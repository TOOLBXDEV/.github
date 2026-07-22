import { NextResponse } from "next/server";
import { getPool } from "@/lib/redshift";
import companyLocData from "@/data/company-locations.json";
import branchLocData from "@/data/branch-locations.json";

const NOMINATIM_DELAY = 1100;
const MAX_GEOCODE_PER_RUN = 30;

async function geocode(query: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "toolbx-sales-heatmap-cron/1.0" },
  });
  const data = await res.json();
  if (data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();

  try {
    const { rows } = await pool.query(`
      SELECT
        c.properties_name as name,
        c.properties_address as address,
        c.properties_city as city,
        c.properties_state as state,
        c.properties_zip as zip,
        c.properties_country as country,
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
               c.properties_state, c.properties_zip, c.properties_country
      ORDER BY c.properties_name
    `);

    const existingCompanies = new Set(
      (companyLocData as any).companies.map((c: any) => c.company_name)
    );
    const existingBranches = new Set(
      (branchLocData as any).branches.map((b: any) => `${b.company_name}::${b.branch_name}`)
    );

    const missingCompanies = rows.filter((r) => !existingCompanies.has(r.name));

    const report = {
      total_pipeline_companies: rows.length,
      already_geocoded: rows.length - missingCompanies.length,
      missing_geocode: missingCompanies.length,
      geocoded_this_run: 0,
      failed_this_run: 0,
      new_results: [] as { company_name: string; type: string; lat: number; lng: number; address_query: string }[],
      branch_count: (branchLocData as any).branches.length,
      existing_branch_keys: existingBranches.size,
    };

    const toProcess = missingCompanies.slice(0, MAX_GEOCODE_PER_RUN);

    for (const r of toProcess) {
      const parts = [];
      if (r.address) parts.push(r.address.trim());
      if (r.city) parts.push(r.city.trim());
      const stateZip = [r.state, r.zip].filter(Boolean).map((s: string) => s.trim()).join(" ");
      if (stateZip) parts.push(stateZip);
      if (r.country) parts.push(r.country.trim());
      const query = parts.join(", ");

      if (!query || query.length < 5) continue;

      const coords = await geocode(query);
      await sleep(NOMINATIM_DELAY);

      if (coords) {
        report.geocoded_this_run++;
        report.new_results.push({
          company_name: r.name,
          type: r.type,
          lat: coords.lat,
          lng: coords.lng,
          address_query: query,
        });
      } else {
        const fallback = [r.city, r.state, r.country].filter(Boolean).map((s: string) => s.trim()).join(", ");
        if (fallback && fallback !== query) {
          const fb = await geocode(fallback);
          await sleep(NOMINATIM_DELAY);
          if (fb) {
            report.geocoded_this_run++;
            report.new_results.push({
              company_name: r.name,
              type: r.type,
              lat: fb.lat,
              lng: fb.lng,
              address_query: fallback + " (fallback)",
            });
          } else {
            report.failed_this_run++;
          }
        } else {
          report.failed_this_run++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      report,
      action_needed: report.missing_geocode > 0
        ? `Run scripts/geocode-companies.mjs locally and commit data/company-locations.json to add ${report.missing_geocode} missing companies.`
        : "All pipeline companies are geocoded.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
