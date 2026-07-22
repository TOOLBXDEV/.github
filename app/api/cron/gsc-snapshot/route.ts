import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly GSC keyword snapshot cron.
 *
 * Google Search Console retains only 16 months of data. This job runs monthly
 * (1st of each month) and snapshots the previous month's keyword data into
 * data/gsc-history.json, building a permanent historical record.
 *
 * Each snapshot entry stores: month, queries (aggregated by query with top page),
 * pages (aggregated by page with total clicks/impressions).
 *
 * Trigger: GET /api/cron/gsc-snapshot?secret=<CRON_SECRET>
 *          or Authorization: Bearer <CRON_SECRET>
 */

const SITE_URL = "https://www.toolbx.com/";
const GSC_API = "https://www.googleapis.com/webmasters/v3";
const HISTORY_FILE = path.join(process.cwd(), "data", "gsc-history.json");

interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface MonthSnapshot {
  month: string; // YYYY-MM
  captured_at: string; // ISO timestamp
  total_clicks: number;
  total_impressions: number;
  unique_queries: number;
  unique_pages: number;
  top_queries: { query: string; clicks: number; impressions: number; position: number; top_page: string }[];
  top_pages: { page: string; clicks: number; impressions: number; avg_position: number; query_count: number }[];
}

function getAuth(): GoogleAuth {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GSC_SERVICE_ACCOUNT_KEY env var not set");

  let credentials: Record<string, string>;
  try {
    const decoded = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    credentials = JSON.parse(decoded);
  } catch {
    throw new Error("GSC_SERVICE_ACCOUNT_KEY is not valid JSON or base64");
  }

  return new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

export async function GET(req: Request) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const url = new URL(req.url);
  const secretParam = url.searchParams.get("secret");

  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    secretParam !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // Determine which month to snapshot — default: previous month
    const targetMonth = url.searchParams.get("month"); // optional override: YYYY-MM
    let startDate: string;
    let endDate: string;
    let monthKey: string;

    if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
      monthKey = targetMonth;
      const [y, m] = targetMonth.split("-").map(Number);
      startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    } else {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      monthKey = prevMonth.toISOString().slice(0, 7); // YYYY-MM
      startDate = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
      endDate = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-${lastDay}`;
    }

    // Check if we already have this month
    let history: MonthSnapshot[] = [];
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      }
    } catch {
      history = [];
    }

    if (history.some((h) => h.month === monthKey)) {
      return NextResponse.json({
        status: "skipped",
        message: `Month ${monthKey} already captured`,
        total_months: history.length,
      });
    }

    // Fetch GSC data for the month
    const resp = await fetch(
      `${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["query", "page"],
          rowLimit: 25000,
          dataState: "final",
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`GSC API ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const rows: GscRow[] = data.rows || [];

    // Aggregate by query
    const queryMap = new Map<string, { clicks: number; impressions: number; positions: number[]; top_page: string; top_page_clicks: number }>();
    for (const r of rows) {
      const query = r.keys[0] || "";
      const page = r.keys[1] || "";
      if (!queryMap.has(query)) {
        queryMap.set(query, { clicks: 0, impressions: 0, positions: [], top_page: "", top_page_clicks: 0 });
      }
      const q = queryMap.get(query)!;
      q.clicks += r.clicks;
      q.impressions += r.impressions;
      q.positions.push(r.position);
      if (r.clicks > q.top_page_clicks) {
        q.top_page = page;
        q.top_page_clicks = r.clicks;
      }
    }

    // Aggregate by page
    const pageMap = new Map<string, { clicks: number; impressions: number; positions: number[]; query_count: number }>();
    for (const r of rows) {
      const page = r.keys[1] || "";
      if (!pageMap.has(page)) {
        pageMap.set(page, { clicks: 0, impressions: 0, positions: [], query_count: 0 });
      }
      const p = pageMap.get(page)!;
      p.clicks += r.clicks;
      p.impressions += r.impressions;
      p.positions.push(r.position);
      p.query_count++;
    }

    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);

    const snapshot: MonthSnapshot = {
      month: monthKey,
      captured_at: new Date().toISOString(),
      total_clicks: totalClicks,
      total_impressions: totalImpressions,
      unique_queries: queryMap.size,
      unique_pages: pageMap.size,
      top_queries: Array.from(queryMap.entries())
        .map(([query, d]) => ({
          query,
          clicks: d.clicks,
          impressions: d.impressions,
          position: Math.round((d.positions.reduce((a, b) => a + b, 0) / d.positions.length) * 10) / 10,
          top_page: d.top_page,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 200), // Top 200 queries per month
      top_pages: Array.from(pageMap.entries())
        .map(([page, d]) => ({
          page,
          clicks: d.clicks,
          impressions: d.impressions,
          avg_position: Math.round((d.positions.reduce((a, b) => a + b, 0) / d.positions.length) * 10) / 10,
          query_count: d.query_count,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 100), // Top 100 pages per month
    };

    // Append and save
    history.push(snapshot);
    history.sort((a, b) => a.month.localeCompare(b.month));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    return NextResponse.json({
      status: "captured",
      month: monthKey,
      date_range: { start: startDate, end: endDate },
      total_clicks: totalClicks,
      total_impressions: totalImpressions,
      unique_queries: queryMap.size,
      unique_pages: pageMap.size,
      total_months_in_history: history.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[gsc-snapshot] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
