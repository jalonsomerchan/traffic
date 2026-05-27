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

  /** Fallback geométrico si no está disponible el atlas de sprites. */
  drawProceduralRoadShape(ctx, screen, road, roadManager) {
    const bits = this.getRoadConnectionBits(road, roadManager);
    const zoom = this.camera.zoom;
    ctx.save();
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.clip();
    ctx.fillStyle = roadColor(road);
    ctx.beginPath();
    this.diamond(ctx, screen.x, screen.y);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(2, 4 * zoom);
    const center = [screen.x, screen.y];
    const endpoints = this.getIsoLaneEndpoints(screen);
    ctx.beginPath();
    for (const [direction, connected] of Object.entries(bits)) {
      if (!connected) continue;
      ctx.moveTo(center[0], center[1]);
      ctx.lineTo(endpoints[direction][0], endpoints[direction][1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Calcula conexiones de cuatro direcciones compatibles con uniones y bordes. */
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

  /** Visualiza desgaste y cierres sin ocultar el tipo de vía. */
  drawRoadDamage(ctx, screen, road) {
    const zoom = this.camera.zoom;
    const damage = 1 - road.health / 100;
    if (damage < 0.22 && !road.closedForRepair && !road.trafficClosed) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, 0.18 + damage * 0.55);
    ctx.strokeStyle = road.closedForRepair || road.trafficClosed ? "#ffd166" : "#2b1e1b";
    ctx.lineWidth = Math.max(1, 1.3 * zoom);
    ctx.beginPath();
    for (let i = -1; i <= 1; i += 1) {
      ctx.moveTo(screen.x - 20 * zoom, screen.y + i * 7 * zoom);
      ctx.lineTo(screen.x + 20 * zoom, screen.y + (i * 7 + 4) * zoom);
    }
    ctx.stroke();
    if (road.closedForRepair || road.trafficClosed) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#ffd166";
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
