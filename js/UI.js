import { ROAD_TYPES, SPEED_LIMITS } from "./RoadManager.js";

const MESSAGES = {
  es: {
    title: "Tráfico isométrico",
    newGame: "Nueva partida",
    loadGame: "Cargar partida",
    loadJson: "Cargar JSON",
    about: "Acerca de",
    close: "Cerrar",
    aboutText: "Construye una red isométrica, controla límites, semáforos y reparaciones, y deja que la ciudad crezca alrededor de tus vías.",
    budget: "Presupuesto",
    vehicles: "Vehículos",
    housing: "Habitaciones",
    roads: "Vías",
    map: "Mapa",
    month: "Mes",
    nextMonth: "Siguiente cobro",
    balance: "Balance mensual",
    populationIncome: "Impuestos de habitantes",
    tripIncome: "Tasas por uso de vías",
    roadMaintenance: "Mantenimiento de vías",
    repairCost: "Obras y reparaciones",
    netResult: "Resultado neto",
    roomsSuffix: "habitaciones",
    tripsSuffix: "viajes",
    roadsSuffix: "vías",
    repairsSuffix: "cortes",
    tool: "Herramienta",
    dirt: "Tierra",
    concretePath: "Cemento",
    stonePath: "Piedra",
    pedestrian: "Peatonal",
    oneWay: "Un sentido",
    twoWay: "Doble sentido",
    premiumRoad: "Premium",
    avenue: "Avenida",
    premiumAvenue: "Av. premium",
    highway: "Autopista",
    roundabout: "Rotonda",
    light: "Semáforo",
    repair: "Reparar",
    closeRoad: "Cortar tráfico",
    removeRoad: "Eliminar vía",
    removeLight: "Quitar semáforo",
    demolish: "Demoler",
    direction: "Girar sentido",
    speed: "Límite",
    viewMode: "Vista",
    viewNormal: "Normal",
    viewTraffic: "Tráfico",
    viewHealth: "Estado",
    viewType: "Tipo",
    viewSpeed: "Velocidad",
    time: "Tiempo",
    pause: "Pausa",
    slow: "Lento",
    normal: "Normal",
    fast: "Rápido",
    heatmap: "Heatmap",
    transparentBuildings: "Edificios transparentes",
    expand: "Ampliar mapa",
    zoomIn: "Zoom +",
    zoomOut: "Zoom -",
    save: "Guardar local",
    download: "Exportar JSON",
    load: "Cargar local",
  },
  en: {
    title: "Isometric traffic",
    newGame: "New game",
    loadGame: "Load game",
    loadJson: "Load JSON",
    about: "About",
    close: "Close",
    aboutText: "Build an isometric network, control limits, traffic lights and repairs, and let the city grow around your roads.",
    budget: "Budget",
    vehicles: "Vehicles",
    housing: "Rooms",
    roads: "Roads",
    map: "Map",
    month: "Month",
    nextMonth: "Next payout",
    balance: "Monthly balance",
    populationIncome: "Resident taxes",
    tripIncome: "Road usage fees",
    roadMaintenance: "Road maintenance",
    repairCost: "Works and repairs",
    netResult: "Net result",
    roomsSuffix: "rooms",
    tripsSuffix: "trips",
    roadsSuffix: "roads",
    repairsSuffix: "closures",
    tool: "Tool",
    dirt: "Dirt",
    concretePath: "Concrete",
    stonePath: "Stone",
    pedestrian: "Pedestrian",
    oneWay: "One-way",
    twoWay: "Two-way",
    premiumRoad: "Premium",
    avenue: "Avenue",
    premiumAvenue: "Premium av.",
    highway: "Highway",
    roundabout: "Roundabout",
    light: "Signal",
    repair: "Repair",
    closeRoad: "Close traffic",
    removeRoad: "Remove road",
    removeLight: "Remove signal",
    demolish: "Demolish",
    direction: "Rotate way",
    speed: "Limit",
    viewMode: "View",
    viewNormal: "Normal",
    viewTraffic: "Traffic",
    viewHealth: "Condition",
    viewType: "Type",
    viewSpeed: "Speed",
    time: "Time",
    pause: "Pause",
    slow: "Slow",
    normal: "Normal",
    fast: "Fast",
    heatmap: "Heatmap",
    transparentBuildings: "Transparent buildings",
    expand: "Expand map",
    zoomIn: "Zoom +",
    zoomOut: "Zoom -",
    save: "Save local",
    download: "Export JSON",
    load: "Load local",
  },
};

const ROAD_TOOL_ORDER = [
  "dirt",
  "concretePath",
  "stonePath",
  "pedestrian",
  "oneWay",
  "twoWay",
  "premiumRoad",
  "avenue",
  "premiumAvenue",
  "highway",
  "roundabout",
];

export class UI {
  /**
   * HUD accesible y traducible sin dependencias.
   * Expone acciones semánticas al bucle principal mediante callbacks.
   */
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.locale = navigator.language.startsWith("es") ? "es" : "en";
    this.tool = "twoWay";
    this.speedLimit = 50;
    this.timeScale = 1;
    this.viewMode = "normal";
    this.render();
  }

  /** Genera el HUD completo desde diccionarios de idioma ES/EN. */
  render() {
    const t = this.t.bind(this);
    this.root.innerHTML = `
      <section class="start-screen" data-panel="start">
        <div class="start-screen__panel">
          <h1>${t("title")}</h1>
          <p>${t("aboutText")}</p>
          <button type="button" data-action="new">${t("newGame")}</button>
          <button type="button" data-action="load">${t("loadGame")}</button>
          <label class="file-button">
            ${t("loadJson")}
            <input type="file" accept="application/json" data-action="load-file" />
          </label>
          <button type="button" data-action="about">${t("about")}</button>
        </div>
      </section>
      <section class="about-panel" data-panel="about" hidden>
        <div>
          <h2>${t("about")}</h2>
          <p>${t("aboutText")}</p>
          <button type="button" data-action="close-about">${t("close")}</button>
        </div>
      </section>
      <h1>${t("title")}</h1>
      <section class="hud__stats" aria-live="polite">
        ${this.statRow(t("budget"), "$0", "budget")}
        ${this.statRow(t("vehicles"), "0", "vehicles")}
        ${this.statRow(t("housing"), "0", "housing")}
        ${this.statRow(t("roads"), "0", "roads")}
        ${this.statRow(t("map"), "28 x 28", "map")}
        ${this.statRow(t("month"), "1", "month")}
        ${this.statRow(t("nextMonth"), "0%", "monthProgress")}
      </section>
      <section class="statement" data-statement hidden aria-live="polite"></section>
      <section class="hud__tools" aria-label="${t("tool")}">
        <div class="tool-palette">
          ${ROAD_TOOL_ORDER.map((tool) => this.toolButton(tool, t(tool), ROAD_TYPES[tool].buildCost)).join("")}
        </div>
        <div class="hud__grid hud__grid--compact">
          ${this.toolButton("light", t("light"))}
          ${this.toolButton("removeLight", t("removeLight"))}
          ${this.toolButton("repair", t("repair"), "danger")}
          ${this.toolButton("closeRoad", t("closeRoad"), "danger")}
          ${this.toolButton("removeRoad", t("removeRoad"), "danger")}
          ${this.toolButton("demolish", t("demolish"), "danger")}
          ${this.toolButton("direction", t("direction"))}
          ${this.toolButton("transparentBuildings", t("transparentBuildings"))}
        </div>
        <div class="view-control" aria-label="${t("viewMode")}">
          ${this.viewButton("normal", t("viewNormal"))}
          ${this.viewButton("traffic", t("viewTraffic"))}
          ${this.viewButton("health", t("viewHealth"))}
          ${this.viewButton("type", t("viewType"))}
          ${this.viewButton("speed", t("viewSpeed"))}
        </div>
        <label class="speed-control">
          <span>${t("speed")}</span>
          <select data-action="speed-limit">
            ${SPEED_LIMITS.map((limit) => `<option value="${limit}" ${limit === this.speedLimit ? "selected" : ""}>${limit}</option>`).join("")}
          </select>
        </label>
        <div class="time-control" aria-label="${t("time")}">
          ${this.timeButton(0, t("pause"))}
          ${this.timeButton(0.5, t("slow"))}
          ${this.timeButton(1, t("normal"))}
          ${this.timeButton(2.5, t("fast"))}
        </div>
        <div class="hud__grid">
          <button type="button" data-action="zoom-in">${t("zoomIn")}</button>
          <button type="button" data-action="zoom-out">${t("zoomOut")}</button>
          <button type="button" data-action="expand">${t("expand")}</button>
          <button type="button" data-action="save">${t("save")}</button>
          <button type="button" data-action="download">${t("download")}</button>
          <button type="button" data-action="load">${t("load")}</button>
        </div>
      </section>
    `;
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
  }

  /** Refresca métricas sin reconstruir todo el DOM. */
  update({ budget, vehicles, housing, roads, map, month, monthProgress, statement }) {
    this.root.querySelector('[data-stat="budget"]').textContent = `$${Math.floor(budget)}`;
    this.root.querySelector('[data-stat="vehicles"]').textContent = vehicles;
    this.root.querySelector('[data-stat="housing"]').textContent = housing;
    this.root.querySelector('[data-stat="roads"]').textContent = roads;
    this.root.querySelector('[data-stat="map"]').textContent = map;
    this.root.querySelector('[data-stat="month"]').textContent = month;
    this.root.querySelector('[data-stat="monthProgress"]').textContent = `${Math.floor(monthProgress * 100)}%`;
    this.updateStatement(statement);
  }

  updateStatement(statement) {
    const panel = this.root.querySelector("[data-statement]");
    if (!statement) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const t = this.t.bind(this);
    panel.innerHTML = `
      <strong>${t("balance")} ${statement.month}</strong>
      ${this.statementRow(t("populationIncome"), statement.populationIncome, true, `${statement.housing} ${t("roomsSuffix")}`)}
      ${this.statementRow(t("tripIncome"), statement.tripIncome, true, `${statement.completedTrips} ${t("tripsSuffix")}`)}
      ${this.statementRow(t("roadMaintenance"), statement.roadMaintenance, false, `${statement.roads} ${t("roadsSuffix")}`)}
      ${this.statementRow(t("repairCost"), statement.repairCost, false, `${statement.repairCount} ${t("repairsSuffix")}`)}
      ${this.statementRow(t("netResult"), statement.balance, statement.balance >= 0)}
    `;
  }

  statementRow(label, amount, positive, detail = "") {
    const sign = positive ? "+" : "-";
    return `
      <div class="${positive ? "statement__income" : "statement__cost"}">
        <span>${label}<small>${detail}</small></span>
        <b>${sign}$${Math.abs(Math.floor(amount))}</b>
      </div>
    `;
  }

  /** Gestiona herramientas, vistas y guardado/carga desde botones. */
  handleClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const tool = button.dataset.tool;
    const action = button.dataset.action;
    if (tool) {
      if (tool === "transparentBuildings") {
        this.callbacks.onTransparentBuildingsToggle();
        button.setAttribute("aria-pressed", button.getAttribute("aria-pressed") !== "true");
        return;
      }
      this.tool = tool;
      this.root.querySelectorAll("[data-tool]").forEach((item) => {
        item.setAttribute("aria-pressed", item.dataset.tool === tool ? "true" : "false");
      });
      this.callbacks.onToolChange(tool);
    }
    if (action === "new") this.callbacks.onNewGame();
    if (action === "about") this.toggleAbout(true);
    if (action === "close-about") this.toggleAbout(false);
    if (action === "save") this.callbacks.onSave();
    if (action === "download") this.callbacks.onDownload();
    if (action === "load") this.callbacks.onLoad();
    if (action === "zoom-in") this.callbacks.onZoom(1);
    if (action === "zoom-out") this.callbacks.onZoom(-1);
    if (action === "expand") this.callbacks.onExpand();
    if (action === "view-mode") {
      this.viewMode = button.dataset.value;
      this.root.querySelectorAll("[data-action='view-mode']").forEach((item) => {
        item.setAttribute("aria-pressed", item.dataset.value === this.viewMode ? "true" : "false");
      });
      this.callbacks.onViewModeChange(this.viewMode);
    }
    if (action === "time") {
      this.timeScale = Number(button.dataset.value);
      this.root.querySelectorAll("[data-action='time']").forEach((item) => {
        item.setAttribute("aria-pressed", item.dataset.value === String(this.timeScale));
      });
      this.callbacks.onTimeScaleChange(this.timeScale);
    }
  }

  handleChange(event) {
    const input = event.target;
    if (input.dataset.action === "speed-limit") {
      this.speedLimit = Number(input.value);
      this.callbacks.onSpeedLimitChange(this.speedLimit);
    }
    if (input.dataset.action === "load-file") {
      this.callbacks.onLoadFile(input.files?.[0]);
      input.value = "";
    }
  }

  hideStart() {
    this.root.querySelector('[data-panel="start"]').hidden = true;
  }

  toggleAbout(open) {
    this.root.querySelector('[data-panel="about"]').hidden = !open;
  }

  /** Plantilla pequeña para mantener consistentes las métricas. */
  statRow(label, value, stat) {
    return `
      <div class="hud__row">
        <span class="hud__label">${label}</span>
        <span class="hud__value" data-stat="${stat}">${value}</span>
      </div>
    `;
  }

  /** Crea botones con aria-pressed para accesibilidad de estado. */
  toolButton(tool, label, meta = "", extraClass = "") {
    if (typeof meta === "string" && !extraClass) {
      extraClass = meta;
      meta = "";
    }
    const pressed = tool === this.tool ? "true" : "false";
    const price = meta ? `<span>$${meta}</span>` : "";
    return `<button type="button" class="${extraClass}" data-tool="${tool}" aria-pressed="${pressed}"><b>${label}</b>${price}</button>`;
  }

  timeButton(value, label) {
    return `<button type="button" data-action="time" data-value="${value}" aria-pressed="${value === this.timeScale}"><b>${label}</b></button>`;
  }

  viewButton(value, label) {
    return `<button type="button" data-action="view-mode" data-value="${value}" aria-pressed="${value === this.viewMode}"><b>${label}</b></button>`;
  }

  showNotice(message) {
    this.spawnFloatingMessage(message, "notice");
  }

  showMoney(amount, x, y) {
    const sign = amount < 0 ? "-" : "+";
    this.spawnFloatingMessage(`${sign}$${Math.abs(Math.floor(amount))}`, amount < 0 ? "money money--cost" : "money", x, y);
  }

  spawnFloatingMessage(message, className, x = window.innerWidth / 2, y = window.innerHeight * 0.35) {
    const item = document.createElement("div");
    item.className = `float-message ${className}`;
    item.textContent = message;
    item.style.left = `${x}px`;
    item.style.top = `${y}px`;
    document.body.append(item);
    item.addEventListener("animationend", () => item.remove());
  }

  /** Traduce claves visibles y cae a inglés si falta alguna entrada. */
  t(key) {
    return MESSAGES[this.locale][key] ?? MESSAGES.en[key] ?? key;
  }
}

export function getRoadCost(type) {
  return ROAD_TYPES[type]?.buildCost ?? 0;
}
