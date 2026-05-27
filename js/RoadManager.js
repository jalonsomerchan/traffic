import { SIMULATION_CONFIG } from "./SimulationConfig.js";

export const ROAD_TYPES = {
  dirt: {
    label: "dirt",
    capacity: 3,
    buildCost: 25,
    maintenanceCost: 0.2,
    defaultSpeedLimit: 20,
    trafficAllowed: true,
    atlasIndex: 0,
  },
  gravelRoad: {
    label: "gravelRoad",
    capacity: 5,
    buildCost: 95,
    maintenanceCost: 0.45,
    defaultSpeedLimit: 20,
    trafficAllowed: true,
    atlasIndex: 0,
  },
  concretePath: {
    label: "concretePath",
    capacity: 7,
    buildCost: 210,
    maintenanceCost: 0.85,
    defaultSpeedLimit: 20,
    trafficAllowed: true,
    atlasIndex: 1,
  },
  stonePath: {
    label: "stonePath",
    capacity: 9,
    buildCost: 420,
    maintenanceCost: 1.2,
    defaultSpeedLimit: 20,
    trafficAllowed: true,
    atlasIndex: 2,
  },
  pedestrian: {
    label: "pedestrian",
    capacity: 0,
    buildCost: 650,
    maintenanceCost: 1.8,
    defaultSpeedLimit: 20,
    trafficAllowed: false,
    atlasIndex: 3,
  },
  oneWay: {
    label: "oneWay",
    capacity: 13,
    buildCost: 980,
    maintenanceCost: 2.6,
    defaultSpeedLimit: 30,
    trafficAllowed: true,
    oneWay: true,
    atlasIndex: 4,
  },
  twoWay: {
    label: "twoWay",
    capacity: 18,
    buildCost: 1800,
    maintenanceCost: 4.2,
    defaultSpeedLimit: 50,
    trafficAllowed: true,
    atlasIndex: 5,
  },
  cityRoad: {
    label: "cityRoad",
    capacity: 26,
    buildCost: 3200,
    maintenanceCost: 6.8,
    defaultSpeedLimit: 50,
    trafficAllowed: true,
    atlasIndex: 5,
  },
  premiumRoad: {
    label: "premiumRoad",
    capacity: 34,
    buildCost: 5600,
    maintenanceCost: 10.5,
    defaultSpeedLimit: 50,
    trafficAllowed: true,
    atlasIndex: 6,
  },
  avenue: {
    label: "avenue",
    capacity: 48,
    buildCost: 9800,
    maintenanceCost: 17.5,
    defaultSpeedLimit: 50,
    trafficAllowed: true,
    atlasIndex: 7,
  },
  boulevard: {
    label: "boulevard",
    capacity: 64,
    buildCost: 15500,
    maintenanceCost: 26,
    defaultSpeedLimit: 50,
    trafficAllowed: true,
    atlasIndex: 7,
  },
  premiumAvenue: {
    label: "premiumAvenue",
    capacity: 82,
    buildCost: 24500,
    maintenanceCost: 39,
    defaultSpeedLimit: 80,
    trafficAllowed: true,
    atlasIndex: 8,
  },
  expressway: {
    label: "expressway",
    capacity: 115,
    buildCost: 39000,
    maintenanceCost: 61,
    defaultSpeedLimit: 80,
    trafficAllowed: true,
    atlasIndex: 9,
  },
  highway: {
    label: "highway",
    capacity: 160,
    buildCost: 62000,
    maintenanceCost: 94,
    defaultSpeedLimit: 80,
    trafficAllowed: true,
    atlasIndex: 9,
  },
  megaHighway: {
    label: "megaHighway",
    capacity: 240,
    buildCost: 120000,
    maintenanceCost: 170,
    defaultSpeedLimit: 80,
    trafficAllowed: true,
    atlasIndex: 9,
  },
  roundabout: {
    label: "roundabout",
    capacity: 58,
    buildCost: 13500,
    maintenanceCost: 22,
    defaultSpeedLimit: 30,
    trafficAllowed: true,
    atlasIndex: 10,
  },
};

export const SPEED_LIMITS = [20, 30, 50, 80];

export class RoadManager extends EventTarget {
  /**
   * Controla la infraestructura y actúa como frontera clara con TrafficSystem.
   * Emite eventos cuando cambia la red para que A* invalide rutas cacheadas.
   */
  constructor(grid) {
    super();
    this.grid = grid;
    this.roads = new Map();
    this.cityGrowthTimer = 0;
    this.buildingStressTimer = 0;
  }

  /** Construye una carretera si la celda está dentro del mapa y vacía. */
  buildRoad(x, y, type = "twoWay") {
    if (!this.grid.isInside(x, y) || !ROAD_TYPES[type]) return null;
    const key = this.grid.key(x, y);
    const existing = this.roads.get(key);
    if (existing) return existing;
    const road = {
      x,
      y,
      type,
      health: 100,
      traffic: 0,
      trafficWear: 0,
      closedForRepair: false,
      trafficClosed: false,
      speedLimit: ROAD_TYPES[type].defaultSpeedLimit,
      trafficLight: null,
      direction: "east",
    };
    this.roads.set(key, road);
    this.grid.clearBuilding(x, y);
    this.grid.setRoad(x, y, road);
    this.dispatchNetworkChanged("road-built", road);
    return road;
  }

  getRoad(x, y) {
    return this.roads.get(this.grid.key(x, y)) ?? null;
  }

  /** Cerrar por reparación elimina el segmento de las rutas y regenera A*. */
  setRepair(x, y, closedForRepair) {
    const road = this.getRoad(x, y);
    if (!road || road.closedForConstruction || road.closedForUpgrade) return;
    road.closedForRepair = closedForRepair;
    if (closedForRepair) {
      road.trafficClosed = false;
      road.traffic = 0;
    }
    this.dispatchNetworkChanged("repair-toggled", road);
  }

  /** Cierra o abre una vía al tráfico sin repararla. */
  setTrafficClosed(x, y, trafficClosed) {
    const road = this.getRoad(x, y);
    if (!road || road.closedForRepair || road.closedForConstruction || road.closedForUpgrade) return false;
    road.trafficClosed = trafficClosed;
    if (trafficClosed) road.traffic = 0;
    this.dispatchNetworkChanged("traffic-closed-toggled", road);
    return true;
  }

  /** Elimina una carretera solo si no tiene tráfico activo. */
  removeRoad(x, y) {
    const road = this.getRoad(x, y);
    if (!road || road.traffic > 0) return false;
    this.roads.delete(this.grid.key(x, y));
    this.grid.clearRoad(x, y);
    this.dispatchNetworkChanged("road-removed", road);
    return true;
  }

  /** Quita un semáforo sin alternar uno nuevo accidentalmente. */
  removeTrafficLight(x, y) {
    const road = this.getRoad(x, y);
    if (!road?.trafficLight) return false;
    road.trafficLight = null;
    this.dispatchNetworkChanged("traffic-light-removed", road);
    return true;
  }

  /** Alterna semáforos en nodos de vía; la fase afecta al coste efectivo. */
  placeTrafficLight(x, y) {
    const road = this.getRoad(x, y);
    if (!road) return;
    road.trafficLight = road.trafficLight
      ? null
      : { phase: "green", timer: 0, greenTime: 5, redTime: 3 };
    this.dispatchNetworkChanged("traffic-light-changed", road);
  }

  /** Cambia el límite de velocidad manteniéndolo en un rango jugable. */
  setSpeedLimit(x, y, speedLimit) {
    const road = this.getRoad(x, y);
    if (!road) return;
    if (!SPEED_LIMITS.includes(speedLimit)) return;
    road.speedLimit = speedLimit;
    this.dispatchNetworkChanged("speed-limit-changed", road);
  }

  /** Rota el sentido único para que el jugador pueda orientar segmentos. */
  rotateDirection(x, y) {
    const road = this.getRoad(x, y);
    if (!road) return;
    const directions = ["east", "south", "west", "north"];
    const next = (directions.indexOf(road.direction) + 1) % directions.length;
    road.direction = directions[next];
    this.dispatchNetworkChanged("direction-changed", road);
  }

  /**
   * Aplica degradación por tráfico, reparación progresiva y fases de semáforo.
   * Recibe conteos desde TrafficSystem para mantener dependencias explícitas.
   */
  update(deltaSeconds, trafficCounts) {
    for (const road of this.roads.values()) {
      road.traffic = trafficCounts.get(this.grid.key(road.x, road.y)) ?? 0;
      road.trafficWear = road.trafficWear ?? 0;
      this.updateTrafficLight(road, deltaSeconds);

      if (road.closedForRepair) {
        road.health = Math.min(100, road.health + deltaSeconds * SIMULATION_CONFIG.roadWorks.repairHealthPerSecond);
        road.traffic = 0;
        road.trafficWear = Math.max(0, road.trafficWear - deltaSeconds * SIMULATION_CONFIG.roadWear.accumulatedTrafficDecayPerSecond);
        if (road.health >= 100) {
          road.closedForRepair = false;
          road.trafficWear = 0;
          this.dispatchNetworkChanged("repair-completed", road);
        }
        continue;
      }

      this.applyTrafficWear(road, deltaSeconds);
    }
    this.updateBuildingPressure(deltaSeconds);
  }

  applyTrafficWear(road, deltaSeconds) {
    const config = SIMULATION_CONFIG.roadWear;
    if (road.traffic <= 0) {
      road.trafficWear = Math.max(0, road.trafficWear - deltaSeconds * config.accumulatedTrafficDecayPerSecond);
      return;
    }

    const capacity = Math.max(1, ROAD_TYPES[road.type].capacity);
    const pressure = road.traffic / capacity;
    road.trafficWear += road.traffic * deltaSeconds;
    const accumulatedPressure = road.trafficWear / capacity;
    const wear =
      config.baseWearPerSecondWithTraffic +
      config.wearPerVehicleSecond * road.traffic +
      config.overloadWearMultiplier * pressure * accumulatedPressure;
    road.health = Math.max(0, road.health - deltaSeconds * wear);
  }

  /** Calcula velocidad real combinando estado, reparación, señales y congestión. */
  getEffectiveSpeed(road) {
    if (!road || road.closedForRepair || road.closedForConstruction || road.closedForUpgrade || road.trafficClosed) return 0;
    const definition = ROAD_TYPES[road.type];
    if (!definition?.trafficAllowed) return 0;
    const healthPenalty = road.health < 20 ? 0.18 : road.health < 50 ? 0.5 : road.health < 75 ? 0.78 : 1;
    const signalPenalty = road.trafficLight?.phase === "red" ? 0.2 : 1;
    const roundaboutPenalty = road.type === "roundabout" ? 0.68 : 1;
    const overload = road.traffic / Math.max(1, definition.capacity);
    const congestionPenalty = Math.max(0.12, 1 - overload ** 1.35);
    return (road.speedLimit / 50) * healthPenalty * signalPenalty * roundaboutPenalty * congestionPenalty;
  }

  /** Determina si A* puede atravesar un segmento hacia un vecino concreto. */
  canTravel(fromRoad, toRoad) {
    if (!fromRoad || !toRoad) return false;
    const fromType = ROAD_TYPES[fromRoad.type];
    const toType = ROAD_TYPES[toRoad.type];
    if (!fromType?.trafficAllowed || !toType?.trafficAllowed) return false;
    if (
      fromRoad.closedForRepair ||
      toRoad.closedForRepair ||
      fromRoad.closedForConstruction ||
      toRoad.closedForConstruction ||
      fromRoad.closedForUpgrade ||
      toRoad.closedForUpgrade ||
      fromRoad.trafficClosed ||
      toRoad.trafficClosed
    ) {
      return false;
    }
    if (!fromType.oneWay) return true;
    const dx = toRoad.x - fromRoad.x;
    const dy = toRoad.y - fromRoad.y;
    return (
      (fromRoad.direction === "east" && dx === 1 && dy === 0) ||
      (fromRoad.direction === "west" && dx === -1 && dy === 0) ||
      (fromRoad.direction === "south" && dx === 0 && dy === 1) ||
      (fromRoad.direction === "north" && dx === 0 && dy === -1)
    );
  }

  /** Suma el mantenimiento por segundo; reparar cuesta más pero recupera salud. */
  getMaintenanceCostPerSecond() {
    let total = 0;
    for (const road of this.roads.values()) {
      const multiplier = road.closedForRepair ? 2.5 : 1;
      total += ROAD_TYPES[road.type].maintenanceCost * multiplier;
    }
    return total;
  }

  /** Coste mensual adicional de reparaciones activas. */
  getRepairCostPerMonth() {
    let total = 0;
    for (const road of this.roads.values()) {
      if (road.closedForRepair) total += ROAD_TYPES[road.type].maintenanceCost * 18;
    }
    return total;
  }

  /** Desglose mensual para que la economía sea transparente en el HUD. */
  getMonthlyCostBreakdown() {
    let maintenance = 0;
    let repair = 0;
    let repairCount = 0;
    for (const road of this.roads.values()) {
      const base = ROAD_TYPES[road.type].maintenanceCost;
      maintenance += base * 7;
      if (road.closedForRepair) {
        repair += base * 18;
        repairCount += 1;
      }
    }
    return {
      maintenance: Math.ceil(maintenance),
      repair: Math.ceil(repair),
      roads: this.roads.size,
      repairCount,
    };
  }

  /**
   * Simula crecimiento urbano: los edificios nacen junto a vías existentes.
   * Su demanda alimenta nuevos viajes y hace que la ciudad se vuelva viva.
   */
  growCity(deltaSeconds) {
    this.cityGrowthTimer += deltaSeconds;
    if (this.cityGrowthTimer < 2.8) return [];
    this.cityGrowthTimer = 0;

    const grown = [];
    const connectedKeys = this.getMainNetworkKeys();
    for (const road of this.roads.values()) {
      if (!connectedKeys.has(this.grid.key(road.x, road.y))) continue;
      if (Math.random() > 0.18) continue;
      for (const neighbor of this.grid.getNeighbors(road.x, road.y)) {
        if (
          !neighbor.road &&
          !neighbor.building &&
          this.hasAdjacentMainRoad(neighbor.x, neighbor.y, connectedKeys) &&
          this.getLocalTrafficPressure(neighbor.x, neighbor.y) < 0.72
        ) {
          const density = Math.max(1, ROAD_TYPES[road.type].capacity / 8);
          const building = {
            kind: Math.floor(Math.random() * 6),
            demand: Math.ceil(1 + Math.random() * density),
            createdAt: performance.now(),
          };
          this.grid.setBuilding(neighbor.x, neighbor.y, building);
          grown.push({ x: neighbor.x, y: neighbor.y, ...building });
          break;
        }
      }
    }
    if (grown.length) this.dispatchEvent(new CustomEvent("city-grown", { detail: grown }));
    return grown;
  }

  /** La congestión sostenida reduce demanda residencial y puede vaciar edificios. */
  updateBuildingPressure(deltaSeconds) {
    this.buildingStressTimer += deltaSeconds;
    if (this.buildingStressTimer < 3) return;
    this.buildingStressTimer = 0;

    for (const cell of this.grid.cells.values()) {
      if (!cell.building) continue;
      const pressure = this.getLocalTrafficPressure(cell.x, cell.y);
      cell.building.trafficStress = cell.building.trafficStress ?? 0;
      if (pressure > 0.9) {
        cell.building.trafficStress += pressure;
      } else {
        cell.building.trafficStress = Math.max(0, cell.building.trafficStress - 0.65);
      }
      if (cell.building.trafficStress >= 2.6) {
        cell.building.demand -= 1;
        cell.building.trafficStress = 0.8;
        if (cell.building.demand <= 0) this.grid.demolishBuilding(cell.x, cell.y);
      }
    }
  }

  /** Presión local normalizada usada para crecimiento urbano y conservación. */
  getLocalTrafficPressure(x, y) {
    const pressures = this.grid.getNeighbors(x, y)
      .map((neighbor) => neighbor.road)
      .filter(Boolean)
      .map((road) => road.traffic / Math.max(1, ROAD_TYPES[road.type].capacity));
    return pressures.length ? Math.max(...pressures) : 0;
  }

  /** Devuelve la red conectada a cualquier entrada regional del borde. */
  getMainNetworkKeys() {
    const entries = this.getEdgeConnections();
    const visited = new Set();
    const queue = entries.map((road) => this.grid.key(road.x, road.y));

    while (queue.length) {
      const key = queue.shift();
      if (visited.has(key)) continue;
      const road = this.roads.get(key);
      if (!road || !ROAD_TYPES[road.type]?.trafficAllowed || road.closedForRepair || road.closedForConstruction || road.closedForUpgrade) continue;
      visited.add(key);
      for (const neighbor of this.grid.getNeighbors(road.x, road.y)) {
        if (neighbor.road && this.canTravel(road, neighbor.road)) {
          queue.push(this.grid.key(neighbor.road.x, neighbor.road.y));
        }
      }
    }
    return visited;
  }

  hasAdjacentMainRoad(x, y, connectedKeys = this.getMainNetworkKeys()) {
    return this.grid.getNeighbors(x, y).some((neighbor) => {
      return neighbor.road && connectedKeys.has(this.grid.key(neighbor.road.x, neighbor.road.y));
    });
  }

  /** Detecta carreteras conectadas al borde del mapa: entradas/salidas regionales. */
  getEdgeConnections() {
    return [...this.roads.values()].filter((road) => {
      const definition = ROAD_TYPES[road.type];
      return (
        definition?.trafficAllowed &&
        !road.closedForRepair &&
        !road.closedForConstruction &&
        !road.closedForUpgrade &&
        (road.x === 0 || road.y === 0 || road.x === this.grid.width - 1 || road.y === this.grid.height - 1)
      );
    });
  }

  /** Avanza el ciclo verde/rojo de un semáforo individual. */
  updateTrafficLight(road, deltaSeconds) {
    if (!road.trafficLight) return;
    const light = road.trafficLight;
    light.timer += deltaSeconds;
    if (light.phase === "green" && light.timer >= light.greenTime) {
      light.phase = "red";
      light.timer = 0;
    } else if (light.phase === "red" && light.timer >= light.redTime) {
      light.phase = "green";
      light.timer = 0;
    }
  }

  /** Notifica cambios de red a consumidores como TrafficSystem. */
  dispatchNetworkChanged(type, road) {
    this.dispatchEvent(new CustomEvent("network-changed", { detail: { type, road } }));
  }

  /** Serializa carreteras con salud, tráfico, señales y reparación. */
  toJSON() {
    return [...this.roads.values()];
  }
}
