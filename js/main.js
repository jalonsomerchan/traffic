import { Grid } from "./Grid.js";
import { ROAD_TYPES, RoadManager } from "./RoadManager.js";
import { TrafficSystem } from "./TrafficSystem.js";
import { Renderer } from "./Renderer.js";
import { UI, getRoadCost } from "./UI.js";
import { Storage } from "./Storage.js";

const canvas = document.querySelector("#game");
const hud = document.querySelector("#hud");
const grid = new Grid();
const roadManager = new RoadManager(grid);
const trafficSystem = new TrafficSystem(grid, roadManager);
const renderer = new Renderer(canvas, grid);
const storage = new Storage();
const MONTHLY_RESIDENT_TAX = 9;

const state = {
  budget: 1800,
  month: 1,
  monthTimer: 0,
  monthLengthSeconds: 18,
  lastStatement: null,
  tool: "twoWay",
  speedLimit: 50,
  selectedCell: null,
  hoverCell: null,
  lastTime: performance.now(),
  running: false,
  dragging: false,
  dragStart: null,
  dragMoved: false,
  timeScale: 1,
};

const ui = new UI(hud, {
  onNewGame: () => {
    resetGame();
    ui.hideStart();
    state.running = true;
    state.timeScale = 1;
  },
  onToolChange: (tool) => {
    state.tool = tool;
  },
  onSpeedLimitChange: (speedLimit) => {
    state.speedLimit = speedLimit;
  },
  onViewModeChange: (viewMode) => {
    renderer.viewMode = viewMode;
  },
  onTransparentBuildingsToggle: () => {
    renderer.buildingsTransparent = !renderer.buildingsTransparent;
  },
  onSave: () => {
    storage.save(serializeGame());
  },
  onDownload: () => {
    storage.save(serializeGame());
    storage.download(serializeGame());
  },
  onLoad: () => {
    const saved = storage.load();
    if (saved) {
      hydrateGame(saved);
      ui.hideStart();
      state.running = true;
    }
  },
  onLoadFile: async (file) => {
    const saved = await storage.loadFile(file);
    if (saved) {
      hydrateGame(saved);
      ui.hideStart();
      state.running = true;
    }
  },
  onZoom: (direction) => {
    renderer.setZoom(renderer.camera.zoom + direction * 0.18);
  },
  onExpand: () => {
    grid.expand(6);
  },
  onTimeScaleChange: (timeScale) => {
    state.timeScale = timeScale;
    state.running = timeScale > 0;
  },
});

seedStarterCity();
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("wheel", handleWheel, { passive: false });
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
requestAnimationFrame(loop);

/** Orquesta update/draw, economía, degradación y crecimiento urbano. */
function loop(now) {
  const deltaSeconds = Math.min(0.05, (now - state.lastTime) / 1000) * state.timeScale;
  state.lastTime = now;

  if (state.running) {
    const trafficCounts = trafficSystem.update(deltaSeconds);
    roadManager.update(deltaSeconds, trafficCounts);
    roadManager.growCity(deltaSeconds);
    state.monthTimer += deltaSeconds;
    if (state.monthTimer >= state.monthLengthSeconds) {
      state.monthTimer -= state.monthLengthSeconds;
      settleMonth();
    }
  }

  renderer.draw({
    roadManager,
    trafficSystem,
    selectedCell: state.selectedCell,
    hoverCell: state.hoverCell,
  });
  ui.update({
    budget: state.budget,
    vehicles: trafficSystem.vehicles.length,
    housing: grid.getHousingCapacity(),
    roads: roadManager.roads.size,
    map: `${grid.width} x ${grid.height}`,
    month: state.month,
    monthProgress: state.monthTimer / state.monthLengthSeconds,
    statement: state.lastStatement,
  });
  requestAnimationFrame(loop);
}

/** Inicia pan de cámara o selección de celda según el gesto del jugador. */
function handlePointerDown(event) {
  canvas.setPointerCapture(event.pointerId);
  updateHoverCell(event);
  state.dragging = true;
  state.dragMoved = false;
  state.dragStart = { x: event.clientX, y: event.clientY, button: event.button };
}

/** Arrastrar mueve la cámara para navegar por planos grandes. */
function handlePointerMove(event) {
  if (!state.dragging) updateHoverCell(event);
  if (!state.dragging || !state.dragStart) return;
  const dx = event.clientX - state.dragStart.x;
  const dy = event.clientY - state.dragStart.y;
  if (Math.abs(dx) + Math.abs(dy) < 3) return;
  renderer.pan(dx, dy);
  state.dragMoved = true;
  state.dragStart = { ...state.dragStart, x: event.clientX, y: event.clientY };
}

/** Un tap construye; un drag solo desplaza el plano. */
function handlePointerUp(event) {
  if (!state.dragging) return;
  state.dragging = false;
  updateHoverCell(event);
  if (!state.dragMoved && event.button !== 2) handleMapAction(event);
}

/** Zoom con rueda del ratón o trackpad sobre el plano. */
function handleWheel(event) {
  event.preventDefault();
  renderer.setZoom(renderer.camera.zoom + (event.deltaY > 0 ? -0.08 : 0.08));
}

/** Convierte clicks/taps sobre canvas en acciones de construcción o control. */
function handleMapAction(event) {
  if (!state.running) return;
  const cell = getPointerCell(event);
  if (!grid.isInside(cell.x, cell.y)) return;
  state.selectedCell = cell;

  if (state.tool === "demolish") {
    const building = grid.demolishBuilding(cell.x, cell.y);
    if (building) {
      const cost = Math.ceil(25 + building.demand * 18);
      state.budget -= cost;
      ui.showMoney(-cost, event.clientX, event.clientY);
    }
    return;
  }

  if (state.tool === "closeRoad") {
    const road = roadManager.getRoad(cell.x, cell.y);
    if (road) roadManager.setTrafficClosed(cell.x, cell.y, !road.trafficClosed);
    return;
  }

  if (state.tool === "removeRoad") {
    if (trafficSystem.hasVehicleOnRoad(cell.x, cell.y)) {
      ui.showNotice("No se puede eliminar: hay tráfico");
      return;
    }
    if (!roadManager.removeRoad(cell.x, cell.y)) ui.showNotice("No hay vía eliminable");
    return;
  }

  if (state.tool === "removeLight") {
    if (!roadManager.removeTrafficLight(cell.x, cell.y)) ui.showNotice("No hay semáforo");
    return;
  }

  if (state.tool in ROAD_TYPES) {
    const cost = getRoadCost(state.tool);
    if (state.budget >= cost && !roadManager.getRoad(cell.x, cell.y)) {
      roadManager.buildRoad(cell.x, cell.y, state.tool);
      state.budget -= cost;
      ui.showMoney(-cost, event.clientX, event.clientY);
    } else if (state.budget < cost) {
      ui.showNotice("No hay presupuesto suficiente");
    } else {
      ui.showNotice("Casilla ocupada");
    }
  }
  if (state.tool === "light") roadManager.placeTrafficLight(cell.x, cell.y);
  if (state.tool === "repair") {
    const road = roadManager.getRoad(cell.x, cell.y);
    if (road) roadManager.setRepair(cell.x, cell.y, !road.closedForRepair);
  }
  if (state.tool === "direction") roadManager.rotateDirection(cell.x, cell.y);
  const road = roadManager.getRoad(cell.x, cell.y);
  if (road) roadManager.setSpeedLimit(cell.x, cell.y, state.speedLimit);
}

function updateHoverCell(event) {
  const cell = getPointerCell(event);
  state.hoverCell = grid.isInside(cell.x, cell.y) ? cell : null;
}

function getPointerCell(event) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const screenX = (event.clientX - rect.left) * ratio;
  const screenY = (event.clientY - rect.top) * ratio;
  return grid.screenToIso(screenX, screenY, renderer.origin, renderer.camera.zoom);
}

/** Crea una red mínima para que el simulador tenga tráfico desde el primer frame. */
function seedStarterCity() {
  for (let x = 0; x <= 12; x += 1) roadManager.buildRoad(x, 8, x < 4 ? "highway" : "twoWay");
  for (let y = 5; y <= 12; y += 1) roadManager.buildRoad(8, y, "twoWay");
  roadManager.buildRoad(8, 8, "roundabout");
  roadManager.placeTrafficLight(8, 8);
  grid.setBuilding(4, 7, { kind: 0, demand: 3, createdAt: performance.now() });
  grid.setBuilding(7, 7, { kind: 1, demand: 4, createdAt: performance.now() });
  grid.setBuilding(9, 9, { kind: 2, demand: 3, createdAt: performance.now() });
}

/** Limpia partida, preservando el mapa grande y una ciudad semilla. */
function resetGame() {
  state.budget = 2400;
  state.month = 1;
  state.monthTimer = 0;
  state.lastStatement = null;
  state.selectedCell = null;
  grid.width = 28;
  grid.height = 28;
  grid.cells.clear();
  roadManager.roads.clear();
  trafficSystem.vehicles = [];
  trafficSystem.pathCache.clear();
  trafficSystem.completedTrips = 0;
  trafficSystem.spawnTimer = 0;
  trafficSystem.edgeSpawnTimer = 0;
  seedStarterCity();
}

/** Liquida ingresos y gastos en bloque para que la economía sea legible. */
function settleMonth() {
  const housing = grid.getHousingCapacity();
  const completedTrips = trafficSystem.completedTrips;
  const costs = roadManager.getMonthlyCostBreakdown();
  const populationIncome = Math.floor(housing * MONTHLY_RESIDENT_TAX);
  const tripIncome = trafficSystem.consumeTaxRevenue();
  const roadMaintenance = costs.maintenance;
  const repairCost = costs.repair;
  const balance = populationIncome + tripIncome - roadMaintenance - repairCost;
  state.budget += balance;
  state.month += 1;
  state.lastStatement = {
    month: state.month - 1,
    housing,
    completedTrips,
    roads: costs.roads,
    repairCount: costs.repairCount,
    populationIncome,
    tripIncome,
    roadMaintenance,
    repairCost,
    balance,
  };
  ui.showMoney(balance, window.innerWidth * 0.46, window.innerHeight * 0.28);
}

/** Reúne todos los subsistemas en un JSON completo y portable. */
function serializeGame() {
  return {
    budget: state.budget,
    month: state.month,
    monthTimer: state.monthTimer,
    lastStatement: state.lastStatement,
    timeScale: state.timeScale,
    viewMode: renderer.viewMode,
    camera: renderer.camera,
    grid: grid.toJSON(),
    roads: roadManager.toJSON(),
    traffic: trafficSystem.toJSON(),
  };
}

/** Restaura partida manteniendo referencias internas coherentes. */
function hydrateGame(saved) {
  state.budget = saved.budget ?? state.budget;
  state.month = saved.month ?? state.month;
  state.monthTimer = saved.monthTimer ?? 0;
  state.lastStatement = saved.lastStatement ?? null;
  state.timeScale = saved.timeScale ?? state.timeScale;
  state.running = state.timeScale > 0;
  renderer.viewMode = saved.viewMode ?? renderer.viewMode;
  if (saved.camera) renderer.camera = { ...renderer.camera, ...saved.camera };
  grid.width = saved.grid?.width ?? grid.width;
  grid.height = saved.grid?.height ?? grid.height;
  grid.cells.clear();
  roadManager.roads.clear();
  for (const road of saved.roads ?? []) {
    const restored = roadManager.buildRoad(road.x, road.y, road.type);
    Object.assign(restored, road);
  }
  for (const cell of saved.grid?.cells ?? []) {
    if (cell.building) grid.setBuilding(cell.x, cell.y, cell.building);
  }
  trafficSystem.vehicles = saved.traffic?.vehicles ?? [];
  trafficSystem.completedTrips = saved.traffic?.completedTrips ?? 0;
  trafficSystem.edgeSpawnTimer = saved.traffic?.edgeSpawnTimer ?? 0;
  trafficSystem.spawnTimer = saved.traffic?.spawnTimer ?? 0;
  trafficSystem.pathCache.clear();
}
