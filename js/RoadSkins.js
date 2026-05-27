import { getRoadWorkVisualState } from "./RoadWorkVisuals.js";

const ROAD_LAYOUTS = {
  dirt: { road: "#9a6a3d", sidewalk: "#7b5635", line: "rgba(255, 232, 176, 0.26)", lineStyle: "none" },
  gravelRoad: { road: "#8a8173", sidewalk: "#b7aa96", line: "rgba(255,255,255,0.26)", lineStyle: "speckle" },
  concretePath: { road: "#b7bdb5", sidewalk: "#d5d8cf", line: "rgba(255,255,255,0.32)", lineStyle: "none" },
  stonePath: { road: "#928a7d", sidewalk: "#c4baa6", line: "rgba(255,255,255,0.34)", lineStyle: "pavers" },
  pedestrian: { road: "#c2ae7f", sidewalk: "#d8c995", line: "rgba(255,255,255,0.42)", lineStyle: "crosswalk" },
  oneWay: { road: "#596771", sidewalk: "#d0c8ba", line: "rgba(255,255,255,0.78)", lineStyle: "arrow" },
  twoWay: { road: "#586069", sidewalk: "#cfc6b8", line: "rgba(255, 224, 92, 0.82)", lineStyle: "center" },
  cityRoad: { road: "#4f5960", sidewalk: "#d5ccbf", line: "rgba(255,255,255,0.72)", lineStyle: "dashed" },
  premiumRoad: { road: "#426b86", sidewalk: "#dce0d6", line: "rgba(195,239,255,0.88)", lineStyle: "double" },
  avenue: { road: "#526f65", sidewalk: "#dad1c1", line: "rgba(255, 225, 98, 0.88)", lineStyle: "median" },
  boulevard: { road: "#557a61", sidewalk: "#d9d2c2", line: "rgba(115, 173, 92, 0.95)", lineStyle: "greenMedian" },
  premiumAvenue: { road: "#3f7f8f", sidewalk: "#e1ded1", line: "rgba(190, 248, 255, 0.94)", lineStyle: "doubleMedian" },
  expressway: { road: "#4c5268", sidewalk: "#747d86", line: "rgba(255,255,255,0.88)", lineStyle: "lanes" },
  highway: { road: "#424961", sidewalk: "#6c7680", line: "rgba(255,255,255,0.9)", lineStyle: "highway" },
  megaHighway: { road: "#383f5f", sidewalk: "#636e7b", line: "rgba(255, 221, 88, 0.94)", lineStyle: "mega" },
  roundabout: { road: "#6d5d87", sidewalk: "#d6cec0", line: "rgba(255,255,255,0.84)", lineStyle: "roundabout" },
};

const SIDE_POINTS = {
  north: ["top", "right"],
  east: ["right", "bottom"],
  south: ["bottom", "left"],
  west: ["left", "top"],
};

const OPPOSITE = { north: "south", east: "west", south: "north", west: "east" };

export function installRoadSkins(RendererClass) {
  RendererClass.prototype.drawRoadTexture = function drawRoadTextureClean() {
    // El render completo de la vía se hace en drawConnectionLines.
  };

  RendererClass.prototype.drawConnectionLines = function drawIsometricRoadTile(ctx, screen, road, roadManager) {
    drawRoadTile(this, ctx, screen, road, roadManager);
  };
}

function drawRoadTile(renderer, ctx, screen, road, roadManager) {
  const layout = getLayout(road);
  const zoom = renderer.camera.zoom;
  const points = getDiamondPoints(renderer, screen);
  const connected = getConnectedSides(renderer, road, roadManager);
  const inset = Math.max(5, 6.5 * zoom);
  const workState = getRoadWorkVisualState(road);

  ctx.save();
  drawPolygon(ctx, [points.top, points.right, points.bottom, points.left], workState ? shade(layout.road, -12) : layout.road);
  drawTileShading(ctx, points, zoom);
  drawOutsideSidewalks(ctx, points, connected, layout, inset);
  drawOutsideCurbs(ctx, points, connected, layout, zoom);
  drawSidewalkHighlights(ctx, points, connected, layout, inset, zoom);
  drawCenterMarkings(ctx, screen, points, connected, layout, road, zoom);
  if (workState) drawRoadWorkOverlay(ctx, screen, points, connected, workState, zoom);
  ctx.restore();
}

function getDiamondPoints(renderer, screen) {
  const tileWidth = renderer.grid.tileWidth * renderer.camera.zoom;
  const tileHeight = renderer.grid.tileHeight * renderer.camera.zoom;
  return {
    top: { x: screen.x, y: screen.y - tileHeight / 2 },
    right: { x: screen.x + tileWidth / 2, y: screen.y },
    bottom: { x: screen.x, y: screen.y + tileHeight / 2 },
    left: { x: screen.x - tileWidth / 2, y: screen.y },
  };
}

function getConnectedSides(renderer, road, roadManager) {
  const bits = renderer.getRoadConnectionBits(road, roadManager);
  return {
    north: bits.north || renderer.isOpenEdgeConnector(road, "north"),
    east: bits.east || renderer.isOpenEdgeConnector(road, "east"),
    south: bits.south || renderer.isOpenEdgeConnector(road, "south"),
    west: bits.west || renderer.isOpenEdgeConnector(road, "west"),
  };
}

function drawOutsideSidewalks(ctx, points, connected, layout, inset) {
  for (const side of Object.keys(SIDE_POINTS)) {
    if (connected[side]) continue;
    const [aName, bName] = SIDE_POINTS[side];
    const a = points[aName];
    const b = points[bName];
    const center = averagePoint(points.top, points.right, points.bottom, points.left);
    const ai = moveTowards(a, center, inset);
    const bi = moveTowards(b, center, inset);
    drawPolygon(ctx, [a, b, bi, ai], layout.sidewalk);
  }
}

function drawOutsideCurbs(ctx, points, connected, layout, zoom) {
  ctx.save();
  ctx.lineWidth = Math.max(1, 1.5 * zoom);
  ctx.strokeStyle = shade(layout.sidewalk, -22);
  ctx.lineCap = "round";
  for (const side of Object.keys(SIDE_POINTS)) {
    if (connected[side]) continue;
    const [aName, bName] = SIDE_POINTS[side];
    ctx.beginPath();
    ctx.moveTo(points[aName].x, points[aName].y);
    ctx.lineTo(points[bName].x, points[bName].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSidewalkHighlights(ctx, points, connected, layout, inset, zoom) {
  ctx.save();
  ctx.lineWidth = Math.max(1, 0.8 * zoom);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  for (const side of Object.keys(SIDE_POINTS)) {
    if (connected[side]) continue;
    const [aName, bName] = SIDE_POINTS[side];
    const center = averagePoint(points.top, points.right, points.bottom, points.left);
    const a = moveTowards(points[aName], center, inset * 0.55);
    const b = moveTowards(points[bName], center, inset * 0.55);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (layout.lineStyle === "pavers" || layout.lineStyle === "crosswalk") drawSidewalkPaving(ctx, points, connected, inset, zoom);
  ctx.restore();
}

function drawSidewalkPaving(ctx, points, connected, inset, zoom) {
  ctx.strokeStyle = "rgba(80, 66, 50, 0.18)";
  ctx.lineWidth = Math.max(1, 0.65 * zoom);
  const center = averagePoint(points.top, points.right, points.bottom, points.left);
  for (const side of Object.keys(SIDE_POINTS)) {
    if (connected[side]) continue;
    const [aName, bName] = SIDE_POINTS[side];
    for (const t of [0.25, 0.5, 0.75]) {
      const edge = lerpPoint(points[aName], points[bName], t);
      const inner = moveTowards(edge, center, inset * 0.86);
      ctx.beginPath();
      ctx.moveTo(edge.x, edge.y);
      ctx.lineTo(inner.x, inner.y);
      ctx.stroke();
    }
  }
}

function drawRoadWorkOverlay(ctx, screen, points, connected, workState, zoom) {
  ctx.save();
  drawWorkTint(ctx, points, workState);
  drawWorkBarriers(ctx, points, connected, zoom);
  drawWorkProgressBadge(ctx, screen, workState, zoom);
  ctx.restore();
}

function drawWorkTint(ctx, points, workState) {
  ctx.globalAlpha = workState.type === "repair" ? 0.2 : 0.28;
  drawPolygon(ctx, [points.top, points.right, points.bottom, points.left], workState.type === "repair" ? "#ffd166" : "#f59e0b");
  ctx.globalAlpha = 1;
}

function drawWorkBarriers(ctx, points, connected, zoom) {
  ctx.save();
  ctx.lineWidth = Math.max(2, 2.2 * zoom);
  ctx.strokeStyle = "rgba(255, 222, 96, 0.95)";
  ctx.setLineDash([5 * zoom, 4 * zoom]);
  for (const side of Object.keys(SIDE_POINTS)) {
    if (connected[side]) continue;
    const [aName, bName] = SIDE_POINTS[side];
    const a = points[aName];
    const b = points[bName];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(42, 34, 20, 0.94)";
  for (const side of Object.keys(SIDE_POINTS)) {
    if (!connected[side]) continue;
    const marker = sideMidpoint(points, side);
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 3.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorkProgressBadge(ctx, screen, workState, zoom) {
  const radius = Math.max(9, 10 * zoom);
  const x = screen.x;
  const y = screen.y - 24 * zoom;
  ctx.save();
  ctx.fillStyle = "rgba(20, 24, 28, 0.88)";
  ctx.beginPath();
  ctx.roundRect(x - 23 * zoom, y - 10 * zoom, 46 * zoom, 20 * zoom, 7 * zoom);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = Math.max(1, 1.2 * zoom);
  ctx.beginPath();
  ctx.arc(x - 12 * zoom, y, radius * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = workState.type === "repair" ? "#34d399" : "#facc15";
  ctx.lineWidth = Math.max(2, 2 * zoom);
  ctx.beginPath();
  ctx.arc(x - 12 * zoom, y, radius * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * workState.progress);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(7, 7.5 * zoom)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(Math.ceil(workState.remainingSeconds)), x - 12 * zoom, y);
  ctx.font = `${Math.max(6, 6.5 * zoom)}px system-ui`;
  ctx.fillText(workState.label, x + 10 * zoom, y);
  ctx.restore();
}

function drawCenterMarkings(ctx, screen, points, connected, layout, road, zoom) {
  if (layout.lineStyle === "none") return;
  if (layout.lineStyle === "roundabout") {
    drawRoundaboutMarking(ctx, screen, layout, zoom);
    return;
  }
  if (layout.lineStyle === "speckle") {
    drawSpeckles(ctx, screen, layout, zoom);
    return;
  }
  if (layout.lineStyle === "pavers" || layout.lineStyle === "crosswalk") {
    drawPaverLines(ctx, points, layout, zoom, layout.lineStyle === "crosswalk");
    return;
  }

  const directions = getLineDirections(connected, road);
  if (!directions.length) directions.push("east", "west");

  ctx.save();
  ctx.strokeStyle = layout.line;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (["dashed", "lanes", "highway", "mega"].includes(layout.lineStyle)) ctx.setLineDash([5 * zoom, 5 * zoom]);
  ctx.lineWidth = Math.max(1, 1.15 * zoom);
  drawDirectionPath(ctx, screen, points, directions, 0);
  ctx.setLineDash([]);

  if (["double", "doubleMedian"].includes(layout.lineStyle)) {
    drawDirectionPath(ctx, screen, points, directions, -3 * zoom);
    drawDirectionPath(ctx, screen, points, directions, 3 * zoom);
  }

  if (["median", "greenMedian", "doubleMedian"].includes(layout.lineStyle)) {
    ctx.strokeStyle = layout.line;
    ctx.lineWidth = Math.max(2, 3.2 * zoom);
    drawDirectionPath(ctx, screen, points, directions, 0);
  }

  if (["highway", "mega"].includes(layout.lineStyle)) {
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = Math.max(1, 1 * zoom);
    drawDirectionPath(ctx, screen, points, directions, -7 * zoom);
    drawDirectionPath(ctx, screen, points, directions, 7 * zoom);
  }

  if (layout.lineStyle === "arrow") drawOneWayArrow(ctx, screen, road, zoom);
  if (layout.lineStyle === "greenMedian") drawMedianTrees(ctx, screen, points, directions, zoom);
  ctx.restore();
}

function getLineDirections(connected, road) {
  const sides = Object.entries(connected).filter(([, value]) => value).map(([side]) => side);
  if (road.type === "oneWay" && connected[road.direction]) return [road.direction];
  if (sides.length === 1) return sides;
  if (sides.length > 1) return sides;
  return road.type === "oneWay" ? [road.direction] : [];
}

function drawDirectionPath(ctx, screen, points, directions, offset) {
  ctx.beginPath();
  for (const direction of directions) {
    const edgePoint = sideMidpoint(points, direction);
    const normal = getNormal(screen, edgePoint);
    ctx.moveTo(screen.x + normal.x * offset, screen.y + normal.y * offset);
    ctx.lineTo(edgePoint.x + normal.x * offset, edgePoint.y + normal.y * offset);
  }
  const opposite = directions.length === 2 && OPPOSITE[directions[0]] === directions[1];
  if (opposite) {
    const a = sideMidpoint(points, directions[0]);
    const b = sideMidpoint(points, directions[1]);
    const normal = getNormal(a, b);
    ctx.moveTo(a.x + normal.x * offset, a.y + normal.y * offset);
    ctx.lineTo(b.x + normal.x * offset, b.y + normal.y * offset);
  }
  ctx.stroke();
}

function drawRoundaboutMarking(ctx, screen, layout, zoom) {
  ctx.save();
  ctx.strokeStyle = layout.sidewalk;
  ctx.lineWidth = Math.max(4, 8 * zoom);
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 18 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = layout.line;
  ctx.lineWidth = Math.max(1, 1.4 * zoom);
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 20 * zoom, 10 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSpeckles(ctx, screen, layout, zoom) {
  ctx.fillStyle = layout.line;
  for (const [dx, dy] of [[-12, -3], [-2, 5], [10, -5], [16, 4], [-18, 6]]) {
    ctx.beginPath();
    ctx.arc(screen.x + dx * zoom, screen.y + dy * zoom, Math.max(1, 1.2 * zoom), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPaverLines(ctx, points, layout, zoom, crosswalk) {
  ctx.save();
  ctx.strokeStyle = layout.line;
  ctx.lineWidth = Math.max(1, 0.9 * zoom);
  const steps = crosswalk ? 5 : 4;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const a = lerpPoint(points.left, points.top, t);
    const b = lerpPoint(points.bottom, points.right, t);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOneWayArrow(ctx, screen, road, zoom) {
  const arrow = { east: "›", west: "‹", north: "⌃", south: "⌄" }[road.direction] ?? "›";
  ctx.save();
  ctx.font = `${Math.max(10, 15 * zoom)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.strokeStyle = "rgba(18,24,28,0.55)";
  ctx.lineWidth = Math.max(2, 2 * zoom);
  ctx.strokeText(arrow, screen.x, screen.y);
  ctx.fillText(arrow, screen.x, screen.y);
  ctx.restore();
}

function drawMedianTrees(ctx, screen, points, directions, zoom) {
  ctx.fillStyle = "rgba(39, 124, 55, 0.95)";
  for (const direction of directions.slice(0, 4)) {
    const edgePoint = sideMidpoint(points, direction);
    const x = screen.x + (edgePoint.x - screen.x) * 0.55;
    const y = screen.y + (edgePoint.y - screen.y) * 0.55;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTileShading(ctx, points, zoom) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth = Math.max(1, 1 * zoom);
  ctx.beginPath();
  ctx.moveTo(points.left.x, points.left.y);
  ctx.lineTo(points.top.x, points.top.y);
  ctx.lineTo(points.right.x, points.right.y);
  ctx.stroke();
  ctx.restore();
}

function sideMidpoint(points, side) {
  const [aName, bName] = SIDE_POINTS[side];
  return midpoint(points[aName], points[bName]);
}

function drawPolygon(ctx, points, fillStyle) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fill();
}

function moveTowards(point, target, distance) {
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return { x: point.x + (dx / length) * distance, y: point.y + (dy / length) * distance };
}

function getNormal(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return { x: -dy / length, y: dx / length };
}

function averagePoint(...points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function shade(hex, amount) {
  if (!hex.startsWith("#")) return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  const r = clamp(((value >> 16) & 255) + amount);
  const g = clamp(((value >> 8) & 255) + amount);
  const b = clamp((value & 255) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function getLayout(road) {
  return ROAD_LAYOUTS[road.type] ?? ROAD_LAYOUTS.twoWay;
}
