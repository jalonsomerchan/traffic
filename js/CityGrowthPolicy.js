import { ROAD_TYPES } from "./RoadManager.js";
import { SIMULATION_CONFIG } from "./SimulationConfig.js";

/** Instala una política de crecimiento más lenta y sensible a accesibilidad. */
export function installCityGrowthPolicy(RoadManagerClass) {
  RoadManagerClass.prototype.growCity = function growCityWithAccessibility(deltaSeconds) {
    const config = SIMULATION_CONFIG.cityGrowth;
    this.cityGrowthTimer += deltaSeconds;
    if (this.cityGrowthTimer < config.intervalSeconds) return [];
    this.cityGrowthTimer = 0;

    const grown = [];
    const connectedKeys = this.getMainNetworkKeys();
    for (const road of this.roads.values()) {
      if (!connectedKeys.has(this.grid.key(road.x, road.y))) continue;

      const accessibility = getRoadAccessibility(this, road, connectedKeys);
      const trafficPressure = this.getLocalTrafficPressure(road.x, road.y);
      if (trafficPressure > config.maxLocalTrafficPressure) continue;

      const pressureFactor = 1 - trafficPressure / Math.max(0.01, config.maxLocalTrafficPressure);
      const lowAccessibilityFactor = accessibility < 0.45 ? config.lowAccessibilityPenalty : 1;
      const chance = config.baseChance * pressureFactor * (config.accessibilityWeight + accessibility) * lowAccessibilityFactor;
      if (Math.random() > chance) continue;

      for (const neighbor of this.grid.getNeighbors(road.x, road.y)) {
        if (
          !neighbor.road &&
          !neighbor.building &&
          this.hasAdjacentMainRoad(neighbor.x, neighbor.y, connectedKeys) &&
          this.getLocalTrafficPressure(neighbor.x, neighbor.y) < config.maxLocalTrafficPressure
        ) {
          const density = Math.max(1, ROAD_TYPES[road.type].capacity / 10);
          const building = {
            kind: Math.floor(Math.random() * 6),
            demand: Math.ceil(1 + Math.random() * density * accessibility),
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
  };
}

function getRoadAccessibility(roadManager, road, connectedKeys) {
  const definition = ROAD_TYPES[road.type];
  if (!definition?.trafficAllowed) return 0;

  const speed = roadManager.getEffectiveSpeed(road);
  const speedScore = Math.min(1, speed / 1.6);
  const healthScore = Math.max(0.12, road.health / 100);
  const capacityScore = Math.min(1, definition.capacity / 48);
  const edgeScore = connectedKeys.has(roadManager.grid.key(road.x, road.y)) ? 1 : 0;
  const pressureScore = 1 - Math.min(1, road.traffic / Math.max(1, definition.capacity));

  return clamp01(edgeScore * (speedScore * 0.34 + healthScore * 0.22 + capacityScore * 0.22 + pressureScore * 0.22));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
