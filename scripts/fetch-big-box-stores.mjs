/**
 * OSM/Overpass only (all chains). For merged retailer + OSM, use: npm run fetch-big-box
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { fetchOsmChains, DEFAULT_BBOXES } from "./fetch-osm-chains.mjs";
import { writeBigBoxJson } from "./lib/big-box-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "big-box-stores.json");

const CHAINS = [
  "Lowe's",
  "Home Depot",
  "True Value",
  "Menards",
  "RONA",
  "Home Hardware",
];

async function main() {
  const stores = await fetchOsmChains(CHAINS, { bboxes: DEFAULT_BBOXES });
  const note = "OpenStreetMap via Overpass only — use npm run fetch-big-box for True Value from retailer GraphQL + Nominatim.";
  const n = writeBigBoxJson(OUT, {
    stores,
    sources: { osmChains: CHAINS, truevalue: "not_used" },
    note,
  });
  console.log(`Wrote ${n} stores to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
