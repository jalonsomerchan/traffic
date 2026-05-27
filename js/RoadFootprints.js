import { ROAD_TYPES } from "./RoadManager.js";

const ROAD_FOOTPRINTS = {
  avenue: 2,
  boulevard: 2,
  premiumAvenue: 2,
  roundabout: 2,
  expressway: 3,
  highway: 3,
  megaHighway: 3,
};

export function getRoadFootprintSize(type) {
  return ROAD_FOOTPRINTS[type] ?? 1;
}

export function getRoadFootprintCells(x, y, type) {
  const size = getRoadFootprintSize(type);
  const cells = [];
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

export function getRoadFootprintCost(type) {
  const size = getRoadFootprintSize(type);
  return (ROAD_TYPES[type]?.buildCost ?? 0) * size * size;
}

export function canBuildRoadFootprint(grid, roadManager, x, y, type) {
  return getRoadFootprintCells(x, y, type).every((cell) => {
    return grid.isInside(cell.x, cell.y) && !roadManager.getRoad(cell.x, cell.y);
  });
}

export function buildRoadFootprint(roadManager, x, y, type) {
  if (!ROAD_TYPES[type]) return [];
  const groupId = `${type}-${x}-${y}-${Date.now().toString(36)}`;
  const size = getRoadFootprintSize(type);
  const roads = [];
  for (const cell of getRoadFootprintCells(x, y, type)) {
    const road = roadManager.buildRoad(cell.x, cell.y, type);
    if (!road) continue;
    road.footprint = { anchorX: x, anchorY: y, size, groupId };
    roads.push(road);
  }
  return roads;
}

export function makeFootprintSelection(x, y, type) {
  return { x, y, cells: getRoadFootprintCells(x, y, type) };
}
