import assert from "node:assert/strict";
import test from "node:test";

import { SIMULATION_CONFIG } from "../js/SimulationConfig.js";
import { getRoadWorkVisualState } from "../js/RoadWorkVisuals.js";

test("construction visual state exposes countdown and progress", () => {
  const road = {
    closedForConstruction: true,
    constructionRemainingSeconds: 5,
    constructionTotalSeconds: 20,
  };

  const state = getRoadWorkVisualState(road);

  assert.equal(state.type, "construction");
  assert.equal(state.label, "OBRA");
  assert.equal(state.remainingSeconds, 5);
  assert.equal(state.progress, 0.75);
});

test("upgrade visual state exposes countdown and progress", () => {
  const road = {
    closedForUpgrade: true,
    upgradeRemainingSeconds: 10,
    upgradeTotalSeconds: 40,
  };

  const state = getRoadWorkVisualState(road);

  assert.equal(state.type, "upgrade");
  assert.equal(state.label, "MEJ");
  assert.equal(state.remainingSeconds, 10);
  assert.equal(state.progress, 0.75);
});

test("repair visual state derives countdown from road health", () => {
  const road = {
    closedForRepair: true,
    health: 60,
  };

  const state = getRoadWorkVisualState(road);

  assert.equal(state.type, "repair");
  assert.equal(state.label, "REP");
  assert.equal(state.progress, 0.6);
  assert.equal(state.remainingSeconds, (100 - road.health) / SIMULATION_CONFIG.roadWorks.repairHealthPerSecond);
});

test("inactive road has no work visual state", () => {
  assert.equal(getRoadWorkVisualState({ health: 100 }), null);
});
