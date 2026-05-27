import assert from "node:assert/strict";
import test from "node:test";

import { calculateDiscontent } from "../js/Discontent.js";
import { SIMULATION_CONFIG } from "../js/SimulationConfig.js";
import {
  getRoadUpgradeCost,
  startRoadConstruction,
  startRoadUpgrade,
  updateRoadConstructions,
  updateRoadUpgrades,
} from "../js/RoadUpgrades.js";

test("road construction closes traffic and finishes from config", () => {
  const road = { x: 1, y: 1, type: "dirt", health: 100, traffic: 4, trafficClosed: false };
  const roadManager = {
    roads: new Map([["1,1", road]]),
    dispatchNetworkChanged: () => {},
  };

  assert.equal(startRoadConstruction(roadManager, road), true);
  assert.equal(road.closedForConstruction, true);
  assert.equal(road.trafficClosed, true);
  assert.equal(road.traffic, 0);
  assert.equal(road.constructionRemainingSeconds, SIMULATION_CONFIG.roadWorks.constructionDurationSeconds);

  updateRoadConstructions(roadManager, SIMULATION_CONFIG.roadWorks.constructionDurationSeconds + 1);

  assert.equal(road.closedForConstruction, false);
  assert.equal(road.trafficClosed, false);
});

test("road upgrades close traffic and finish automatically after a longer work", () => {
  const road = { x: 1, y: 1, type: "dirt", health: 50, traffic: 3, trafficClosed: false };
  const roadManager = {
    roads: new Map([["1,1", road]]),
    getRoad: () => road,
    dispatchNetworkChanged: () => {},
  };

  assert.equal(startRoadUpgrade(roadManager, 1, 1, "twoWay"), true);
  assert.equal(road.closedForUpgrade, true);
  assert.equal(road.trafficClosed, true);
  assert.equal(road.traffic, 0);
  assert.ok(road.upgradeRemainingSeconds > SIMULATION_CONFIG.roadWorks.constructionDurationSeconds);

  updateRoadUpgrades(roadManager, SIMULATION_CONFIG.roadWorks.upgradeDurationSeconds + 1);

  assert.equal(road.closedForUpgrade, false);
  assert.equal(road.trafficClosed, false);
  assert.equal(road.type, "twoWay");
  assert.equal(road.health, 100);
});

test("road upgrade cost is lower than rebuilding but greater than zero", () => {
  const cost = getRoadUpgradeCost("dirt", "twoWay");

  assert.ok(cost > 0);
  assert.ok(cost < 180);
});

test("discontent reduces income when traffic and degradation are high", () => {
  const roadManager = {
    roads: new Map([
      ["1,1", { x: 1, y: 1, type: "twoWay", health: 20, traffic: 20 }],
      ["1,2", { x: 1, y: 2, type: "twoWay", health: 30, traffic: 18 }],
    ]),
  };

  const discontent = calculateDiscontent(roadManager, 12);

  assert.ok(discontent.value > 0.5);
  assert.ok(discontent.incomeMultiplier < 1);
});
