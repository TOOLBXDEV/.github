import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ── Config ───────────────────────────────────────────────── */
const SITE_URL = "https://www.toolbx.com/";
const GSC_API = "https://www.googleapis.com/webmasters/v3";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/* ── Auth helper ──────────────────────────────────────────── */
function getAuth(): GoogleAuth {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GSC_SERVICE_ACCOUNT_KEY env var not set");

  let credentials: Record<string, string>;
  try {
    // Accept base64-encoded or raw JSON
    const decoded = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    credentials = JSON.parse(decoded);
  } catch {
    throw new Error("GSC_SERVICE_ACCOUNT_KEY is not valid JSON or base64");
  }

  return new GoogleAuth({
    credentials,
    scopes: [SCOPE],
  });
}

/* ── Types ────────────────────────────────────────────────── */
interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscResponse {
  rows?: GscRow[];
  responseAggregationType?: string;
}

export interface GscKeyword {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageSummary {
  page: string;
  total_clicks: number;
  total_impressions: number;
  avg_position: number;
  avg_ctr: number;
  top_queries: { query: string; clicks: number; impressions: number; position: number }[];
}

/* ── Fetch GSC data ───────────────────────────────────────── */
async function fetchGscData(
  auth: GoogleAuth,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit = 1000
): Promise<GscRow[]> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const body = {
    startDate,
    endDate,
    dimensions,
    rowLimit,
    dataState: "final",
  };

  const resp = await fetch(
    `${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GSC API ${resp.status}: ${errText}`);
  }

  const data: GscResponse = await resp.json();
  return data.rows || [];
}

/* ── GET handler ──────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const auth = getAuth();
    const params = req.nextUrl.searchParams;

    // Date range: default full 16-month GSC retention window
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() - 3); // GSC data lags ~3 days
    const defaultStart = new Date(defaultEnd);
    defaultStart.setMonth(defaultStart.getMonth() - 16); // Full 16-month retention

    const endDate = params.get("endDate") || defaultEnd.toISOString().slice(0, 10);
    const start = params.get("startDate") || defaultStart.toISOString().slice(0, 10);

    // View mode: "queries" (top queries), "pages" (page-level), "query-page" (both dimensions)
    const view = params.get("view") || "query-page";

    let dimensions: string[];
    switch (view) {
      case "queries":
        dimensions = ["query"];
        break;
      case "pages":
        dimensions = ["page"];
        break;
      case "query-page":
      default:
        dimensions = ["query", "page"];
        break;
    }

    const rows = await fetchGscData(auth, start, endDate, dimensions, 25000);

    // Transform into typed output
    if (view === "query-page" || view === "queries") {
      const keywords: GscKeyword[] = rows.map((r) => ({
        query: r.keys[0] || "",
        page: r.keys[1] || "",
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100, // percent with 2 decimals
        position: Math.round(r.position * 10) / 10,
      }));

      // Also build page-level summaries for the "query-page" view
      if (view === "query-page") {
        const pageMap = new Map<string, { clicks: number; impressions: number; positions: number[]; ctrs: number[]; queries: GscKeyword[] }>();

        for (const kw of keywords) {
          const page = kw.page || "(no page)";
          if (!pageMap.has(page)) {
            pageMap.set(page, { clicks: 0, impressions: 0, positions: [], ctrs: [], queries: [] });
          }
          const p = pageMap.get(page)!;
          p.clicks += kw.clicks;
          p.impressions += kw.impressions;
          p.positions.push(kw.position);
          p.ctrs.push(kw.ctr);
          p.queries.push(kw);
        }

        const pages: GscPageSummary[] = Array.from(pageMap.entries())
          .map(([page, d]) => ({
            page,
            total_clicks: d.clicks,
            total_impressions: d.impressions,
            avg_position: Math.round((d.positions.reduce((a, b) => a + b, 0) / d.positions.length) * 10) / 10,
            avg_ctr: Math.round((d.ctrs.reduce((a, b) => a + b, 0) / d.ctrs.length) * 100) / 100,
            top_queries: d.queries.sort((a, b) => b.clicks - a.clicks).slice(0, 10),
          }))
          .sort((a, b) => b.total_clicks - a.total_clicks);

        return NextResponse.json(
          {
            keywords: keywords.sort((a, b) => b.clicks - a.clicks),
            pages,
            date_range: { start, end: endDate },
            total_keywords: keywords.length,
            total_pages: pages.length,
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

      // queries-only view
      return NextResponse.json(
        {
          keywords: keywords.sort((a, b) => b.clicks - a.clicks),
          date_range: { start, end: endDate },
          total_keywords: keywords.length,
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

    // pages-only view
    const pages = rows.map((r) => ({
      page: r.keys[0] || "",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 10000) / 100,
      position: Math.round(r.position * 10) / 10,
    }));

    return NextResponse.json(
      {
        pages: pages.sort((a, b) => b.clicks - a.clicks),
        date_range: { start, end: endDate },
        total_pages: pages.length,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[gsc-keywords] Error:", message);
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
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
