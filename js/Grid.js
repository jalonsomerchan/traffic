export class Grid {
  /**
   * Centraliza el modelo espacial del simulador.
   * La cuadrícula usa coordenadas cartesianas enteras y expone helpers
   * para proyectarlas a isométrico sin mezclar lógica de renderizado.
   */
  constructor({ width = 28, height = 28, tileWidth = 72, tileHeight = 36 } = {}) {
    this.width = width;
    this.height = height;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.cells = new Map();
  }

  key(x, y) {
    return `${x},${y}`;
  }

  /** Comprueba límites antes de leer o escribir celdas. */
  isInside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Crea celdas bajo demanda para mantener pequeño el estado serializado. */
  getCell(x, y) {
    if (!this.isInside(x, y)) return null;
    const key = this.key(x, y);
    if (!this.cells.has(key)) {
      this.cells.set(key, { x, y, road: null, building: null });
    }
    return this.cells.get(key);
  }

  /** Adjunta la referencia de una vía a su celda visual y lógica. */
  setRoad(x, y, road) {
    const cell = this.getCell(x, y);
    if (cell) {
      cell.road = road;
      cell.building = null;
    }
  }

  /** Elimina una vía de la celda sin tocar edificios vecinos. */
  clearRoad(x, y) {
    const cell = this.getCell(x, y);
    if (cell) cell.road = null;
  }

  /** Quita edificios cuando el jugador urbaniza una celda con infraestructura. */
  clearBuilding(x, y) {
    const cell = this.getCell(x, y);
    if (cell) cell.building = null;
  }

  /** Añade edificios solo en celdas libres para no bloquear carreteras. */
  setBuilding(x, y, building) {
    const cell = this.getCell(x, y);
    if (cell && !cell.road && this.hasAdjacentRoad(x, y)) cell.building = building;
  }

  /** Demuele un edificio existente y devuelve su demanda perdida. */
  demolishBuilding(x, y) {
    const cell = this.getCell(x, y);
    if (!cell?.building) return null;
    const building = cell.building;
    cell.building = null;
    return building;
  }

  /** Comprueba si una celda libre toca al menos una vía. */
  hasAdjacentRoad(x, y) {
    return this.getNeighbors(x, y).some((neighbor) => Boolean(neighbor.road));
  }

  /** Las habitaciones representan capacidad residencial perdida al demoler. */
  getHousingCapacity() {
    return [...this.cells.values()].reduce((total, cell) => {
      return total + (cell.building ? cell.building.demand * 12 : 0);
    }, 0);
  }

  /** Devuelve vecinos ortogonales, que son las conexiones válidas de A*. */
  getNeighbors(x, y) {
    return [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]
      .filter(([nx, ny]) => this.isInside(nx, ny))
      .map(([nx, ny]) => this.getCell(nx, ny));
  }

  /** Amplía el plano conservando las celdas ya construidas. */
  expand(amount = 6) {
    this.width += amount;
    this.height += amount;
  }

  /** Proyecta una celda del mundo a pantalla para dibujar el diamante iso. */
  isoToScreen(x, y, origin, zoom = 1) {
    return {
      x: origin.x + (x - y) * (this.tileWidth / 2) * zoom,
      y: origin.y + (x + y) * (this.tileHeight / 2) * zoom,
    };
  }

  /** Convierte un punto de pantalla en celda para herramientas de construcción. */
  screenToIso(screenX, screenY, origin, zoom = 1) {
    const dx = screenX - origin.x;
    const dy = screenY - origin.y;
    const x = Math.round(dy / (this.tileHeight * zoom) + dx / (this.tileWidth * zoom));
    const y = Math.round(dy / (this.tileHeight * zoom) - dx / (this.tileWidth * zoom));
    return { x, y };
  }

  /** Exporta estado completo sin guardar funciones ni referencias circulares. */
  toJSON() {
    return {
      width: this.width,
      height: this.height,
      cells: [...this.cells.values()],
    };
  }
}
