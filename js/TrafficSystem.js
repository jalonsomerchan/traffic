import { ROAD_TYPES } from "./RoadManager.js";
import { SIMULATION_CONFIG } from "./SimulationConfig.js";

export class TrafficSystem {
  /**
   * Gestiona vehículos, demanda y pathfinding.
   * No modifica carreteras directamente: consulta RoadManager y responde a eventos.
   */
  constructor(grid, roadManager) {
    this.grid = grid;
    this.roadManager = roadManager;
    this.vehicles = [];
    this.pathCache = new Map();
    this.spawnTimer = 0;
    this.edgeSpawnTimer = 0;
    this.completedTrips = 0;
    this.taxPerTrip = 18;
    this.detours = 0;
    this.blockedRoutes = 0;
    this.roadManager.addEventListener("network-changed", (event) => this.handleNetworkChanged(event.detail));
  }

  /** Tick principal: crea viajes, mueve vehículos y devuelve conteos por vía. */
  update(deltaSeconds) {
    const demand = this.getHousingTrafficDemand();
    this.spawnTimer += deltaSeconds * demand.internalFactor;
    this.edgeSpawnTimer += deltaSeconds * demand.externalFactor;
    if (this.spawnTimer > SIMULATION_CONFIG.trafficDemand.internalSpawnIntervalSeconds) {
      this.spawnTimer = 0;
      this.spawnVehicleFromDemand();
    }
    if (this.edgeSpawnTimer > SIMULATION_CONFIG.trafficDemand.externalSpawnIntervalSeconds) {
      this.edgeSpawnTimer = 0;
      this.spawnVehicleFromEdgeConnection();
    }
    this.moveVehicles(deltaSeconds);
    return this.collectTrafficCounts();
  }

  getHousingTrafficDemand() {
    const housing = this.grid.getHousingCapacity();
    const config = SIMULATION_CONFIG.trafficDemand;
    return {
      housing,
      internalFactor: clamp01(housing / Math.max(1, config.housingForFullInternalTraffic)),
      externalFactor: housing > 0
        ? Math.max(config.minimumExternalTrafficFactor, clamp01(housing / Math.max(1, config.housingForFullExternalTraffic)))
        : config.minimumExternalTrafficFactor * 0.25,
    };
  }

  /** Convierte demanda de edificios cercanos a carreteras en vehículos nuevos. */
  spawnVehicleFromDemand() {
    const sources = [...this.grid.cells.values()].filter((cell) => cell.building);
    const roads = [...this.roadManager.roads.values()].filter((road) => this.roadManager.getEffectiveSpeed(road) > 0);
    if (sources.length < 1 || roads.length < 2) return;

    const source = weightedPick(sources, (cell) => cell.building.demand);
    const nearestRoad = this.findNearestRoad(source.x, source.y);
    const destination = roads[Math.floor(Math.random() * roads.length)];
    if (!nearestRoad || nearestRoad === destination) return;

    const path = this.findPath(nearestRoad, destination);
    if (path.length < 2) return;
    this.vehicles.push({ path, index: 0, progress: 0, speed: 1, color: pickVehicleColor() });
  }

  /** Genera tráfico externo desde las conexiones al borde del mapa. */
  spawnVehicleFromEdgeConnection() {
    const entries = this.roadManager.getEdgeConnections();
    const destinations = [...this.roadManager.roads.values()].filter((road) => this.roadManager.getEffectiveSpeed(road) > 0);
    if (!entries.length || destinations.length < 2) return;
    const start = weightedPick(entries, (road) => 1 + road.traffic * 0.25);
    const goal = destinations[Math.floor(Math.random() * destinations.length)];
    if (start === goal) return;
    const path = this.findPath(start, goal);
    if (path.length < 2) return;
    this.vehicles.push({ path, index: 0, progress: 0, speed: 1, color: pickVehicleColor(), external: true });
  }

  /** Avanza cada vehículo, evitando entrar en vías cerradas y manteniendo esperas. */
  moveVehicles(deltaSeconds) {
    for (let i = this.vehicles.length - 1; i >= 0; i -= 1) {
      const vehicle = this.vehicles[i];
      const current = vehicle.path[vehicle.index];
      const next = vehicle.path[Math.min(vehicle.index + 1, vehicle.path.length - 1)];
      if (!current) {
        this.vehicles.splice(i, 1);
        continue;
      }

      if (vehicle.waitingFor) {
        this.retryWaitingVehicle(vehicle);
        vehicle.speed = 0;
        continue;
      }

      const nextRoad = this.roadManager.getRoad(next?.x, next?.y);
      if (next && !sameCell(current, next) && !this.canEnterRoad(nextRoad)) {
        this.waitOrReroute(vehicle, next);
        continue;
      }

      const road = this.roadManager.getRoad(current.x, current.y);
      vehicle.speed = this.getVehicleSpeedForCurrentRoad(road, nextRoad);
      if (vehicle.speed <= 0) {
        this.waitOrReroute(vehicle, current);
        continue;
      }
      vehicle.progress += deltaSeconds * vehicle.speed * 1.35;

      while (vehicle.progress >= 1) {
        vehicle.progress -= 1;
        vehicle.index += 1;
        vehicle.waitingFor = null;
        vehicle.waitNotified = false;
        if (vehicle.index >= vehicle.path.length - 1) {
          this.vehicles.splice(i, 1);
          this.completedTrips += 1;
          break;
        }
      }
    }
  }

  getVehicleSpeedForCurrentRoad(road, nextRoad) {
    const speed = this.roadManager.getEffectiveSpeed(road);
    if (speed > 0) return speed;
    if (this.isClosedButExitAllowed(road) && this.canEnterRoad(nextRoad)) return 0.55;
    return 0;
  }

  isClosedButExitAllowed(road) {
    return Boolean(road?.closedForRepair || road?.closedForConstruction || road?.closedForUpgrade || road?.trafficClosed);
  }

  canEnterRoad(road) {
    return this.roadManager.getEffectiveSpeed(road) > 0;
  }

  waitOrReroute(vehicle, blockedCell) {
    const current = vehicle.path[vehicle.index];
    const destination = vehicle.path[vehicle.path.length - 1];
    const reroute = this.findAlternativePath(current, destination, blockedCell);
    if (reroute.length > 1) {
      this.applyReroute(vehicle, reroute);
      return;
    }
    this.keepVehicleWaiting(vehicle, blockedCell);
  }

  retryWaitingVehicle(vehicle) {
    const current = vehicle.path[vehicle.index];
    const destination = vehicle.path[vehicle.path.length - 1];
    const blockedCell = vehicle.waitingFor;
    const reroute = this.findAlternativePath(current, destination, blockedCell);
    if (reroute.length > 1) {
      this.applyReroute(vehicle, reroute);
      return;
    }
    const blockedRoad = this.roadManager.getRoad(blockedCell.x, blockedCell.y);
    if (this.canEnterRoad(blockedRoad)) {
      vehicle.waitingFor = null;
      vehicle.waitNotified = false;
    }
  }

  keepVehicleWaiting(vehicle, blockedCell) {
    vehicle.waitingFor = { x: blockedCell.x, y: blockedCell.y };
    vehicle.progress = 0;
    vehicle.speed = 0;
    if (!vehicle.waitNotified) {
      vehicle.waitNotified = true;
      this.blockedRoutes += 1;
      this.dispatchIncident("blocked-route", vehicle.path[vehicle.index]);
    }
  }

  /** Usado por demolición: no se puede quitar una vía con vehículos sobre ella. */
  hasVehicleOnRoad(x, y) {
    return this.vehicles.some((vehicle) => vehicleTouchesRoad(vehicle, x, y));
  }

  /** Agrupa vehículos por celda para degradación, heatmap y congestión. */
  collectTrafficCounts() {
    const counts = new Map();
    for (const vehicle of this.vehicles) {
      const cell = vehicle.path[Math.min(vehicle.index, vehicle.path.length - 1)];
      const key = this.grid.key(cell.x, cell.y);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  /** Responde a cierres buscando rutas alternativas antes de retirar vehículos. */
  handleNetworkChanged(detail) {
    this.pathCache.clear();
    const road = detail?.road;
    if (!road) return;
    if (detail.type === "road-removed") {
      this.clearVehiclesFromRoad(road.x, road.y);
      return;
    }
    const shouldReroute = road.closedForRepair || road.closedForConstruction || road.closedForUpgrade || road.trafficClosed || this.roadManager.getEffectiveSpeed(road) <= 0;
    if (shouldReroute) this.rerouteVehiclesBeforeRoad(road.x, road.y);
  }

  rerouteVehiclesBeforeRoad(x, y) {
    for (const vehicle of this.vehicles) {
      const next = vehicle.path[Math.min(vehicle.index + 1, vehicle.path.length - 1)];
      if (!sameCell(next, { x, y })) continue;
      this.waitOrReroute(vehicle, { x, y });
    }
  }

  applyReroute(vehicle, path) {
    vehicle.path = path;
    vehicle.index = 0;
    vehicle.progress = 0;
    vehicle.waitingFor = null;
    vehicle.waitNotified = false;
    this.detours += 1;
    this.dispatchIncident("detour", path[0]);
  }

  clearVehiclesFromRoad(x, y) {
    this.vehicles = this.vehicles.filter((vehicle) => !vehicleTouchesRoad(vehicle, x, y));
  }

  consumeTrafficIncidents() {
    const incidents = {
      detours: this.detours,
      blockedRoutes: this.blockedRoutes,
    };
    this.detours = 0;
    this.blockedRoutes = 0;
    return incidents;
  }

  dispatchIncident(type, cell) {
    this.roadManager.dispatchEvent(new CustomEvent("traffic-incident", { detail: { type, cell } }));
  }

  /** Entrega al bucle principal los impuestos generados por viajes completados. */
  consumeTaxRevenue() {
    const revenue = this.completedTrips * this.taxPerTrip;
    this.completedTrips = 0;
    return revenue;
  }

  /** Busca el segmento más cercano a un edificio para iniciar un viaje. */
  findNearestRoad(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const road of this.roadManager.roads.values()) {
      const distance = Math.abs(road.x - x) + Math.abs(road.y - y);
      if (distance < bestDistance && this.roadManager.getEffectiveSpeed(road) > 0) {
        best = road;
        bestDistance = distance;
      }
    }
    return best;
  }

  findAlternativePath(start, goal, blockedCell = null) {
    if (!start || !goal) return [];
    const startRoad = this.roadManager.getRoad(start.x, start.y);
    if (this.roadManager.getEffectiveSpeed(startRoad) > 0) {
      return this.findPath(start, goal, { bypassCache: true, blockedCell });
    }

    const starts = this.grid.getNeighbors(start.x, start.y)
      .map((neighbor) => neighbor.road)
      .filter((road) => road && this.roadManager.getEffectiveSpeed(road) > 0 && !sameCell(road, blockedCell));

    let bestPath = [];
    for (const road of starts) {
      const candidate = this.findPath(road, goal, { bypassCache: true, blockedCell });
      if (candidate.length > 1 && (!bestPath.length || candidate.length < bestPath.length)) bestPath = candidate;
    }
    return bestPath;
  }

  /**
   * A* sobre celdas con carretera.
   * El coste penaliza reparación, mala salud, semáforos y congestión actual.
   */
  findPath(start, goal, options = {}) {
    const cacheKey = `${start.x},${start.y}->${goal.x},${goal.y}`;
    if (!options.bypassCache && this.pathCache.has(cacheKey)) return this.pathCache.get(cacheKey);

    const open = [{ x: start.x, y: start.y, cost: 0, score: 0, parent: null }];
    const visited = new Map();

    while (open.length) {
      open.sort((a, b) => a.score - b.score);
      const current = open.shift();
      const currentKey = this.grid.key(current.x, current.y);
      if (visited.has(currentKey)) continue;
      visited.set(currentKey, current);

      if (current.x === goal.x && current.y === goal.y) {
        const path = reconstructPath(current);
        if (!options.bypassCache) this.pathCache.set(cacheKey, path);
        return path;
      }

      for (const neighbor of this.grid.getNeighbors(current.x, current.y)) {
        const road = neighbor.road;
        const fromRoad = this.roadManager.getRoad(current.x, current.y);
        if (
          !road ||
          sameCell(road, options.blockedCell) ||
          !this.roadManager.canTravel(fromRoad, road) ||
          visited.has(this.grid.key(road.x, road.y))
        ) {
          continue;
        }
        const speed = Math.max(0.08, this.roadManager.getEffectiveSpeed(road));
        const trafficCost = 1 + road.traffic / Math.max(1, ROAD_TYPES[road.type].capacity);
        const nextCost = current.cost + trafficCost / speed;
        open.push({
          x: road.x,
          y: road.y,
          cost: nextCost,
          score: nextCost + manhattan(road, goal),
          parent: current,
        });
      }
    }

    return [];
  }

  /** Exporta vehículos en curso para guardado JSON. */
  toJSON() {
    return {
      vehicles: this.vehicles,
      completedTrips: this.completedTrips,
      spawnTimer: this.spawnTimer,
      edgeSpawnTimer: this.edgeSpawnTimer,
      detours: this.detours,
      blockedRoutes: this.blockedRoutes,
    };
  }
}

function vehicleTouchesRoad(vehicle, x, y) {
  const current = vehicle.path[vehicle.index];
  const next = vehicle.path[Math.min(vehicle.index + 1, vehicle.path.length - 1)];
  return (current?.x === x && current?.y === y) || (next?.x === x && next?.y === y);
}

function sameCell(a, b) {
  return a && b && a.x === b.x && a.y === b.y;
}

function reconstructPath(node) {
  const path = [];
  let current = node;
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function weightedPick(items, weight) {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= weight(item);
    if (cursor <= 0) return item;
  }
  return items[0];
}

function pickVehicleColor() {
  return ["#f7f0d4", "#e2533f", "#3977d8", "#f0b33f", "#2f3c46"][Math.floor(Math.random() * 5)];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
