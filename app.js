import {
  MEDFORD,
  POIS,
  CANDIDATE_SITES,
  ZONING_GROUP,
  ENDPOINT_SLOTS,
  PARCEL_FIELDS,
  PDO_URL,
  MOCK_PARCELS,
} from "./data.js";

const MILES_PER_KM = 0.621371;
const PARCELS_MIN_ZOOM = 13;
const STORAGE_KEY = "edge-medford-endpoints";

// ---------- Endpoint configuration ----------
function loadEndpoints() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    stored = {};
  }
  const out = {};
  for (const slot of ENDPOINT_SLOTS) {
    // Falsy check so empty strings from older versions fall back to defaults.
    const v = (stored[slot.key] || "").trim();
    out[slot.key] = v || (slot.default || "").trim();
  }
  return out;
}

function saveEndpoints(values) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  endpoints = loadEndpoints();
}

let endpoints = loadEndpoints();

// ---------- Map ----------
const BASEMAPS = {
  dark: {
    tiles: [
      "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    ],
    label: "Dark",
  },
  light: {
    tiles: [
      "https://a.basemaps.cartocdn.com/voyager/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/voyager/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/voyager/{z}/{x}/{y}.png",
      "https://d.basemaps.cartocdn.com/voyager/{z}/{x}/{y}.png",
    ],
    label: "Light",
  },
  satellite: {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    label: "Satellite",
    attribution: "Tiles &copy; Esri",
  },
};

let currentBasemap = "dark";

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      basemap: {
        type: "raster",
        tiles: BASEMAPS.dark.tiles,
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  },
  center: MEDFORD.center,
  zoom: MEDFORD.zoom,
  maxBounds: [
    [-123.2, 42.05],
    [-122.55, 42.6],
  ],
});

map.addControl(new maplibregl.NavigationControl(), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");

function setBasemap(key) {
  const b = BASEMAPS[key];
  if (!b) return;
  currentBasemap = key;
  const src = map.getSource("basemap");
  if (src && typeof src.setTiles === "function") {
    src.setTiles(b.tiles);
  } else {
    // Fallback: rebuild the source. Insert BELOW the first non-basemap layer
    // so overlays stay on top.
    const layers = map.getStyle().layers.filter((l) => l.id !== "basemap");
    map.removeLayer("basemap");
    map.removeSource("basemap");
    map.addSource("basemap", {
      type: "raster",
      tiles: b.tiles,
      tileSize: 256,
      maxzoom: 19,
      attribution: b.attribution || "&copy; OpenStreetMap contributors &copy; CARTO",
    });
    map.addLayer({ id: "basemap", type: "raster", source: "basemap" }, layers[0]?.id);
  }
  document.querySelectorAll("[data-basemap]").forEach((el) => {
    el.classList.toggle("active", el.dataset.basemap === key);
  });
  document.body.dataset.basemap = key;
}

// ---------- Distance ----------
function haversineMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h)) * MILES_PER_KM;
}

function nearestMiles(site, points) {
  let best = Infinity;
  for (const p of points) {
    const d = haversineMiles(site, p);
    if (d < best) best = d;
  }
  return best;
}

// ---------- Form ----------
const form = document.getElementById("criteria-form");

function readCriteria() {
  const zoningChecked = [
    ...document.querySelectorAll("#zoningChips input:checked"),
  ].map((el) => el.value);
  const utilitiesRequired = [
    ...document.querySelectorAll('input[name="util"]:checked'),
  ].map((el) => el.value);
  return {
    projectType: document.getElementById("projectType").value,
    minAcres: Number(document.getElementById("minAcres").value),
    maxAcres: Number(document.getElementById("maxAcres").value),
    zoning: zoningChecked,
    allowRezone: document.getElementById("allowRezone").checked,
    distI5: Number(document.getElementById("distI5").value),
    distAirport: Number(document.getElementById("distAirport").value),
    distRail: Number(document.getElementById("distRail").value),
    distDowntown: Number(document.getElementById("distDowntown").value),
    utilitiesRequired,
    avoidFloodplain: document.getElementById("avoidFloodplain").checked,
    avoidSlope: document.getElementById("avoidSlope").checked,
    overlayCity: document.getElementById("overlayCity").checked,
    overlayZoning: document.getElementById("overlayZoning").checked,
    overlayPois: document.getElementById("overlayPois").checked,
    overlayParcels: document.getElementById("overlayParcels").checked,
    overlayFloodplainLayer: document.getElementById("overlayFloodplainLayer").checked,
  };
}

for (const slider of document.querySelectorAll(".slider input[type='range']")) {
  const out = slider.parentElement.querySelector("output");
  const sync = () => (out.textContent = Number(slider.value).toFixed(1) + " mi");
  slider.addEventListener("input", sync);
  sync();
}

// ---------- Scoring ----------
function scoreSite(site, c) {
  const distances = {
    i5: nearestMiles(site, POIS.i5_exits),
    airport: haversineMiles(site, POIS.airport),
    rail: nearestMiles(site, POIS.rail),
    downtown: haversineMiles(site, POIS.downtown),
  };

  const reasons = [];
  if (site.acres < c.minAcres) reasons.push(`too small (${site.acres} ac)`);
  if (site.acres > c.maxAcres) reasons.push(`too large (${site.acres} ac)`);

  const zoneGroup = ZONING_GROUP[site.zoning] || "other";
  const zoningOk = c.zoning.includes(zoneGroup);
  if (!zoningOk && !c.allowRezone) reasons.push(`zoning ${site.zoning} excluded`);

  if (distances.i5 > c.distI5) reasons.push(`I-5 ${distances.i5.toFixed(1)} mi`);
  if (distances.airport > c.distAirport) reasons.push(`airport ${distances.airport.toFixed(1)} mi`);
  if (distances.rail > c.distRail) reasons.push(`rail ${distances.rail.toFixed(1)} mi`);
  if (distances.downtown > c.distDowntown) reasons.push(`downtown ${distances.downtown.toFixed(1)} mi`);

  for (const u of c.utilitiesRequired) {
    if (!site.utilities.includes(u)) reasons.push(`no ${u}`);
  }
  if (c.avoidFloodplain && site.floodplain) reasons.push("in floodplain");
  if (c.avoidSlope && site.slope > 15) reasons.push("steep slope");

  let score = 0;
  if (zoningOk) score += 20;
  else if (c.allowRezone) score += 8;

  if (site.acres >= c.minAcres && site.acres <= c.maxAcres) {
    const mid = (c.minAcres + c.maxAcres) / 2;
    const span = Math.max(c.maxAcres - c.minAcres, 0.1);
    const offset = Math.abs(site.acres - mid) / (span / 2);
    score += 15 * (1 - Math.min(offset, 1));
  }

  const proxScore = (actual, max, weight) => {
    if (actual > max) return 0;
    return weight * Math.exp(-actual / Math.max(max / 2, 0.5));
  };
  score += proxScore(distances.i5, c.distI5, 18);
  score += proxScore(distances.airport, c.distAirport, 8);
  score += proxScore(distances.rail, c.distRail, 14);
  score += proxScore(distances.downtown, c.distDowntown, 10);

  const fullUtils = ["water", "sewer", "power3", "gas", "fiber"];
  const utilCount = fullUtils.filter((u) => site.utilities.includes(u)).length;
  score += (utilCount / fullUtils.length) * 10;

  if ((c.projectType === "logistics" || c.projectType === "industrial") && site.hasRailSpur) {
    score += 5;
  }

  return {
    site,
    distances,
    score: Math.round(score),
    qualifies: reasons.length === 0,
    reasons,
    zoneGroup,
  };
}

// ---------- Map data ----------
function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

function sitesToFeatureCollection(scored) {
  return {
    type: "FeatureCollection",
    features: scored.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.site.lng, r.site.lat] },
      properties: {
        id: r.site.id,
        name: r.site.name,
        score: r.score,
        qualifies: r.qualifies,
        acres: r.site.acres,
        zoning: r.site.zoning,
      },
    })),
  };
}

function poisToFeatureCollection() {
  const pts = [POIS.airport, POIS.downtown, ...POIS.i5_exits, ...POIS.rail];
  return {
    type: "FeatureCollection",
    features: pts.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { name: p.name, kind: p.kind },
    })),
  };
}

function ensureLayers() {
  if (map.getSource("sites")) return;

  // Parcels (rendered below sites so they're clickable underneath).
  map.addSource("parcels", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "parcels-fill",
    type: "fill",
    source: "parcels",
    paint: {
      "fill-color": "#7fd1e0",
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "selected"], false], 0.45,
        ["boolean", ["feature-state", "hover"], false], 0.22,
        0.05,
      ],
    },
    layout: { visibility: "none" },
  });
  map.addLayer({
    id: "parcels-line",
    type: "line",
    source: "parcels",
    paint: {
      "line-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false], "#e8b54a",
        "#7fd1e0",
      ],
      "line-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false], 3,
        1.2,
      ],
      "line-opacity": 0.95,
    },
    layout: { visibility: "none" },
  });

  // Zoning (under parcels). Higher opacity + brighter color so it pops on dark.
  map.addSource("zoning", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "zoning-fill",
    type: "fill",
    source: "zoning",
    paint: { "fill-color": "#9ae3ec", "fill-opacity": 0.28 },
    layout: { visibility: "none" },
  });
  map.addLayer({
    id: "zoning-line",
    type: "line",
    source: "zoning",
    paint: { "line-color": "#9ae3ec", "line-width": 1, "line-opacity": 0.85 },
    layout: { visibility: "none" },
  });

  // City limits — bright gold thick dashed line so it's unmistakable.
  map.addSource("city-limits", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "city-limits-line",
    type: "line",
    source: "city-limits",
    paint: {
      "line-color": "#e8b54a",
      "line-width": 3,
      "line-dasharray": [4, 2],
      "line-opacity": 0.95,
    },
  });

  // Floodplain.
  map.addSource("floodplain", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "floodplain-fill",
    type: "fill",
    source: "floodplain",
    paint: { "fill-color": "#5fa9e8", "fill-opacity": 0.35 },
    layout: { visibility: "none" },
  });
  map.addLayer({
    id: "floodplain-line",
    type: "line",
    source: "floodplain",
    paint: { "line-color": "#5fa9e8", "line-width": 1, "line-opacity": 0.7 },
    layout: { visibility: "none" },
  });

  // Candidate sites (always on top).
  map.addSource("sites", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "sites-circle",
    type: "circle",
    source: "sites",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 6, 14, 13],
      "circle-color": [
        "case",
        ["==", ["get", "qualifies"], false], "#5a6b80",
        ["interpolate", ["linear"], ["get", "score"], 0, "#c89537", 50, "#e8b54a", 80, "#7fc88a"],
      ],
      "circle-stroke-color": "#0b1c30",
      "circle-stroke-width": 2,
      "circle-opacity": 0.95,
    },
  });
  map.addLayer({
    id: "sites-label",
    type: "symbol",
    source: "sites",
    layout: {
      "text-field": ["to-string", ["get", "score"]],
      "text-size": 11,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#0b1c30" },
  });

  // POIs (always on top of sites for legibility).
  map.addSource("pois", { type: "geojson", data: poisToFeatureCollection() });
  map.addLayer({
    id: "pois-symbol",
    type: "circle",
    source: "pois",
    paint: {
      "circle-radius": 5,
      "circle-color": [
        "match", ["get", "kind"],
        "airport", "#6db4c1",
        "downtown", "#f1ece1",
        "i5", "#e8b54a",
        "rail", "#b48cc9",
        "#8ea4bc",
      ],
      "circle-stroke-color": "#0b1c30",
      "circle-stroke-width": 1.5,
    },
  });
  map.addLayer({
    id: "pois-label",
    type: "symbol",
    source: "pois",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 10,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
    },
    paint: {
      "text-color": "#d8d2c2",
      "text-halo-color": "#0b1c30",
      "text-halo-width": 1.5,
    },
  });

  // Site clicks.
  map.on("click", "sites-circle", (e) => {
    const f = e.features[0];
    const r = scoredById.get(f.properties.id);
    if (r) showPopup(r);
  });
  map.on("mouseenter", "sites-circle", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "sites-circle", () => (map.getCanvas().style.cursor = ""));

  // Parcel clicks + hover.
  let hoverId = null;
  map.on("mousemove", "parcels-fill", (e) => {
    if (!e.features.length) return;
    map.getCanvas().style.cursor = "pointer";
    const id = e.features[0].id;
    if (hoverId !== null && hoverId !== id) {
      map.setFeatureState({ source: "parcels", id: hoverId }, { hover: false });
    }
    hoverId = id;
    if (hoverId != null) map.setFeatureState({ source: "parcels", id: hoverId }, { hover: true });
  });
  map.on("mouseleave", "parcels-fill", () => {
    map.getCanvas().style.cursor = "";
    if (hoverId !== null) {
      map.setFeatureState({ source: "parcels", id: hoverId }, { hover: false });
      hoverId = null;
    }
  });
  map.on("click", "parcels-fill", (e) => {
    if (!e.features.length) return;
    const f = e.features[0];
    selectParcel(f);
  });
}

// ---------- Popup (candidate sites) ----------
let openPopup = null;
function showPopup(r) {
  if (openPopup) openPopup.remove();
  const s = r.site;
  const html = `
    <div class="popup-title">${escapeHtml(s.name)}</div>
    <div class="popup-meta">${escapeHtml(s.address)} · ${s.acres} ac · ${s.zoning}</div>
    <div class="popup-row"><span>Score</span><b>${r.score}/100</b></div>
    <div class="popup-row"><span>I-5</span><b>${r.distances.i5.toFixed(1)} mi</b></div>
    <div class="popup-row"><span>Airport (MFR)</span><b>${r.distances.airport.toFixed(1)} mi</b></div>
    <div class="popup-row"><span>Rail</span><b>${r.distances.rail.toFixed(1)} mi</b></div>
    <div class="popup-row"><span>Downtown</span><b>${r.distances.downtown.toFixed(1)} mi</b></div>
    <div class="popup-row"><span>Utilities</span><b>${s.utilities.join(", ") || "—"}</b></div>
    ${s.floodplain ? '<div class="popup-row"><span>Floodplain</span><b>Yes</b></div>' : ""}
    ${s.hasRailSpur ? '<div class="popup-row"><span>Rail spur</span><b>Yes</b></div>' : ""}
    ${r.reasons.length ? `<div class="popup-row"><span>Filtered</span><b>${escapeHtml(r.reasons.join(", "))}</b></div>` : ""}
    ${s.notes ? `<div class="popup-row"><span>Notes</span><b>${escapeHtml(s.notes)}</b></div>` : ""}
  `;
  openPopup = new maplibregl.Popup({ offset: 14, maxWidth: "320px" })
    .setLngLat([s.lng, s.lat])
    .setHTML(html)
    .addTo(map);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ---------- Parcel detail view ----------
let selectedParcelId = null;

function findField(props, candidates) {
  if (!props) return null;
  for (const c of candidates) {
    if (props[c] != null && props[c] !== "") return props[c];
    const lc = c.toLowerCase();
    if (props[lc] != null && props[lc] !== "") return props[lc];
  }
  return null;
}

function selectParcel(feature) {
  const props = feature.properties || {};
  const id = feature.id;

  if (selectedParcelId !== null) {
    map.setFeatureState({ source: "parcels", id: selectedParcelId }, { selected: false });
  }
  selectedParcelId = id;
  if (id != null) {
    map.setFeatureState({ source: "parcels", id }, { selected: true });
  }

  const apn = findField(props, PARCEL_FIELDS.apn) || "(unknown)";
  const owner = findField(props, PARCEL_FIELDS.owner) || "—";
  const acres = findField(props, PARCEL_FIELDS.acres);
  const address = findField(props, PARCEL_FIELDS.address) || "—";
  const zoning = findField(props, PARCEL_FIELDS.zoning) || "—";
  const landUse = findField(props, PARCEL_FIELDS.landUse) || "—";
  const assessedRaw = findField(props, PARCEL_FIELDS.assessedValue);
  const yearBuilt = findField(props, PARCEL_FIELDS.yearBuilt) || "—";

  const acresStr = acres != null ? `${Number(acres).toFixed(2)} ac` : "—";
  const assessed =
    assessedRaw != null
      ? `$${Number(assessedRaw).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : "—";

  document.getElementById("parcelTitle").textContent = `Parcel ${apn}`;
  document.getElementById("parcelMeta").textContent = address;
  document.getElementById("parcelAttrs").innerHTML = `
    <div><dt>Owner</dt><dd>${escapeHtml(String(owner))}</dd></div>
    <div><dt>Acres</dt><dd>${escapeHtml(acresStr)}</dd></div>
    <div><dt>Zoning</dt><dd>${escapeHtml(String(zoning))}</dd></div>
    <div><dt>Land Use</dt><dd>${escapeHtml(String(landUse))}</dd></div>
    <div><dt>Assessed</dt><dd>${escapeHtml(assessed)}</dd></div>
    <div><dt>Year Built</dt><dd>${escapeHtml(String(yearBuilt))}</dd></div>
  `;

  const allAttrs = Object.entries(props)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`)
    .join("");
  document.getElementById("parcelAllAttrs").innerHTML = allAttrs || "<em>No additional attributes.</em>";

  document.getElementById("parcelPdoLink").href = PDO_URL;

  switchRightPanel("parcel");
}

function switchRightPanel(view) {
  document.getElementById("results-view").hidden = view !== "results";
  document.getElementById("parcel-view").hidden = view !== "parcel";
}

document.getElementById("parcelBack").addEventListener("click", () => {
  switchRightPanel("results");
  if (selectedParcelId !== null) {
    map.setFeatureState({ source: "parcels", id: selectedParcelId }, { selected: false });
    selectedParcelId = null;
  }
});

// ---------- Results ----------
let scoredById = new Map();

function renderResults(scored) {
  const list = document.getElementById("results");
  const count = document.getElementById("resultsCount");
  const qualifying = scored.filter((r) => r.qualifies);
  count.textContent = `${qualifying.length} of ${scored.length} match`;

  const ranked = [...qualifying].sort((a, b) => b.score - a.score);
  if (ranked.length === 0) {
    list.innerHTML = `<li class="empty">No sites match your criteria. Loosen distance limits, expand zoning, or enable rezone.</li>`;
    return;
  }
  list.innerHTML = ranked
    .slice(0, 10)
    .map((r) => {
      const s = r.site;
      const cls = r.score >= 75 ? "s-high" : r.score >= 50 ? "s-mid" : "s-low";
      return `
        <li data-id="${s.id}">
          <div class="result-head">
            <div class="result-name">${escapeHtml(s.name)}</div>
            <span class="score-pill ${cls}">${r.score}</span>
          </div>
          <div class="result-meta">
            <span><b>${s.acres}</b> ac</span>
            <span>${s.zoning}</span>
            <span>I-5 <b>${r.distances.i5.toFixed(1)}</b> mi</span>
            <span>Rail <b>${r.distances.rail.toFixed(1)}</b> mi</span>
            ${s.hasRailSpur ? "<span>· rail spur</span>" : ""}
          </div>
        </li>`;
    })
    .join("");

  for (const li of list.querySelectorAll("li[data-id]")) {
    li.addEventListener("click", () => {
      for (const x of list.querySelectorAll("li.active")) x.classList.remove("active");
      li.classList.add("active");
      const r = scoredById.get(li.dataset.id);
      if (!r) return;
      map.flyTo({ center: [r.site.lng, r.site.lat], zoom: 14, speed: 1.2 });
      showPopup(r);
    });
  }
}

// ---------- Run ----------
function run() {
  const c = readCriteria();
  const scored = CANDIDATE_SITES.map((s) => scoreSite(s, c));
  scoredById = new Map(scored.map((r) => [r.site.id, r]));
  ensureLayers();
  map.getSource("sites").setData(sitesToFeatureCollection(scored));
  applyOverlayVisibility(c);
  renderResults(scored);
}

function applyOverlayVisibility(c) {
  map.setLayoutProperty("pois-symbol", "visibility", c.overlayPois ? "visible" : "none");
  map.setLayoutProperty("pois-label", "visibility", c.overlayPois ? "visible" : "none");
  map.setLayoutProperty("city-limits-line", "visibility", c.overlayCity ? "visible" : "none");
  map.setLayoutProperty("zoning-fill", "visibility", c.overlayZoning ? "visible" : "none");
  map.setLayoutProperty("zoning-line", "visibility", c.overlayZoning ? "visible" : "none");
  map.setLayoutProperty("parcels-fill", "visibility", c.overlayParcels ? "visible" : "none");
  map.setLayoutProperty("parcels-line", "visibility", c.overlayParcels ? "visible" : "none");
  map.setLayoutProperty("floodplain-fill", "visibility", c.overlayFloodplainLayer ? "visible" : "none");
  map.setLayoutProperty("floodplain-line", "visibility", c.overlayFloodplainLayer ? "visible" : "none");

  if (c.overlayCity) loadStaticOverlay("city-limits", endpoints.cityLimits);
  if (c.overlayZoning) loadStaticOverlay("zoning", endpoints.zoning);
  if (c.overlayFloodplainLayer) loadStaticOverlay("floodplain", endpoints.floodplain);
  if (c.overlayParcels) loadParcelsInView();
  else clearParcelsState();
}

function clearParcelsState() {
  if (selectedParcelId !== null) {
    try { map.setFeatureState({ source: "parcels", id: selectedParcelId }, { selected: false }); } catch (e) {}
    selectedParcelId = null;
  }
  switchRightPanel("results");
}

// ---------- ArcGIS query helpers ----------
function arcgisQueryUrl(base, params) {
  if (!base) return null;
  const trimmed = base.replace(/\/$/, "");
  const defaults = {
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    f: "geojson",
    returnGeometry: "true",
  };
  const merged = { ...defaults, ...params };
  const qs = new URLSearchParams(merged).toString();
  return `${trimmed}/query?${qs}`;
}

// Static overlays load once.
const overlayLoaded = new Set();

function fcBounds(fc) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const consume = (coords) => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else {
      for (const c of coords) consume(c);
    }
  };
  for (const f of fc.features) {
    if (f.geometry) consume(f.geometry.coordinates);
  }
  if (!isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

async function loadStaticOverlay(sourceId, baseUrl) {
  if (!baseUrl) {
    setStatus(`No endpoint configured for ${sourceId}. Open Data sources to set one.`, true);
    return;
  }
  if (overlayLoaded.has(sourceId)) return;
  overlayLoaded.add(sourceId);
  const url = arcgisQueryUrl(baseUrl, {});
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const gj = await res.json();
    if (gj.error) throw new Error(gj.error.message || "service error");
    if (gj.type !== "FeatureCollection") {
      throw new Error("response is not GeoJSON (got " + (gj.type || "esri json?") + ")");
    }
    if (!gj.features || !gj.features.length) {
      throw new Error("0 features (try a different layer index)");
    }
    map.getSource(sourceId).setData(gj);
    const bbox = fcBounds(gj);
    const bboxText = bbox
      ? `bbox ${bbox[0].toFixed(3)},${bbox[1].toFixed(3)} → ${bbox[2].toFixed(3)},${bbox[3].toFixed(3)}`
      : "no geometry";
    const looksWGS84 = bbox && bbox[0] > -180 && bbox[0] < 180 && bbox[1] > -90 && bbox[1] < 90;
    if (!looksWGS84 && bbox) {
      setStatus(
        `${sourceId}: ${gj.features.length} features loaded but coords look projected (${bboxText}). Service may not honor outSR=4326.`,
        true,
        { bbox, label: sourceId }
      );
    } else {
      setStatus(
        `${sourceId}: ${gj.features.length} features loaded · ${bboxText}`,
        true,
        { bbox, label: sourceId }
      );
    }
  } catch (err) {
    overlayLoaded.delete(sourceId);
    setStatus(`Couldn't load ${sourceId} (${err.message}). Open Data sources to fix.`, true);
  }
}

// Parcels: viewport-bounded, throttled.
let parcelsInflight;
let lastParcelKey = "";
let parcelsTimer;

function loadParcelsInView() {
  clearTimeout(parcelsTimer);
  parcelsTimer = setTimeout(loadParcelsNow, 250);
}

async function loadParcelsNow() {
  if (!endpoints.parcels) {
    // Fall back to mock parcels so click-to-inspect still works.
    map.getSource("parcels").setData(MOCK_PARCELS);
    setStatus("Showing mock parcels. Configure a live endpoint in Data sources.");
    return;
  }
  if (map.getZoom() < PARCELS_MIN_ZOOM) {
    map.getSource("parcels").setData(emptyFC());
    setStatus(`Zoom in to level ${PARCELS_MIN_ZOOM} to load parcels.`);
    return;
  }
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  const key = bbox.map((n) => n.toFixed(4)).join(",");
  if (key === lastParcelKey) return;
  lastParcelKey = key;

  if (parcelsInflight) parcelsInflight.abort();
  parcelsInflight = new AbortController();

  const url = arcgisQueryUrl(endpoints.parcels, {
    geometry: bbox.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "2000",
  });
  try {
    const res = await fetch(url, { signal: parcelsInflight.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const gj = await res.json();
    if (gj.error) throw new Error(gj.error.message || "service error");
    if (gj.type !== "FeatureCollection") {
      throw new Error("response is not GeoJSON (got " + (gj.type || "esri json?") + ")");
    }

    // Assign stable feature IDs for feature-state.
    gj.features.forEach((f, i) => {
      const props = f.properties || {};
      const apn = findField(props, PARCEL_FIELDS.apn);
      f.id = apn ? `${apn}` : i + 1;
    });
    map.getSource("parcels").setData(gj);
    const bbox = fcBounds(gj);
    const bboxText = bbox
      ? `bbox ${bbox[0].toFixed(3)},${bbox[1].toFixed(3)} → ${bbox[2].toFixed(3)},${bbox[3].toFixed(3)}`
      : "no geometry";
    setStatus(`${gj.features.length} parcels in view · ${bboxText}`, true, { bbox, label: "parcels" });
  } catch (err) {
    if (err.name === "AbortError") return;
    map.getSource("parcels").setData(MOCK_PARCELS);
    setStatus(`Parcel query failed (${err.message}). Showing mock parcels.`, true);
  }
}

map.on("moveend", () => {
  if (document.getElementById("overlayParcels").checked) loadParcelsInView();
});

// ---------- Status banner ----------
const statusEl = document.getElementById("data-status");
let statusTimer;
let lastLoadedBbox = null;
let lastLoadedLabel = null;
function setStatus(text, persistent = false, opts = {}) {
  statusEl.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = text;
  statusEl.appendChild(span);
  if (opts.bbox) {
    lastLoadedBbox = opts.bbox;
    lastLoadedLabel = opts.label || "layer";
    const link = document.createElement("button");
    link.type = "button";
    link.className = "status-link";
    link.textContent = "Zoom to data ↗";
    link.addEventListener("click", () => {
      const [w, s, e, n] = opts.bbox;
      if (isFinite(w) && Math.abs(w) <= 180 && Math.abs(n) <= 90) {
        map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 800 });
      } else {
        setStatus(`Bbox is projected; can't zoom: ${w.toFixed(0)},${s.toFixed(0)} → ${e.toFixed(0)},${n.toFixed(0)}`, true);
      }
    });
    statusEl.appendChild(link);
  }
  statusEl.hidden = false;
  clearTimeout(statusTimer);
  if (!persistent) statusTimer = setTimeout(() => (statusEl.hidden = true), 6000);
}

// ---------- Data sources modal ----------
const modal = document.getElementById("endpoints-modal");
const modalBody = document.getElementById("endpoints-fields");

function openEndpointsModal() {
  modalBody.innerHTML = ENDPOINT_SLOTS.map((slot) => {
    const v = endpoints[slot.key] || "";
    return `
      <label class="endpoint-row">
        <div class="endpoint-label">
          <span>${escapeHtml(slot.label)}</span>
          <small>${escapeHtml(slot.hint)}</small>
        </div>
        <input
          type="url"
          data-key="${slot.key}"
          value="${escapeHtml(v)}"
          placeholder="${escapeHtml(slot.placeholder)}"
        />
        <button type="button" class="btn-test" data-key="${slot.key}">Test</button>
        <span class="endpoint-status" data-key="${slot.key}"></span>
      </label>
    `;
  }).join("");
  modal.hidden = false;

  modalBody.querySelectorAll(".btn-test").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      const input = modalBody.querySelector(`input[data-key="${key}"]`);
      const status = modalBody.querySelector(`.endpoint-status[data-key="${key}"]`);
      const url = input.value.trim();
      if (!url) {
        status.textContent = "empty";
        status.className = "endpoint-status warn";
        return;
      }
      status.textContent = "testing…";
      status.className = "endpoint-status";
      try {
        const countUrl = arcgisQueryUrl(url, { returnCountOnly: "true", f: "json" });
        const res = await fetch(countUrl);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (json.count != null) {
          status.textContent = `${json.count.toLocaleString()} features`;
          status.className = "endpoint-status ok";
        } else if (json.error) {
          throw new Error(json.error.message || "service error");
        } else {
          status.textContent = "responded";
          status.className = "endpoint-status ok";
        }
      } catch (err) {
        status.textContent = err.message;
        status.className = "endpoint-status bad";
      }
    });
  });
}

function closeEndpointsModal() {
  modal.hidden = true;
}

document.getElementById("openEndpoints").addEventListener("click", openEndpointsModal);
document.getElementById("endpoints-close").addEventListener("click", closeEndpointsModal);
document.getElementById("endpoints-cancel").addEventListener("click", closeEndpointsModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeEndpointsModal(); });

document.getElementById("endpoints-save").addEventListener("click", () => {
  const values = {};
  modalBody.querySelectorAll("input[data-key]").forEach((input) => {
    values[input.dataset.key] = input.value.trim();
  });
  saveEndpoints(values);
  overlayLoaded.clear();
  lastParcelKey = "";
  closeEndpointsModal();
  run();
  setStatus("Endpoints saved.");
});

// ---------- Form wiring ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  run();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  form.reset();
  for (const slider of document.querySelectorAll(".slider input[type='range']")) {
    slider.dispatchEvent(new Event("input"));
  }
  run();
});

form.addEventListener("change", () => run());

map.on("load", () => {
  ensureLayers();
  run();
});

// Basemap toggle wiring.
document.querySelectorAll("[data-basemap]").forEach((btn) => {
  btn.addEventListener("click", () => setBasemap(btn.dataset.basemap));
});
