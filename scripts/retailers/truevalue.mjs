/**
 * True Value stores via www.truevalue.com GraphQL (GetStoreLocatorQuery).
 * Fetches fresh dibcommercerestriction from HTML; geocodes with Nominatim (1.1s throttle) + cache.
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  nominatimGeocodeBestEffort,
  loadJsonCache,
  saveJsonCache,
  roundCoord,
  sleep,
} from "../lib/big-box-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const CACHE = join(ROOT, "data", ".geocode-truevalue.json");

const QUERY = `query GetStoreLocatorQuery(
  $lat: String
  $long: String
  $zipCityOrState: String
  $distance: Int
  $limit: Int
  $memberNum: String
  $sku: String
  $isRentalMember: Boolean
  $isSameDayPickup: Boolean
) {
  storeLocator(
    filter: {
      lat: $lat
      lng: $long
      zipCityOrState: $zipCityOrState
      distance: $distance
      limit: $limit
      is_rental_member: $isRentalMember
      is_same_day_pickup: $isSameDayPickup
    }
    member_microsite_id: $memberNum
    sku: $sku
  ) {
    count
    store {
      name
      street
      state
      city
      zipcode
      distance
    }
  }
}`;

async function fetchStoreConfigHeaders() {
  const res = await fetch("https://www.truevalue.com/find-a-store/", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; toolbx-sales-hub/1.0)" },
  });
  const html = await res.text();
  const m = html.match(/meta name="store-config" content="([^"]+)"/);
  if (!m) throw new Error("True Value: could not parse store-config meta");
  const raw = m[1].replace(/&quot;/g, '"').replace(/&#34;/g, '"');
  const cfg = JSON.parse(raw);
  const h = cfg.headers || {};
  return {
    dib: h.dibcommercerestriction || "",
    store: h.Store || "truevalue",
  };
}

export async function fetchTrueValueStores(options = {}) {
  const skipGeocode = options.skipGeocode === true;
  const { dib, store } = await fetchStoreConfigHeaders();
  const variables = {
    lat: "39.8283",
    long: "-98.5795",
    zipCityOrState: "",
    distance: 15000,
    limit: 2500,
    memberNum: "",
    sku: "",
    isRentalMember: false,
    isSameDayPickup: false,
  };
  const res = await fetch("https://www.truevalue.com/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Store: store,
      dibcommercerestriction: dib,
      "User-Agent": "Mozilla/5.0 (compatible; toolbx-sales-hub/1.0)",
    },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    return { ok: false, error: JSON.stringify(json.errors), stores: [] };
  }
  let list = json.data?.storeLocator?.store;
  if (!Array.isArray(list)) {
    return { ok: false, error: "no storeLocator.store", stores: [] };
  }
  const tvMax = process.env.TV_MAX ? parseInt(process.env.TV_MAX, 10) : 0;
  if (Number.isFinite(tvMax) && tvMax > 0) {
    list = list.slice(0, tvMax);
  }
  const cache = loadJsonCache(CACHE);
  const stores = [];
  let i = 0;
  let misses = 0;
  for (const st of list) {
    const line1 = String(st.street || "").trim();
    const city = String(st.city || "").trim();
    const state = String(st.state || "").trim();
    const zipcode = String(st.zipcode || "").trim();
    const name = String(st.name || "True Value").slice(0, 200);
    const addr = [line1, [city, state, zipcode].filter(Boolean).join(", ")].filter(Boolean).join("\n");
    const key = `${line1}|${city}|${state}|${zipcode}`;
    let lat, lng;
    if (!skipGeocode) {
      if (cache[key]) {
        lat = cache[key].lat;
        lng = cache[key].lng;
      } else {
        const geo = await nominatimGeocodeBestEffort(line1, city, state, zipcode);
        if (!geo) {
          misses += 1;
        } else {
          lat = geo.lat;
          lng = geo.lng;
          cache[key] = { lat, lng };
          i++;
          if (i % 25 === 0) saveJsonCache(CACHE, cache);
        }
      }
    }
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    stores.push({
      chain: "True Value",
      name,
      address: addr.slice(0, 300),
      lat: roundCoord(lat),
      lng: roundCoord(lng),
    });
  }
  if (!skipGeocode) {
    saveJsonCache(CACHE, cache);
    process.stderr.write(`True Value geocode: ${stores.length} ok, ${misses} miss (of ${list.length})\n`);
  }
  return { ok: true, stores, count: list.length };
}
