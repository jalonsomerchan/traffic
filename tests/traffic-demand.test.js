import assert from "node:assert/strict";
import test from "node:test";

import { Grid } from "../js/Grid.js";
import { RoadManager } from "../js/RoadManager.js";
import { SIMULATION_CONFIG } from "../js/SimulationConfig.js";
import { TrafficSystem } from "../js/TrafficSystem.js";

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  };
}

test("internal traffic demand is zero without housing", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roadManager = new RoadManager(grid);
  const trafficSystem = new TrafficSystem(grid, roadManager);

  const demand = trafficSystem.getHousingTrafficDemand();

  assert.equal(demand.housing, 0);
  assert.equal(demand.internalFactor, 0);
  assert.equal(demand.externalFactor, SIMULATION_CONFIG.trafficDemand.minimumExternalTrafficFactor * 0.2);
  assert.equal(demand.activeVehicleLimit, SIMULATION_CONFIG.trafficDemand.baseActiveVehicleLimit);
});

test("traffic demand grows with housing capacity", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roadManager = new RoadManager(grid);
  const trafficSystem = new TrafficSystem(grid, roadManager);
  roadManager.buildRoad(1, 1, "dirt");
  grid.setBuilding(1, 2, { kind: 0, demand: 10 });

  const demand = trafficSystem.getHousingTrafficDemand();

  assert.equal(demand.housing, 120);
  assert.ok(demand.internalFactor > 0);
  assert.ok(demand.internalFactor < 1);
  assert.ok(demand.externalFactor >= SIMULATION_CONFIG.trafficDemand.minimumExternalTrafficFactor);
  assert.ok(demand.activeVehicleLimit > SIMULATION_CONFIG.trafficDemand.baseActiveVehicleLimit);
});

test("traffic demand is capped at full scale", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roadManager = new RoadManager(grid);
  const trafficSystem = new TrafficSystem(grid, roadManager);
  roadManager.buildRoad(1, 1, "dirt");
  grid.setBuilding(1, 2, { kind: 0, demand: 200 });

  const demand = trafficSystem.getHousingTrafficDemand();

  assert.equal(demand.internalFactor, 1);
  assert.equal(demand.externalFactor, 1);
  assert.equal(demand.activeVehicleLimit, SIMULATION_CONFIG.trafficDemand.maxActiveVehicles);
});

test("active vehicle cap prevents spawn bursts while at capacity", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roadManager = new RoadManager(grid);
  const trafficSystem = new TrafficSystem(grid, roadManager);
  roadManager.buildRoad(1, 1, "dirt");
  grid.setBuilding(1, 2, { kind: 0, demand: 1 });

  const demand = trafficSystem.getHousingTrafficDemand();
  trafficSystem.vehicles = Array.from({ length: demand.activeVehicleLimit }, () => ({
    path: [{ x: 1, y: 1 }, { x: 1, y: 1 }],
    index: 0,
    progress: 0,
    speed: 0,
  }));
  trafficSystem.spawnTimer = 999;
  trafficSystem.edgeSpawnTimer = 999;

  trafficSystem.update(1);

  assert.equal(trafficSystem.vehicles.length, demand.activeVehicleLimit);
  assert.ok(trafficSystem.spawnTimer < SIMULATION_CONFIG.trafficDemand.internalSpawnIntervalSeconds);
  assert.ok(trafficSystem.edgeSpawnTimer < SIMULATION_CONFIG.trafficDemand.externalSpawnIntervalSeconds);
});
