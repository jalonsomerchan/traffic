import { SIMULATION_CONFIG } from "./SimulationConfig.js";

export const TREE_TOOL = "clearTree";

export function seedTrees(grid, blockedCells = []) {
  const blocked = new Set(blockedCells.map((cell) => grid.key(cell.x, cell.y)));
  const config = SIMULATION_CONFIG.treeWorks;
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const key = grid.key(x, y);
      if (blocked.has(key)) continue;
      const cell = grid.getCell(x, y);
      if (!cell || cell.road || cell.building || cell.tree) continue;
      if (Math.random() < config.initialDensity) {
        cell.tree = {
          kind: Math.floor(Math.random() * 3),
          clearing: false,
          remainingSeconds: 0,
          totalSeconds: 0,
        };
      }
    }
  }
}

export function startTreeClearing(grid, x, y) {
  const cell = grid.getCell(x, y);
  if (!cell?.tree || cell.tree.clearing) return false;
  const duration = SIMULATION_CONFIG.treeWorks.clearDurationSeconds;
  cell.tree.clearing = true;
  cell.tree.remainingSeconds = duration;
  cell.tree.totalSeconds = duration;
  return true;
}

export function updateTreeClearing(grid, deltaSeconds) {
  for (const cell of grid.cells.values()) {
    if (!cell.tree?.clearing) continue;
    cell.tree.remainingSeconds = Math.max(0, cell.tree.remainingSeconds - deltaSeconds);
    if (cell.tree.remainingSeconds <= 0) cell.tree = null;
  }
}

export function getTreeClearCost() {
  return SIMULATION_CONFIG.treeWorks.clearCost;
}

export function getProtectedStarterCells() {
  const cells = [];
  const radius = SIMULATION_CONFIG.treeWorks.protectedStarterRadius;
  for (let x = 0; x <= 12; x += 1) addProtectedArea(cells, x, 8, radius);
  for (let y = 5; y <= 12; y += 1) addProtectedArea(cells, 8, y, radius);
  for (const [x, y] of [[4, 7], [7, 7], [9, 9]]) addProtectedArea(cells, x, y, radius);
  return cells;
}

function addProtectedArea(cells, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
}
