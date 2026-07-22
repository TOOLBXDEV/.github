/**
 * Renders a static PNG of customer companies (dots only).
 * Includes HubSpot lifecycle = Customer plus closed-won companies still
 * in implementation (Awaiting Kick Off Call / In Flight).
 * Does not modify the sales heatmap app.
 *
 * Run: node scripts/generate-customer-map-image.mjs
 * Output: output/customer-lifecycle-map.png
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "output");
const OUT_PNG = path.join(OUT_DIR, "customer-lifecycle-map.png");
const TMP_HTML = path.join(OUT_DIR, "_customer-map-render.html");

const LAND = "#D6E8EA";
const WATER = "#FFFFFF";
const DOT = "#4A7C82";
/** Thin admin borders — light grey-teal like reference screenshot */
const ADMIN_LINE = "#B5CACD";
const ADMIN_WEIGHT = 1.15;

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].trim();
    }
    break;
  }
}

async function fetchAdminBoundaries() {
  const [usRes, caRes] = await Promise.all([
    fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"),
    fetch(
      "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-canada-province/exports/geojson?limit=-1",
    ),
  ]);
  const features = [];
  if (usRes.ok) {
    const us = await usRes.json();
    if (us.features) features.push(...us.features);
  }
  if (caRes.ok) {
    const ca = await caRes.json();
    if (ca.features) features.push(...ca.features);
  }
  return { type: "FeatureCollection", features };
}

async function fetchCustomerPoints() {
  loadEnv();
  const pool = new pg.Pool({
    host: process.env.REDSHIFT_HOST,
    port: Number(process.env.REDSHIFT_PORT) || 5439,
    database: process.env.REDSHIFT_DB,
    user: process.env.REDSHIFT_USER,
    password: process.env.REDSHIFT_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  const companyLocData = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "company-locations.json"), "utf8"),
  );
  const geoMap = new Map();
  for (const c of companyLocData.companies || []) {
    geoMap.set(c.company_name.toLowerCase().trim(), { lat: c.lat, lng: c.lng });
  }

  const { rows } = await pool.query(`
    SELECT
      c.properties_name as company,
      c.properties_hs_latitude as lat,
      c.properties_hs_longitude as lng
    FROM hubspot_companies c
    WHERE TRIM(COALESCE(c.properties_name, '')) <> ''
      AND (
        LOWER(TRIM(COALESCE(c.properties_lifecyclestage, ''))) = 'customer'
        OR (
          TRIM(COALESCE(c.properties_lifecyclestage, '')) IN ('1050035315', '1050035316')
          AND EXISTS (
            SELECT 1 FROM hubspot_deals d
            WHERE d.properties_hs_is_closed_won = true
              AND LOWER(TRIM(d.properties_company_name)) = LOWER(TRIM(c.properties_name))
          )
        )
      )
  `);

  await pool.end();

  const points = [];
  const seen = new Set();
  for (const r of rows) {
    const name = String(r.company || "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const geo = geoMap.get(key);
    const lat = geo?.lat ?? (r.lat ? parseFloat(String(r.lat)) : null);
    const lng = geo?.lng ?? (r.lng ? parseFloat(String(r.lng)) : null);
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    if (lat < 15 || lat > 72 || lng < -170 || lng > -50) continue;
    points.push({ lat, lng, company: name });
  }
  return points;
}

function buildHtml(points, boundaries) {
  const pointsJson = JSON.stringify(points);
  const boundariesJson = JSON.stringify(boundaries);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 1600px; height: 1000px; background: ${WATER}; }
    .leaflet-container { background: ${WATER} !important; font-family: system-ui, sans-serif; }
    .land-tiles { filter: sepia(0.15) saturate(0.35) hue-rotate(145deg) brightness(1.08) contrast(0.92); opacity: 1; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${pointsJson};
    const boundaries = ${boundariesJson};
    const DOT = "${DOT}";
    const ADMIN_LINE = "${ADMIN_LINE}";
    const ADMIN_WEIGHT = ${ADMIN_WEIGHT};

    const map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      touchZoom: false,
    }).setView([39.5, -98.5], 4);

    const adminPane = map.createPane("adminBoundaries");
    adminPane.style.zIndex = "385";

    const dotsPane = map.createPane("customerDots");
    dotsPane.style.zIndex = "650";

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      className: "land-tiles",
    }).addTo(map);

    L.geoJSON(boundaries, {
      pane: "adminBoundaries",
      style: {
        color: ADMIN_LINE,
        weight: ADMIN_WEIGHT,
        opacity: 0.92,
        fillColor: "transparent",
        fillOpacity: 0,
      },
      interactive: false,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: '<div style="width:7px;height:7px;border-radius:50%;background:' + DOT + ';opacity:0.88;box-shadow:0 0 0 2px rgba(255,255,255,0.55), 0 0 6px rgba(74,124,130,0.35)"></div>',
      iconSize: [7, 7],
      iconAnchor: [3.5, 3.5],
    });

    for (const p of points) {
      L.marker([p.lat, p.lng], { icon, pane: "customerDots" }).addTo(map);
    }

    map.fitBounds([[24, -130], [52, -63]], { padding: [40, 40] });
    window.__mapReady = true;
  </script>
</body>
</html>`;
}

async function main() {
  console.log("Fetching customer companies from Redshift...");
  const points = await fetchCustomerPoints();
  console.log(`Mapped ${points.length} customers with coordinates.`);

  if (points.length === 0) {
    console.error("No customer points to render.");
    process.exit(1);
  }

  console.log("Fetching US states + Canada provinces/territories GeoJSON...");
  const boundaries = await fetchAdminBoundaries();
  console.log(`  ${boundaries.features.length} admin regions`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(TMP_HTML, buildHtml(points, boundaries));

  console.log("Rendering PNG with Playwright...");
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  await page.goto(`file://${TMP_HTML}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__mapReady === true);
  await page.waitForTimeout(1500);
  await page.locator("#map").screenshot({ path: OUT_PNG, type: "png" });
  await browser.close();

  console.log(`Wrote ${OUT_PNG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
