/**
 * One-time script: geocode active branches for multi-branch pipeline companies.
 * Uses Nominatim (free, 1 req/sec rate limit).
 * Output: data/branch-locations.json
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "branch-locations.json");

const pool = new pg.Pool({
  host: process.env.REDSHIFT_HOST,
  port: Number(process.env.REDSHIFT_PORT) || 5439,
  database: process.env.REDSHIFT_DB,
  user: process.env.REDSHIFT_USER,
  password: process.env.REDSHIFT_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const SKIP_PATTERNS = [
  /e-commerce/i, /ecommerce/i, /staging/i, /online/i,
  /warehouse/i, /headquarters/i, /^hq$/i, /^dev /i,
  /test/i, /demo/i,
];

function extractSearchQuery(branchName, companyName, state, country) {
  let q = branchName.trim();

  if (SKIP_PATTERNS.some((p) => p.test(q))) return null;

  // "Company Name - City" or "Company Name – City"
  const dashIdx = q.search(/\s[-–—]\s/);
  if (dashIdx > -1) q = q.slice(dashIdx).replace(/^[\s\-–—]+/, "").trim();

  // Strip trailing " Location", " Branch"
  q = q.replace(/\s+(location|branch)$/i, "").trim();

  // If the remaining string equals the company name, it's the HQ
  if (q.toLowerCase() === companyName.toLowerCase()) return null;

  const parts = [q];
  if (state) parts.push(state);
  if (country) parts.push(country);
  return parts.join(", ");
}

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

async function main() {
  console.log("Querying branches from Redshift...");

  const { rows } = await pool.query(`
    WITH pipeline_cos AS (
      SELECT DISTINCT c.properties_name, c.properties_state, c.properties_country
      FROM hubspot_companies c
      JOIN hubspot_deals d ON d.properties_company_name = c.properties_name
      WHERE d.properties_hs_is_closed_won = true 
         OR (d.properties_pipeline = 'default' AND d.properties_hs_is_closed = false)
    ),
    multi_branch AS (
      SELECT ec.ecommerce_config_id, ec.display_name,
             pc.properties_state as state, pc.properties_country as country
      FROM pipeline_cos pc
      JOIN bi_ecommerce_config ec ON LOWER(TRIM(ec.display_name)) = LOWER(TRIM(pc.properties_name))
      WHERE ec.ecommerce_config_id IN (
        SELECT ecommerce_config_id FROM bi_branch WHERE is_active = true
        GROUP BY ecommerce_config_id HAVING COUNT(*) > 1
      )
    )
    SELECT b.branch_id, b.name as branch_name, b.google_places_id,
           mb.display_name as company_name, mb.state, mb.country
    FROM bi_branch b
    JOIN multi_branch mb ON b.ecommerce_config_id = mb.ecommerce_config_id
    WHERE b.is_active = true
    ORDER BY mb.display_name, b.name
  `);

  console.log(`Found ${rows.length} branches across multi-branch pipeline companies.`);

  const results = [];
  let geocoded = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const query = extractSearchQuery(r.branch_name, r.company_name, r.state, r.country);

    if (!query) {
      skipped++;
      console.log(`[${i + 1}/${rows.length}] SKIP: ${r.company_name} / ${r.branch_name}`);
      continue;
    }

    console.log(`[${i + 1}/${rows.length}] Geocoding: "${query}" (${r.company_name} / ${r.branch_name})`);

    const coords = await geocode(query);
    await sleep(1100); // Nominatim rate limit

    if (coords) {
      geocoded++;
      results.push({
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        company_name: r.company_name,
        google_places_id: r.google_places_id || "",
        lat: coords.lat,
        lng: coords.lng,
      });
    } else {
      failed++;
      console.log(`  ⚠ No result for: "${query}"`);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ branches: results }, null, 2));
  console.log(`\nDone! Geocoded: ${geocoded}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Saved to ${OUT}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
