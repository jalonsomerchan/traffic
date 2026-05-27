const FAMILY_SKINS = {
  dirt: { edge: "rgba(75, 48, 25, 0.45)", stripe: "rgba(255, 226, 170, 0.24)", pattern: "mud" },
  gravelRoad: { edge: "rgba(90, 82, 69, 0.55)", stripe: "rgba(250, 246, 226, 0.28)", pattern: "gravel" },
  concretePath: { edge: "rgba(210, 214, 208, 0.52)", stripe: "rgba(255,255,255,0.22)", pattern: "slabs" },
  stonePath: { edge: "rgba(42, 45, 43, 0.5)", stripe: "rgba(255,255,255,0.26)", pattern: "cobble" },
  pedestrian: { edge: "rgba(93, 126, 66, 0.62)", stripe: "rgba(255,255,255,0.34)", pattern: "walk" },
  oneWay: { edge: "rgba(15, 22, 29, 0.62)", stripe: "rgba(255, 255, 255, 0.84)", pattern: "oneWay" },
  twoWay: { edge: "rgba(21, 27, 33, 0.7)", stripe: "rgba(255, 241, 143, 0.72)", pattern: "center" },
  cityRoad: { edge: "rgba(18, 23, 28, 0.74)", stripe: "rgba(255,255,255,0.62)", pattern: "parking" },
  premiumRoad: { edge: "rgba(52, 143, 199, 0.78)", stripe: "rgba(210, 242, 255, 0.8)", pattern: "blueEdge" },
  avenue: { edge: "rgba(73, 111, 91, 0.82)", stripe: "rgba(255, 241, 143, 0.82)", pattern: "median" },
  boulevard: { edge: "rgba(79, 136, 99, 0.95)", stripe: "rgba(232, 255, 210, 0.88)", pattern: "trees" },
  premiumAvenue: { edge: "rgba(79, 213, 236, 0.9)", stripe: "rgba(221, 249, 255, 0.88)", pattern: "premiumMedian" },
  expressway: { edge: "rgba(40, 42, 70, 0.86)", stripe: "rgba(255,255,255,0.86)", pattern: "fast" },
  highway: { edge: "rgba(29, 31, 43, 0.9)", stripe: "rgba(255,255,255,0.9)", pattern: "highway" },
  megaHighway: { edge: "rgba(20, 21, 35, 0.96)", stripe: "rgba(255, 212, 88, 0.94)", pattern: "mega" },
  roundabout: { edge: "rgba(118, 86, 166, 0.86)", stripe: "rgba(255,255,255,0.82)", pattern: "roundabout" },
};

/** Añade texturas distintivas sin depender de nuevos sprites ni assets pesados. */
export function installRoadSkins(RendererClass) {
  const originalTexture = RendererClass.prototype.drawRoadTexture;
  RendererClass.prototype.drawRoadTexture = function drawRoadTextureWithSkin(ctx, screen, road) {
    originalTexture.call(this, ctx, screen, road);
    drawSkinOverlay(this, ctx, screen, road);
  };
}

function drawSkinOverlay(renderer, ctx, screen, road) {
  const skin = FAMILY_SKINS[road.type];
  if (!skin) return;
  const zoom = renderer.camera.zoom;
  ctx.save();
  ctx.beginPath();
  renderer.diamond(ctx, screen.x, screen.y);
  ctx.clip();

  drawEdge(renderer, ctx, screen, skin.edge, zoom);
  drawPattern(renderer, ctx, screen, road, skin, zoom);

  ctx.restore();
}

function drawEdge(renderer, ctx, screen, color, zoom) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, 2.4 * zoom);
  ctx.beginPath();
  renderer.diamond(ctx, screen.x, screen.y);
  ctx.stroke();
}

function drawPattern(renderer, ctx, screen, road, skin, zoom) {
  const tileWidth = renderer.grid.tileWidth * zoom;
  const tileHeight = renderer.grid.tileHeight * zoom;
  ctx.strokeStyle = skin.stripe;
  ctx.fillStyle = skin.stripe;
  ctx.lineCap = "round";

  if (skin.pattern === "mud") drawDiagonalHatches(ctx, screen, zoom, -30, 9, 1);
  if (skin.pattern === "gravel") drawDots(ctx, screen, road, zoom, 18, 1.2);
  if (skin.pattern === "slabs") drawGrid(ctx, screen, zoom, 14);
  if (skin.pattern === "cobble") drawDots(ctx, screen, road, zoom, 28, 1.7);
  if (skin.pattern === "walk") drawCrosswalk(ctx, screen, zoom);
  if (skin.pattern === "oneWay") drawOneWayChevrons(ctx, screen, road, zoom);
  if (skin.pattern === "center") drawCenterLine(ctx, screen, tileWidth, tileHeight, zoom, false);
  if (skin.pattern === "parking") drawSideTicks(ctx, screen, zoom);
  if (skin.pattern === "blueEdge") drawDoubleEdge(ctx, screen, tileWidth, tileHeight, zoom);
  if (skin.pattern === "median") drawMedian(ctx, screen, zoom, "rgba(94, 145, 83, 0.74)");
  if (skin.pattern === "trees") drawBoulevardTrees(ctx, screen, road, zoom);
  if (skin.pattern === "premiumMedian") drawMedian(ctx, screen, zoom, "rgba(72, 220, 224, 0.86)");
  if (skin.pattern === "fast") drawFastDashes(ctx, screen, zoom, 2);
  if (skin.pattern === "highway") drawHighwayLanes(ctx, screen, zoom, 3);
  if (skin.pattern === "mega") drawHighwayLanes(ctx, screen, zoom, 5);
  if (skin.pattern === "roundabout") drawRoundaboutSkin(ctx, screen, zoom);
}

function drawDiagonalHatches(ctx, screen, zoom, start, step, width) {
  ctx.lineWidth = Math.max(1, width * zoom);
  for (let offset = start; offset <= -start; offset += step) {
    ctx.beginPath();
    ctx.moveTo(screen.x - 34 * zoom, screen.y + offset * zoom);
    ctx.lineTo(screen.x + 34 * zoom, screen.y + (offset + 8) * zoom);
    ctx.stroke();
  }
}

function drawDots(ctx, screen, road, zoom, count, radius) {
  for (let index = 0; index < count; index += 1) {
    const seed = (road.x * 37 + road.y * 19 + index * 11) % 97;
    const x = screen.x + ((seed % 11) - 5) * 5.8 * zoom;
    const y = screen.y + ((Math.floor(seed / 7) % 7) - 3) * 3.8 * zoom;
    ctx.beginPath();
    ctx.arc(x, y, radius * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrid(ctx, screen, zoom, step) {
  ctx.lineWidth = Math.max(1, zoom);
  for (let offset = -28; offset <= 28; offset += step) {
    ctx.beginPath();
    ctx.moveTo(screen.x + offset * zoom, screen.y - 16 * zoom);
    ctx.lineTo(screen.x + offset * zoom, screen.y + 16 * zoom);
    ctx.stroke();
  }
}

function drawCrosswalk(ctx, screen, zoom) {
  ctx.lineWidth = Math.max(2, 2 * zoom);
  for (let offset = -20; offset <= 20; offset += 10) {
    ctx.beginPath();
    ctx.moveTo(screen.x + offset * zoom, screen.y - 13 * zoom);
    ctx.lineTo(screen.x + offset * zoom, screen.y + 13 * zoom);
    ctx.stroke();
  }
}

function drawOneWayChevrons(ctx, screen, road, zoom) {
  ctx.lineWidth = Math.max(2, 2.2 * zoom);
  const dir = road.direction === "west" || road.direction === "north" ? -1 : 1;
  for (let offset = -12; offset <= 12; offset += 12) {
    ctx.beginPath();
    ctx.moveTo(screen.x + (offset - 5 * dir) * zoom, screen.y - 5 * zoom);
    ctx.lineTo(screen.x + (offset + 4 * dir) * zoom, screen.y);
    ctx.lineTo(screen.x + (offset - 5 * dir) * zoom, screen.y + 5 * zoom);
    ctx.stroke();
  }
}

function drawCenterLine(ctx, screen, tileWidth, tileHeight, zoom, dashed) {
  ctx.lineWidth = Math.max(1, 1.5 * zoom);
  if (dashed) ctx.setLineDash([5 * zoom, 5 * zoom]);
  ctx.beginPath();
  ctx.moveTo(screen.x - tileWidth * 0.32, screen.y - tileHeight * 0.16);
  ctx.lineTo(screen.x + tileWidth * 0.32, screen.y + tileHeight * 0.16);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSideTicks(ctx, screen, zoom) {
  ctx.lineWidth = Math.max(1, 1.4 * zoom);
  for (let offset = -24; offset <= 24; offset += 12) {
    ctx.beginPath();
    ctx.moveTo(screen.x + offset * zoom, screen.y - 15 * zoom);
    ctx.lineTo(screen.x + (offset + 6) * zoom, screen.y - 10 * zoom);
    ctx.stroke();
  }
}

function drawDoubleEdge(ctx, screen, tileWidth, tileHeight, zoom) {
  ctx.lineWidth = Math.max(2, 2 * zoom);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(screen.x - tileWidth * 0.3, screen.y + side * tileHeight * 0.22);
    ctx.lineTo(screen.x + tileWidth * 0.3, screen.y + side * tileHeight * 0.22);
    ctx.stroke();
  }
}

function drawMedian(ctx, screen, zoom, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 21 * zoom, 4.5 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoulevardTrees(ctx, screen, road, zoom) {
  drawMedian(ctx, screen, zoom, "rgba(78, 135, 80, 0.86)");
  ctx.fillStyle = "rgba(37, 102, 52, 0.92)";
  for (let index = 0; index < 3; index += 1) {
    const offset = (index - 1) * 13;
    ctx.beginPath();
    ctx.arc(screen.x + offset * zoom, screen.y, 3.2 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFastDashes(ctx, screen, zoom, lanes) {
  ctx.lineWidth = Math.max(1, 1.6 * zoom);
  ctx.setLineDash([7 * zoom, 6 * zoom]);
  for (let lane = 0; lane < lanes; lane += 1) {
    const offset = (lane - (lanes - 1) / 2) * 7;
    ctx.beginPath();
    ctx.moveTo(screen.x - 24 * zoom, screen.y + offset * zoom);
    ctx.lineTo(screen.x + 24 * zoom, screen.y + offset * zoom);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawHighwayLanes(ctx, screen, zoom, lanes) {
  ctx.lineWidth = Math.max(1, 1.3 * zoom);
  for (let lane = 0; lane < lanes; lane += 1) {
    const offset = (lane - (lanes - 1) / 2) * 5;
    ctx.beginPath();
    ctx.moveTo(screen.x - 29 * zoom, screen.y + offset * zoom);
    ctx.lineTo(screen.x + 29 * zoom, screen.y + offset * zoom);
    ctx.stroke();
  }
}

function drawRoundaboutSkin(ctx, screen, zoom) {
  ctx.lineWidth = Math.max(2, 2.2 * zoom);
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 22 * zoom, 11 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();
}
