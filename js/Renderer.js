import { ROAD_TYPES } from "./RoadManager.js";

export class Renderer {
  /** Dibuja el mundo isométrico en canvas y ordena por profundidad. */
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grid = grid;
    this.origin = { x: canvas.width / 2, y: 88 };
    this.camera = { x: 0, y: 0, zoom: 1.65 };
    this.viewMode = "normal";
    this.heatmap = false;
    this.buildingsTransparent = false;
    this.buildingSheet = new Image();
    this.buildingSheet.src = "./assets/sprites/buildings-v2/sheet-transparent.png";
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.floor(this.canvas.clientWidth * ratio);
    const height = Math.floor(this.canvas.clientHeight * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.origin = { x: width / 2 + this.camera.x, y: 95 * ratio + this.camera.y };
  }

  setZoom(zoom) {
    this.camera.zoom = Math.max(0.65, Math.min(2.8, zoom));
  }

  pan(dx, dy) {
    const ratio = window.devicePixelRatio || 1;
    this.camera.x += dx * ratio;
    this.camera.y += dy * ratio;
  }

  draw({ roadManager, trafficSystem, selectedCell, hoverCell }) {
    this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = getCanvasBackground();
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const drawables = this.buildDrawList(roadManager, trafficSystem, selectedCell, hoverCell);
    drawables.sort((a, b) => a.depth - b.depth || a.layer - b.layer);
    for (const item of drawables) item.draw(ctx);
  }

  buildDrawList(roadManager, trafficSystem, selectedCell, hoverCell) {
    const items = [];
    for (let y = 0; y < this.grid.height; y += 1) {
      for (let x = 0; x < this.grid.width; x += 1) {
        const cell = this.grid.getCell(x, y);
        const screen = this.grid.isoToScreen(x, y, this.origin, this.camera.zoom);
        items.push({
          depth: x + y,
          layer: 0,
          draw: (ctx) => this.drawTile(ctx, screen, {
            selected: isSelected(selectedCell, x, y),
            hover: isSelected(hoverCell, x, y),
          }),
        });
        if (cell.road) {
          items.push({
            depth: x + y + 0.1,
            layer: 1,
            draw: (ctx) => this.drawRoad(ctx, screen, cell.road, roadManager),
          });
        }
        if (cell.building) {
          items.push({
            depth: x + y + 0.55,
            layer: 2,
            draw: (ctx) => this.drawBuilding(ctx, screen, cell.building),
          });
        }
      }
    }

    for (const vehicle of trafficSystem.vehicles) {
      const current = vehicle.path[vehicle.index];
      const next = vehicle.path[Math.min(vehicle.index + 1, vehicle.path.length - 1)];
      if (!current || !next) continue;
      items.push({
        depth: lerp(current.x, next.x, vehicle.progress) + lerp(current.y, next.y, vehicle.progress) + 0.4,
        layer: 3,
        draw: (ctx) => this.drawVehicle(ctx, current, next, vehicle),
      });
    }
    return items;
  }

  drawTile(ctx, screen, state) {
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.fillStyle = state.selected
      ? "rgba(36, 155, 123, 0.3)"
      : state.hover
        ? "rgba(242, 201, 76, 0.28)"
        : "rgba(99, 141, 119, 0.13)";
    ctx.strokeStyle = state.hover ? "rgba(242, 201, 76, 0.9)" : "rgba(41, 70, 58, 0.22)";
    ctx.lineWidth = state.hover ? Math.max(2, 2 * this.camera.zoom) : 1;
    ctx.fill();
    ctx.stroke();
  }

  drawRoad(ctx, screen, road, roadManager) {
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.fillStyle = roadViewColor(road, this.viewMode);
    ctx.fill();
    if (this.viewMode === "normal" || this.viewMode === "type") this.drawRoadTexture(ctx, screen, road);
    this.drawConnectionLines(ctx, screen, road, roadManager);
    this.drawRoadDamage(ctx, screen, road);
    this.drawRoadMarkings(ctx, screen, road);
    if (road.trafficLight) this.drawTrafficLight(ctx, screen, road);
  }

  drawRoadTexture(ctx, screen, road) {
    const zoom = this.camera.zoom;
    if (road.type !== "dirt") return;
    ctx.save();
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.clip();
    ctx.strokeStyle = "rgba(78, 52, 30, 0.24)";
    ctx.lineWidth = Math.max(1, zoom);
    for (let offset = -24; offset <= 24; offset += 8) {
      ctx.beginPath();
      ctx.moveTo(screen.x - 38 * zoom, screen.y + offset * zoom);
      ctx.lineTo(screen.x + 38 * zoom, screen.y + (offset + 8) * zoom);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawConnectionLines(ctx, screen, road, roadManager) {
    const bits = this.getRoadConnectionBits(road, roadManager);
    const zoom = this.camera.zoom;
    const endpoints = this.getIsoLaneEndpoints(screen);
    ctx.save();
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.clip();
    ctx.strokeStyle = laneColor(road);
    ctx.lineWidth = laneWidth(road, zoom);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const [direction, connected] of Object.entries(bits)) {
      if (!connected && !this.isOpenEdgeConnector(road, direction)) continue;
      ctx.moveTo(screen.x, screen.y);
      ctx.lineTo(endpoints[direction][0], endpoints[direction][1]);
    }
    ctx.stroke();
    if (road.type === "roundabout") {
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = Math.max(2, 3 * zoom);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 20 * zoom, 10 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  getRoadConnectionBits(road, roadManager) {
    const bits = { north: false, east: false, south: false, west: false };
    const directions = {
      north: [0, -1],
      east: [1, 0],
      south: [0, 1],
      west: [-1, 0],
    };
    for (const [direction, [dx, dy]] of Object.entries(directions)) {
      const neighbor = roadManager.getRoad(road.x + dx, road.y + dy);
      bits[direction] = roadManager.canTravel(road, neighbor) || roadManager.canTravel(neighbor, road);
    }
    return bits;
  }

  getIsoLaneEndpoints(screen) {
    const tileWidth = this.grid.tileWidth * this.camera.zoom;
    const tileHeight = this.grid.tileHeight * this.camera.zoom;
    return {
      north: [screen.x, screen.y - tileHeight / 2],
      east: [screen.x + tileWidth / 2, screen.y],
      south: [screen.x, screen.y + tileHeight / 2],
      west: [screen.x - tileWidth / 2, screen.y],
    };
  }

  isOpenEdgeConnector(road, direction) {
    return (
      (direction === "north" && road.y === 0) ||
      (direction === "east" && road.x === this.grid.width - 1) ||
      (direction === "south" && road.y === this.grid.height - 1) ||
      (direction === "west" && road.x === 0)
    );
  }

  drawRoadDamage(ctx, screen, road) {
    const zoom = this.camera.zoom;
    const damage = 1 - road.health / 100;
    if (damage < 0.22 && !road.closedForRepair && !road.closedForConstruction && !road.closedForUpgrade && !road.trafficClosed) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, 0.18 + damage * 0.55);
    ctx.strokeStyle = road.closedForRepair || road.closedForConstruction || road.closedForUpgrade || road.trafficClosed ? "#ffd166" : "#2b1e1b";
    ctx.lineWidth = Math.max(1, 1.3 * zoom);
    ctx.beginPath();
    for (let i = -1; i <= 1; i += 1) {
      ctx.moveTo(screen.x - 20 * zoom, screen.y + i * 7 * zoom);
      ctx.lineTo(screen.x + 20 * zoom, screen.y + (i * 7 + 4) * zoom);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawRoadMarkings(ctx, screen, road) {
    const zoom = this.camera.zoom;
    if (road.type === "oneWay") {
      ctx.save();
      ctx.font = `${Math.max(9, 12 * zoom)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText({ east: ">", west: "<", north: "^", south: "v" }[road.direction] ?? ">", screen.x, screen.y);
      ctx.restore();
    }
    if (this.viewMode === "speed") {
      ctx.save();
      ctx.fillStyle = "rgba(18, 28, 24, 0.82)";
      ctx.beginPath();
      ctx.roundRect(screen.x - 14 * zoom, screen.y + 13 * zoom, 28 * zoom, 15 * zoom, 4 * zoom);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(8, 9 * zoom)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(road.speedLimit), screen.x, screen.y + 21 * zoom);
      ctx.restore();
    }
  }

  drawTrafficLight(ctx, screen, road) {
    const zoom = this.camera.zoom;
    ctx.fillStyle = "#18211d";
    ctx.fillRect(screen.x + 19 * zoom, screen.y - 34 * zoom, 5 * zoom, 24 * zoom);
    ctx.fillStyle = road.trafficLight.phase === "green" ? "#35d47b" : "#e34b3f";
    ctx.beginPath();
    ctx.arc(screen.x + 22 * zoom, screen.y - 36 * zoom, 7 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBuilding(ctx, screen, building) {
    const size = 128;
    const col = building.kind % 3;
    const row = Math.floor(building.kind / 3);
    if (this.buildingSheet.complete && this.buildingSheet.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = this.buildingsTransparent ? 0.38 : 1;
      ctx.drawImage(
        this.buildingSheet,
        col * size,
        row * size,
        size,
        size,
        screen.x - 42 * this.camera.zoom,
        screen.y - 78 * this.camera.zoom,
        84 * this.camera.zoom,
        98 * this.camera.zoom,
      );
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#6c8fb0";
    ctx.fillRect(screen.x - 16, screen.y - 48, 32, 42);
  }

  drawVehicle(ctx, current, next, vehicle) {
    const from = this.grid.isoToScreen(current.x, current.y, this.origin, this.camera.zoom);
    const to = this.grid.isoToScreen(next.x, next.y, this.origin, this.camera.zoom);
    const x = lerp(from.x, to.x, vehicle.progress);
    const y = lerp(from.y, to.y, vehicle.progress);
    ctx.fillStyle = vehicle.color;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.26)";
    ctx.beginPath();
    ctx.ellipse(x, y - 5 * this.camera.zoom, 8 * this.camera.zoom, 4 * this.camera.zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  diamond(ctx, x, y) {
    const tileWidth = this.grid.tileWidth * this.camera.zoom;
    const tileHeight = this.grid.tileHeight * this.camera.zoom;
    ctx.moveTo(x, y - tileHeight / 2);
    ctx.lineTo(x + tileWidth / 2, y);
    ctx.lineTo(x, y + tileHeight / 2);
    ctx.lineTo(x - tileWidth / 2, y);
    ctx.closePath();
  }
}

function isSelected(selection, x, y) {
  if (!selection) return false;
  if (Array.isArray(selection.cells)) return selection.cells.some((cell) => cell.x === x && cell.y === y);
  return selection.x === x && selection.y === y;
}

function roadSurfaceColor(road) {
  if (road.closedForRepair || road.closedForConstruction || road.closedForUpgrade) return "#776949";
  if (road.health < 20) return "#694847";
  return {
    dirt: "#80613f",
    gravelRoad: "#80786c",
    concretePath: "#9fa39c",
    stonePath: "#7f817a",
    pedestrian: "#8f8c77",
    oneWay: "#59636b",
    twoWay: "#687179",
    cityRoad: "#616970",
    premiumRoad: "#415a72",
    avenue: "#5d6870",
    boulevard: "#5f7568",
    premiumAvenue: "#426575",
    expressway: "#4f5963",
    highway: "#4a545e",
    megaHighway: "#444b5c",
    roundabout: "#58656d",
  }[road.type] ?? "#747d83";
}

function laneColor(road) {
  if (road.type === "dirt") return "rgba(245, 221, 174, 0.32)";
  if (road.type === "pedestrian" || road.type === "stonePath") return "rgba(255, 255, 255, 0.24)";
  if (road.type.includes("premium")) return "rgba(210, 242, 255, 0.72)";
  if (road.type === "avenue" || road.type === "boulevard") return "rgba(255, 224, 105, 0.72)";
  return "rgba(255, 255, 255, 0.62)";
}

function laneWidth(road, zoom) {
  if (["expressway", "highway", "megaHighway"].includes(road.type)) return Math.max(4, 6 * zoom);
  if (["avenue", "boulevard", "premiumAvenue"].includes(road.type)) return Math.max(3, 5 * zoom);
  if (road.type === "pedestrian") return Math.max(2, 3 * zoom);
  return Math.max(2, 3 * zoom);
}

export function roadViewColor(road, viewMode = "normal") {
  if (viewMode === "traffic") {
    const intensity = Math.min(1, road.traffic / Math.max(1, ROAD_TYPES[road.type]?.capacity ?? 1));
    return heatColor(intensity);
  }
  if (viewMode === "health") return healthColor(road.health, road.closedForRepair || road.closedForConstruction || road.closedForUpgrade || road.trafficClosed);
  if (viewMode === "speed") return speedColor(road.speedLimit);
  if (viewMode === "type") return typeColor(road.type);
  return roadSurfaceColor(road);
}

export function heatColor(intensity) {
  return colorScale(intensity, [
    [0, 94, 203, 124],
    [0.25, 180, 222, 92],
    [0.5, 246, 205, 77],
    [0.75, 236, 126, 55],
    [1, 198, 54, 57],
  ]);
}

function healthColor(health, blocked) {
  if (blocked) return "#f1c453";
  return colorScale(1 - health / 100, [
    [0, 62, 166, 119],
    [0.35, 139, 196, 91],
    [0.58, 232, 185, 68],
    [0.8, 219, 110, 54],
    [1, 151, 55, 60],
  ]);
}

function speedColor(speedLimit) {
  return { 20: "#8f6a44", 30: "#6f8f59", 50: "#4f7fa6", 80: "#7254a8" }[speedLimit] ?? "#747d83";
}

function typeColor(type) {
  return {
    dirt: "#8a6b42",
    gravelRoad: "#7f786b",
    concretePath: "#a7aba2",
    stonePath: "#797b73",
    pedestrian: "#85a56c",
    oneWay: "#5f6e7d",
    twoWay: "#6a747d",
    cityRoad: "#66717a",
    premiumRoad: "#326f9e",
    avenue: "#5f867b",
    boulevard: "#5f9367",
    premiumAvenue: "#2f9bb3",
    expressway: "#626983",
    highway: "#5c5f74",
    megaHighway: "#505572",
    roundabout: "#8a6db0",
  }[type] ?? "#747d83";
}

function colorScale(value, stops) {
  const clamped = Math.max(0, Math.min(1, value));
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const next = stops[index];
    if (clamped <= next[0]) {
      const local = (clamped - previous[0]) / Math.max(0.001, next[0] - previous[0]);
      return `rgb(${Math.round(lerp(previous[1], next[1], local))}, ${Math.round(lerp(previous[2], next[2], local))}, ${Math.round(lerp(previous[3], next[3], local))})`;
    }
  }
  const last = stops[stops.length - 1];
  return `rgb(${last[1]}, ${last[2]}, ${last[3]})`;
}

function getCanvasBackground() {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "#121a17" : "#e9f1ed";
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
