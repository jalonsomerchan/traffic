import { ROAD_TYPES } from "./RoadManager.js";

/** Calcula descontento normalizado por tráfico acumulado y degradación de carreteras. */
export function calculateDiscontent(roadManager, vehicleCount) {
  const roads = [...roadManager.roads.values()];
  if (!roads.length) return { value: 0, traffic: 0, degradation: 0, incomeMultiplier: 1 };

  const traffic = average(roads.map((road) => road.traffic / Math.max(1, ROAD_TYPES[road.type]?.capacity ?? 1)));
  const degradation = average(roads.map((road) => 1 - road.health / 100));
  const saturation = Math.min(1, vehicleCount / Math.max(10, roads.length * 1.5));
  const works = roads.filter((road) => road.closedForRepair || road.closedForUpgrade || road.trafficClosed).length / roads.length;
  const value = clamp01(traffic * 0.42 + degradation * 0.36 + saturation * 0.14 + works * 0.08);

  return {
    value,
    traffic: clamp01(traffic),
    degradation: clamp01(degradation),
    incomeMultiplier: Math.max(0.35, 1 - value * 0.72),
  };
}

export function applyDiscontentPenalty(amount, discontent) {
  return Math.floor(amount * discontent.incomeMultiplier);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
