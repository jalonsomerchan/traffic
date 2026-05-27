import assert from "node:assert/strict";
import test from "node:test";

import { calculateDiscontent } from "../js/Discontent.js";
import { Grid } from "../js/Grid.js";
import { ROAD_TYPES, RoadManager } from "../js/RoadManager.js";
import { SIMULATION_CONFIG } from "../js/SimulationConfig.js";
import { TrafficSystem } from "../js/TrafficSystem.js";
import {
  getRoadUpgradeCost,
  startRoadConstruction,
  startRoadUpgrade,
  updateRoadConstructions,
  updateRoadUpgrades,
} from "../js/RoadUpgrades.js";

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  };
}

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

test("road upgrade cost scales with the expanded catalog and stays below rebuilding", () => {
  const cost = getRoadUpgradeCost("dirt", "twoWay");

  assert.ok(cost > ROAD_TYPES.dirt.buildCost);
  assert.ok(cost < ROAD_TYPES.twoWay.buildCost);
});

test("discontent reduces income when traffic and degradation are high", () => {
  const roadManager = {
    roads: new Map([
      ["1,1", { x: 1, y: 1, type: "twoWay", health: 20, traffic: 20 }],
      ["1,2", { x: 1, y: 2, type: "twoWay", health: 30, traffic: 18 }],
    ]),
  };

  const discontent = calculateDiscontent(roadManager, 12, SIMULATION_CONFIG.trafficIncidents.blockedRouteDiscontent);

  assert.ok(discontent.value > 0.5);
  assert.ok(discontent.incomeMultiplier < 1);
});

test("drivers reroute around a closed road when an alternative exists", () => {
  const grid = new Grid({ width: 3, height: 2 });
  const roadManager = new RoadManager(grid);
  const trafficSystem = new TrafficSystem(grid, roadManager);

  for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]) {
    roadManager.buildRoad(x, y, "twoWay");
  }
  trafficSystem.vehicles.push({
    path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    index: 0,
    progress: 0,
    speed: 1,
  });

  roadManager.setTrafficClosed(1, 0, true);

  assert.equal(trafficSystem.vehicles.length, 1);
  assert.equal(trafficSystem.detours, 1);
  assert.ok(trafficSystem.vehicles[0].path.some((cell) => cell.y === 1));
});

test("drivers get angry when a closure leaves no alternative route", () => {
  const grid = new Grid({ width: 3, height: 1 });
  const roadManager = new RoadManager(grid);
  const trafficSystem = new TrafficSystem(grid, roadManager);
  let blockedNotices = 0;
  roadManager.addEventListener("traffic-incident", (event) => {
    if (event.detail.type === "blocked-route") blockedNotices += 1;
  });

  for (const [x, y] of [[0, 0], [1, 0], [2, 0]]) {
    roadManager.buildRoad(x, y, "twoWay");
  }
  trafficSystem.vehicles.push({
    path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    index: 0,
    progress: 0,
    speed: 1,
  });

  roadManager.setTrafficClosed(1, 0, true);

  assert.equal(trafficSystem.vehicles.length, 0);
  assert.equal(trafficSystem.blockedRoutes, 1);
  assert.equal(blockedNotices, 1);
});
