import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/redshift";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PORTAL = "49044619";

/* ── AE Territory mapping ────────────────────────────────── */

/** HubSpot owner ID → AE name */
const OWNER_ID_TO_AE: Record<string, string> = {
  "83523709": "Joshua Kolenda",
  "85535326": "Michelle Kubas",
  "89101885": "Graham Staley",
  "89637010": "Pouyan Mirsaeidi",
  "88239302": "Norman Kuan",
};

/** Full state name → 2-letter code (US + CA provinces) */
const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
  // Canadian provinces
  ontario: "ON", quebec: "QC", "new brunswick": "NB", "nova scotia": "NS",
  "prince edward island": "PE", "newfoundland and labrador": "NL",
  newfoundland: "NL", "british columbia": "BC", alberta: "AB",
  saskatchewan: "SK", manitoba: "MB", yukon: "YT",
  "northwest territories": "NT", nunavut: "NU",
};

/** State/province code → AE name */
const STATE_TO_AE: Record<string, string> = {
  FL: "Pouyan Mirsaeidi", GA: "Pouyan Mirsaeidi", KY: "Pouyan Mirsaeidi",
  MS: "Pouyan Mirsaeidi", NC: "Pouyan Mirsaeidi", OK: "Pouyan Mirsaeidi",
  SC: "Pouyan Mirsaeidi", TN: "Pouyan Mirsaeidi", VA: "Pouyan Mirsaeidi",
  WV: "Pouyan Mirsaeidi", AL: "Pouyan Mirsaeidi",
  AK: "Michelle Kubas", AZ: "Michelle Kubas", AR: "Michelle Kubas",
  CA: "Michelle Kubas", CO: "Michelle Kubas", HI: "Michelle Kubas",
  ID: "Michelle Kubas", KS: "Michelle Kubas", LA: "Michelle Kubas",
  MO: "Michelle Kubas", MT: "Michelle Kubas", ND: "Michelle Kubas",
  NV: "Michelle Kubas", NM: "Michelle Kubas", OR: "Michelle Kubas",
  SD: "Michelle Kubas", TX: "Michelle Kubas", UT: "Michelle Kubas",
  WA: "Michelle Kubas", WY: "Michelle Kubas",
  CT: "Graham Staley", DE: "Graham Staley", ME: "Graham Staley",
  MD: "Graham Staley", MA: "Graham Staley", NH: "Graham Staley",
  NJ: "Graham Staley", NY: "Graham Staley", PA: "Graham Staley",
  RI: "Graham Staley", VT: "Graham Staley", DC: "Graham Staley",
  ON: "Graham Staley", QC: "Graham Staley", NB: "Graham Staley",
  NS: "Graham Staley", PE: "Graham Staley", NL: "Graham Staley",
  IL: "Joshua Kolenda", IN: "Joshua Kolenda", IA: "Joshua Kolenda",
  MI: "Joshua Kolenda", MN: "Joshua Kolenda", NE: "Joshua Kolenda",
  OH: "Joshua Kolenda", WI: "Joshua Kolenda",
  BC: "Joshua Kolenda", AB: "Joshua Kolenda", SK: "Joshua Kolenda",
  MB: "Joshua Kolenda", YT: "Joshua Kolenda", NT: "Joshua Kolenda",
  NU: "Joshua Kolenda",
};

function resolveAeTerritory(hsAeTerritory: string | null, stateName: string | null): string {
  // 1. HubSpot ae_territory (owner ID) takes precedence
  if (hsAeTerritory) {
    const id = String(hsAeTerritory).trim();
    if (OWNER_ID_TO_AE[id]) return OWNER_ID_TO_AE[id];
    // Sometimes it's already a name
    if (id && !id.match(/^\d+$/)) return id;
  }
  // 2. State-based auto-assignment
  if (stateName) {
    const normalized = stateName.trim().toLowerCase();
    // Try direct 2-letter code first
    if (normalized.length === 2) {
      const ae = STATE_TO_AE[normalized.toUpperCase()];
      if (ae) return ae;
    }
    // Try full name → code → AE
    const code = STATE_NAME_TO_CODE[normalized];
    if (code) {
      const ae = STATE_TO_AE[code];
      if (ae) return ae;
    }
  }
  return "";
}

/* ── Types ────────────────────────────────────────────────── */

interface HubSpotCompanyEnrichment {
  company_id: string;
  domain: string;
  company_name: string;
  owner_name: string;
  lifecycle_stage: string;
  deal_id: string | null;
  deal_name: string | null;
  first_visit_ts: string | null;
  last_visit_ts: string | null;
  hs_pageviews: number | null;
  hs_visits: number | null;
  ae_territory_raw: string | null;
  annual_revenue_hs: string | null;
  state: string;
  industry: string;
  employees: string;
  country: string;
  // Source attribution
  hs_source: string;
  hs_source_detail: string;
  hs_latest_source: string;
  hs_latest_source_detail: string;
  first_touch_campaign: string | null;
  last_touch_campaign: string | null;
  hs_source_keyword: string;
}

interface HubSpotContactEnrichment {
  contact_id: string;
  email: string;
  first_name: string;
  last_name: string;
  title: string;
  company_domain: string;
  company_name: string;
  first_visit_ts: string | null;
  last_visit_ts: string | null;
  hs_pageviews: number | null;
  hs_visits: number | null;
  last_contacted: string | null;
  last_sales_activity: string | null;
  lifecycle_stage: string;
  owner_name: string;
  state: string;
  ae_territory_raw: string | null;
  // Source + page attribution
  first_url: string | null;
  last_url: string | null;
  first_referrer: string | null;
  last_referrer: string | null;
  hs_source: string;
  hs_source_detail: string;
  hs_latest_source: string;
  hs_latest_source_detail: string;
  // Contact's own source attribution (not company-level)
  contact_source: string;
  contact_source_detail: string;
  contact_source_keyword: string;
}

/* ── SQL ──────────────────────────────────────────────────── */

const COMPANY_ENRICHMENT_SQL = `
  WITH ranked_deals AS (
    SELECT
      ROUND(d.properties_hs_primary_associated_company)::bigint AS company_id,
      d.id::varchar AS deal_id,
      d.properties_dealname AS deal_name,
      ROW_NUMBER() OVER (
        PARTITION BY ROUND(d.properties_hs_primary_associated_company)
        ORDER BY d.updatedat DESC
      ) AS rn
    FROM hubspot_deals d
    WHERE d.properties_pipeline = 'default'
      AND d.properties_hs_is_closed = false
  )
  SELECT
    c.id::varchar AS company_id,
    LOWER(TRIM(c.properties_domain)) AS domain,
    c.properties_name AS company_name,
    TRIM(COALESCE(o.firstname, '') || ' ' || COALESCE(o.lastname, '')) AS owner_name,
    LOWER(TRIM(COALESCE(c.properties_lifecyclestage, ''))) AS lifecycle_stage,
    rd.deal_id,
    rd.deal_name,
    c.properties_hs_analytics_first_visit_timestamp AS first_visit_ts,
    c.properties_hs_analytics_last_visit_timestamp AS last_visit_ts,
    c.properties_hs_analytics_num_page_views AS hs_pageviews,
    c.properties_hs_analytics_num_visits AS hs_visits,
    c.properties_ae_territory AS ae_territory_raw,
    c.properties_annualrevenue AS annual_revenue_hs,
    c.properties_state AS state,
    c.properties_industry AS industry,
    c.properties_numberofemployees AS employees,
    c.properties_country AS country,
    c.properties_hs_analytics_source AS hs_source,
    c.properties_hs_analytics_source_data_1 AS hs_source_detail,
    c.properties_hs_analytics_latest_source AS hs_latest_source,
    c.properties_hs_analytics_latest_source_data_1 AS hs_latest_source_detail,
    c.properties_hs_analytics_first_touch_converting_campaign AS first_touch_campaign,
    c.properties_hs_analytics_last_touch_converting_campaign AS last_touch_campaign,
    c.properties_hs_analytics_source_data_2 AS hs_source_keyword
  FROM hubspot_companies c
  LEFT JOIN hubspot_owners o
    ON c.properties_hubspot_owner_id = o.id
  LEFT JOIN ranked_deals rd
    ON rd.company_id = c.id::bigint AND rd.rn = 1
  WHERE c.properties_domain IS NOT NULL
    AND TRIM(c.properties_domain) <> ''
`;

const CONTACT_ENRICHMENT_SQL = `
  SELECT
    ct.id::varchar AS contact_id,
    LOWER(TRIM(ct.properties_email)) AS email,
    ct.properties_firstname AS first_name,
    ct.properties_lastname AS last_name,
    ct.properties_jobtitle AS title,
    LOWER(TRIM(COALESCE(c.properties_domain, ''))) AS company_domain,
    c.properties_name AS company_name,
    ct.properties_hs_analytics_first_visit_timestamp AS first_visit_ts,
    ct.properties_hs_analytics_last_visit_timestamp AS last_visit_ts,
    ct.properties_hs_analytics_num_page_views AS hs_pageviews,
    ct.properties_hs_analytics_num_visits AS hs_visits,
    ct.properties_notes_last_contacted AS last_contacted,
    ct.properties_hs_last_sales_activity_timestamp AS last_sales_activity,
    LOWER(TRIM(COALESCE(c.properties_lifecyclestage, ''))) AS lifecycle_stage,
    TRIM(COALESCE(o.firstname, '') || ' ' || COALESCE(o.lastname, '')) AS owner_name,
    c.properties_state AS state,
    c.properties_ae_territory AS ae_territory_raw,
    ct.properties_hs_analytics_first_url AS first_url,
    ct.properties_hs_analytics_last_url AS last_url,
    ct.properties_hs_analytics_first_referrer AS first_referrer,
    ct.properties_hs_analytics_last_referrer AS last_referrer,
    c.properties_hs_analytics_source AS hs_source,
    c.properties_hs_analytics_source_data_1 AS hs_source_detail,
    c.properties_hs_analytics_latest_source AS hs_latest_source,
    c.properties_hs_analytics_latest_source_data_1 AS hs_latest_source_detail,
    ct.properties_hs_analytics_source AS contact_source,
    ct.properties_hs_analytics_source_data_1 AS contact_source_detail,
    ct.properties_hs_analytics_source_data_2 AS contact_source_keyword
  FROM hubspot_contacts ct
  LEFT JOIN hubspot_companies c
    ON ROUND(ct.properties_associatedcompanyid)::bigint = c.id::bigint
  LEFT JOIN hubspot_owners o
    ON ct.properties_hubspot_owner_id = o.id
  WHERE ct.properties_email IS NOT NULL
    AND TRIM(ct.properties_email) <> ''
`;

const LIFECYCLE_MAP: Record<string, string> = {
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

/* ── Source formatting ───────────────────────────────────── */

const SOURCE_LABELS: Record<string, string> = {
  ORGANIC_SEARCH: "Organic Search",
  PAID_SEARCH: "Paid Search",
  EMAIL_MARKETING: "Email Marketing",
  SOCIAL_MEDIA: "Social Media",
  DIRECT_TRAFFIC: "Direct Traffic",
  REFERRALS: "Referral",
  OTHER_CAMPAIGNS: "Other Campaign",
  OFFLINE: "Offline",
  PAID_SOCIAL: "Paid Social",
};

function formatSource(raw: string | null): string {
  if (!raw) return "";
  const upper = raw.trim().toUpperCase();
  return SOURCE_LABELS[upper] || raw.trim();
}

/* ── Page intelligence (cached PostHog data) ─────────────── */

interface PageIntelEntry {
  utm_keywords?: { term: string; source: string; medium: string; hits: number }[];
  utm_campaigns?: { source: string; medium: string; campaign: string; hits: number }[];
  referrers?: { domain: string; hits: number }[];
  avg_session_seconds?: number;
  total_entries?: number;
}

let pageIntel: Record<string, PageIntelEntry> = {};
try {
  const piPath = path.join(process.cwd(), "data", "page-intelligence.json");
  if (fs.existsSync(piPath)) {
    pageIntel = JSON.parse(fs.readFileSync(piPath, "utf-8"));
  }
} catch {
  // Page intelligence not available yet — will be built by scheduled task
}

/* ── GSC keyword cache (refreshed per cold start, ~5 min TTL) ── */

interface GscPageKeywords {
  queries: { query: string; clicks: number; impressions: number; position: number }[];
  total_clicks: number;
}

let gscPageCache: Map<string, GscPageKeywords> = new Map();
let gscCacheTime = 0;
const GSC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/* ── GSC daily cache (per page-date, for keyword attribution) ── */

interface GscDailyEntry {
  queries: { query: string; clicks: number; impressions: number; position: number }[];
  total_clicks: number;
}

// Keyed by "pagePath|YYYY-MM-DD"
let gscDailyCache: Map<string, GscDailyEntry> = new Map();
let gscDailyCacheTime = 0;

const BRANDED_PATTERNS = ["toolbx", "tool bx", "toolbx.com", "www.toolbx.com"];

function isBrandedQuery(query: string): boolean {
  const q = query.toLowerCase();
  return BRANDED_PATTERNS.some(p => q.includes(p));
}

interface KeywordResult {
  keywords: string;
  confidence: "exact" | "high" | "medium" | "low" | "inferred" | "";
  source: "google_ads" | "gsc_daily_dedup" | "gsc_page_aggregate" | "hubspot_utm" | "";
  branded: boolean;
  details: string;
}

async function refreshGscCache(): Promise<void> {
  if (Date.now() - gscCacheTime < GSC_CACHE_TTL && gscPageCache.size > 0) return;

  try {
    const { GoogleAuth } = await import("google-auth-library");
    const raw = process.env.GSC_SERVICE_ACCOUNT_KEY;
    if (!raw) return;

    let credentials: Record<string, string>;
    try {
      const decoded = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
      credentials = JSON.parse(decoded);
    } catch { return; }

    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 16); // Full 16-month GSC retention

    const resp = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent("https://www.toolbx.com/")}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          dimensions: ["query", "page"],
          rowLimit: 25000,
          dataState: "final",
        }),
      }
    );

    if (!resp.ok) return;

    const data = await resp.json();
    const rows: { keys: string[]; clicks: number; impressions: number; position: number }[] = data.rows || [];

    const newCache = new Map<string, GscPageKeywords>();
    for (const r of rows) {
      const query = r.keys[0] || "";
      const pageUrl = r.keys[1] || "";
      // Normalize page URL to path
      let pagePath: string;
      try {
        const u = new URL(pageUrl);
        pagePath = u.pathname.replace(/\/$/, "") || "/";
      } catch {
        pagePath = pageUrl;
      }

      if (!newCache.has(pagePath)) {
        newCache.set(pagePath, { queries: [], total_clicks: 0 });
      }
      const entry = newCache.get(pagePath)!;
      entry.queries.push({ query, clicks: r.clicks, impressions: r.impressions, position: r.position });
      entry.total_clicks += r.clicks;
    }

    // Sort queries by clicks desc within each page
    for (const entry of newCache.values()) {
      entry.queries.sort((a, b) => b.clicks - a.clicks);
    }

    gscPageCache = newCache;
    gscCacheTime = Date.now();
    console.log(`[visitor-data] GSC cache refreshed: ${newCache.size} pages, ${rows.length} query-page combos`);
  } catch (err) {
    console.error("[visitor-data] GSC cache refresh failed:", err);
  }
}

async function refreshGscDailyCache(): Promise<void> {
  if (Date.now() - gscDailyCacheTime < GSC_CACHE_TTL && gscDailyCache.size > 0) return;

  try {
    const { GoogleAuth } = await import("google-auth-library");
    const raw = process.env.GSC_SERVICE_ACCOUNT_KEY;
    if (!raw) return;

    let credentials: Record<string, string>;
    try {
      const decoded = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
      credentials = JSON.parse(decoded);
    } catch { return; }

    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 3); // GSC finalization lag

    const newCache = new Map<string, GscDailyEntry>();

    // Fetch in 4-month chunks to stay under 25k row limit
    for (let chunk = 0; chunk < 4; chunk++) {
      const chunkEnd = new Date(endDate);
      chunkEnd.setMonth(chunkEnd.getMonth() - chunk * 4);
      const chunkStart = new Date(chunkEnd);
      chunkStart.setMonth(chunkStart.getMonth() - 4);

      if (chunkStart > endDate) continue;

      const resp = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent("https://www.toolbx.com/")}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: chunkStart.toISOString().slice(0, 10),
            endDate: chunkEnd.toISOString().slice(0, 10),
            dimensions: ["query", "page", "date"],
            searchType: "web",
            rowLimit: 25000,
            dataState: "final",
          }),
        }
      );

      if (!resp.ok) continue;

      const data = await resp.json();
      const rows: { keys: string[]; clicks: number; impressions: number; position: number }[] = data.rows || [];

      for (const r of rows) {
        const query = r.keys[0] || "";
        const pageUrl = r.keys[1] || "";
        const date = r.keys[2] || "";

        let pagePath: string;
        try {
          const u = new URL(pageUrl);
          pagePath = u.pathname.replace(/\/$/, "") || "/";
        } catch {
          pagePath = pageUrl;
        }

        const key = `${pagePath}|${date}`;
        if (!newCache.has(key)) {
          newCache.set(key, { queries: [], total_clicks: 0 });
        }
        const entry = newCache.get(key)!;
        entry.queries.push({ query, clicks: r.clicks, impressions: r.impressions, position: r.position });
        entry.total_clicks += r.clicks;
      }
    }

    // Sort queries by clicks desc within each page-date
    for (const entry of newCache.values()) {
      entry.queries.sort((a, b) => b.clicks - a.clicks);
    }

    gscDailyCache = newCache;
    gscDailyCacheTime = Date.now();
    console.log(`[visitor-data] GSC daily cache refreshed: ${newCache.size} page-date combos`);
  } catch (err) {
    console.error("[visitor-data] GSC daily cache refresh failed:", err);
  }
}

function normalizePath(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

/** Legacy wrapper for backward compat — returns just the keyword string */
function resolvePageKeywordsLegacy(pageUrl: string | null): string {
  const result = resolvePageKeywordsV2(pageUrl);
  return result.keywords;
}

/**
 * Upgraded keyword resolution with date-aware GSC dedup and confidence scoring.
 *
 * @param pageUrl - Landing page URL
 * @param visitDate - ISO timestamp of the visit (for date-specific GSC lookup)
 * @param contactSource - HubSpot contact source (PAID_SEARCH, ORGANIC_SEARCH, etc.)
 * @param contactSourceKeyword - HubSpot source_data_2 (exact keyword for paid search)
 */
function resolvePageKeywordsV2(
  pageUrl: string | null,
  visitDate?: string | null,
  contactSource?: string | null,
  contactSourceKeyword?: string | null,
): KeywordResult {
  const empty: KeywordResult = { keywords: "", confidence: "", source: "", branded: false, details: "" };

  // Priority 0: Exact keyword from Google Ads (via HubSpot source_data_2)
  if (contactSource?.toUpperCase() === "PAID_SEARCH" && contactSourceKeyword && contactSourceKeyword.toUpperCase() !== "GOOGLE") {
    // Filter out date strings from MailerLite campaigns that misuse utm_term
    const isDate = /^\d{4}-\d{2}-\d{2}/.test(contactSourceKeyword);
    if (!isDate) {
      return {
        keywords: contactSourceKeyword,
        confidence: "exact",
        source: "google_ads",
        branded: isBrandedQuery(contactSourceKeyword),
        details: "Exact bid keyword from Google Ads (HubSpot source_data_2)",
      };
    }
  }

  if (!pageUrl) return empty;

  // Check if URL is on a non-GSC domain (go.toolbx.com, fr.toolbx.com)
  try {
    const u = new URL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`);
    const host = u.hostname.toLowerCase();
    if (host !== "www.toolbx.com" && host !== "toolbx.com") {
      return { ...empty, details: `No GSC data — landing page on ${host}` };
    }
  } catch { /* continue with normalization */ }

  const norm = normalizePath(pageUrl);

  // Priority 1: Date-specific GSC dedup (when we have the visit date)
  if (visitDate && contactSource?.toUpperCase() === "ORGANIC_SEARCH" && gscDailyCache.size > 0) {
    let visitDateStr: string;
    try {
      // Convert UTC timestamp to date string
      // Check both the exact date and ±1 day for timezone mismatch
      const dt = new Date(visitDate);
      visitDateStr = dt.toISOString().slice(0, 10);
    } catch {
      visitDateStr = "";
    }

    if (visitDateStr) {
      // Try exact date, then ±1 day
      const datesToCheck = [visitDateStr];
      const dtObj = new Date(visitDateStr);
      const prevDay = new Date(dtObj); prevDay.setDate(prevDay.getDate() - 1);
      const nextDay = new Date(dtObj); nextDay.setDate(nextDay.getDate() + 1);
      datesToCheck.push(prevDay.toISOString().slice(0, 10));
      datesToCheck.push(nextDay.toISOString().slice(0, 10));

      for (const checkDate of datesToCheck) {
        const key = `${norm}|${checkDate}`;
        const dailyEntry = gscDailyCache.get(key);
        if (dailyEntry?.queries?.length) {
          const topQuery = dailyEntry.queries[0];
          const totalQueries = dailyEntry.queries.length;
          const totalClicks = dailyEntry.total_clicks;

          // Confidence scoring
          let confidence: KeywordResult["confidence"];
          if (totalQueries === 1) {
            // Only one query drove clicks to this page on this date
            confidence = "high";
          } else if (topQuery.clicks > totalClicks * 0.6) {
            // Top query has >60% of clicks — dominant
            confidence = "medium";
          } else {
            confidence = "low";
          }

          const kws = dailyEntry.queries.slice(0, 3).map(q => q.query).join(", ");
          const dateLabel = checkDate === visitDateStr ? "exact date" : "±1 day";
          return {
            keywords: kws,
            confidence,
            source: "gsc_daily_dedup",
            branded: isBrandedQuery(topQuery.query),
            details: `${totalQueries} query${totalQueries > 1 ? "ies" : "y"}, ${totalClicks} click${totalClicks > 1 ? "s" : ""} on ${checkDate} (${dateLabel})`,
          };
        }
      }
    }
  }

  // Priority 2: Page-level aggregate from GSC (no date specificity)
  const gscEntry = gscPageCache.get(norm);
  if (gscEntry?.queries?.length) {
    const kws = gscEntry.queries.slice(0, 3).map(q => q.query).join(", ");
    return {
      keywords: kws,
      confidence: "inferred",
      source: "gsc_page_aggregate",
      branded: isBrandedQuery(gscEntry.queries[0].query),
      details: `Top queries for ${norm} (aggregate, not date-specific)`,
    };
  }

  // Priority 3: PostHog UTM keywords
  const piEntry = pageIntel[norm];
  if (piEntry?.utm_keywords?.length) {
    const kws = piEntry.utm_keywords.slice(0, 3).map(k => k.term).join(", ");
    return {
      keywords: kws,
      confidence: "inferred",
      source: "hubspot_utm",
      branded: isBrandedQuery(piEntry.utm_keywords[0].term),
      details: "From PostHog UTM keyword data (aggregate)",
    };
  }

  return empty;
}

/* ── Handler ──────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "companies";

  // 0. Refresh GSC keyword caches (non-blocking, cached for 5 min)
  await Promise.all([
    refreshGscCache().catch(() => {}),
    refreshGscDailyCache().catch(() => {}),
  ]);

  // 1. Load static Apollo/merged JSON
  const file = type === "people" ? "visitor-people.json" : "visitor-companies.json";
  const filePath = path.join(process.cwd(), "data", file);
  let staticData: Record<string, unknown>[];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    staticData = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Data file not found" }, { status: 404 });
  }

  // 2. Query Redshift for live HubSpot enrichment
  let companyMap = new Map<string, HubSpotCompanyEnrichment>();
  let contactMap = new Map<string, HubSpotContactEnrichment>();
  let enrichment_source = "static_only";
  let maxVisitDate = "";

  try {
    const pool = getPool();

    // Company enrichment (always needed)
    const { rows: companyRows } = await pool.query(COMPANY_ENRICHMENT_SQL);
    for (const r of companyRows) {
      const domain = (r.domain || "").trim();
      if (!domain || companyMap.has(domain)) continue;
      const rawLC = (r.lifecycle_stage || "").trim().toLowerCase();
      companyMap.set(domain, {
        company_id: r.company_id,
        domain,
        company_name: r.company_name || "",
        owner_name: (r.owner_name || "").trim(),
        lifecycle_stage: LIFECYCLE_MAP[rawLC] || rawLC || "",
        deal_id: r.deal_id || null,
        deal_name: r.deal_name || null,
        first_visit_ts: r.first_visit_ts || null,
        last_visit_ts: r.last_visit_ts || null,
        hs_pageviews: r.hs_pageviews ? Number(r.hs_pageviews) : null,
        hs_visits: r.hs_visits ? Number(r.hs_visits) : null,
        ae_territory_raw: r.ae_territory_raw || null,
        annual_revenue_hs: r.annual_revenue_hs || null,
        state: r.state || "",
        industry: r.industry || "",
        employees: r.employees ? String(r.employees) : "",
        country: r.country || "",
        hs_source: r.hs_source || "",
        hs_source_detail: r.hs_source_detail || "",
        hs_latest_source: r.hs_latest_source || "",
        hs_latest_source_detail: r.hs_latest_source_detail || "",
        first_touch_campaign: r.first_touch_campaign || null,
        last_touch_campaign: r.last_touch_campaign || null,
        hs_source_keyword: r.hs_source_keyword || "",
      });
      // Track max visit date for "last updated"
      if (r.last_visit_ts) {
        const ts = String(r.last_visit_ts);
        if (ts > maxVisitDate) maxVisitDate = ts;
      }
    }

    // Contact enrichment (for people tab — real timestamps per contact)
    if (type === "people") {
      const { rows: contactRows } = await pool.query(CONTACT_ENRICHMENT_SQL);
      for (const r of contactRows) {
        const email = (r.email || "").trim();
        if (!email || contactMap.has(email)) continue;
        contactMap.set(email, {
          contact_id: r.contact_id,
          email,
          first_name: r.first_name || "",
          last_name: r.last_name || "",
          title: r.title || "",
          company_domain: r.company_domain || "",
          company_name: r.company_name || "",
          first_visit_ts: r.first_visit_ts || null,
          last_visit_ts: r.last_visit_ts || null,
          hs_pageviews: r.hs_pageviews ? Number(r.hs_pageviews) : null,
          hs_visits: r.hs_visits ? Number(r.hs_visits) : null,
          last_contacted: r.last_contacted || null,
          last_sales_activity: r.last_sales_activity || null,
          lifecycle_stage: r.lifecycle_stage || "",
          owner_name: (r.owner_name || "").trim(),
          state: r.state || "",
          ae_territory_raw: r.ae_territory_raw || null,
          first_url: r.first_url || null,
          last_url: r.last_url || null,
          first_referrer: r.first_referrer || null,
          last_referrer: r.last_referrer || null,
          hs_source: r.hs_source || "",
          hs_source_detail: r.hs_source_detail || "",
          hs_latest_source: r.hs_latest_source || "",
          hs_latest_source_detail: r.hs_latest_source_detail || "",
          contact_source: r.contact_source || "",
          contact_source_detail: r.contact_source_detail || "",
          contact_source_keyword: r.contact_source_keyword || "",
        });
        if (r.last_visit_ts) {
          const ts = String(r.last_visit_ts);
          if (ts > maxVisitDate) maxVisitDate = ts;
        }
      }
    }

    enrichment_source = "redshift_live";
  } catch (err: unknown) {
    console.error("[visitor-data] Redshift enrichment failed, serving static:", err);
  }

  // 3. Merge
  const enriched = staticData.map((record) => {
    const rec = record as Record<string, unknown>;
    const domain = String(rec.domain || "").toLowerCase().trim();
    const hs = companyMap.get(domain);

    if (type === "companies") {
      if (!hs) {
        // Still compute ae_territory from state for non-HubSpot companies
        const stateVal = String(rec.state || "");
        const ae = resolveAeTerritory(null, stateVal);
        return { ...rec, ae_territory: ae };
      }

      const companyLink = `https://app.hubspot.com/contacts/${PORTAL}/record/0-2/${hs.company_id}`;
      const dealLink = hs.deal_id
        ? `https://app.hubspot.com/contacts/${PORTAL}/record/0-3/${hs.deal_id}`
        : "";

      // Resolve AE territory: HubSpot ae_territory (owner ID) > state rules
      const stateVal = String(rec.state || "");
      const ae = resolveAeTerritory(hs.ae_territory_raw, stateVal);

      // Revenue: prefer HubSpot, fall back to Apollo
      const revenue = hs.annual_revenue_hs || rec.annual_revenue || "";

      // Traffic source attribution
      const hsTrafficSource = formatSource(hs.hs_source);
      const hsLatestTrafficSource = formatSource(hs.hs_latest_source);

      return {
        ...rec,
        hs_company_link: companyLink,
        hs_owner: hs.owner_name,
        active_deal_name: hs.deal_name || "",
        active_deal_link: dealLink,
        ...(hs.lifecycle_stage ? { lifecycle_stage: hs.lifecycle_stage } : {}),
        // Real timestamps from HubSpot analytics
        ...(hs.first_visit_ts ? { hs_earliest_visit_ts: new Date(hs.first_visit_ts).toISOString() } : {}),
        ...(hs.last_visit_ts ? { hs_latest_visit_ts: new Date(hs.last_visit_ts).toISOString() } : {}),
        ...(hs.hs_pageviews != null ? { hs_tracked_pageviews: hs.hs_pageviews } : {}),
        ...(hs.hs_visits != null ? { hs_tracked_sessions: hs.hs_visits } : {}),
        ae_territory: ae,
        annual_revenue: revenue,
        // Source attribution
        hs_original_source: hsTrafficSource,
        hs_original_source_detail: hs.hs_source_detail || "",
        hs_latest_source: hsLatestTrafficSource,
        hs_latest_source_detail: hs.hs_latest_source_detail || "",
        first_touch_campaign: hs.first_touch_campaign || "",
        last_touch_campaign: hs.last_touch_campaign || "",
        // Company-level keyword attribution
        ...(() => {
          // For paid search companies with a keyword in source_data_2
          if (hs.hs_source?.toUpperCase() === "PAID_SEARCH" && hs.hs_source_keyword && hs.hs_source_keyword.toUpperCase() !== "GOOGLE") {
            const isDate = /^\d{4}-\d{2}-\d{2}/.test(hs.hs_source_keyword);
            if (!isDate) {
              return {
                search_keywords: hs.hs_source_keyword,
                keyword_confidence: "exact",
                keyword_source: "google_ads",
                keyword_branded: isBrandedQuery(hs.hs_source_keyword),
              };
            }
          }
          // Fallback to page-level inference from top Apollo pages
          const topPage = String(rec.top_pages || "").split(",")[0]?.trim();
          if (topPage) {
            const kwResult = resolvePageKeywordsV2(topPage);
            if (kwResult.keywords) {
              return {
                search_keywords: kwResult.keywords,
                keyword_confidence: kwResult.confidence,
                keyword_source: kwResult.source,
                keyword_branded: kwResult.branded,
              };
            }
          }
          return {};
        })(),
      };
    } else {
      // People tab: enrich from both company and contact data
      const email = String(rec.email || "").toLowerCase().trim();
      const contact = contactMap.get(email);

      const enrichments: Record<string, unknown> = {};

      // Company-level enrichments
      if (hs) {
        enrichments.hs_company_link = `https://app.hubspot.com/contacts/${PORTAL}/record/0-2/${hs.company_id}`;
        enrichments.hs_owner = hs.owner_name;
        enrichments.active_deal_name = hs.deal_name || "";
        enrichments.active_deal_link = hs.deal_id
          ? `https://app.hubspot.com/contacts/${PORTAL}/record/0-3/${hs.deal_id}`
          : "";
        if (hs.lifecycle_stage) enrichments.lifecycle_stage = hs.lifecycle_stage;

        // AE territory from company
        const stateVal = String(rec.state || rec.ip_state || "");
        enrichments.ae_territory = resolveAeTerritory(hs.ae_territory_raw, stateVal);

        // Revenue from company
        enrichments.annual_revenue = hs.annual_revenue_hs || rec.annual_revenue || "";
      } else {
        // State-based territory for non-HubSpot
        const stateVal = String(rec.state || rec.ip_state || "");
        enrichments.ae_territory = resolveAeTerritory(null, stateVal);
      }

      // Contact-level enrichments (real timestamps!)
      if (contact) {
        if (contact.first_visit_ts) enrichments.hs_first_visit_ts = new Date(contact.first_visit_ts).toISOString();
        if (contact.last_visit_ts) enrichments.hs_last_visit_ts = new Date(contact.last_visit_ts).toISOString();
        if (contact.hs_pageviews != null) enrichments.hs_pageviews = contact.hs_pageviews;
        if (contact.hs_visits != null) enrichments.hs_sessions = contact.hs_visits;
        if (!rec.hs_contact_link) {
          enrichments.hs_contact_link = `https://app.hubspot.com/contacts/${PORTAL}/record/0-1/${contact.contact_id}`;
        }
        // Page + source attribution from contact
        enrichments.hs_first_page = contact.first_url || "";
        enrichments.hs_last_page = contact.last_url || "";
        enrichments.hs_first_referrer = contact.first_referrer || "";
        enrichments.hs_last_referrer = contact.last_referrer || "";
        // Use contact's OWN source (not company-level) when available
        const contactSrc = contact.contact_source || contact.hs_source || "";
        const contactSrcDetail = contact.contact_source_detail || contact.hs_source_detail || "";
        enrichments.hs_original_source = formatSource(contactSrc);
        enrichments.hs_original_source_detail = contactSrcDetail;
        enrichments.hs_latest_source = formatSource(contact.hs_latest_source);
        enrichments.hs_latest_source_detail = contact.hs_latest_source_detail || "";
        // Keyword attribution with confidence scoring
        const kwResult = resolvePageKeywordsV2(
          contact.first_url,
          contact.first_visit_ts,
          contact.contact_source || contact.hs_source,
          contact.contact_source_keyword,
        );
        if (!kwResult.keywords && contact.last_url) {
          // Fallback: try last URL if first URL had no keywords
          const fallback = resolvePageKeywordsV2(contact.last_url);
          enrichments.search_keywords = fallback.keywords;
          enrichments.keyword_confidence = fallback.confidence;
          enrichments.keyword_source = fallback.source;
          enrichments.keyword_branded = fallback.branded;
        } else {
          enrichments.search_keywords = kwResult.keywords;
          enrichments.keyword_confidence = kwResult.confidence;
          enrichments.keyword_source = kwResult.source;
          enrichments.keyword_branded = kwResult.branded;
        }
      }

      return { ...rec, ...enrichments };
    }
  });

  // 4. Gap-fill: add HubSpot companies/contacts with website visits NOT in Apollo JSON
  if (enrichment_source === "redshift_live") {
    const existingDomains = new Set(enriched.map((r) => String((r as Record<string, unknown>).domain || "").toLowerCase().trim()));
    const existingEmails = new Set(enriched.map((r) => String((r as Record<string, unknown>).email || "").toLowerCase().trim()));

    if (type === "companies") {
      for (const [domain, hs] of companyMap) {
        if (existingDomains.has(domain)) continue;
        if (!hs.last_visit_ts) continue; // only add companies with tracked website visits
        const ae = resolveAeTerritory(hs.ae_territory_raw, hs.state);
        enriched.push({
          company_name: hs.company_name,
          domain,
          industry: hs.industry,
          annual_revenue: hs.annual_revenue_hs || "",
          employees: hs.employees,
          locations: "",
          country: hs.country,
          state: hs.state,
          apollo_visits: 0,
          apollo_visitors: 0,
          apollo_last_visit: "",
          apollo_last_visit_ts: "",
          apollo_first_visit: "",
          intent_score: "",
          interest_level: "",
          top_pages: "",
          ...(() => {
            if (hs.hs_source?.toUpperCase() === "PAID_SEARCH" && hs.hs_source_keyword && hs.hs_source_keyword.toUpperCase() !== "GOOGLE" && !/^\d{4}-\d{2}-\d{2}/.test(hs.hs_source_keyword)) {
              return { search_keywords: hs.hs_source_keyword, keyword_confidence: "exact", keyword_source: "google_ads", keyword_branded: isBrandedQuery(hs.hs_source_keyword) };
            }
            return { search_keywords: "", keyword_confidence: "", keyword_source: "", keyword_branded: false };
          })(),
          data_sources: "hubspot",
          hs_company_link: `https://app.hubspot.com/contacts/${PORTAL}/record/0-2/${hs.company_id}`,
          hs_owner: hs.owner_name,
          active_deal_name: hs.deal_name || "",
          active_deal_link: hs.deal_id ? `https://app.hubspot.com/contacts/${PORTAL}/record/0-3/${hs.deal_id}` : "",
          lifecycle_stage: LIFECYCLE_MAP[hs.lifecycle_stage] || hs.lifecycle_stage || "",
          hs_earliest_visit_ts: new Date(hs.first_visit_ts!).toISOString(),
          hs_latest_visit_ts: new Date(hs.last_visit_ts).toISOString(),
          hs_tracked_pageviews: hs.hs_pageviews || 0,
          hs_tracked_sessions: hs.hs_visits || 0,
          ae_territory: ae,
          effective_last_visit: new Date(hs.last_visit_ts).toISOString(),
          hs_original_source: formatSource(hs.hs_source),
          hs_original_source_detail: hs.hs_source_detail || "",
          hs_latest_source: formatSource(hs.hs_latest_source),
          hs_latest_source_detail: hs.hs_latest_source_detail || "",
          first_touch_campaign: hs.first_touch_campaign || "",
          last_touch_campaign: hs.last_touch_campaign || "",
        } as unknown as Record<string, unknown>);
      }
    } else {
      for (const [email, ct] of contactMap) {
        if (existingEmails.has(email)) continue;
        if (!ct.last_visit_ts) continue; // only add contacts with tracked website visits
        const ae = resolveAeTerritory(ct.ae_territory_raw, ct.state);
        const fullName = [ct.first_name, ct.last_name].filter(Boolean).join(" ");
        enriched.push({
          name: fullName,
          email,
          title: ct.title,
          company_name: ct.company_name,
          domain: ct.company_domain,
          hs_owner: ct.owner_name,
          active_deal_name: "",
          active_deal_link: "",
          lifecycle_stage: LIFECYCLE_MAP[ct.lifecycle_stage] || ct.lifecycle_stage || "",
          hs_contact_link: `https://app.hubspot.com/contacts/${PORTAL}/record/0-1/${ct.contact_id}`,
          hs_first_visit_ts: new Date(ct.first_visit_ts!).toISOString(),
          hs_last_visit_ts: new Date(ct.last_visit_ts).toISOString(),
          hs_pageviews: ct.hs_pageviews || 0,
          hs_sessions: ct.hs_visits || 0,
          ae_territory: ae,
          state: ct.state,
          data_sources: "hubspot",
          effective_last_visit: new Date(ct.last_visit_ts).toISOString(),
          hs_first_page: ct.first_url || "",
          hs_last_page: ct.last_url || "",
          hs_first_referrer: ct.first_referrer || "",
          hs_last_referrer: ct.last_referrer || "",
          hs_original_source: formatSource(ct.contact_source || ct.hs_source),
          hs_original_source_detail: ct.contact_source_detail || ct.hs_source_detail || "",
          hs_latest_source: formatSource(ct.hs_latest_source),
          hs_latest_source_detail: ct.hs_latest_source_detail || "",
          ...(() => {
            const kwResult = resolvePageKeywordsV2(
              ct.first_url,
              ct.first_visit_ts,
              ct.contact_source || ct.hs_source,
              ct.contact_source_keyword,
            );
            const final = kwResult.keywords ? kwResult : (ct.last_url ? resolvePageKeywordsV2(ct.last_url) : kwResult);
            return {
              search_keywords: final.keywords,
              keyword_confidence: final.confidence,
              keyword_source: final.source,
              keyword_branded: final.branded,
            };
          })(),
        } as unknown as Record<string, unknown>);
      }
    }
  }

  // 5. Traffic quality classification + session engagement
  const NOISE_REFERRERS = new Set(["localhost", "localhost:3000", "localhost:8000", "staging-web.toolbxops.net"]);
  const EXISTING_USER_REFERRERS = new Set(["toolbxapp.com"]);

  for (const row of enriched) {
    const r = row as Record<string, unknown>;
    const domain = String(r.domain || "").toLowerCase();
    const referrer = String(r.hs_first_referrer || r.referrer_domain || "").toLowerCase();
    const pageviews = Number(r.hs_tracked_pageviews || r.hs_pageviews || r.apollo_visits || 0);
    const sessions = Number(r.hs_tracked_sessions || r.hs_sessions || 0);
    const avgTime = Number(r.avg_session_seconds || 0);

    // Traffic quality flag
    if (NOISE_REFERRERS.has(referrer) || NOISE_REFERRERS.has(domain)) {
      r.traffic_quality = "Noise";
    } else if (EXISTING_USER_REFERRERS.has(referrer) || EXISTING_USER_REFERRERS.has(domain)) {
      r.traffic_quality = "Existing User";
    } else if (pageviews === 0 && sessions <= 1 && avgTime < 1) {
      r.traffic_quality = "Suspect";
    } else {
      r.traffic_quality = "Valid";
    }

    // Session engagement signal
    if (avgTime > 300 || pageviews >= 5) {
      r.engagement_level = "Deep";
    } else if (avgTime > 30 || pageviews >= 2) {
      r.engagement_level = "Casual";
    } else if (pageviews >= 1) {
      r.engagement_level = "Bounce";
    } else {
      r.engagement_level = "";
    }
  }

  // "updated_at" = when this data was fetched (live query time)
  const updatedAt = enrichment_source === "redshift_live"
    ? new Date().toISOString()
    : maxVisitDate
      ? new Date(maxVisitDate).toISOString()
      : "";

  return NextResponse.json(
    {
      data: enriched,
      count: enriched.length,
      updated_at: updatedAt,
      enrichment_source,
      hubspot_company_matches: companyMap.size,
      hubspot_contact_matches: contactMap.size,
      static_count: staticData.length,
      hubspot_gap_fill: enriched.length - staticData.length,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
