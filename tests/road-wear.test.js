import assert from "node:assert/strict";
import test from "node:test";

import { Grid } from "../js/Grid.js";
import { RoadManager } from "../js/RoadManager.js";

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  };
}

test("roads without traffic do not degrade", () => {
  const grid = new Grid({ width: 3, height: 3 });
  const roadManager = new RoadManager(grid);
  const road = roadManager.buildRoad(1, 1, "twoWay");

  roadManager.update(10, new Map());

  assert.equal(road.health, 100);
  assert.equal(road.trafficWear, 0);
});

test("roads degrade when cars pass through them", () => {
  const grid = new Grid({ width: 3, height: 3 });
  const roadManager = new RoadManager(grid);
  const road = roadManager.buildRoad(1, 1, "twoWay");
  const trafficCounts = new Map([[grid.key(1, 1), 4]]);

  roadManager.update(10, trafficCounts);

  assert.ok(road.health < 100);
  assert.ok(road.trafficWear > 0);
});

test("roads with more passing cars degrade faster", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roadManager = new RoadManager(grid);
  const lowTrafficRoad = roadManager.buildRoad(1, 1, "twoWay");
  const highTrafficRoad = roadManager.buildRoad(2, 2, "twoWay");
  const trafficCounts = new Map([
    [grid.key(1, 1), 1],
    [grid.key(2, 2), 8],
  ]);

  roadManager.update(10, trafficCounts);

  assert.ok(highTrafficRoad.health < lowTrafficRoad.health);
  assert.ok(highTrafficRoad.trafficWear > lowTrafficRoad.trafficWear);
});
