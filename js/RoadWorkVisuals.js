import { SIMULATION_CONFIG } from "./SimulationConfig.js";

export function getRoadWorkVisualState(road) {
  if (road.closedForConstruction) {
    return makeTimedState("construction", road.constructionRemainingSeconds, road.constructionTotalSeconds);
  }

  if (road.closedForUpgrade) {
    return makeTimedState("upgrade", road.upgradeRemainingSeconds, road.upgradeTotalSeconds);
  }

  if (road.closedForRepair) {
    const remainingSeconds = Math.max(0, (100 - road.health) / Math.max(0.01, SIMULATION_CONFIG.roadWorks.repairHealthPerSecond));
    return {
      type: "repair",
      label: "REP",
      remainingSeconds,
      progress: clamp01(road.health / 100),
    };
  }

  return null;
}

function makeTimedState(type, remainingSeconds = 0, totalSeconds = 1) {
  const safeTotal = Math.max(0.01, totalSeconds);
  const labels = {
    construction: "OBRA",
    upgrade: "MEJ",
  };
  return {
    type,
    label: labels[type] ?? "OBRA",
    remainingSeconds: Math.max(0, remainingSeconds),
    progress: clamp01(1 - remainingSeconds / safeTotal),
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
