/**
 * One-time script: geocode pipeline company addresses from HubSpot fields.
 * Uses the manually-entered address instead of HubSpot's auto-enriched lat/lng.
 * Output: data/company-locations.json
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "company-locations.json");

const pool = new pg.Pool({
  host: process.env.REDSHIFT_HOST,
  port: Number(process.env.REDSHIFT_PORT) || 5439,
  database: process.env.REDSHIFT_DB,
  user: process.env.REDSHIFT_USER,
  password: process.env.REDSHIFT_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "toolbx-sales-heatmap/1.0" },
  });
  const data = await res.json();
  if (data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildQuery(row) {
  const parts = [];
  if (row.address) parts.push(row.address.trim());
  if (row.city) parts.push(row.city.trim());
  const stateZip = [row.state, row.zip].filter(Boolean).map(s => s.trim()).join(" ");
  if (stateZip) parts.push(stateZip);
  if (row.country) parts.push(row.country.trim());
  return parts.join(", ");
}

async function main() {
  console.log("Querying pipeline companies with addresses from Redshift...");

  const { rows } = await pool.query(`
    SELECT DISTINCT
      c.properties_name as name,
      c.properties_address as address,
      c.properties_city as city,
      c.properties_state as state,
      c.properties_zip as zip,
      c.properties_country as country,
      c.properties_hs_latitude as hs_lat,
      c.properties_hs_longitude as hs_lng,
      CASE
        WHEN bool_or(d.properties_hs_is_closed_won) THEN 'Customer'
        ELSE 'Opportunity'
      END as type
    FROM hubspot_companies c
    JOIN hubspot_deals d ON d.properties_company_name = c.properties_name
    WHERE (d.properties_hs_is_closed_won = true
       OR (d.properties_pipeline = 'default' AND d.properties_hs_is_closed = false))
      AND c.properties_address IS NOT NULL
      AND c.properties_address != ''
    GROUP BY c.properties_name, c.properties_address, c.properties_city,
             c.properties_state, c.properties_zip, c.properties_country,
             c.properties_hs_latitude, c.properties_hs_longitude
    ORDER BY c.properties_name
  `);

  console.log(`Found ${rows.length} pipeline companies with addresses.`);

  const results = [];
  let geocoded = 0, failed = 0, skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const query = buildQuery(r);

    if (!query || query.length < 5) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${rows.length}] Geocoding: "${query}" (${r.name})`);

    const coords = await geocode(query);
    await sleep(1100);

    if (coords) {
      geocoded++;
      results.push({
        company_name: r.name,
        type: r.type,
        lat: coords.lat,
        lng: coords.lng,
        address_query: query,
      });
    } else {
      failed++;
      console.log(`  ⚠ No result for: "${query}"`);
      // Fall back to city + state + country
      const fallback = [r.city, r.state, r.country].filter(Boolean).map(s => s.trim()).join(", ");
      if (fallback && fallback !== query) {
        console.log(`  → Trying fallback: "${fallback}"`);
        const fb = await geocode(fallback);
        await sleep(1100);
        if (fb) {
          geocoded++;
          failed--;
          results.push({
            company_name: r.name,
            type: r.type,
            lat: fb.lat,
            lng: fb.lng,
            address_query: fallback + " (fallback)",
          });
        }
      }
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ companies: results }, null, 2));
  console.log(`\nDone! Geocoded: ${geocoded}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Saved to ${OUT}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
