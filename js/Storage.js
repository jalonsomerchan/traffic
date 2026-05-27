export class Storage {
  /** Encapsula localStorage para guardar/cargar partidas como JSON completo. */
  constructor(key = "trafic:isometric-save") {
    this.key = key;
  }

  /** Guarda una instantánea serializable del estado del juego. */
  save(state) {
    localStorage.setItem(this.key, this.stringify(state));
  }

  /** Carga de forma tolerante: si el JSON está corrupto devuelve null. */
  load() {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Descarga un fichero JSON para que la partida sea portable fuera del navegador. */
  download(state, filename = "trafic-save.json") {
    const blob = new Blob([this.stringify(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Lee un fichero JSON seleccionado por el jugador. */
  async loadFile(file) {
    if (!file) return null;
    try {
      return JSON.parse(await file.text());
    } catch {
      return null;
    }
  }

  stringify(state) {
    return JSON.stringify(state, null, 2);
  }
}
