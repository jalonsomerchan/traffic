export function installTreeRenderer(RendererClass) {
  const originalBuildDrawList = RendererClass.prototype.buildDrawList;
  RendererClass.prototype.buildDrawList = function buildDrawListWithTrees(roadManager, trafficSystem, selectedCell, hoverCell) {
    const items = originalBuildDrawList.call(this, roadManager, trafficSystem, selectedCell, hoverCell);
    for (const cell of this.grid.cells.values()) {
      if (!cell.tree) continue;
      const screen = this.grid.isoToScreen(cell.x, cell.y, this.origin, this.camera.zoom);
      items.push({
        depth: cell.x + cell.y + 0.35,
        layer: 1.4,
        draw: (ctx) => drawTree(ctx, screen, cell.tree, this.camera.zoom),
      });
    }
    return items;
  };
}

function drawTree(ctx, screen, tree, zoom) {
  ctx.save();
  const sway = tree.kind === 1 ? -3 : tree.kind === 2 ? 3 : 0;
  ctx.fillStyle = "rgba(64, 39, 22, 0.95)";
  ctx.fillRect(screen.x - 3 * zoom, screen.y - 20 * zoom, 6 * zoom, 22 * zoom);

  ctx.fillStyle = tree.clearing ? "rgba(178, 123, 53, 0.92)" : "rgba(38, 118, 61, 0.96)";
  ctx.beginPath();
  ctx.arc(screen.x + sway * zoom, screen.y - 29 * zoom, 13 * zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tree.clearing ? "rgba(214, 160, 76, 0.86)" : "rgba(64, 151, 77, 0.92)";
  ctx.beginPath();
  ctx.arc(screen.x - 7 * zoom, screen.y - 22 * zoom, 10 * zoom, 0, Math.PI * 2);
  ctx.arc(screen.x + 8 * zoom, screen.y - 22 * zoom, 10 * zoom, 0, Math.PI * 2);
  ctx.fill();

  if (tree.clearing) drawProgress(ctx, screen, tree, zoom);
  ctx.restore();
}

function drawProgress(ctx, screen, tree, zoom) {
  const progress = 1 - tree.remainingSeconds / Math.max(1, tree.totalSeconds);
  ctx.strokeStyle = "rgba(255, 225, 132, 0.95)";
  ctx.lineWidth = Math.max(2, 2 * zoom);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y - 39 * zoom, 15 * zoom, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
}
