const ROAD_LAYOUTS = {
  dirt: { footprint: 1, roadWidth: 9, sidewalkWidth: 0, road: "#8a633b", sidewalk: "transparent", line: "rgba(255, 235, 190, 0.22)", lanes: 0 },
  gravelRoad: { footprint: 1, roadWidth: 10, sidewalkWidth: 1, road: "#7d7669", sidewalk: "#b9b0a0", line: "rgba(255,255,255,0.28)", lanes: 0 },
  concretePath: { footprint: 1, roadWidth: 10, sidewalkWidth: 3, road: "#c2c8c0", sidewalk: "#d8ddd5", line: "rgba(255,255,255,0.32)", lanes: 0 },
  stonePath: { footprint: 1, roadWidth: 10, sidewalkWidth: 4, road: "#9b9485", sidewalk: "#c9c0ad", line: "rgba(255,255,255,0.34)", lanes: 0 },
  pedestrian: { footprint: 1, roadWidth: 8, sidewalkWidth: 9, road: "#b8a985", sidewalk: "#d7c79f", line: "rgba(255,255,255,0.38)", lanes: 0 },
  oneWay: { footprint: 1, roadWidth: 12, sidewalkWidth: 4, road: "#3b4144", sidewalk: "#c9c4b8", line: "rgba(255,255,255,0.72)", lanes: 1 },
  twoWay: { footprint: 1, roadWidth: 14, sidewalkWidth: 5, road: "#343a3e", sidewalk: "#cbc6ba", line: "rgba(255,224,105,0.78)", lanes: 2 },
  cityRoad: { footprint: 1, roadWidth: 17, sidewalkWidth: 6, road: "#30363a", sidewalk: "#d1cabd", line: "rgba(255,255,255,0.66)", lanes: 2 },
  premiumRoad: { footprint: 1, roadWidth: 19, sidewalkWidth: 7, road: "#2f3d45", sidewalk: "#d9d7cc", line: "rgba(190,230,255,0.78)", lanes: 2 },
  avenue: { footprint: 2, roadWidth: 24, sidewalkWidth: 9, road: "#30383d", sidewalk: "#d5d0c4", line: "rgba(255,224,105,0.82)", lanes: 3, median: true },
  boulevard: { footprint: 2, roadWidth: 26, sidewalkWidth: 11, road: "#303a3d", sidewalk: "#d8d4c7", line: "rgba(255,255,255,0.78)", lanes: 3, median: true, trees: true },
  premiumAvenue: { footprint: 2, roadWidth: 28, sidewalkWidth: 12, road: "#263940", sidewalk: "#dedbd0", line: "rgba(202,244,255,0.88)", lanes: 4, median: true },
  expressway: { footprint: 3, roadWidth: 33, sidewalkWidth: 4, road: "#292d36", sidewalk: "#69717a", line: "rgba(255,255,255,0.84)", lanes: 4, shoulder: true },
  highway: { footprint: 3, roadWidth: 38, sidewalkWidth: 3, road: "#252936", sidewalk: "#606a72", line: "rgba(255,255,255,0.88)", lanes: 5, shoulder: true, barrier: true },
  megaHighway: { footprint: 3, roadWidth: 46, sidewalkWidth: 3, road: "#202433", sidewalk: "#59636d", line: "rgba(255,219,92,0.92)", lanes: 6, shoulder: true, barrier: true },
  roundabout: { footprint: 2, roadWidth: 24, sidewalkWidth: 8, road: "#343a3e", sidewalk: "#d5d0c4", line: "rgba(255,255,255,0.84)", lanes: 2, roundabout: true },
};

/** Dibuja carreteras sobrias: acera + calzada, con anchura según categoría. */
export function installRoadSkins(RendererClass) {
  RendererClass.prototype.drawRoadTexture = function drawRoadTextureWithSidewalks(ctx, screen, road) {
    drawTileBase(this, ctx, screen, road);
  };

  RendererClass.prototype.drawConnectionLines = function drawRoadConnectionsWithSidewalks(ctx, screen, road, roadManager) {
    drawRoadFootprint(this, ctx, screen, road, roadManager);
  };
}

function drawTileBase(renderer, ctx, screen, road) {
  const layout = getLayout(road);
  const zoom = renderer.camera.zoom;
  ctx.save();
  ctx.beginPath();
  renderer.diamond(ctx, screen.x, screen.y);
  ctx.clip();

  if (layout.sidewalkWidth > 0) {
    ctx.fillStyle = layout.sidewalk;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    renderer.diamond(ctx, screen.x, screen.y);
    ctx.fill();
  }

  if (road.type === "dirt") {
    ctx.strokeStyle = "rgba(88, 56, 30, 0.28)";
    ctx.lineWidth = Math.max(1, zoom);
    for (let offset = -22; offset <= 22; offset += 11) {
      ctx.beginPath();
      ctx.moveTo(screen.x - 34 * zoom, screen.y + offset * zoom);
      ctx.lineTo(screen.x + 34 * zoom, screen.y + (offset + 7) * zoom);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawRoadFootprint(renderer, ctx, screen, road, roadManager) {
  const layout = getLayout(road);
  const bits = renderer.getRoadConnectionBits(road, roadManager);
  const endpoints = renderer.getIsoLaneEndpoints(screen);
  const directions = Object.entries(bits)
    .filter(([direction, connected]) => connected || renderer.isOpenEdgeConnector(road, direction))
    .map(([direction]) => direction);
  if (!directions.length) directions.push("east", "west");

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (layout.roundabout) {
    drawRoundabout(ctx, screen, layout, renderer.camera.zoom);
    ctx.restore();
    return;
  }

  drawStrokes(ctx, screen, endpoints, directions, layout, renderer.camera.zoom);
  drawLaneMarkings(ctx, screen, endpoints, directions, layout, renderer.camera.zoom, road);

  ctx.restore();
}

function drawStrokes(ctx, screen, endpoints, directions, layout, zoom) {
  const backplateWidth = (layout.roadWidth + layout.sidewalkWidth * 2 + (layout.footprint - 1) * 10) * zoom;
  const roadWidth = layout.roadWidth * zoom;
  const shadowWidth = (layout.roadWidth + layout.sidewalkWidth * 2 + (layout.footprint - 1) * 13) * zoom;

  ctx.strokeStyle = "rgba(10, 12, 14, 0.18)";
  ctx.lineWidth = Math.max(2, shadowWidth + 2 * zoom);
  drawDirectionLines(ctx, screen, endpoints, directions);

  if (layout.sidewalkWidth > 0) {
    ctx.strokeStyle = layout.sidewalk;
    ctx.lineWidth = Math.max(2, backplateWidth);
    drawDirectionLines(ctx, screen, endpoints, directions);
  }

  ctx.strokeStyle = layout.road;
  ctx.lineWidth = Math.max(2, roadWidth);
  drawDirectionLines(ctx, screen, endpoints, directions);

  if (layout.shoulder) {
    ctx.strokeStyle = "rgba(220, 226, 225, 0.38)";
    ctx.lineWidth = Math.max(1, 2 * zoom);
    drawOffsetLane(ctx, screen, endpoints, directions, -roadWidth * 0.5, zoom);
    drawOffsetLane(ctx, screen, endpoints, directions, roadWidth * 0.5, zoom);
  }

  if (layout.median) drawMedian(ctx, screen, endpoints, directions, layout, zoom);
  if (layout.barrier) drawBarrier(ctx, screen, endpoints, directions, zoom);
  if (layout.trees) drawTrees(ctx, screen, endpoints, directions, zoom);
}

function drawDirectionLines(ctx, screen, endpoints, directions) {
  ctx.beginPath();
  for (const direction of directions) {
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(endpoints[direction][0], endpoints[direction][1]);
  }
  ctx.stroke();
}

function drawLaneMarkings(ctx, screen, endpoints, directions, layout, zoom, road) {
  if (!layout.lanes) return;
  ctx.strokeStyle = layout.line;
  ctx.lineWidth = Math.max(1, 1.1 * zoom);
  if (layout.lanes <= 2) {
    ctx.setLineDash([6 * zoom, 5 * zoom]);
    drawDirectionLines(ctx, screen, endpoints, directions);
    ctx.setLineDash([]);
    return;
  }

  const laneOffsets = getLaneOffsets(layout.lanes, zoom);
  ctx.setLineDash([7 * zoom, 7 * zoom]);
  for (const offset of laneOffsets) drawOffsetLane(ctx, screen, endpoints, directions, offset, zoom);
  ctx.setLineDash([]);

  if (road.type === "oneWay") drawOneWayArrow(ctx, screen, road, zoom);
}

function getLaneOffsets(lanes, zoom) {
  const offsets = [];
  for (let lane = 1; lane < lanes; lane += 1) offsets.push((lane - lanes / 2) * 5 * zoom);
  return offsets;
}

function drawOffsetLane(ctx, screen, endpoints, directions, offset, zoom) {
  ctx.beginPath();
  for (const direction of directions) {
    const end = endpoints[direction];
    const dx = end[0] - screen.x;
    const dy = end[1] - screen.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    ctx.moveTo(screen.x + nx * offset, screen.y + ny * offset);
    ctx.lineTo(end[0] + nx * offset, end[1] + ny * offset);
  }
  ctx.stroke();
}

function drawMedian(ctx, screen, endpoints, directions, layout, zoom) {
  ctx.strokeStyle = layout.trees ? "rgba(83, 126, 75, 0.95)" : "rgba(225, 218, 178, 0.88)";
  ctx.lineWidth = Math.max(2, 4 * zoom);
  drawDirectionLines(ctx, screen, endpoints, directions);
}

function drawBarrier(ctx, screen, endpoints, directions, zoom) {
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = Math.max(1, 1.5 * zoom);
  drawDirectionLines(ctx, screen, endpoints, directions);
}

function drawTrees(ctx, screen, endpoints, directions, zoom) {
  ctx.fillStyle = "rgba(42, 112, 55, 0.9)";
  for (const direction of directions) {
    const end = endpoints[direction];
    for (const t of [0.35, 0.65]) {
      const x = screen.x + (end[0] - screen.x) * t;
      const y = screen.y + (end[1] - screen.y) * t;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawOneWayArrow(ctx, screen, road, zoom) {
  const arrow = { east: ">", west: "<", north: "^", south: "v" }[road.direction] ?? ">";
  ctx.save();
  ctx.setLineDash([]);
  ctx.font = `${Math.max(9, 12 * zoom)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(arrow, screen.x, screen.y);
  ctx.restore();
}

function drawRoundabout(ctx, screen, layout, zoom) {
  ctx.strokeStyle = "rgba(10, 12, 14, 0.18)";
  ctx.lineWidth = Math.max(2, (layout.roadWidth + layout.sidewalkWidth * 2) * zoom);
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 24 * zoom, 12 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = layout.sidewalk;
  ctx.lineWidth = Math.max(2, (layout.roadWidth + layout.sidewalkWidth) * zoom);
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 22 * zoom, 11 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = layout.road;
  ctx.lineWidth = Math.max(2, layout.roadWidth * zoom);
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 20 * zoom, 10 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = layout.line;
  ctx.lineWidth = Math.max(1, 1.3 * zoom);
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 20 * zoom, 10 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function getLayout(road) {
  return ROAD_LAYOUTS[road.type] ?? ROAD_LAYOUTS.twoWay;
}
