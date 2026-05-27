import assert from "node:assert/strict";
import test from "node:test";

import { Grid } from "../js/Grid.js";
import { getTreeClearCost, seedTrees, startTreeClearing, updateTreeClearing } from "../js/Trees.js";

test("tree clearing costs money externally and removes tree after configured time", () => {
  const grid = new Grid({ width: 2, height: 2 });
  const cell = grid.getCell(1, 1);
  cell.tree = { kind: 0, clearing: false, remainingSeconds: 0, totalSeconds: 0 };

  assert.ok(getTreeClearCost() > 0);
  assert.equal(startTreeClearing(grid, 1, 1), true);
  assert.equal(cell.tree.clearing, true);
  assert.ok(cell.tree.remainingSeconds > 0);

  updateTreeClearing(grid, 999);

  assert.equal(cell.tree, null);
});

test("tree seeding respects protected starter cells", () => {
  const grid = new Grid({ width: 1, height: 1 });

  seedTrees(grid, [{ x: 0, y: 0 }]);

  assert.equal(grid.getCell(0, 0).tree, null);
});
