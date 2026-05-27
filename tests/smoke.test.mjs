import test from "node:test";
import assert from "node:assert/strict";
import { Grid } from "../js/Grid.js";
import { RoadManager } from "../js/RoadManager.js";
import { heatColor, roadViewColor } from "../js/Renderer.js";
import { TrafficSystem } from "../js/TrafficSystem.js";

test("roads degrade with traffic and recover while closed for repair", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roads = new RoadManager(grid);
  const road = roads.buildRoad(1, 1, "twoWay");
  roads.update(10, new Map([[grid.key(1, 1), 8]]));
  assert.ok(road.health < 100);
  roads.setRepair(1, 1, true);
  const damagedHealth = road.health;
  roads.update(2, new Map());
  assert.ok(road.health > damagedHealth);
  roads.update(20, new Map());
  assert.equal(road.health, 100);
  assert.equal(road.closedForRepair, false);
});

test("A* avoids roads closed for repair", () => {
  const grid = new Grid({ width: 5, height: 3 });
  const roads = new RoadManager(grid);
  const traffic = new TrafficSystem(grid, roads);
  for (let x = 0; x < 5; x += 1) roads.buildRoad(x, 1, "twoWay");
  roads.buildRoad(1, 0, "twoWay");
  roads.buildRoad(2, 0, "twoWay");
  roads.buildRoad(3, 0, "twoWay");
  roads.setRepair(2, 1, true);
  const path = traffic.findPath(roads.getRoad(0, 1), roads.getRoad(4, 1));
  assert.deepEqual(
    path.map((cell) => `${cell.x},${cell.y}`),
    ["0,1", "1,1", "1,0", "2,0", "3,0", "3,1", "4,1"],
  );
});

test("road types expose different maintenance costs", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roads = new RoadManager(grid);
  roads.buildRoad(0, 0, "twoWay");
  roads.buildRoad(1, 0, "highway");
  assert.equal(roads.getMaintenanceCostPerSecond(), 9.950000000000001);
  roads.setRepair(1, 0, true);
  assert.equal(roads.getMaintenanceCostPerSecond(), 22.55);
});

test("monthly road costs are reported as a readable breakdown", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roads = new RoadManager(grid);
  roads.buildRoad(0, 0, "twoWay");
  roads.buildRoad(1, 0, "highway");
  roads.setRepair(1, 0, true);
  const costs = roads.getMonthlyCostBreakdown();
  assert.equal(costs.roads, 2);
  assert.equal(costs.repairCount, 1);
  assert.equal(costs.maintenance, 70);
  assert.equal(costs.repair, 152);
});

test("traffic revenue is paid in monthly blocks and resets pending trips", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roads = new RoadManager(grid);
  const traffic = new TrafficSystem(grid, roads);
  traffic.completedTrips = 3;
  assert.equal(traffic.consumeTaxRevenue(), 54);
  assert.equal(traffic.completedTrips, 0);
});

test("road view modes expose multi-level visual colors", () => {
  const grid = new Grid({ width: 2, height: 1 });
  const roads = new RoadManager(grid);
  const road = roads.buildRoad(0, 0, "highway");
  road.traffic = 0;
  const lowTraffic = roadViewColor(road, "traffic");
  road.traffic = 80;
  const highTraffic = roadViewColor(road, "traffic");
  assert.notEqual(lowTraffic, highTraffic);
  assert.notEqual(heatColor(0.2), heatColor(0.6));
  assert.notEqual(roadViewColor(road, "type"), roadViewColor(road, "speed"));
});

test("road health view changes with degradation", () => {
  const grid = new Grid({ width: 2, height: 1 });
  const roads = new RoadManager(grid);
  const road = roads.buildRoad(0, 0, "twoWay");
  const healthy = roadViewColor(road, "health");
  road.health = 18;
  assert.notEqual(healthy, roadViewColor(road, "health"));
});

test("pedestrian streets do not accept vehicle traffic", () => {
  const grid = new Grid({ width: 3, height: 1 });
  const roads = new RoadManager(grid);
  roads.buildRoad(0, 0, "twoWay");
  const pedestrian = roads.buildRoad(1, 0, "pedestrian");
  roads.buildRoad(2, 0, "twoWay");
  assert.equal(roads.getEffectiveSpeed(pedestrian), 0);
  assert.equal(roads.canTravel(roads.getRoad(0, 0), pedestrian), false);
});

test("buildings only appear next to roads and can be demolished", () => {
  const grid = new Grid({ width: 4, height: 4 });
  grid.setBuilding(2, 2, { kind: 1, demand: 3 });
  assert.equal(grid.getCell(2, 2).building, null);
  const roads = new RoadManager(grid);
  roads.buildRoad(1, 2, "twoWay");
  grid.setBuilding(2, 2, { kind: 1, demand: 3 });
  assert.equal(grid.getHousingCapacity(), 36);
  assert.equal(grid.getCell(2, 2).building.demand, 3);
  assert.equal(grid.demolishBuilding(2, 2).demand, 3);
  assert.equal(grid.getCell(2, 2).building, null);
  assert.equal(grid.getHousingCapacity(), 0);
});

test("edge road connections are detected as external city links", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roads = new RoadManager(grid);
  roads.buildRoad(0, 1, "highway");
  roads.buildRoad(1, 1, "twoWay");
  assert.equal(roads.getEdgeConnections().length, 1);
});

test("building state is cleared when a road is built on that cell", () => {
  const grid = new Grid({ width: 4, height: 4 });
  const roads = new RoadManager(grid);
  roads.buildRoad(1, 1, "twoWay");
  grid.setBuilding(2, 1, { kind: 0, demand: 2 });
  assert.ok(grid.getCell(2, 1).building);
  roads.buildRoad(2, 1, "twoWay");
  assert.equal(grid.getCell(2, 1).building, null);
  assert.ok(grid.getCell(2, 1).road);
});

test("main network excludes isolated roads away from edge connections", () => {
  const grid = new Grid({ width: 8, height: 8 });
  const roads = new RoadManager(grid);
  roads.buildRoad(0, 1, "highway");
  roads.buildRoad(1, 1, "twoWay");
  roads.buildRoad(6, 6, "twoWay");
  const connected = roads.getMainNetworkKeys();
  assert.equal(connected.has(grid.key(1, 1)), true);
  assert.equal(connected.has(grid.key(6, 6)), false);
  assert.equal(roads.hasAdjacentMainRoad(6, 5, connected), false);
});

test("traffic closures and removed traffic lights affect road state", () => {
  const grid = new Grid({ width: 3, height: 3 });
  const roads = new RoadManager(grid);
  const road = roads.buildRoad(1, 1, "twoWay");
  roads.placeTrafficLight(1, 1);
  assert.ok(road.trafficLight);
  assert.equal(roads.removeTrafficLight(1, 1), true);
  assert.equal(road.trafficLight, null);
  assert.equal(roads.setTrafficClosed(1, 1, true), true);
  assert.equal(roads.getEffectiveSpeed(road), 0);
});

test("closing a road immediately clears active vehicles from that cell", () => {
  const grid = new Grid({ width: 3, height: 1 });
  const roads = new RoadManager(grid);
  const traffic = new TrafficSystem(grid, roads);
  roads.buildRoad(0, 0, "twoWay");
  roads.buildRoad(1, 0, "twoWay");
  roads.buildRoad(2, 0, "twoWay");
  traffic.vehicles.push({
    path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    index: 1,
    progress: 0,
  });
  assert.equal(traffic.hasVehicleOnRoad(1, 0), true);
  roads.setTrafficClosed(1, 0, true);
  assert.equal(roads.getRoad(1, 0).traffic, 0);
  assert.equal(traffic.hasVehicleOnRoad(1, 0), false);
});

test("heavy traffic suppresses nearby buildings over time", () => {
  const grid = new Grid({ width: 3, height: 3 });
  const roads = new RoadManager(grid);
  roads.buildRoad(1, 1, "twoWay");
  grid.setBuilding(1, 0, { kind: 1, demand: 1 });
  const trafficCounts = new Map([[grid.key(1, 1), 18]]);
  roads.update(3.1, trafficCounts);
  roads.update(3.1, trafficCounts);
  roads.update(3.1, trafficCounts);
  assert.equal(grid.getCell(1, 0).building, null);
});

test("roads cannot be removed while they report traffic", () => {
  const grid = new Grid({ width: 3, height: 3 });
  const roads = new RoadManager(grid);
  const road = roads.buildRoad(1, 1, "twoWay");
  road.traffic = 1;
  assert.equal(roads.removeRoad(1, 1), false);
  road.traffic = 0;
  assert.equal(roads.removeRoad(1, 1), true);
  assert.equal(grid.getCell(1, 1).road, null);
});
