export function runSecretCommand(code, context) {
  const normalized = String(code ?? "").trim().toLowerCase();
  if (normalized === "moremoney") {
    context.state.budget += 10000;
    context.ui.showMoney(10000, window.innerWidth * 0.5, window.innerHeight * 0.32);
    return true;
  }

  if (normalized === "nobuilding") {
    removeAllBuildings(context.grid);
    context.ui.showNotice("Edificios eliminados");
    return true;
  }

  return false;
}

function removeAllBuildings(grid) {
  for (const cell of grid.cells.values()) {
    cell.building = null;
  }
}
