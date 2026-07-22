/**
 * Merges retailer-sourced stores (where implemented) with OSM/Overpass for remaining chains.
 * Run: npm run fetch-big-box
 *
 * Env:
 *   SKIP_TV=1           — skip True Value GraphQL (all chains from OSM)
 *   TV_SKIP_GEOCODE=1   — True Value: skip Nominatim
 *   TV_MAX=N            — only first N True Value stores (testing)
 *   OSM_SKIP=1          — skip Overpass (True Value + retailers only; use when Overpass is overloaded)
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeBigBoxJson } from "./lib/big-box-shared.mjs";
import { fetchOsmChains } from "./fetch-osm-chains.mjs";
import { fetchTrueValueStores } from "./retailers/truevalue.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Written to public/ so Vercel always deploys it (App Router API 404s on stale builds). */
const OUT = join(__dirname, "..", "public", "big-box-stores.json");

const ALL_CHAINS = ["Lowe's", "Home Depot", "True Value", "Menards", "RONA", "Home Hardware"];

async function main() {
  const sources = { osmChains: [...ALL_CHAINS], truevalue: "skipped" };
  const retailerStores = [];
  let osmChains = [...ALL_CHAINS];

  if (process.env.SKIP_TV !== "1") {
    process.stderr.write("Fetching True Value (GraphQL + Nominatim)…\n");
    try {
      const tv = await fetchTrueValueStores({
        skipGeocode: process.env.TV_SKIP_GEOCODE === "1",
      });
      if (tv.ok && tv.stores?.length) {
        retailerStores.push(...tv.stores);
        sources.truevalue = `ok (${tv.stores.length} with coordinates)`;
        osmChains = osmChains.filter((c) => c !== "True Value");
      } else {
        sources.truevalue = tv.error || "failed or empty";
      }
    } catch (e) {
      sources.truevalue = `error: ${e.message}`;
      process.stderr.write(`True Value failed: ${e.message}\n`);
    }
  }

  process.stderr.write(`OSM Overpass for: ${osmChains.join(", ")}\n`);
  let osm = [];
  if (process.env.OSM_SKIP === "1") {
    process.stderr.write("OSM_SKIP=1 — skipping Overpass.\n");
    sources.osmSkipped = true;
  } else try {
    osm = await fetchOsmChains(osmChains);
  } catch (e) {
    sources.osmError = e.message || String(e);
    process.stderr.write(`OSM Overpass failed: ${sources.osmError}\n`);
  }
  sources.osmChains = osmChains;

  const stores = [...osm, ...retailerStores];
  const note =
    "True Value (when enabled): truevalue.com GraphQL + Nominatim (see data/.geocode-truevalue.json). " +
    "Other chains: OpenStreetMap via Overpass. If you need pins immediately, run SKIP_TV=1 npm run fetch-big-box.";
  const n = writeBigBoxJson(OUT, { stores, sources, note });
  console.log(`Wrote ${n} stores to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
