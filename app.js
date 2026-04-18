const API_ROOT = "https://www.datos.gov.co/resource/nmzq-aian.json";
const MAX_ROWS = 2000;
const LEVELS = { low: "Bajo", medium: "Medio", high: "Alto" };
const SELECT_FIELDS = [
  "id_lugar",
  "nombre_lugar",
  "fecha_de_los_datos",
  "dispositivos_unicos",
  "dispositivos_nuevos",
  "dispositivos_recurrentes",
  "logins",
  "tiempo_de_sesion_minutos",
  "subida_megabytes",
  "bajada_megabytes",
  "sesiones",
  "consumidores",
].join(",");

const refs = {
  grid: document.getElementById("card-grid"),
  loading: document.getElementById("loading"),
  empty: document.getElementById("empty"),
  overlay: document.getElementById("overlay"),
  count: document.getElementById("count"),
  close: document.getElementById("close"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  modal: {
    img: document.getElementById("m-img"),
    eye: document.getElementById("m-eye"),
    name: document.getElementById("m-name"),
    desc: document.getElementById("m-desc"),
    tags: document.getElementById("m-tags"),
    stats: document.getElementById("m-stats"),
  },
};

const sorters = {
  name: (a, b) => a.name.localeCompare(b.name),
  users: (a, b) => a.dispositivosUnicos - b.dispositivosUnicos,
  "users-d": (a, b) => b.dispositivosUnicos - a.dispositivosUnicos,
  logins: (a, b) => b.logins - a.logins,
  time: (a, b) => b.tiempoSesionMinutos - a.tiempoSesionMinutos,
};

const state = {
  zones: [],
  filterUsage: "all",
  filterTraffic: "all",
  sortMode: "name",
  query: "",
  currentDate: "",
};

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const bucketLabel = (bucket) => LEVELS[bucket] || "Sin dato";
const usageBucket = (devices) =>
  devices >= 80 ? "high" : devices >= 25 ? "medium" : "low";
const trafficBucket = (logins) =>
  logins >= 200 ? "high" : logins >= 60 ? "medium" : "low";

function shortDate(isoDate) {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
}

function badgeUrl(name) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "ZW";

  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' fill='#d8d2c7'/><circle cx='60' cy='60' r='41' fill='#0d0c0a'/><text x='60' y='73' text-anchor='middle' fill='#c8ff00' font-size='34' font-family='Bebas Neue, sans-serif'>${initials}</text></svg>`,
  )}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchLatestDate() {
  const data = await fetchJson(
    `${API_ROOT}?$select=max(fecha_de_los_datos)%20as%20max_fecha`,
  );
  if (!data.length || !data[0].max_fecha)
    throw new Error("Sin fecha disponible");
  return data[0].max_fecha;
}

async function fetchLatestRows(maxDate) {
  const where = encodeURIComponent(`fecha_de_los_datos = '${maxDate}'`);
  const url = `${API_ROOT}?$select=${SELECT_FIELDS}&$where=${where}&$order=dispositivos_unicos%20DESC&$limit=${MAX_ROWS}`;
  return fetchJson(url);
}

function toZone(row) {
  const dispositivosUnicos = number(row.dispositivos_unicos);
  const logins = number(row.logins);

  return {
    id: row.id_lugar,
    name: row.nombre_lugar || "Sin nombre",
    date: row.fecha_de_los_datos,
    dispositivosUnicos,
    dispositivosNuevos: number(row.dispositivos_nuevos),
    dispositivosRecurrentes: number(row.dispositivos_recurrentes),
    logins,
    tiempoSesionMinutos: number(row.tiempo_de_sesion_minutos),
    subidaMB: number(row.subida_megabytes),
    bajadaMB: number(row.bajada_megabytes),
    sesiones: number(row.sesiones),
    consumidores: number(row.consumidores),
    usage: usageBucket(dispositivosUnicos),
    traffic: trafficBucket(logins),
  };
}

function filteredZones() {
  return state.zones
    .filter(
      (zone) => state.filterUsage === "all" || zone.usage === state.filterUsage,
    )
    .filter(
      (zone) =>
        state.filterTraffic === "all" || zone.traffic === state.filterTraffic,
    )
    .filter(
      (zone) => !state.query || zone.name.toLowerCase().includes(state.query),
    )
    .sort(sorters[state.sortMode] || sorters.name);
}

function render() {
  const zones = filteredZones();
  refs.empty.style.display = zones.length ? "none" : "block";
  refs.grid.innerHTML = "";

  zones.forEach((zone, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.r = zone.usage;
    card.style.animationDelay = `${Math.min(index * 12, 300)}ms`;
    card.innerHTML = `
      <div class="img-wrap"><img src="${badgeUrl(zone.name)}" alt="${zone.name}" /></div>
      <div class="card-body">
        <div class="card-name">${zone.name}</div>
        <div class="card-line"></div>
        <div class="card-meta">
          <span>${bucketLabel(zone.usage).toUpperCase()} · ${bucketLabel(zone.traffic).toUpperCase()}</span>
          <div class="card-elixir">${zone.dispositivosUnicos}</div>
        </div>
      </div>`;
    card.addEventListener("click", () => openModal(zone));
    refs.grid.appendChild(card);
  });
}

function setModal(zone) {
  const usageLabel = bucketLabel(zone.usage);
  const trafficLabel = bucketLabel(zone.traffic);
  const dateLabel = shortDate(zone.date || state.currentDate);

  refs.modal.img.src = badgeUrl(zone.name);
  refs.modal.eye.textContent = `${usageLabel} · ${trafficLabel}`;
  refs.modal.name.textContent = zone.name;
  refs.modal.desc.textContent = `Zona ${zone.id}: registro de uso del ${dateLabel}. Tuvo ${zone.dispositivosUnicos} dispositivos únicos, ${zone.logins} logins y ${zone.tiempoSesionMinutos.toFixed(2)} minutos de sesión.`;
  refs.modal.tags.innerHTML = `
    <span class="modal-tag">${dateLabel}</span>
    <span class="modal-tag">Uso ${usageLabel}</span>
    <span class="modal-tag acid">Tráfico ${trafficLabel}</span>`;
  refs.modal.stats.innerHTML = `
    <div class="mstat"><div class="mstat-label">Dispositivos</div><div class="mstat-val">${zone.dispositivosUnicos}</div></div>
    <div class="mstat"><div class="mstat-label">Logins</div><div class="mstat-val">${zone.logins}</div></div>
    <div class="mstat"><div class="mstat-label">Sesiones</div><div class="mstat-val">${zone.sesiones}</div></div>
    <div class="mstat"><div class="mstat-label">Nuevos</div><div class="mstat-val">${zone.dispositivosNuevos}</div></div>
    <div class="mstat"><div class="mstat-label">Recurrentes</div><div class="mstat-val">${zone.dispositivosRecurrentes}</div></div>
    <div class="mstat"><div class="mstat-label">Minutos</div><div class="mstat-val">${zone.tiempoSesionMinutos.toFixed(0)}</div></div>`;
}

function openModal(zone) {
  setModal(zone);
  refs.overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  refs.overlay.classList.remove("open");
  document.body.style.overflow = "";
}

async function bootstrap() {
  try {
    state.currentDate = await fetchLatestDate();
    state.zones = (await fetchLatestRows(state.currentDate)).map(toZone);
    refs.count.textContent = state.zones.length;
    refs.loading.style.display = "none";
    render();
  } catch {
    refs.loading.textContent = "Error al cargar los datos de SODA2.";
  }
}

refs.close.addEventListener("click", closeModal);
refs.overlay.addEventListener(
  "click",
  (event) => event.target === refs.overlay && closeModal(),
);
document.addEventListener(
  "keydown",
  (event) => event.key === "Escape" && closeModal(),
);

document.querySelectorAll("[data-r]").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-r]")
      .forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filterUsage = button.dataset.r;
    render();
  });
});

document.querySelectorAll("[data-t]").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-t]")
      .forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filterTraffic = button.dataset.t;
    render();
  });
});

refs.search.addEventListener("input", (event) => {
  state.query = event.target.value.toLowerCase().trim();
  render();
});

refs.sort.addEventListener("change", (event) => {
  state.sortMode = event.target.value;
  render();
});

bootstrap();
