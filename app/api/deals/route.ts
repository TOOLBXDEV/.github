import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/redshift";
import { resolveSurcharge, type SurchargeInfo } from "@/lib/surcharge";
import { LEAD_COMPANY_LIFECYCLE_SQL } from "@/lib/map-stages";
import type { Deal, DealLine, Branch } from "@/lib/types";
import branchData from "@/data/branch-locations.json";
import companyLocData from "@/data/company-locations.json";

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

function empRange(n: number): string {
  if (!n) return "";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 500) return "201-500";
  if (n <= 1000) return "501-1000";
  return "1000+";
}

function revRange(n: number): string {
  if (!n) return "";
  if (n < 1_000_000) return "Under $1M";
  if (n < 5_000_000) return "$1M - $5M";
  if (n < 10_000_000) return "$5M - $10M";
  if (n < 50_000_000) return "$10M - $50M";
  if (n < 100_000_000) return "$50M - $100M";
  return "$100M+";
}

function amtRange(n: number): string {
  if (!n) return "";
  if (n < 10_000) return "Under $10K";
  if (n < 25_000) return "$10K - $25K";
  if (n < 50_000) return "$25K - $50K";
  if (n < 100_000) return "$50K - $100K";
  return "$100K+";
}

function arrRange(n: number): string {
  if (!n) return "";
  if (n < 10_000) return "Under $10K";
  if (n < 25_000) return "$10K - $25K";
  if (n < 50_000) return "$25K - $50K";
  if (n < 100_000) return "$50K - $100K";
  return "$100K+";
}

function locRange(n: number): string {
  if (!n) return "";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 10) return "6-10";
  if (n <= 25) return "11-25";
  if (n <= 50) return "26-50";
  return "50+";
}

function toISO(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const STATE_NORM: Record<string, string> = {
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
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon",
};

const STATE_TYPOS: Record<string, string> = {
  "Road Island": "Rhode Island",
  "New Brunswick/Nouveau-Brunswick": "New Brunswick",
};

function normalizeState(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (STATE_TYPOS[trimmed]) return STATE_TYPOS[trimmed];
  if (STATE_NORM[trimmed.toUpperCase()]) return STATE_NORM[trimmed.toUpperCase()];
  return trimmed;
}

const BUYING_GROUP_FALLBACK: Record<string, string> = {
  "0011N00001n4p8wQAA": "Home Hardware",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

function applySurchargeToDeal(
  deal: Deal,
  info: SurchargeInfo,
): void {
  deal.surcharge_orders = info.orders_enabled;
  deal.surcharge_payments = info.payments_enabled;
  deal.surcharge_orders_rate_pct = info.orders_rate_pct;
  deal.surcharge_payments_rate_pct = info.payments_rate_pct;
  deal.surcharge_source = info.source;
}

const COMPANY_ONLY_SELECT = `
        c.id::varchar as hs_company_id,
        c.properties_name,
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
        c.properties_orders_surcharge_enabled as hs_orders_surcharge,
        c.properties_payments_surcharge_enabled as hs_payments_surcharge,
        ec.credit_card_surcharge_config,
        c.createdat,
        c.updatedat,
        o.firstname || ' ' || o.lastname as owner`;

const COMPANY_ONLY_FROM = `
      FROM hubspot_companies c
      LEFT JOIN hubspot_owners o ON c.properties_hubspot_owner_id = o.id
      LEFT JOIN bi_ecommerce_config ec ON LOWER(TRIM(ec.display_name)) = LOWER(TRIM(c.properties_name))
      LEFT JOIN hubspot_companies bg ON c.properties_buying_group IS NOT NULL
        AND c.properties_buying_group != ''
        AND bg.properties_salesforceaccountid = c.properties_buying_group
      WHERE TRIM(COALESCE(c.properties_name, '')) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM hubspot_deals d
          WHERE ROUND(d.properties_hs_primary_associated_company) = c.id::numeric
            AND (
              d.properties_hs_is_closed_won = true
              OR (d.properties_pipeline = 'default' AND d.properties_hs_is_closed = false)
            )
        )`;

const LEAD_COMPANY_SQL = `
      SELECT ${COMPANY_ONLY_SELECT}
      ${COMPANY_ONLY_FROM}
      ${LEAD_COMPANY_LIFECYCLE_SQL}`;

function mergeCompanyOnlyRows(
  companyRows: Record<string, unknown>[],
  dealBackedKeys: Set<string>,
  branchMap: Map<string, Branch[]>,
  geoMap: Map<string, { lat: number; lng: number; type?: string }>,
): Deal[] {
  const out: Deal[] = [];
  for (const r of companyRows) {
    const company = String(r.properties_name || "").trim();
    const key = company.toLowerCase();
    if (!company || dealBackedKeys.has(key)) continue;
    dealBackedKeys.add(key);

    const lat = r.properties_hs_latitude
      ? parseFloat(String(r.properties_hs_latitude))
      : null;
    const lng = r.properties_hs_longitude
      ? parseFloat(String(r.properties_hs_longitude))
      : null;

    const rawLC = String(r.properties_lifecyclestage || "").trim().toLowerCase();
    const lcStage = LIFECYCLE_MAP[rawLC] || (rawLC ? rawLC : "Unknown");
    const isChurned = rawLC === "1020959500";
    const stage = isChurned ? "Churned" : lcStage;
    const status: "Customer" | "Prospect" =
      rawLC === "customer" ? "Customer" : "Prospect";

    const employees = Number(r.properties_numberofemployees) || 0;
    const revenue = Number(r.properties_annualrevenue) || 0;
    const industry = String(r.properties_industry || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    const bgSfid = String(r.properties_buying_group || "").trim();
    const buyingGroup =
      String(r.buying_group_name || "") || BUYING_GROUP_FALLBACK[bgSfid] || "";

    const created = toISO(r.createdat);
    const companyKey = company.toLowerCase().trim();
    const branches = branchMap.get(companyKey) || [];
    const geo = geoMap.get(companyKey);

    const coDeal: Deal = {
      name: "",
      company,
      status,
      stage,
      amount: 0,
      erp: "",
      owner: String(r.owner || "").trim(),
      created,
      won_date: "",
      product: "",
      city: String(r.properties_city || ""),
      state: normalizeState(String(r.properties_state || "")),
      country: String(r.properties_country || ""),
      zip: String(r.properties_zip || ""),
      lat: geo?.lat ?? lat,
      lng: geo?.lng ?? lng,
      industry,
      employees,
      revenue,
      domain: String(r.properties_domain || ""),
      phone: String(r.properties_phone || ""),
      address: String(r.properties_address || ""),
      website: String(r.properties_website || ""),
      emp_range: empRange(employees),
      rev_range: revRange(revenue),
      amt_range: "",
      cum_amt_range: "",
      deal_breakdown: [],
      buying_group: buyingGroup,
      territory: String(r.properties_territory || "").trim(),
      branches,
      arr: Number(r.properties_arr) || 0,
      arr_range: arrRange(Number(r.properties_arr) || 0),
      num_locations: Number(r.properties_of_locations__c) || 0,
      loc_range: locRange(Number(r.properties_of_locations__c) || 0),
      open_pipeline_value: 0,
      updated_at: toISO(r.updatedat),
      hubspot_company_id: String(r.hs_company_id || ""),
      record_source: "company",
    };
    applySurchargeToDeal(
      coDeal,
      resolveSurcharge(
        r.credit_card_surcharge_config,
        r.hs_orders_surcharge,
        r.hs_payments_surcharge,
      ),
    );
    out.push(coDeal);
  }
  return out;
}

const DEALS_FROM_JOINS = `
      FROM hubspot_deals d
      LEFT JOIN hubspot_owners o ON d.properties_hubspot_owner_id = o.id
      LEFT JOIN hubspot_companies c ON ROUND(d.properties_hs_primary_associated_company) = c.id::numeric
      LEFT JOIN hubspot_companies bg ON c.properties_buying_group IS NOT NULL
        AND c.properties_buying_group != ''
        AND bg.properties_salesforceaccountid = c.properties_buying_group`;

const DEALS_WHERE_ORDER = `
      WHERE (
          d.properties_hs_is_closed_won = true
          OR (d.properties_pipeline = 'default' AND d.properties_hs_is_closed = false)
        )
      ORDER BY d.properties_hs_is_closed_won DESC, d.updatedat DESC`;

const DEALS_SELECT_CORE = `
        d.properties_dealname,
        d.properties_company_name,
        d.properties_dealstage,
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
        d.updatedat as deal_updated_at`;

const DEALS_SQL_FULL = `
      SELECT ${DEALS_SELECT_CORE},
        c.properties_orders_surcharge_enabled as hs_orders_surcharge,
        c.properties_payments_surcharge_enabled as hs_payments_surcharge,
        ec.credit_card_surcharge_config
      ${DEALS_FROM_JOINS}
      LEFT JOIN bi_ecommerce_config ec ON LOWER(TRIM(ec.display_name)) = LOWER(TRIM(COALESCE(c.properties_name, d.properties_company_name)))
      ${DEALS_WHERE_ORDER}`;

const DEALS_SQL_LEGACY = `
      SELECT ${DEALS_SELECT_CORE}
      ${DEALS_FROM_JOINS}
      ${DEALS_WHERE_ORDER}`;

async function queryDealRows(pool: ReturnType<typeof getPool>) {
  const attempts = [
    { sql: DEALS_SQL_FULL, mode: "full" },
    { sql: DEALS_SQL_LEGACY, mode: "legacy" },
  ];
  let lastErr: unknown;
  for (const { sql, mode } of attempts) {
    try {
      const { rows } = await pool.query(sql);
      return { rows, query_mode: mode };
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/does not exist/i.test(msg)) throw err;
      console.warn(`[deals] query mode "${mode}" failed, trying fallback:`, msg);
    }
  }
  throw lastErr;
}

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    const includeCompanyOnly =
      process.env.INCLUDE_COMPANY_ONLY_RECORDS === "true" ||
      request.nextUrl.searchParams.get("includeCompanies") === "1";
    const includeLeadCompanies =
      process.env.INCLUDE_LEAD_COMPANIES !== "false" &&
      request.nextUrl.searchParams.get("includeLeads") !== "0";

    const [{ rows, query_mode }, leadQueryResult] = await Promise.all([
      queryDealRows(pool),
      includeLeadCompanies
        ? pool.query(LEAD_COMPANY_SQL)
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    ]);

    interface CompanyAgg {
      deal: Deal;
      products: Set<string>;
      erps: Set<string>;
      dealLines: DealLine[];
      totalAmount: number;
      openPipelineValue: number;
      earliestCreated: string;
      earliestWon: string;
      hasWon: boolean;
      latestUpdated: string;
    }

    const companyMap = new Map<string, CompanyAgg>();

    for (const r of rows) {
      const lat = r.properties_hs_latitude
        ? parseFloat(r.properties_hs_latitude)
        : null;
      const lng = r.properties_hs_longitude
        ? parseFloat(r.properties_hs_longitude)
        : null;

      const isWon = r.properties_hs_is_closed_won === true;
      const rawLC = (r.properties_lifecyclestage || "").trim().toLowerCase();
      const lcStage = LIFECYCLE_MAP[rawLC] || (rawLC ? rawLC : "Unknown");
      const isChurned = rawLC === "1020959500";
      const stage = isChurned ? "Churned" : lcStage;
      const status: "Customer" | "Prospect" = rawLC === "customer" ? "Customer" : "Prospect";

      const employees = Number(r.properties_numberofemployees) || 0;
      const revenue = Number(r.properties_annualrevenue) || 0;
      const amount = Number(r.amount) || 0;
      const industry = (r.properties_industry || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      const product = r.properties_product || "";
      const erp = r.properties_erp_pos || "";
      const created = toISO(r.createdat);
      const wonDate = toISO(r.properties_hs_closed_won_date);

      const bgSfid = (r.properties_buying_group || "").trim();
      const buyingGroup = r.buying_group_name
        || BUYING_GROUP_FALLBACK[bgSfid]
        || "";

      const company = r.properties_company_name || r.properties_dealname || "";
      const key = company.toLowerCase().trim();
      const existing = companyMap.get(key);

      const isOpenSalesDeal = r.properties_pipeline === "default" && r.properties_hs_is_closed !== true;
      const arrWEst = Number(r.arr_w_est) || 0;
      const openAmt = isOpenSalesDeal ? arrWEst : 0;

      const line: DealLine = { product: product || r.properties_dealname || "Deal", amount };
      const surcharge = resolveSurcharge(
        r.credit_card_surcharge_config,
        r.hs_orders_surcharge,
        r.hs_payments_surcharge,
      );

      if (!existing) {
        const dealRow: Deal = {
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
            lat,
            lng,
            industry,
            employees,
            revenue,
            domain: r.properties_domain || "",
            phone: r.properties_phone || "",
            address: r.properties_address || "",
            website: r.properties_website || "",
            emp_range: empRange(employees),
            rev_range: revRange(revenue),
            amt_range: amtRange(amount),
            cum_amt_range: "",
            deal_breakdown: [],
            buying_group: buyingGroup,
            territory: (r.properties_territory || "").trim(),
            branches: [],
            arr: Number(r.properties_arr) || 0,
            arr_range: arrRange(Number(r.properties_arr) || 0),
            num_locations: Number(r.properties_of_locations__c) || 0,
            loc_range: locRange(Number(r.properties_of_locations__c) || 0),
            open_pipeline_value: openAmt,
            updated_at: toISO(r.deal_updated_at),
          };
        applySurchargeToDeal(dealRow, surcharge);
        companyMap.set(key, {
          deal: dealRow,
          products: new Set(product ? [product] : []),
          erps: new Set(erp ? [erp] : []),
          dealLines: [line],
          totalAmount: amount,
          openPipelineValue: openAmt,
          earliestCreated: created,
          earliestWon: wonDate,
          hasWon: isWon,
          latestUpdated: toISO(r.deal_updated_at),
        });
      } else {
        if (product) existing.products.add(product);
        if (erp) existing.erps.add(erp);
        existing.dealLines.push(line);
        existing.totalAmount += amount;
        existing.openPipelineValue += openAmt;
        if (isWon) existing.hasWon = true;
        if (created && (!existing.earliestCreated || created < existing.earliestCreated))
          existing.earliestCreated = created;
        if (wonDate && (!existing.earliestWon || wonDate < existing.earliestWon))
          existing.earliestWon = wonDate;
        const upd = toISO(r.deal_updated_at);
        if (upd && (!existing.latestUpdated || upd > existing.latestUpdated))
          existing.latestUpdated = upd;
      }
    }

    const branchMap = new Map<string, Branch[]>();
    for (const b of (branchData as { branches: Array<{ company_name: string; branch_name: string; lat: number; lng: number }> }).branches) {
      const key = b.company_name.toLowerCase().trim();
      if (!branchMap.has(key)) branchMap.set(key, []);
      branchMap.get(key)!.push({ branch_name: b.branch_name, lat: b.lat, lng: b.lng });
    }

    // Address-geocoded coordinates override HubSpot's auto-enriched lat/lng
    const geoMap = new Map<string, { lat: number; lng: number; type?: string }>();
    for (const c of (companyLocData as { companies: Array<{ company_name: string; lat: number; lng: number; type?: string }> }).companies) {
      geoMap.set(c.company_name.toLowerCase().trim(), { lat: c.lat, lng: c.lng, type: c.type });
    }

    const deals: Deal[] = Array.from(companyMap.values()).map((agg) => {
      const maxSingleDeal = Math.max(...agg.dealLines.map((l) => l.amount), 0);
      const companyKey = (agg.deal.company || "").toLowerCase().trim();
      const branches = branchMap.get(companyKey) || [];
      const geo = geoMap.get(companyKey);
      return {
        ...agg.deal,
        lat: geo?.lat ?? agg.deal.lat,
        lng: geo?.lng ?? agg.deal.lng,
        stage: agg.deal.stage,
        status: agg.deal.status,
        product: Array.from(agg.products).sort().join(", "),
        erp: Array.from(agg.erps).sort().join(", "),
        amount: agg.totalAmount,
        amt_range: amtRange(maxSingleDeal),
        cum_amt_range: amtRange(agg.totalAmount),
        deal_breakdown: agg.dealLines,
        created: agg.earliestCreated,
        won_date: agg.earliestWon,
        branches,
        open_pipeline_value: agg.openPipelineValue,
        updated_at: agg.latestUpdated,
      };
    });

    const dealBackedKeys = new Set(
      Array.from(companyMap.keys()).map((k) => k.toLowerCase().trim()),
    );

    const companyOnlyDeals: Deal[] = [];
    const build =
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";

    if (includeLeadCompanies && leadQueryResult.rows.length > 0) {
      companyOnlyDeals.push(
        ...mergeCompanyOnlyRows(
          leadQueryResult.rows as Record<string, unknown>[],
          dealBackedKeys,
          branchMap,
          geoMap,
        ),
      );
    }

    if (includeCompanyOnly) {
      const { rows: companyRows } = await pool.query(`
      SELECT ${COMPANY_ONLY_SELECT}
      ${COMPANY_ONLY_FROM}
        AND COALESCE(LOWER(TRIM(c.properties_lifecyclestage)), '') <> 'customer'
        AND COALESCE(TRIM(c.properties_lifecyclestage), '') <> '1020959500'
        AND (
          c.properties_lifecyclestage IS NULL
          OR TRIM(c.properties_lifecyclestage) = ''
          OR LOWER(TRIM(c.properties_lifecyclestage)) IN (
            'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity',
            'subscriber', 'evangelist', 'other'
          )
          OR TRIM(c.properties_lifecyclestage) IN ('1050035316', '1050035315', '1324949332')
        )
    `);
      companyOnlyDeals.push(
        ...mergeCompanyOnlyRows(
          companyRows as Record<string, unknown>[],
          dealBackedKeys,
          branchMap,
          geoMap,
        ),
      );
    }

    companyOnlyDeals.sort((a, b) => a.company.localeCompare(b.company));

    return NextResponse.json({
      deals: [...deals, ...companyOnlyDeals],
      updated_at: new Date().toISOString(),
      build,
      query_mode,
      include_leads: includeLeadCompanies,
      lead_company_count: includeLeadCompanies ? leadQueryResult.rows.length : 0,
    });
  } catch (err: any) {
    console.error("Redshift query failed:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch data",
        detail: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
