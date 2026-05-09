const map = new maplibregl.Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [-98.5795, 39.8283],
  zoom: 3,
});

map.addControl(new maplibregl.NavigationControl(), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

const sites = [];
const markers = [];
const listEl = document.getElementById("site-list");
const clearBtn = document.getElementById("clear-btn");

function render() {
  if (sites.length === 0) {
    listEl.innerHTML = '<li class="empty">No sites yet.</li>';
    return;
  }
  listEl.innerHTML = sites
    .map(
      (s, i) =>
        `<li><strong>Site ${i + 1}</strong><br>${s.lng.toFixed(4)}, ${s.lat.toFixed(4)}</li>`
    )
    .join("");
}

map.on("click", (e) => {
  const { lng, lat } = e.lngLat;
  sites.push({ lng, lat });
  const marker = new maplibregl.Marker({ color: "#38bdf8" })
    .setLngLat([lng, lat])
    .setPopup(
      new maplibregl.Popup({ offset: 24 }).setText(
        `Site ${sites.length}\n${lng.toFixed(4)}, ${lat.toFixed(4)}`
      )
    )
    .addTo(map);
  markers.push(marker);
  render();
});

clearBtn.addEventListener("click", () => {
  markers.forEach((m) => m.remove());
  markers.length = 0;
  sites.length = 0;
  render();
});
