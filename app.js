import { MEDFORD, POIS, CANDIDATE_SITES, ZONING_GROUP, ARCGIS } from "./data.js";

const MILES_PER_KM = 0.621371;

// ---------- Map ----------
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      basemap: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        ],
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

// ---------- Form state ----------
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
  };
}

// Live-update slider readouts.
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

  // Hard filters.
  if (site.acres < c.minAcres) reasons.push(`too small (${site.acres} ac)`);
  if (site.acres > c.maxAcres) reasons.push(`too large (${site.acres} ac)`);

  const zoneGroup = ZONING_GROUP[site.zoning] || "other";
  const zoningOk = c.zoning.includes(zoneGroup);
  if (!zoningOk && !c.allowRezone) reasons.push(`zoning ${site.zoning} excluded`);

  if (distances.i5 > c.distI5) reasons.push(`I-5 ${distances.i5.toFixed(1)} mi`);
  if (distances.airport > c.distAirport)
    reasons.push(`airport ${distances.airport.toFixed(1)} mi`);
  if (distances.rail > c.distRail)
    reasons.push(`rail ${distances.rail.toFixed(1)} mi`);
  if (distances.downtown > c.distDowntown)
    reasons.push(`downtown ${distances.downtown.toFixed(1)} mi`);

  for (const u of c.utilitiesRequired) {
    if (!site.utilities.includes(u)) reasons.push(`no ${u}`);
  }
  if (c.avoidFloodplain && site.floodplain) reasons.push("in floodplain");
  if (c.avoidSlope && site.slope > 15) reasons.push("steep slope");

  // Soft scoring (0-100). Each category contributes if hard filter passed.
  let score = 0;
  // Zoning fit (20 pts; rezone-needed gets 8 pts).
  if (zoningOk) score += 20;
  else if (c.allowRezone) score += 8;

  // Lot size fit within range — closer to midpoint = higher (15 pts).
  if (site.acres >= c.minAcres && site.acres <= c.maxAcres) {
    const mid = (c.minAcres + c.maxAcres) / 2;
    const span = Math.max(c.maxAcres - c.minAcres, 0.1);
    const offset = Math.abs(site.acres - mid) / (span / 2);
    score += 15 * (1 - Math.min(offset, 1));
  }

  // Proximity scoring — exponential decay so closer is much better. (50 pts split.)
  const proxScore = (actual, max, weight) => {
    if (actual > max) return 0;
    return weight * Math.exp(-actual / Math.max(max / 2, 0.5));
  };
  score += proxScore(distances.i5, c.distI5, 18);
  score += proxScore(distances.airport, c.distAirport, 8);
  score += proxScore(distances.rail, c.distRail, 14);
  score += proxScore(distances.downtown, c.distDowntown, 10);

  // Utilities completeness (10 pts).
  const fullUtils = ["water", "sewer", "power3", "gas", "fiber"];
  const utilCount = fullUtils.filter((u) => site.utilities.includes(u)).length;
  score += (utilCount / fullUtils.length) * 10;

  // Bonus: rail spur on industrial/logistics projects (5 pts).
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

// ---------- Map layers ----------
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

  map.addSource("sites", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "sites-circle",
    type: "circle",
    source: "sites",
    paint: {
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        9, 6, 14, 13,
      ],
      "circle-color": [
        "case",
        ["==", ["get", "qualifies"], false], "#5a6b80",
        [
          "interpolate", ["linear"], ["get", "score"],
          0, "#c89537",
          50, "#e8b54a",
          80, "#7fc88a",
        ],
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
    paint: {
      "text-color": "#0b1c30",
    },
  });

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

  // Empty placeholders for live overlays.
  map.addSource("city-limits", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "city-limits-line",
    type: "line",
    source: "city-limits",
    paint: { "line-color": "#6db4c1", "line-width": 2, "line-dasharray": [3, 2] },
  });

  map.addSource("zoning", { type: "geojson", data: emptyFC() });
  map.addLayer(
    {
      id: "zoning-fill",
      type: "fill",
      source: "zoning",
      paint: { "fill-color": "#6db4c1", "fill-opacity": 0.15 },
      layout: { visibility: "none" },
    },
    "sites-circle"
  );
  map.addLayer(
    {
      id: "zoning-line",
      type: "line",
      source: "zoning",
      paint: { "line-color": "#6db4c1", "line-width": 0.6, "line-opacity": 0.55 },
      layout: { visibility: "none" },
    },
    "sites-circle"
  );

  map.on("click", "sites-circle", (e) => {
    const f = e.features[0];
    const r = scoredById.get(f.properties.id);
    if (r) showPopup(r);
  });
  map.on("mouseenter", "sites-circle", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "sites-circle", () => (map.getCanvas().style.cursor = ""));
}

function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

// ---------- Popup ----------
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

  if (c.overlayCity) loadOverlay("city-limits", ARCGIS.cityLimits);
  if (c.overlayZoning) loadOverlay("zoning", ARCGIS.zoning);
}

// ---------- ArcGIS overlays ----------
const overlayLoaded = new Set();
async function loadOverlay(sourceId, url) {
  if (overlayLoaded.has(sourceId)) return;
  overlayLoaded.add(sourceId);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const gj = await res.json();
    if (!gj || !gj.features) throw new Error("not GeoJSON");
    map.getSource(sourceId).setData(gj);
    setStatus(`Loaded ${gj.features.length} features for ${sourceId}.`);
  } catch (err) {
    overlayLoaded.delete(sourceId);
    setStatus(
      `Couldn't load live ${sourceId} from City GIS (${err.message}). ` +
        `Update ARCGIS.${sourceId === "city-limits" ? "cityLimits" : "zoning"} in data.js with the correct endpoint.`,
      true
    );
  }
}

const statusEl = document.getElementById("data-status");
let statusTimer;
function setStatus(text, persistent = false) {
  statusEl.textContent = text;
  statusEl.hidden = false;
  clearTimeout(statusTimer);
  if (!persistent) statusTimer = setTimeout(() => (statusEl.hidden = true), 6000);
}

// ---------- Wire form ----------
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

// Re-run scoring on any change (so sliders feel live).
form.addEventListener("change", () => run());

// Initial render once map loads.
map.on("load", () => {
  ensureLayers();
  run();
});
