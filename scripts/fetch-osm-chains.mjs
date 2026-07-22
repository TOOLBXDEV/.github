/**
 * OpenStreetMap / Overpass fetch for selected chains only.
 */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

export const DEFAULT_BBOXES = [
  [24, -125, 33, -110], [33, -125, 42, -110], [42, -125, 50, -110],
  [24, -110, 33, -98], [33, -110, 42, -98], [42, -110, 50, -98],
  [24, -98, 33, -86], [33, -98, 42, -86], [42, -98, 50, -86],
  [24, -86, 33, -74], [33, -86, 42, -74], [42, -86, 50, -74],
  [41, -141, 52, -110], [41, -110, 52, -52],
];

const CHAIN_CONFIG = {
  "Lowe's": { brand: "Lowe's" },
  "Home Depot": { brand: "The Home Depot", extraNameRegex: "^The Home Depot" },
  "True Value": { brand: "True Value" },
  Menards: { brand: "Menards" },
  RONA: { brand: "RONA" },
  "Home Hardware": { brand: "Home Hardware" },
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function escapeBrand(brand) { return brand.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

function formatAddress(tags) {
  if (!tags) return "";
  if (tags["addr:full"]) return String(tags["addr:full"]).trim();
  const line1 = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  const city = tags["addr:city"] || tags["addr:suburb"] || "";
  const region = tags["addr:state"] || tags["addr:province"] || "";
  const pc = tags["addr:postcode"] || "";
  const line2 = [city, region, pc].filter(Boolean).join(", ").trim();
  const parts = [line1, line2].filter(Boolean);
  return parts.join("\n") || "";
}

function parseElements(elements, displayChain) {
  const stores = [];
  for (const el of elements || []) {
    let lat, lng;
    if (el.type === "node") { lat = el.lat; lng = el.lon; }
    else if (el.center) { lat = el.center.lat; lng = el.center.lon; }
    else continue;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const tags = el.tags || {};
    const nm = tags.name || tags.brand || displayChain;
    const addr = formatAddress(tags);
    stores.push({
      chain: displayChain,
      name: String(nm).slice(0, 200),
      address: addr ? String(addr).slice(0, 300) : "",
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    });
  }
  return stores;
}

function buildQuery(cfg, south, west, north, east) {
  const b = escapeBrand(cfg.brand);
  const lines = [
    `  nwr["brand"="${b}"](${south},${west},${north},${east});`,
    `  nwr["operator"="${b}"](${south},${west},${north},${east});`,
  ];
  if (cfg.extraNameRegex) {
    const rx = escapeBrand(cfg.extraNameRegex);
    lines.push(`  nwr["name"~"${rx}",i](${south},${west},${north},${east});`);
  }
  return `[out:json][timeout:480];
(
${lines.join("\n")}
);
out center tags;`;
}

async function fetchBboxOnce(baseUrl, cfg, south, west, north, east) {
  const query = buildQuery(cfg, south, west, north, east);
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  const status = res.status;
  if (status === 429 || status === 504 || status === 502 || status === 503) {
    const e = new Error("HTTP " + status);
    e.status = status;
    throw e;
  }
  if (!res.ok) { const e = new Error("HTTP " + status); e.status = status; throw e; }
  const data = await res.json();
  return parseElements(data.elements, cfg.chain);
}

async function fetchBbox(endpoints, cfg, south, west, north, east) {
  let wait = 25000;
  for (let attempt = 0; attempt < 18; attempt++) {
    const baseUrl = endpoints[attempt % endpoints.length];
    try {
      return await fetchBboxOnce(baseUrl, cfg, south, west, north, east);
    } catch (e) {
      const retryable = e.status === 429 || e.status === 504 || e.status === 502 || e.status === 503;
      if (retryable) {
        process.stderr.write(` [retry ${wait / 1000}s ${baseUrl.split("/")[2]}] `);
        await sleep(wait);
        wait = Math.min(wait + 15000, 240000);
        continue;
      }
      throw e;
    }
  }
  throw new Error("too many retries");
}

/**
 * @param {string[]} chainNames
 * @param {{ onProgress?: (msg:string)=>void, bboxes?: number[][], endpoints?: string[] }} [opts]
 */
export async function fetchOsmChains(chainNames, opts = {}) {
  const log = opts.onProgress || ((m) => process.stderr.write(m));
  const boxes = opts.bboxes || DEFAULT_BBOXES;
  const endpoints = opts.endpoints || OVERPASS_ENDPOINTS;
  const all = [];
  for (const name of chainNames) {
    const cfg = CHAIN_CONFIG[name];
    if (!cfg) {
      log(`Unknown chain skipped: ${name}\n`);
      continue;
    }
    const full = { chain: name, ...cfg };
    log(`OSM ${name}…\n`);
    for (const [south, west, north, east] of boxes) {
      log(`  bbox ${south},${west},${north},${east}… `);
      try {
        const part = await fetchBbox(endpoints, full, south, west, north, east);
        log(`${part.length}\n`);
        all.push(...part);
      } catch (err) {
        log(`ERROR: ${err.message} — skipping bbox\n`);
      }
      await sleep(12000);
    }
  }
  return all;
}
