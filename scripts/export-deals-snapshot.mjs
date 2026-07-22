/**
 * Writes public/deals-snapshot.json from Redshift (same rules as /api/deals, no company-only).
 * Run: node scripts/export-deals-snapshot.mjs
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "deals-snapshot.json");

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

const LIFECYCLE_MAP = {
  customer: "Customer",
  opportunity: "Opportunity",
  lead: "Lead",
  marketingqualifiedlead: "Marketing Qualified Lead",
  salesqualifiedlead: "Sales Qualified Lead",
  subscriber: "Subscriber",
  evangelist: "Evangelist",
  other: "Other",
  "1020959500": "Churned",
  "1050035316": "In Flight",
  "1050035315": "Awaiting Kick Off Call",
  "1324949332": "Closed Lost - Re-engage",
};

const STATE_NORM = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

function normalizeState(raw) {
  if (!raw) return "";
  const t = raw.trim();
  return STATE_NORM[t.toUpperCase()] || t;
}

function toISO(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function empRange(n) {
  if (!n) return "";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 500) return "201-500";
  if (n <= 1000) return "501-1000";
  return "1000+";
}

function revRange(n) {
  if (!n) return "";
  if (n < 1_000_000) return "Under $1M";
  if (n < 5_000_000) return "$1M - $5M";
  if (n < 10_000_000) return "$5M - $10M";
  if (n < 50_000_000) return "$10M - $50M";
  if (n < 100_000_000) return "$50M - $100M";
  return "$100M+";
}

function amtRange(n) {
  if (!n) return "";
  if (n < 10_000) return "Under $10K";
  if (n < 25_000) return "$10K - $25K";
  if (n < 50_000) return "$25K - $50K";
  if (n < 100_000) return "$50K - $100K";
  return "$100K+";
}

function arrRange(n) {
  if (!n) return "";
  if (n < 10_000) return "Under $10K";
  if (n < 25_000) return "$10K - $25K";
  if (n < 50_000) return "$25K - $50K";
  if (n < 100_000) return "$50K - $100K";
  return "$100K+";
}

function locRange(n) {
  if (!n) return "";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 10) return "6-10";
  if (n <= 25) return "11-25";
  if (n <= 50) return "26-50";
  return "50+";
}

loadEnv();

const pool = new pg.Pool({
  host: process.env.REDSHIFT_HOST,
  port: Number(process.env.REDSHIFT_PORT) || 5439,
  database: process.env.REDSHIFT_DB,
  user: process.env.REDSHIFT_USER,
  password: process.env.REDSHIFT_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const branchData = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "branch-locations.json"), "utf8"),
);
const companyLocData = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "company-locations.json"), "utf8"),
);

const SQL = `
  SELECT 
    d.properties_dealname,
    d.properties_company_name,
    d.properties_hs_is_closed_won,
    d.properties_hs_is_closed,
    d.properties_pipeline,
    ROUND(d.properties_amount::numeric, 0) as amount,
    CASE WHEN NULLIF(TRIM(d.properties_annual_recurring_revenue_w_est::text),'') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         THEN ROUND(TRIM(d.properties_annual_recurring_revenue_w_est::text)::numeric, 0)
         ELSE NULL END as arr_w_est,
    d.properties_erp_pos,
    o.firstname || ' ' || o.lastname as owner,
    d.createdat,
    d.properties_hs_closed_won_date,
    d.properties_product,
    c.properties_city,
    c.properties_state,
    c.properties_country,
    c.properties_zip,
    c.properties_hs_latitude,
    c.properties_hs_longitude,
    c.properties_industry,
    c.properties_numberofemployees,
    c.properties_annualrevenue,
    c.properties_domain,
    c.properties_phone,
    c.properties_address,
    c.properties_website,
    c.properties_lifecyclestage,
    c.properties_buying_group,
    bg.properties_name as buying_group_name,
    c.properties_territory,
    c.properties_arr,
    c.properties_of_locations__c,
    d.updatedat as deal_updated_at
  FROM hubspot_deals d
  LEFT JOIN hubspot_owners o ON d.properties_hubspot_owner_id = o.id
  LEFT JOIN hubspot_companies c ON ROUND(d.properties_hs_primary_associated_company) = c.id::numeric
  LEFT JOIN hubspot_companies bg ON c.properties_buying_group IS NOT NULL
    AND c.properties_buying_group != ''
    AND bg.properties_salesforceaccountid = c.properties_buying_group
  WHERE (
      d.properties_hs_is_closed_won = true
      OR (d.properties_pipeline = 'default' AND d.properties_hs_is_closed = false)
    )
`;

console.log("Querying Redshift...");
const { rows } = await pool.query(SQL);
console.log(`Rows: ${rows.length}`);

const companyMap = new Map();

for (const r of rows) {
  const company = r.properties_company_name || r.properties_dealname || "";
  const key = company.toLowerCase().trim();
  if (!key) continue;

  const rawLC = (r.properties_lifecyclestage || "").trim().toLowerCase();
  const lcStage = LIFECYCLE_MAP[rawLC] || (rawLC ? rawLC : "Unknown");
  const stage = rawLC === "1020959500" ? "Churned" : lcStage;
  const status = rawLC === "customer" ? "Customer" : "Prospect";
  const amount = Number(r.amount) || 0;
  const product = r.properties_product || "";
  const erp = r.properties_erp_pos || "";
  const created = toISO(r.createdat);
  const wonDate = toISO(r.properties_hs_closed_won_date);
  const isOpenSalesDeal =
    r.properties_pipeline === "default" && r.properties_hs_is_closed !== true;
  const openAmt = isOpenSalesDeal ? Number(r.arr_w_est) || 0 : 0;
  const line = { product: product || r.properties_dealname || "Deal", amount };

  const existing = companyMap.get(key);
  if (!existing) {
    companyMap.set(key, {
      deal: {
        name: r.properties_dealname || "",
        company,
        status,
        stage,
        amount,
        erp,
        owner: r.owner || "",
        created,
        won_date: wonDate,
        product,
        city: r.properties_city || "",
        state: normalizeState(r.properties_state || ""),
        country: r.properties_country || "",
        zip: r.properties_zip || "",
        lat: r.properties_hs_latitude ? parseFloat(r.properties_hs_latitude) : null,
        lng: r.properties_hs_longitude ? parseFloat(r.properties_hs_longitude) : null,
        industry: (r.properties_industry || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        employees: Number(r.properties_numberofemployees) || 0,
        revenue: Number(r.properties_annualrevenue) || 0,
        domain: r.properties_domain || "",
        phone: r.properties_phone || "",
        address: r.properties_address || "",
        website: r.properties_website || "",
        emp_range: empRange(Number(r.properties_numberofemployees) || 0),
        rev_range: revRange(Number(r.properties_annualrevenue) || 0),
        amt_range: amtRange(amount),
        cum_amt_range: "",
        deal_breakdown: [],
        buying_group: r.buying_group_name || "",
        territory: (r.properties_territory || "").trim(),
        branches: [],
        arr: Number(r.properties_arr) || 0,
        arr_range: arrRange(Number(r.properties_arr) || 0),
        num_locations: Number(r.properties_of_locations__c) || 0,
        loc_range: locRange(Number(r.properties_of_locations__c) || 0),
        open_pipeline_value: openAmt,
        updated_at: toISO(r.deal_updated_at),
      },
      products: new Set(product ? [product] : []),
      erps: new Set(erp ? [erp] : []),
      dealLines: [line],
      totalAmount: amount,
      openPipelineValue: openAmt,
      earliestCreated: created,
      earliestWon: wonDate,
      latestUpdated: toISO(r.deal_updated_at),
    });
  } else {
    if (product) existing.products.add(product);
    if (erp) existing.erps.add(erp);
    existing.dealLines.push(line);
    existing.totalAmount += amount;
    existing.openPipelineValue += openAmt;
    if (created && (!existing.earliestCreated || created < existing.earliestCreated))
      existing.earliestCreated = created;
    if (wonDate && (!existing.earliestWon || wonDate < existing.earliestWon))
      existing.earliestWon = wonDate;
    const upd = toISO(r.deal_updated_at);
    if (upd && (!existing.latestUpdated || upd > existing.latestUpdated))
      existing.latestUpdated = upd;
  }
}

const branchMap = new Map();
for (const b of branchData.branches || []) {
  const k = b.company_name.toLowerCase().trim();
  if (!branchMap.has(k)) branchMap.set(k, []);
  branchMap.get(k).push({ branch_name: b.branch_name, lat: b.lat, lng: b.lng });
}

const geoMap = new Map();
for (const c of companyLocData.companies || []) {
  geoMap.set(c.company_name.toLowerCase().trim(), { lat: c.lat, lng: c.lng });
}

const deals = Array.from(companyMap.values()).map((agg) => {
  const maxSingle = Math.max(...agg.dealLines.map((l) => l.amount), 0);
  const companyKey = agg.deal.company.toLowerCase().trim();
  const geo = geoMap.get(companyKey);
  return {
    ...agg.deal,
    lat: geo?.lat ?? agg.deal.lat,
    lng: geo?.lng ?? agg.deal.lng,
    product: Array.from(agg.products).sort().join(", "),
    erp: Array.from(agg.erps).sort().join(", "),
    amount: agg.totalAmount,
    amt_range: amtRange(maxSingle),
    cum_amt_range: amtRange(agg.totalAmount),
    deal_breakdown: agg.dealLines,
    created: agg.earliestCreated,
    won_date: agg.earliestWon,
    branches: branchMap.get(companyKey) || [],
    open_pipeline_value: agg.openPipelineValue,
    updated_at: agg.latestUpdated,
  };
});

const payload = {
  deals,
  updated_at: new Date().toISOString(),
  snapshot: true,
  build: "snapshot-export",
};

fs.writeFileSync(OUT, JSON.stringify(payload));
console.log(`Wrote ${deals.length} companies to ${OUT}`);
await pool.end();
