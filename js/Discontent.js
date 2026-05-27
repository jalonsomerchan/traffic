import { ROAD_TYPES } from "./RoadManager.js";

/** Calcula descontento normalizado por tráfico acumulado, degradación e incidencias. */
export function calculateDiscontent(roadManager, vehicleCount, incidentDiscontent = 0) {
  const roads = [...roadManager.roads.values()];
  if (!roads.length) return { value: clamp01(incidentDiscontent), traffic: 0, degradation: 0, incomeMultiplier: 1 };

  const traffic = average(roads.map((road) => road.traffic / Math.max(1, ROAD_TYPES[road.type]?.capacity ?? 1)));
  const degradation = average(roads.map((road) => 1 - road.health / 100));
  const saturation = Math.min(1, vehicleCount / Math.max(10, roads.length * 1.5));
  const works = roads.filter((road) => road.closedForRepair || road.closedForUpgrade || road.closedForConstruction || road.trafficClosed).length / roads.length;
  const value = clamp01(traffic * 0.38 + degradation * 0.32 + saturation * 0.12 + works * 0.08 + incidentDiscontent);

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
