export const SIMULATION_CONFIG = {
  roadWorks: {
    constructionDurationSeconds: 20,
    repairHealthPerSecond: 4,
    upgradeDurationSeconds: 34,
    upgradeHealthPerSecond: 2,
    activeUpgradeMonthlyCostMultiplier: 28,
  },
  treeWorks: {
    clearCost: 85,
    clearDurationSeconds: 14,
    initialDensity: 0.18,
    protectedStarterRadius: 2,
  },
  trafficIncidents: {
    detourDiscontent: 0.018,
    blockedRouteDiscontent: 0.18,
    incidentDecayPerSecond: 0.035,
    blockedRouteNotice: "Conductores enfurecidos: no hay ruta alternativa",
  },
  cityGrowth: {
    intervalSeconds: 4.8,
    baseChance: 0.12,
    maxLocalTrafficPressure: 0.62,
    accessibilityWeight: 0.72,
    lowAccessibilityPenalty: 0.35,
  },
};
