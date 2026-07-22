/**
 * Shared helpers for big-box store JSON generation.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { dirname } from "path";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function roundCoord(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

export function dedupeStores(stores) {
  const seen = new Set();
  const out = [];
  for (const s of stores) {
    const key = `${s.chain}|${s.lat.toFixed(6)}|${s.lng.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function writeBigBoxJson(outPath, { stores, sources, note }) {
  mkdirSync(dirname(outPath), { recursive: true });
  const d = dedupeStores(stores);
  const payload = {
    stores: d,
    fetchedAt: new Date().toISOString(),
    count: d.length,
    sources: sources || {},
    note: note || "",
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 0), "utf8");
  return payload.count;
}

const NOMINATIM_UA = "toolbx-sales-hub-fetch/1.0 (batch geocode; contact: local)";

async function nominatimFetch(params) {
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams(params);
  const res = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function nominatimGeocodeAddress(line1, city, state, postcode) {
  const q = [line1, city, state, postcode, "United States"].filter(Boolean).join(", ");
  return nominatimFetch({ format: "json", limit: "1", q });
}

export async function nominatimGeocodeBestEffort(line1, city, state, zipcode) {
  const street = String(line1 || "").trim();
  const c = String(city || "").trim();
  const st = String(state || "").trim();
  const z = String(zipcode || "").trim().replace(/^(\d{5})-\d{4}$/, "$1");

  const structured = await nominatimFetch({
    format: "json",
    limit: "1",
    countrycodes: "us",
    ...(street ? { street } : {}),
    ...(c ? { city: c } : {}),
    ...(st ? { state: st } : {}),
    ...(z ? { postalcode: z } : {}),
  });
  if (structured) return structured;

  await sleep(1100);
  if (c && st && z) {
    const q2 = await nominatimFetch({
      format: "json",
      limit: "1",
      countrycodes: "us",
      q: `${c}, ${st} ${z}, USA`,
    });
    if (q2) return q2;
  }

  await sleep(1100);
  if (z) {
    return await nominatimFetch({
      format: "json",
      limit: "1",
      countrycodes: "us",
      q: `${z}, USA`,
    });
  }

  return null;
}

export function loadJsonCache(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function saveJsonCache(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 0), "utf8");
}
