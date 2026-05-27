const ROAD_LAYOUTS = {
  dirt: { roadWidth: 8, sidewalkWidth: 0, road: "#8d6540", sidewalk: "transparent", curb: "rgba(83, 53, 28, 0.34)", line: "rgba(255, 238, 196, 0.2)", lanes: 0 },
  gravelRoad: { roadWidth: 9, sidewalkWidth: 2, road: "#7f786b", sidewalk: "#a99f8d", curb: "#8d846f", line: "rgba(255,255,255,0.2)", lanes: 0 },
  concretePath: { roadWidth: 10, sidewalkWidth: 3, road: "#bcc3bd", sidewalk: "#d7d9d2", curb: "#aeb5ad", line: "rgba(255,255,255,0.24)", lanes: 0 },
  stonePath: { roadWidth: 10, sidewalkWidth: 4, road: "#9f9788", sidewalk: "#c6bda9", curb: "#8d8678", line: "rgba(255,255,255,0.26)", lanes: 0 },
  pedestrian: { roadWidth: 8, sidewalkWidth: 8, road: "#b7a77f", sidewalk: "#d5c89f", curb: "#aa9a73", line: "rgba(255,255,255,0.32)", lanes: 0 },
  oneWay: { roadWidth: 11, sidewalkWidth: 5, road: "#444a4d", sidewalk: "#cfc8ba", curb: "#aaa296", line: "rgba(255,255,255,0.66)", lanes: 1 },
  twoWay: { roadWidth: 13, sidewalkWidth: 5, road: "#373d40", sidewalk: "#cec7ba", curb: "#aaa196", line: "rgba(255, 222, 98, 0.72)", lanes: 2 },
  cityRoad: { roadWidth: 15, sidewalkWidth: 6, road: "#343a3d", sidewalk: "#d2cabb", curb: "#aaa196", line: "rgba(255,255,255,0.58)", lanes: 2 },
  premiumRoad: { roadWidth: 17, sidewalkWidth: 7, road: "#30414a", sidewalk: "#dad7cc", curb: "#9bb9c8", line: "rgba(190, 231, 255, 0.72)", lanes: 2 },
  avenue: { roadWidth: 22, sidewalkWidth: 9, road: "#32393d", sidewalk: "#d7d0c1", curb: "#afa696", line: "rgba(255, 225, 103, 0.78)", lanes: 3, median: "#d8c870" },
  boulevard: { roadWidth: 23, sidewalkWidth: 10, road: "#323b3d", sidewalk: "#d9d3c3", curb: "#9fb894", line: "rgba(255,255,255,0.7)", lanes: 3, median: "#628e54", trees: true },
  premiumAvenue: { roadWidth: 25, sidewalkWidth: 11, road: "#283c42", sidewalk: "#dfdbcf", curb: "#8fcad3", line: "rgba(208, 245, 255, 0.82)", lanes: 4, median: "#94dce5" },
  expressway: { roadWidth: 30, sidewalkWidth: 5, road: "#2b3039", sidewalk: "#737c82", curb: "#566068", line: "rgba(255,255,255,0.82)", lanes: 4, shoulder: true },
  highway: { roadWidth: 34, sidewalkWidth: 5, road: "#252a35", sidewalk: "#67717a", curb: "#4e5963", line: "rgba(255,255,255,0.84)", lanes: 5, shoulder: true, barrier: true },
  megaHighway: { roadWidth: 39, sidewalkWidth: 5, road: "#202433", sidewalk: "#616b74", curb: "#48535d", line: "rgba(255, 220, 92, 0.88)", lanes: 6, shoulder: true, barrier: true },
  roundabout: { roadWidth: 22, sidewalkWidth: 8, road: "#373d40", sidewalk: "#d7d0c1", curb: "#afa696", line: "rgba(255,255,255,0.76)", lanes: 2, roundabout: true },
};

/** Dibuja carreteras continuas, con aceras y anchuras por categoría. */
export function installRoadSkins(RendererClass) {
  RendererClass.prototype.drawRoadTexture = function drawRoadTextureClean() {
    // El aspecto completo se dibuja en drawConnectionLines para evitar rombos sueltos.
  };

  RendererClass.prototype.drawConnectionLines = function drawContinuousRoad(ctx, screen, road, roadManager) {
    drawRoad(this, ctx, screen, road, roadManager);
  };
}

function drawRoad(renderer, ctx, screen, road, roadManager) {
  const layout = getLayout(road);
  const zoom = renderer.camera.zoom;
  const directions = getDirections(renderer, road, roadManager);
  const endpoints = getExtendedEndpoints(renderer, screen, zoom);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (layout.roundabout) {
    drawRoundabout(ctx, screen, layout, zoom);
    ctx.restore();
    return;
  }

  drawConnectedStroke(ctx, screen, endpoints, directions, "rgba(10, 12, 14, 0.16)", layout.roadWidth + layout.sidewalkWidth * 2 + 5, zoom);
  if (layout.sidewalkWidth > 0) {
    drawConnectedStroke(ctx, screen, endpoints, directions, layout.sidewalk, layout.roadWidth + layout.sidewalkWidth * 2, zoom);
    drawConnectedStroke(ctx, screen, endpoints, directions, layout.curb, layout.roadWidth + layout.sidewalkWidth * 2 - 3, zoom);
  }
  drawConnectedStroke(ctx, screen, endpoints, directions, layout.road, layout.roadWidth, zoom);

  if (layout.shoulder) drawShoulders(ctx, screen, endpoints, directions, layout, zoom);
  if (layout.median) drawConnectedStroke(ctx, screen, endpoints, directions, layout.median, 3.8, zoom);
  if (layout.barrier) drawConnectedStroke(ctx, screen, endpoints, directions, "rgba(238,242,240,0.72)", 1.4, zoom);
  drawLaneLines(ctx, screen, endpoints, directions, layout, zoom, road);
  if (layout.trees) drawTreeDots(ctx, screen, endpoints, directions, zoom);

  ctx.restore();
}

function getDirections(renderer, road, roadManager) {
  const bits = renderer.getRoadConnectionBits(road, roadManager);
  const directions = Object.entries(bits)
    .filter(([direction, connected]) => connected || renderer.isOpenEdgeConnector(road, direction))
    .map(([direction]) => direction);

  if (directions.length) return directions;
  if (road.type === "oneWay") return [road.direction];
  return ["east", "west"];
}

function getExtendedEndpoints(renderer, screen, zoom) {
  const base = renderer.getIsoLaneEndpoints(screen);
  const extension = 9 * zoom;
  const extended = {};
  for (const [direction, end] of Object.entries(base)) {
    const dx = end[0] - screen.x;
    const dy = end[1] - screen.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    extended[direction] = [end[0] + (dx / length) * extension, end[1] + (dy / length) * extension];
  }
  return extended;
}

function drawConnectedStroke(ctx, screen, endpoints, directions, color, width, zoom) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width * zoom);
  ctx.beginPath();
  for (const direction of directions) {
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(endpoints[direction][0], endpoints[direction][1]);
  }
  if (directions.length === 2 && areOpposite(directions[0], directions[1])) {
    const a = endpoints[directions[0]];
    const b = endpoints[directions[1]];
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
}

function drawLaneLines(ctx, screen, endpoints, directions, layout, zoom, road) {
  if (!layout.lanes) return;
  ctx.strokeStyle = layout.line;
  ctx.lineWidth = Math.max(1, 1.05 * zoom);

  if (layout.lanes <= 2) {
    ctx.setLineDash([5.5 * zoom, 6 * zoom]);
    drawConnectedStroke(ctx, screen, endpoints, directions, layout.line, 1.05, zoom);
    ctx.setLineDash([]);
    if (road.type === "oneWay") drawOneWayArrow(ctx, screen, road, zoom);
    return;
  }

  ctx.setLineDash([6 * zoom, 7 * zoom]);
  for (const offset of getLaneOffsets(layout.lanes, zoom)) {
    drawOffsetStroke(ctx, screen, endpoints, directions, offset, layout.line, 1, zoom);
  }
  ctx.setLineDash([]);
}

function drawShoulders(ctx, screen, endpoints, directions, layout, zoom) {
  const offset = (layout.roadWidth / 2 - 2.2) * zoom;
  drawOffsetStroke(ctx, screen, endpoints, directions, -offset, "rgba(235,238,235,0.48)", 1.25, zoom);
  drawOffsetStroke(ctx, screen, endpoints, directions, offset, "rgba(235,238,235,0.48)", 1.25, zoom);
}

function drawOffsetStroke(ctx, screen, endpoints, directions, offset, color, width, zoom) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width * zoom);
  ctx.beginPath();
  for (const direction of directions) {
    const end = endpoints[direction];
    const normal = getNormal(screen, end);
    ctx.moveTo(screen.x + normal.x * offset, screen.y + normal.y * offset);
    ctx.lineTo(end[0] + normal.x * offset, end[1] + normal.y * offset);
  }
  ctx.stroke();
}

function drawTreeDots(ctx, screen, endpoints, directions, zoom) {
  ctx.fillStyle = "rgba(42, 113, 57, 0.92)";
  for (const direction of directions) {
    const end = endpoints[direction];
    const normal = getNormal(screen, end);
    for (const t of [0.42, 0.68]) {
      const x = screen.x + (end[0] - screen.x) * t + normal.x * 10 * zoom;
      const y = screen.y + (end[1] - screen.y) * t + normal.y * 10 * zoom;
      ctx.beginPath();
      ctx.arc(x, y, 2.3 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawOneWayArrow(ctx, screen, road, zoom) {
  const arrow = { east: ">", west: "<", north: "^", south: "v" }[road.direction] ?? ">";
  ctx.save();
  ctx.font = `${Math.max(9, 12 * zoom)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "rgba(10,12,14,0.55)";
  ctx.lineWidth = Math.max(2, 2 * zoom);
  ctx.strokeText(arrow, screen.x, screen.y);
  ctx.fillText(arrow, screen.x, screen.y);
  ctx.restore();
}

function drawRoundabout(ctx, screen, layout, zoom) {
  ctx.strokeStyle = "rgba(10, 12, 14, 0.16)";
  ctx.lineWidth = Math.max(2, (layout.roadWidth + layout.sidewalkWidth * 2 + 4) * zoom);
  ellipse(ctx, screen, 24, 12, zoom);

  ctx.strokeStyle = layout.sidewalk;
  ctx.lineWidth = Math.max(2, (layout.roadWidth + layout.sidewalkWidth * 2) * zoom);
  ellipse(ctx, screen, 23, 11.5, zoom);

  ctx.strokeStyle = layout.curb;
  ctx.lineWidth = Math.max(2, (layout.roadWidth + layout.sidewalkWidth * 2 - 3) * zoom);
  ellipse(ctx, screen, 22, 11, zoom);

  ctx.strokeStyle = layout.road;
  ctx.lineWidth = Math.max(2, layout.roadWidth * zoom);
  ellipse(ctx, screen, 20, 10, zoom);

  ctx.strokeStyle = layout.line;
  ctx.lineWidth = Math.max(1, 1.2 * zoom);
  ellipse(ctx, screen, 20, 10, zoom);
}

function ellipse(ctx, screen, rx, ry, zoom) {
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, rx * zoom, ry * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function getLaneOffsets(lanes, zoom) {
  const offsets = [];
  for (let lane = 1; lane < lanes; lane += 1) offsets.push((lane - lanes / 2) * 4.8 * zoom);
  return offsets;
}

function getNormal(screen, end) {
  const dx = end[0] - screen.x;
  const dy = end[1] - screen.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return { x: -dy / length, y: dx / length };
}

function areOpposite(a, b) {
  return (a === "north" && b === "south") || (a === "south" && b === "north") || (a === "east" && b === "west") || (a === "west" && b === "east");
}

function getLayout(road) {
  return ROAD_LAYOUTS[road.type] ?? ROAD_LAYOUTS.twoWay;
}
