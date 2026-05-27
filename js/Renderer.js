import { ROAD_TYPES } from "./RoadManager.js";

export class Renderer {
  /**
   * Dibuja el mundo isométrico en canvas.
   * Mantiene Painter's Algorithm ordenando cada elemento por profundidad.
   */
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
    this.roadSheet = new Image();
    this.roadSheet.src = "./assets/sprites/roads-v2/sheet-transparent.png";
    this.connectionSheet = new Image();
    this.connectionSheet.src = "./assets/sprites/road-connections/sheet-transparent.png";
  }

  /** Ajusta el canvas a devicePixelRatio para render nítido y responsive. */
  resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.floor(this.canvas.clientWidth * ratio);
    const height = Math.floor(this.canvas.clientHeight * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.origin = { x: width / 2 + this.camera.x, y: 95 * ratio + this.camera.y };
    }
    this.origin = { x: width / 2 + this.camera.x, y: 95 * ratio + this.camera.y };
  }

  /** Ajusta zoom con límites para que el mapa pueda alejarse y acercarse. */
  setZoom(zoom) {
    this.camera.zoom = Math.max(0.65, Math.min(2.8, zoom));
  }

  /** Desplaza la cámara en pantalla; funciona con ratón, táctil y botones. */
  pan(dx, dy) {
    const ratio = window.devicePixelRatio || 1;
    this.camera.x += dx * ratio;
    this.camera.y += dy * ratio;
  }

  /** Limpia pantalla, construye la lista de dibujo, ordena y pinta. */
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

  /**
   * Crea drawables con depth/layer.
   * La ordenación por x+y hace que objetos más al fondo se pinten primero.
   */
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
      items.push({
        depth: lerp(current.x, next.x, vehicle.progress) + lerp(current.y, next.y, vehicle.progress) + 0.4,
        layer: 3,
        draw: (ctx) => this.drawVehicle(ctx, current, next, vehicle),
      });
    }
    return items;
  }

  /** Pinta una celda base y resalta la selección de herramienta. */
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

  /** Renderiza carreteras normales o coloreadas por intensidad de tráfico. */
  drawRoad(ctx, screen, road, roadManager) {
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.fillStyle = roadViewColor(road, this.viewMode);
    ctx.fill();
    if (this.viewMode === "normal" || this.viewMode === "type") this.drawRoadTexture(ctx, screen, road);
    this.drawConnectionLines(ctx, screen, road, roadManager);
    this.drawRoadDamage(ctx, screen, road);
    ctx.lineWidth = Math.max(1, 1.5 * this.camera.zoom);
    ctx.strokeStyle = road.closedForRepair ? "#ffd166" : "rgba(255, 255, 255, 0.36)";
    ctx.stroke();
    this.drawRoadMarkings(ctx, screen, road);

    if (road.trafficLight) {
      ctx.fillStyle = "#18211d";
      ctx.fillRect(screen.x + 19 * this.camera.zoom, screen.y - 34 * this.camera.zoom, 5 * this.camera.zoom, 24 * this.camera.zoom);
      ctx.fillStyle = road.trafficLight.phase === "green" ? "#35d47b" : "#e34b3f";
      ctx.beginPath();
      ctx.arc(screen.x + 22 * this.camera.zoom, screen.y - 36 * this.camera.zoom, 7 * this.camera.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Superpone el atlas generado sin depender de él para la lógica. */
  drawRoadSprite(ctx, screen, road, roadManager) {
    const definition = ROAD_TYPES[road.type];
    if (!definition) return;
    const connectionIndex = this.getConnectionAtlasIndex(road, roadManager);
    const size = 128;
    const width = this.grid.tileWidth * this.camera.zoom;
    const height = this.grid.tileHeight * 1.45 * this.camera.zoom;

    ctx.save();
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.clip();

    if (this.roadSheet.complete && this.roadSheet.naturalWidth) {
      const typeCol = definition.atlasIndex % 4;
      const typeRow = Math.floor(definition.atlasIndex / 4);
      ctx.globalAlpha = this.viewMode === "normal" ? 1 : 0.18;
      ctx.drawImage(
        this.roadSheet,
        typeCol * size,
        typeRow * size,
        size,
        size,
        screen.x - width / 2,
        screen.y - height / 2,
        width,
        height,
      );
    }

    if (this.connectionSheet.complete && this.connectionSheet.naturalWidth && connectionIndex !== null && road.type !== "roundabout") {
      const col = connectionIndex % 4;
      const row = Math.floor(connectionIndex / 4);
      ctx.globalAlpha = this.viewMode === "normal" ? 0.36 : 0.14;
      ctx.drawImage(
        this.connectionSheet,
        col * size,
        row * size,
        size,
        size,
        screen.x - width / 2,
        screen.y - height / 2,
        width,
        height,
      );
    } else {
      this.drawProceduralRoadShape(ctx, screen, road, roadManager);
    }
    ctx.restore();
    this.drawConnectionLines(ctx, screen, road, roadManager);
    ctx.globalAlpha = 1;
  }

  /** Añade textura y bordes por tipo sin deformar la casilla isométrica. */
  drawRoadTexture(ctx, screen, road) {
    const zoom = this.camera.zoom;
    ctx.save();
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.clip();

    if (road.type === "dirt") {
      ctx.strokeStyle = "rgba(78, 52, 30, 0.24)";
      ctx.lineWidth = Math.max(1, zoom);
      for (let offset = -24; offset <= 24; offset += 8) {
        ctx.beginPath();
        ctx.moveTo(screen.x - 38 * zoom, screen.y + offset * zoom);
        ctx.lineTo(screen.x + 38 * zoom, screen.y + (offset + 8) * zoom);
        ctx.stroke();
      }
    }

    if (road.type === "stonePath" || road.type === "pedestrian") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = Math.max(1, zoom);
      for (let offset = -28; offset <= 28; offset += 12) {
        ctx.beginPath();
        ctx.moveTo(screen.x + offset * zoom, screen.y - 18 * zoom);
        ctx.lineTo(screen.x + offset * zoom, screen.y + 18 * zoom);
        ctx.stroke();
      }
    }

    if (road.type.includes("premium")) {
      ctx.strokeStyle = "rgba(79, 170, 209, 0.55)";
      ctx.lineWidth = Math.max(1, 2 * zoom);
      ctx.beginPath();
      this.diamond(ctx, screen.x, screen.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Muestra degradación: manchas, grietas y baches proporcionales a salud. */
  drawRoadDamage(ctx, screen, road) {
    if (road.health > 94 && !road.closedForRepair && !road.trafficClosed) return;
    const zoom = this.camera.zoom;
    const damage = road.closedForRepair || road.trafficClosed ? 0.55 : 1 - road.health / 100;
    const potholes = Math.max(1, Math.ceil(damage * 8));
    ctx.save();
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.clip();
    for (let index = 0; index < potholes; index += 1) {
      const seed = (road.x * 31 + road.y * 17 + index * 13) % 37;
      const ox = ((seed % 7) - 3) * 6 * zoom;
      const oy = ((Math.floor(seed / 3) % 5) - 2) * 4 * zoom;
      ctx.fillStyle = road.closedForRepair || road.trafficClosed ? "rgba(255, 209, 102, 0.62)" : "rgba(18, 15, 13, 0.68)";
      ctx.beginPath();
      ctx.ellipse(screen.x + ox, screen.y + oy, (3 + index) * zoom, (1.6 + index * 0.4) * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (road.health < 60 || road.closedForRepair || road.trafficClosed) {
      ctx.strokeStyle = road.closedForRepair || road.trafficClosed ? "rgba(255, 209, 102, 0.9)" : "rgba(31, 26, 24, 0.88)";
      ctx.lineWidth = Math.max(1, 1.4 * zoom);
      ctx.beginPath();
      ctx.moveTo(screen.x - 18 * zoom, screen.y - 3 * zoom);
      ctx.lineTo(screen.x - 5 * zoom, screen.y + 4 * zoom);
      ctx.lineTo(screen.x + 8 * zoom, screen.y - 2 * zoom);
      ctx.lineTo(screen.x + 20 * zoom, screen.y + 5 * zoom);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Clasifica automáticamente recta, curva, T, cruce o entrada por borde. */
  getConnectionAtlasIndex(road, roadManager) {
    if (road.type === "roundabout") return ROAD_TYPES.roundabout.atlasIndex;
    const bits = this.getRoadConnectionBits(road, roadManager);
    const count = Object.values(bits).filter(Boolean).length;
    if (count <= 1 && this.isEdgeRoad(road)) return 11;
    if ((bits.east || bits.west) && !(bits.north || bits.south)) return 0;
    if ((bits.north || bits.south) && !(bits.east || bits.west)) return 1;
    if (bits.north && bits.east && count === 2) return 2;
    if (bits.east && bits.south && count === 2) return 3;
    if (bits.south && bits.west && count === 2) return 4;
    if (bits.west && bits.north && count === 2) return 5;
    if (!bits.north && count === 3) return 6;
    if (!bits.east && count === 3) return 7;
    if (!bits.south && count === 3) return 8;
    if (!bits.west && count === 3) return 9;
    if (count === 4) return 10;
    return ROAD_TYPES[road.type]?.atlasIndex ?? null;
  }

  getRoadConnectionBits(road, roadManager) {
    const connectable = (x, y) => {
      const other = roadManager.getRoad(x, y);
      return Boolean(other && ROAD_TYPES[other.type]?.trafficAllowed === ROAD_TYPES[road.type]?.trafficAllowed);
    };
    return {
      north: connectable(road.x, road.y - 1),
      east: connectable(road.x + 1, road.y),
      south: connectable(road.x, road.y + 1),
      west: connectable(road.x - 1, road.y),
    };
  }

  isEdgeRoad(road) {
    return road.x === 0 || road.y === 0 || road.x === this.grid.width - 1 || road.y === this.grid.height - 1;
  }

  /** Fallback nítido si el atlas no ha cargado todavía. */
  drawProceduralRoadShape(ctx, screen, road, roadManager) {
    const bits = this.getRoadConnectionBits(road, roadManager);
    const zoom = this.camera.zoom;
    ctx.save();
    ctx.strokeStyle = roadColor(road);
    ctx.lineWidth = Math.max(10, 16 * zoom);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const [direction, connected] of Object.entries(bits)) {
      if (!connected) continue;
      ctx.moveTo(screen.x, screen.y);
      const end = this.getIsoLaneEndpoints(screen)[direction];
      ctx.lineTo(end[0], end[1]);
    }
    ctx.stroke();
    if (road.type === "roundabout") {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 14 * zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Dibuja líneas finas de conexión para que rectas, curvas y cruces sean inequívocos. */
  drawConnectionLines(ctx, screen, road, roadManager) {
    const bits = this.getRoadConnectionBits(road, roadManager);
    const zoom = this.camera.zoom;
    const center = [screen.x, screen.y];
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
      ctx.moveTo(center[0], center[1]);
      ctx.lineTo(endpoints[direction][0], endpoints[direction][1]);
    }
    ctx.stroke();
    if (road.type === "roundabout") {
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(2, 3 * zoom);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 20 * zoom, 10 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(25, 32, 30, 0.7)";
      ctx.lineWidth = Math.max(2, 5 * zoom);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 7 * zoom, 3.5 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Devuelve extremos alineados con las diagonales reales de la proyección iso. */
  getIsoLaneEndpoints(screen) {
    const tileWidth = this.grid.tileWidth * this.camera.zoom;
    const tileHeight = this.grid.tileHeight * this.camera.zoom;
    return {
      north: [screen.x + tileWidth * 0.42, screen.y - tileHeight * 0.42],
      east: [screen.x + tileWidth * 0.42, screen.y + tileHeight * 0.42],
      south: [screen.x - tileWidth * 0.42, screen.y + tileHeight * 0.42],
      west: [screen.x - tileWidth * 0.42, screen.y - tileHeight * 0.42],
    };
  }

  isOpenEdgeConnector(road, direction) {
    return (
      (direction === "west" && road.x === 0) ||
      (direction === "north" && road.y === 0) ||
      (direction === "east" && road.x === this.grid.width - 1) ||
      (direction === "south" && road.y === this.grid.height - 1)
    );
  }

  /** Pinta información jugable visible: límite, dirección, cierre y rotonda. */
  drawRoadMarkings(ctx, screen, road) {
    const zoom = this.camera.zoom;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(9, 11 * zoom)}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "rgba(20,25,24,0.62)";
    ctx.lineWidth = 3;

    if (road.type === "oneWay") {
      const arrow = { east: ">", west: "<", north: "^", south: "v" }[road.direction];
      ctx.strokeText(arrow, screen.x, screen.y - 1 * zoom);
      ctx.fillText(arrow, screen.x, screen.y - 1 * zoom);
    }

    if (road.type === "roundabout") {
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 17 * zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (road.closedForRepair) {
      ctx.fillStyle = "#ffd166";
      ctx.strokeText("!!", screen.x, screen.y);
      ctx.fillText("!!", screen.x, screen.y);
    }

    if (road.trafficClosed) {
      ctx.fillStyle = "#ffd166";
      ctx.strokeText("X", screen.x, screen.y);
      ctx.fillText("X", screen.x, screen.y);
    }

    ctx.fillStyle = "rgba(10, 16, 14, 0.82)";
    ctx.beginPath();
    ctx.roundRect(screen.x - 14 * zoom, screen.y + 13 * zoom, 28 * zoom, 15 * zoom, 4 * zoom);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(road.speedLimit), screen.x, screen.y + 21 * zoom);
    ctx.restore();
  }

  /** Dibuja edificios desde la hoja generada y usa fallback geométrico si falta. */
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

  /** Interpola la posición entre dos celdas para simular movimiento continuo. */
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

  /** Traza el rombo isométrico compartido por suelo y carreteras. */
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

function isSelected(selectedCell, x, y) {
  return selectedCell?.x === x && selectedCell?.y === y;
}

function roadColor(road) {
  if (road.closedForRepair) return "#7a6b45";
  if (road.health < 20) return "#6b4140";
  if (road.type === "dirt") return "#8a6b42";
  if (road.type === "concretePath") return "#a5a79f";
  if (road.type === "stonePath") return "#85847d";
  if (road.type === "pedestrian") return "#8f8d77";
  if (road.type === "oneWay") return "#59626a";
  if (road.type === "premiumRoad") return "#3e546d";
  if (road.type === "premiumAvenue") return "#3d5f70";
  if (road.type === "highway") return "#4f5963";
  if (road.type === "avenue") return "#5f6870";
  if (road.type === "roundabout") return "#56636a";
  return "#747d83";
}

function roadSurfaceColor(road) {
  if (road.closedForRepair) return "#776949";
  if (road.health < 20) return "#694847";
  return {
    dirt: "#80613f",
    concretePath: "#9fa39c",
    stonePath: "#7f817a",
    pedestrian: "#8f8c77",
    oneWay: "#59636b",
    twoWay: "#687179",
    premiumRoad: "#415a72",
    avenue: "#5d6870",
    premiumAvenue: "#426575",
    highway: "#4a545e",
    roundabout: "#58656d",
  }[road.type] ?? "#747d83";
}

function laneColor(road) {
  if (road.type === "dirt") return "rgba(245, 221, 174, 0.32)";
  if (road.type === "pedestrian" || road.type === "stonePath") return "rgba(255, 255, 255, 0.24)";
  if (road.type.includes("premium")) return "rgba(210, 242, 255, 0.72)";
  return "rgba(255, 255, 255, 0.62)";
}

function laneWidth(road, zoom) {
  if (road.type === "highway") return Math.max(4, 5 * zoom);
  if (road.type.includes("avenue")) return Math.max(3, 4 * zoom);
  if (road.type === "pedestrian") return Math.max(2, 3 * zoom);
  return Math.max(2, 3 * zoom);
}

export function roadViewColor(road, viewMode = "normal") {
  if (viewMode === "traffic") {
    const intensity = Math.min(1, road.traffic / Math.max(1, ROAD_TYPES[road.type].capacity));
    return heatColor(intensity);
  }
  if (viewMode === "health") return healthColor(road.health, road.closedForRepair || road.trafficClosed);
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
  return {
    20: "#8f6a44",
    30: "#6f8f59",
    50: "#4f7fa6",
    80: "#7254a8",
  }[speedLimit] ?? "#747d83";
}

function typeColor(type) {
  return {
    dirt: "#8a6b42",
    concretePath: "#a7aba2",
    stonePath: "#797b73",
    pedestrian: "#85a56c",
    oneWay: "#5f6e7d",
    twoWay: "#6a747d",
    premiumRoad: "#326f9e",
    avenue: "#5f867b",
    premiumAvenue: "#2f9bb3",
    highway: "#5c5f74",
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
