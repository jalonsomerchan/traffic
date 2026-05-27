import { SIMULATION_CONFIG } from "./SimulationConfig.js";
import { ROAD_TYPES } from "./RoadManager.js";

const MIN_UPGRADE_COST_RATE = 0.35;
const DIFFERENCE_UPGRADE_COST_RATE = 0.85;

/** Calcula un coste de mejora menor que reconstruir, pero sensible al salto de categoría. */
export function getRoadUpgradeCost(fromType, toType) {
  if (fromType === toType) return 0;
  const current = ROAD_TYPES[fromType];
  const target = ROAD_TYPES[toType];
  if (!current || !target) return 0;
  const costDifference = Math.max(0, target.buildCost - current.buildCost);
  return Math.ceil(Math.max(target.buildCost * MIN_UPGRADE_COST_RATE, costDifference * DIFFERENCE_UPGRADE_COST_RATE));
}

/** Inicia una mejora sin demoler: corta la vía temporalmente y conserva la casilla. */
export function startRoadUpgrade(roadManager, x, y, targetType) {
  const road = roadManager.getRoad(x, y);
  if (!road || !ROAD_TYPES[targetType] || road.type === targetType || road.closedForUpgrade) return false;

  const duration = SIMULATION_CONFIG.roadWorks.upgradeDurationSeconds;
  road.closedForUpgrade = true;
  road.upgradeTargetType = targetType;
  road.upgradeRemainingSeconds = duration;
  road.upgradeTotalSeconds = duration;
  road.trafficClosed = true;
  road.traffic = 0;
  roadManager.dispatchNetworkChanged("upgrade-started", road);
  return true;
}

/** Avanza obras de mejora; tardan más que una reparación y finalizan automáticamente. */
export function updateRoadUpgrades(roadManager, deltaSeconds) {
  for (const road of roadManager.roads.values()) {
    if (!road.closedForUpgrade) continue;
    road.trafficClosed = true;
    road.traffic = 0;
    road.upgradeRemainingSeconds = Math.max(0, road.upgradeRemainingSeconds - deltaSeconds);
    road.health = Math.min(100, road.health + deltaSeconds * SIMULATION_CONFIG.roadWorks.upgradeHealthPerSecond);

    if (road.upgradeRemainingSeconds <= 0) completeRoadUpgrade(roadManager, road);
  }
}

/** Coste mensual extra de obras de mejora activas, superior al coste de reparación. */
export function getActiveUpgradeMonthlyCost(roadManager) {
  let total = 0;
  for (const road of roadManager.roads.values()) {
    if (!road.closedForUpgrade) continue;
    const current = ROAD_TYPES[road.type]?.maintenanceCost ?? 0;
    const target = ROAD_TYPES[road.upgradeTargetType]?.maintenanceCost ?? current;
    total += Math.max(current, target) * SIMULATION_CONFIG.roadWorks.activeUpgradeMonthlyCostMultiplier;
  }
  return Math.ceil(total);
}

function completeRoadUpgrade(roadManager, road) {
  const targetType = road.upgradeTargetType;
  if (ROAD_TYPES[targetType]) {
    road.type = targetType;
    road.speedLimit = ROAD_TYPES[targetType].defaultSpeedLimit;
  }
  road.health = 100;
  road.trafficClosed = false;
  road.closedForUpgrade = false;
  delete road.upgradeTargetType;
  delete road.upgradeRemainingSeconds;
  delete road.upgradeTotalSeconds;
  roadManager.dispatchNetworkChanged("upgrade-completed", road);
}
