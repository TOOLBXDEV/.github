"use client";

import { useEffect, useState, useMemo } from "react";

/* ── TOOLBX brand palette ─────────────────────────────────── */
const T = {
  bg: "#1C1C1E",
  panel: "#2D2D30",
  card: "#232325",
  border: "#3A3A3C",
  yellow: "#FFCA05",
  teal: "#457F86",
  tealLight: "#93C1C8",
  green: "#4ade80",
  orange: "#fb923c",
  red: "#f87171",
  text: "#E8E8E8",
  dim: "#999",
  silver: "#CCC",
};

/* ── Types ─────────────────────────────────────────────────── */
interface Company {
  company_name: string;
  domain: string;
  industry: string;
  annual_revenue: string;
  employees: string;
  country: string;
  state: string;
  apollo_visits: number;
  apollo_visitors: number;
  apollo_first_visit: string;
  apollo_last_visit: string;
  intent: string;
  intent_score: number;
  pv_1d: number | string;
  pv_7d: number | string;
  pv_30d: number | string;
  pv_90d: number | string;
  lifecycle_stage: string;
  ae_territory: string;
  data_sources: string;
  hs_link: string;
  hs_company_link: string;
  hs_owner: string;
  active_deal_name: string;
  active_deal_link: string;
  hubspot_contacts: number;
  primary_interest: string;
  hs_tracked_sessions: number;
  hs_tracked_pageviews: number;
}

interface Person {
  name: string;
  email: string;
  title: string;
  company_name: string;
  domain: string;
  industry: string;
  annual_revenue: string;
  employees: string;
  country: string;
  state: string;
  lifecycle_stage: string;
  ae_territory: string;
  company_apollo_visits: number;
  company_first_visit: string;
  company_last_visit: string;
  primary_interest: string;
  person_intent: string;
  bm_score: string;
  hs_sessions: number;
  hs_pageviews: number;
  hs_avg_pages_per_session: number;
  hs_first_page: string;
  hs_last_page: string;
  hs_first_visit: string;
  hs_last_visit: string;
  hs_original_source: string;
  data_sources: string;
  hs_contact_link: string;
  hs_company_link: string;
  hs_owner: string;
  active_deal_name: string;
  active_deal_link: string;
}

type Tab = "companies" | "people" | "keywords";

interface GscKeyword {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscPageSummary {
  page: string;
  total_clicks: number;
  total_impressions: number;
  avg_position: number;
  avg_ctr: number;
  top_queries: { query: string; clicks: number; impressions: number; position: number }[];
}

/* ── Helpers ───────────────────────────────────────────────── */
function intentBadge(intent: string) {
  if (!intent) return <span style={{ color: T.dim }}>—</span>;
  const colors: Record<string, string> = {
    "Very High": T.red,
    very_high: T.red,
    High: T.orange,
    high: T.orange,
    Medium: T.yellow,
    medium: T.yellow,
    Low: T.tealLight,
    low: T.tealLight,
  };
  const bg = colors[intent] || T.dim;
  const label = intent.charAt(0).toUpperCase() + intent.slice(1).replace("_", " ");
  return (
    <span style={{ background: bg + "22", color: bg, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function lifecycleBadge(stage: string) {
  if (!stage) return <span style={{ color: T.dim }}>—</span>;
  const colors: Record<string, string> = {
    Customer: T.yellow,
    Opportunity: T.teal,
    Lead: T.silver,
    "Sales Qualified Lead": T.tealLight,
    "Marketing Qualified Lead": T.silver,
    Subscriber: "#666",
    "Custom Stage": T.dim,
  };
  const c = colors[stage] || T.dim;
  return (
    <span style={{ background: c + "22", color: c, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {stage}
    </span>
  );
}

function fmt(n: number | string | undefined) {
  if (n === undefined || n === "" || n === null) return "—";
  return typeof n === "number" ? n.toLocaleString() : n;
}

/* ── Main Component ───────────────────────────────────────── */
export default function WebsiteTrafficPage() {
  const [tab, setTab] = useState<Tab>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [gscKeywords, setGscKeywords] = useState<GscKeyword[]>([]);
  const [gscPages, setGscPages] = useState<GscPageSummary[]>([]);
  const [gscDateRange, setGscDateRange] = useState({ start: "", end: "" });
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");

  // Company filters
  const [cSearch, setCSearch] = useState("");
  const [cSortKey, setCSortKey] = useState<keyof Company>("apollo_last_visit");
  const [cSortDir, setCSortDir] = useState<"asc" | "desc">("desc");
  const [cIntent, setCIntent] = useState("all");
  const [cLifecycle, setCLifecycle] = useState("all");
  const [cSource, setCSource] = useState("all");

  // People filters
  const [pSearch, setPSearch] = useState("");
  const [pSortKey, setPSortKey] = useState<keyof Person>("hs_last_visit");
  const [pSortDir, setPSortDir] = useState<"asc" | "desc">("desc");
  const [pLifecycle, setPLifecycle] = useState("all");
  const [pSource, setPSource] = useState("all");

  // Keywords filters
  const [kwSearch, setKwSearch] = useState("");
  const [kwView, setKwView] = useState<"queries" | "pages">("queries");
  const [kwSortKey, setKwSortKey] = useState<"clicks" | "impressions" | "ctr" | "position">("clicks");
  const [kwSortDir, setKwSortDir] = useState<"asc" | "desc">("desc");
  // Date picker state — default to full 16-month window
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() - 3);
  const defaultStart = new Date(defaultEnd);
  defaultStart.setMonth(defaultStart.getMonth() - 16);
  const [kwStartDate, setKwStartDate] = useState(defaultStart.toISOString().slice(0, 10));
  const [kwEndDate, setKwEndDate] = useState(defaultEnd.toISOString().slice(0, 10));
  const [kwDateDirty, setKwDateDirty] = useState(false); // track if user changed dates after initial load

  useEffect(() => {
    Promise.all([
      fetch("/api/visitor-data?type=companies").then((r) => r.json()),
      fetch("/api/visitor-data?type=people").then((r) => r.json()),
    ])
      .then(([cd, pd]) => {
        setCompanies(cd.data || []);
        setPeople(pd.data || []);
        setUpdatedAt(cd.updated_at || pd.updated_at || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // GSC fetch function — reusable for initial load and date range changes
  const [gscInitialLoaded, setGscInitialLoaded] = useState(false);
  const fetchGscData = (startDate: string, endDate: string) => {
    setGscLoading(true);
    setGscError("");
    fetch(`/api/gsc-keywords?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setGscError(data.error);
        } else {
          setGscKeywords(data.keywords || []);
          setGscPages(data.pages || []);
          setGscDateRange(data.date_range || { start: startDate, end: endDate });
        }
        setGscLoading(false);
        setGscInitialLoaded(true);
        setKwDateDirty(false);
      })
      .catch((e) => {
        setGscError(e.message || "Failed to load GSC data");
        setGscLoading(false);
      });
  };

  // Lazy-load GSC keywords when tab is first selected
  useEffect(() => {
    if (tab !== "keywords" || gscInitialLoaded || gscLoading) return;
    fetchGscData(kwStartDate, kwEndDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, gscInitialLoaded, gscLoading]);

  /* ── Company filtering/sorting ─────────────── */
  const filteredCompanies = useMemo(() => {
    let list = companies;
    if (cSearch) {
      const q = cSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.company_name?.toLowerCase().includes(q) ||
          c.domain?.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q) ||
          c.state?.toLowerCase().includes(q)
      );
    }
    if (cIntent !== "all") list = list.filter((c) => c.intent?.toLowerCase() === cIntent.toLowerCase());
    if (cLifecycle !== "all") list = list.filter((c) => c.lifecycle_stage === cLifecycle);
    if (cSource !== "all") list = list.filter((c) => c.data_sources?.includes(cSource));
    return [...list].sort((a, b) => {
      const av = a[cSortKey] ?? "";
      const bv = b[cSortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return cSortDir === "asc" ? av - bv : bv - av;
      return cSortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [companies, cSearch, cSortKey, cSortDir, cIntent, cLifecycle, cSource]);

  /* ── People filtering/sorting ──────────────── */
  const filteredPeople = useMemo(() => {
    let list = people;
    if (pSearch) {
      const q = pSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.company_name?.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q) ||
          p.domain?.toLowerCase().includes(q)
      );
    }
    if (pLifecycle !== "all") list = list.filter((p) => p.lifecycle_stage === pLifecycle);
    if (pSource !== "all") {
      if (pSource === "identified") list = list.filter((p) => p.email);
      else list = list.filter((p) => p.data_sources?.includes(pSource));
    }
    return [...list].sort((a, b) => {
      const av = a[pSortKey] ?? "";
      const bv = b[pSortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return pSortDir === "asc" ? av - bv : bv - av;
      return pSortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [people, pSearch, pSortKey, pSortDir, pLifecycle, pSource]);

  /* ── Keywords filtering/sorting ─────────────── */
  const filteredKeywords = useMemo(() => {
    if (kwView === "pages") return []; // handled by filteredGscPages
    let list = gscKeywords;
    if (kwSearch) {
      const q = kwSearch.toLowerCase();
      list = list.filter(
        (k) => k.query?.toLowerCase().includes(q) || k.page?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const av = a[kwSortKey] ?? 0;
      const bv = b[kwSortKey] ?? 0;
      // Position: lower is better, so "desc" sorts low→high (best first)
      if (kwSortKey === "position") return kwSortDir === "desc" ? av - bv : bv - av;
      return kwSortDir === "desc" ? bv - av : av - bv;
    });
  }, [gscKeywords, kwSearch, kwSortKey, kwSortDir, kwView]);

  const filteredGscPages = useMemo(() => {
    if (kwView !== "pages") return [];
    let list = gscPages;
    if (kwSearch) {
      const q = kwSearch.toLowerCase();
      list = list.filter(
        (p) => p.page?.toLowerCase().includes(q) || p.top_queries?.some((tq) => tq.query.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      const keyMap: Record<string, "total_clicks" | "total_impressions" | "avg_ctr" | "avg_position"> = {
        clicks: "total_clicks", impressions: "total_impressions", ctr: "avg_ctr", position: "avg_position",
      };
      const field = keyMap[kwSortKey] || "total_clicks";
      const av = a[field] ?? 0;
      const bv = b[field] ?? 0;
      if (kwSortKey === "position") return kwSortDir === "desc" ? av - bv : bv - av;
      return kwSortDir === "desc" ? bv - av : av - bv;
    });
  }, [gscPages, kwSearch, kwSortKey, kwSortDir, kwView]);

  const cIntents = useMemo(() => [...new Set(companies.map((c) => c.intent).filter(Boolean))].sort(), [companies]);
  const cLifecycles = useMemo(() => [...new Set(companies.map((c) => c.lifecycle_stage).filter(Boolean))].sort(), [companies]);
  const pLifecycles = useMemo(() => [...new Set(people.map((p) => p.lifecycle_stage).filter(Boolean))].sort(), [people]);

  function toggleCSort(key: keyof Company) {
    if (cSortKey === key) setCSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setCSortKey(key); setCSortDir("desc"); }
  }
  function togglePSort(key: keyof Person) {
    if (pSortKey === key) setPSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPSortKey(key); setPSortDir("desc"); }
  }
  function toggleKwSort(key: "clicks" | "impressions" | "ctr" | "position") {
    if (kwSortKey === key) setKwSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setKwSortKey(key); setKwSortDir("desc"); }
  }

  const cArrow = (key: keyof Company) => (cSortKey === key ? (cSortDir === "asc" ? " ▲" : " ▼") : "");
  const pArrow = (key: keyof Person) => (pSortKey === key ? (pSortDir === "asc" ? " ▲" : " ▼") : "");
  const kwArrow = (key: string) => (kwSortKey === key ? (kwSortDir === "asc" ? " ▲" : " ▼") : "");

  /* ── KPIs ─────────────────────────────────────── */
  const companyKpis = useMemo(() => {
    const totalVisits = companies.reduce((s, c) => s + (c.apollo_visits || 0), 0);
    const totalVisitors = companies.reduce((s, c) => s + (c.apollo_visitors || 0), 0);
    const highIntent = companies.filter((c) => c.intent?.toLowerCase() === "high" || c.intent?.toLowerCase() === "very_high" || c.intent?.toLowerCase() === "very high").length;
    return [
      { label: "Total Companies", value: companies.length.toLocaleString(), color: T.yellow },
      { label: "Total Visits (90d)", value: totalVisits.toLocaleString(), color: T.tealLight },
      { label: "Unique Visitors", value: totalVisitors.toLocaleString(), color: T.green },
      { label: "High/Very High Intent", value: highIntent.toLocaleString(), color: T.orange },
    ];
  }, [companies]);

  const peopleKpis = useMemo(() => {
    const totalSessions = people.reduce((s, p) => s + (p.hs_sessions || 0), 0);
    const identified = people.filter((p) => p.email).length;
    const customers = people.filter((p) => p.lifecycle_stage === "Customer").length;
    return [
      { label: "Total People", value: people.length.toLocaleString(), color: T.yellow },
      { label: "Identified (w/ email)", value: identified.toLocaleString(), color: T.green },
      { label: "Total Sessions", value: totalSessions.toLocaleString(), color: T.tealLight },
      { label: "Customers", value: customers.toLocaleString(), color: T.orange },
    ];
  }, [people]);

  const keywordKpis = useMemo(() => {
    const totalClicks = gscKeywords.reduce((s, k) => s + k.clicks, 0);
    const totalImpressions = gscKeywords.reduce((s, k) => s + k.impressions, 0);
    const uniqueQueries = new Set(gscKeywords.map((k) => k.query)).size;
    const avgPosition = gscKeywords.length > 0 ? Math.round((gscKeywords.reduce((s, k) => s + k.position, 0) / gscKeywords.length) * 10) / 10 : 0;
    return [
      { label: "Unique Queries", value: uniqueQueries.toLocaleString(), color: T.yellow },
      { label: "Total Clicks", value: totalClicks.toLocaleString(), color: T.green },
      { label: "Total Impressions", value: totalImpressions.toLocaleString(), color: T.tealLight },
      { label: "Avg Position", value: avgPosition.toString(), color: T.orange },
    ];
  }, [gscKeywords]);

  /* ── Shared styles ────────────────────────────── */
  const thStyle = (align: "left" | "right" = "left"): React.CSSProperties => ({
    textAlign: align,
    padding: "10px 8px",
    cursor: "pointer",
    color: T.dim,
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    userSelect: "none",
    whiteSpace: "nowrap",
  });

  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${T.yellow}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: T.dim, fontSize: 14 }}>Loading visitor data...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* ── Header ──────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "'Bitter', Georgia, serif", fontWeight: 700, fontSize: 20, color: T.yellow }}>TOOLBX</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>Website Traffic</span>
          </div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>
            {companies.length} companies • {people.length} people • Last updated{" "}
            {updatedAt ? new Date(updatedAt).toLocaleDateString() : "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/" style={{ padding: "6px 14px", borderRadius: 6, background: T.panel, color: T.dim, fontSize: 13, textDecoration: "none", border: `1px solid ${T.border}` }}>
            Sales Map
          </a>
          <a href="/campaigns" style={{ padding: "6px 14px", borderRadius: 6, background: T.panel, color: T.dim, fontSize: 13, textDecoration: "none", border: `1px solid ${T.border}` }}>
            Campaigns
          </a>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────── */}
      <div style={{ padding: "12px 24px 0", display: "flex", gap: 0, borderBottom: `1px solid ${T.border}` }}>
        {(["companies", "people", "keywords"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: tab === t ? `2px solid ${T.yellow}` : "2px solid transparent",
              color: tab === t ? T.yellow : T.dim,
              cursor: "pointer",
              transition: "all 0.15s",
              marginBottom: -1,
            }}
          >
            {t === "companies"
              ? `Companies (${companies.length})`
              : t === "people"
              ? `People (${people.length})`
              : `Keywords${gscKeywords.length ? ` (${new Set(gscKeywords.map(k => k.query)).size})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ───────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "16px 24px" }}>
        {(tab === "companies" ? companyKpis : tab === "people" ? peopleKpis : keywordKpis).map((kpi) => (
          <div key={kpi.label} style={{ background: T.card, borderRadius: 8, padding: "14px 18px", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.dim, marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ── COMPANIES TAB ──────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {tab === "companies" && (
        <>
          {/* Filters */}
          <div style={{ padding: "0 24px 12px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search company, domain, industry, state..."
              value={cSearch}
              onChange={(e) => setCSearch(e.target.value)}
              style={{ flex: 1, minWidth: 240, padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13, outline: "none" }}
            />
            <select value={cIntent} onChange={(e) => setCIntent(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 }}>
              <option value="all">All Intent</option>
              {cIntents.map((i) => (
                <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
              ))}
            </select>
            <select value={cLifecycle} onChange={(e) => setCLifecycle(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 }}>
              <option value="all">All Lifecycle</option>
              {cLifecycles.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select value={cSource} onChange={(e) => setCSource(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 }}>
              <option value="all">All Sources</option>
              <option value="HubSpot">HubSpot</option>
              <option value="Apollo">Apollo</option>
              <option value="HS Analytics">HS Analytics</option>
            </select>
            <span style={{ fontSize: 12, color: T.dim }}>{filteredCompanies.length} results</span>
          </div>

          {/* Table */}
          <div style={{ padding: "0 24px 24px", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${T.border}`, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
                  {([
                    ["company_name", "Company", "left"],
                    ["hs_owner", "Owner", "left"],
                    ["active_deal_name", "Active Deal", "left"],
                    ["industry", "Industry", "left"],
                    ["state", "State", "left"],
                    ["apollo_visits", "Visits", "right"],
                    ["apollo_visitors", "Visitors", "right"],
                    ["intent", "Intent", "left"],
                    ["apollo_last_visit", "Last Visit", "left"],
                    ["lifecycle_stage", "Lifecycle", "left"],
                    ["data_sources", "Sources", "left"],
                  ] as [keyof Company, string, "left" | "right"][]).map(([key, label, align]) => (
                    <th key={key} onClick={() => toggleCSort(key)} style={thStyle(align)}>
                      {label}{cArrow(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c, i) => (
                  <tr
                    key={c.domain + i}
                    style={{ borderBottom: `1px solid ${T.border}40`, transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.panel + "80")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 600 }}>
                        {c.hs_company_link ? (
                          <a href={c.hs_company_link} target="_blank" rel="noopener noreferrer" style={{ color: T.tealLight, textDecoration: "none" }}>{c.company_name}</a>
                        ) : (
                          <span style={{ color: T.text }}>{c.company_name}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.dim }}>
                        {c.domain}
                        {c.employees ? ` • ${c.employees} emp` : ""}
                        {c.annual_revenue ? ` • ${c.annual_revenue}` : ""}
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: T.silver }}>{c.hs_owner || "—"}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12 }}>
                      {c.active_deal_name ? (
                        <a href={c.active_deal_link} target="_blank" rel="noopener noreferrer" style={{ color: T.green, textDecoration: "none", fontWeight: 600 }}>{c.active_deal_name}</a>
                      ) : (
                        <span style={{ color: T.dim }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px", color: T.silver, fontSize: 12 }}>{c.industry || "—"}</td>
                    <td style={{ padding: "10px 8px", color: T.silver, fontSize: 12 }}>{c.state || "—"}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: T.yellow }}>{fmt(c.apollo_visits)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", color: T.tealLight }}>{fmt(c.apollo_visitors)}</td>
                    <td style={{ padding: "10px 8px" }}>{intentBadge(c.intent)}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: T.silver }}>{c.apollo_last_visit || "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{lifecycleBadge(c.lifecycle_stage)}</td>
                    <td style={{ padding: "10px 8px", fontSize: 11, color: T.dim }}>{c.data_sources || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── PEOPLE TAB ─────────────────────────── */}
      {/* ═══════════════════════════════════════════ */}
      {tab === "people" && (
        <>
          {/* Filters */}
          <div style={{ padding: "0 24px 12px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search name, email, company, title..."
              value={pSearch}
              onChange={(e) => setPSearch(e.target.value)}
              style={{ flex: 1, minWidth: 240, padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13, outline: "none" }}
            />
            <select value={pLifecycle} onChange={(e) => setPLifecycle(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 }}>
              <option value="all">All Lifecycle</option>
              {pLifecycles.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select value={pSource} onChange={(e) => setPSource(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13 }}>
              <option value="all">All</option>
              <option value="identified">Identified Only</option>
              <option value="HubSpot">HubSpot</option>
              <option value="Apollo">Apollo</option>
            </select>
            <span style={{ fontSize: 12, color: T.dim }}>{filteredPeople.length} results</span>
          </div>

          {/* Table */}
          <div style={{ padding: "0 24px 24px", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${T.border}`, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
                  {([
                    ["name", "Name", "left"],
                    ["title", "Title", "left"],
                    ["company_name", "Company", "left"],
                    ["hs_owner", "Owner", "left"],
                    ["active_deal_name", "Active Deal", "left"],
                    ["hs_sessions", "Sessions", "right"],
                    ["hs_pageviews", "Pageviews", "right"],
                    ["hs_last_visit", "Last Visit", "left"],
                    ["lifecycle_stage", "Lifecycle", "left"],
                    ["hs_original_source", "Source", "left"],
                  ] as [keyof Person, string, "left" | "right"][]).map(([key, label, align]) => (
                    <th key={key} onClick={() => togglePSort(key)} style={thStyle(align)}>
                      {label}{pArrow(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((p, i) => (
                  <tr
                    key={(p.email || p.name) + i}
                    style={{ borderBottom: `1px solid ${T.border}40`, transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.panel + "80")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 600, color: T.text }}>
                        {p.hs_contact_link ? (
                          <a href={p.hs_contact_link} target="_blank" rel="noopener noreferrer" style={{ color: T.text, textDecoration: "none" }}>{p.name || "Unknown"}</a>
                        ) : (
                          p.name || "Unknown"
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.tealLight }}>{p.email || "—"}</div>
                    </td>
                    <td style={{ padding: "10px 8px", color: T.silver, fontSize: 12 }}>{p.title || "—"}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontSize: 12 }}>
                        {p.hs_company_link ? (
                          <a href={p.hs_company_link} target="_blank" rel="noopener noreferrer" style={{ color: T.tealLight, textDecoration: "none" }}>{p.company_name || "—"}</a>
                        ) : (
                          <span style={{ color: T.silver }}>{p.company_name || "—"}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.dim }}>{p.domain || ""}</div>
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: T.silver }}>{p.hs_owner || "—"}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12 }}>
                      {p.active_deal_name ? (
                        <a href={p.active_deal_link} target="_blank" rel="noopener noreferrer" style={{ color: T.green, textDecoration: "none", fontWeight: 600 }}>{p.active_deal_name}</a>
                      ) : (
                        <span style={{ color: T.dim }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: T.yellow }}>{p.hs_sessions || 0}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", color: T.tealLight }}>{p.hs_pageviews || 0}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: T.silver }}>{p.hs_last_visit || p.company_last_visit || "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{lifecycleBadge(p.lifecycle_stage)}</td>
                    <td style={{ padding: "10px 8px", fontSize: 11, color: T.dim }}>{p.hs_original_source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ── KEYWORDS TAB (Google Search Console) ── */}
      {/* ═══════════════════════════════════════════ */}
      {tab === "keywords" && (
        <>
          {gscLoading && (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ width: 32, height: 32, border: `2px solid ${T.yellow}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ color: T.dim, fontSize: 14 }}>Loading Google Search Console data...</p>
            </div>
          )}

          {gscError && (
            <div style={{ padding: "24px", margin: "12px 24px", background: T.red + "15", border: `1px solid ${T.red}40`, borderRadius: 8 }}>
              <div style={{ color: T.red, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>GSC Connection Error</div>
              <div style={{ color: T.dim, fontSize: 13 }}>{gscError}</div>
              <div style={{ color: T.dim, fontSize: 12, marginTop: 8 }}>Make sure the <code>GSC_SERVICE_ACCOUNT_KEY</code> environment variable is set in Vercel.</div>
            </div>
          )}

          {!gscLoading && !gscError && (
            <>
              {/* Date range + view toggle */}
              <div style={{ padding: "0 24px 12px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Search queries or pages..."
                  value={kwSearch}
                  onChange={(e) => setKwSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13, outline: "none" }}
                />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <label style={{ fontSize: 12, color: T.dim }}>From</label>
                  <input
                    type="date"
                    value={kwStartDate}
                    onChange={(e) => { setKwStartDate(e.target.value); setKwDateDirty(true); }}
                    style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                  />
                  <label style={{ fontSize: 12, color: T.dim }}>To</label>
                  <input
                    type="date"
                    value={kwEndDate}
                    onChange={(e) => { setKwEndDate(e.target.value); setKwDateDirty(true); }}
                    style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                  />
                  {kwDateDirty && (
                    <button
                      onClick={() => fetchGscData(kwStartDate, kwEndDate)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "none",
                        background: T.yellow,
                        color: "#1C1C1E",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Apply
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
                  {(["queries", "pages"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setKwView(v)}
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        background: kwView === v ? T.yellow + "22" : T.card,
                        color: kwView === v ? T.yellow : T.dim,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {v === "queries" ? "By Query" : "By Page"}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: T.dim }}>
                  {kwView === "queries" ? filteredKeywords.length : filteredGscPages.length} results
                </span>
              </div>

              {/* ── Queries view ─────────── */}
              {kwView === "queries" && (
                <div style={{ padding: "0 24px 24px", overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}`, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
                        <th style={{ ...thStyle("left"), cursor: "default" }}>Query</th>
                        <th style={{ ...thStyle("left"), cursor: "default" }}>Page</th>
                        <th onClick={() => toggleKwSort("clicks")} style={thStyle("right")}>Clicks{kwArrow("clicks")}</th>
                        <th onClick={() => toggleKwSort("impressions")} style={thStyle("right")}>Impressions{kwArrow("impressions")}</th>
                        <th onClick={() => toggleKwSort("ctr")} style={thStyle("right")}>CTR{kwArrow("ctr")}</th>
                        <th onClick={() => toggleKwSort("position")} style={thStyle("right")}>Position{kwArrow("position")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKeywords.slice(0, 200).map((k, i) => {
                        const pagePath = (() => { try { return new URL(k.page).pathname; } catch { return k.page; } })();
                        return (
                          <tr
                            key={k.query + k.page + i}
                            style={{ borderBottom: `1px solid ${T.border}40`, transition: "background 0.15s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = T.panel + "80")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "10px 8px", fontWeight: 600, color: T.text }}>{k.query}</td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              <a href={k.page} target="_blank" rel="noopener noreferrer" style={{ color: T.tealLight, textDecoration: "none" }}>
                                {pagePath}
                              </a>
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: T.yellow }}>{k.clicks}</td>
                            <td style={{ padding: "10px 8px", textAlign: "right", color: T.tealLight }}>{k.impressions.toLocaleString()}</td>
                            <td style={{ padding: "10px 8px", textAlign: "right", color: T.silver }}>{k.ctr}%</td>
                            <td style={{ padding: "10px 8px", textAlign: "right" }}>
                              <span style={{
                                color: k.position <= 3 ? T.green : k.position <= 10 ? T.yellow : k.position <= 20 ? T.orange : T.dim,
                                fontWeight: k.position <= 10 ? 700 : 400,
                              }}>
                                {k.position}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredKeywords.length > 200 && (
                    <div style={{ textAlign: "center", padding: 12, color: T.dim, fontSize: 12 }}>
                      Showing 200 of {filteredKeywords.length} results. Use search to narrow down.
                    </div>
                  )}
                </div>
              )}

              {/* ── Pages view ─────────── */}
              {kwView === "pages" && (
                <div style={{ padding: "0 24px 24px", overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}`, position: "sticky", top: 0, background: T.bg, zIndex: 1 }}>
                        <th style={{ ...thStyle("left"), cursor: "default" }}>Page</th>
                        <th onClick={() => toggleKwSort("clicks")} style={thStyle("right")}>Clicks{kwArrow("clicks")}</th>
                        <th onClick={() => toggleKwSort("impressions")} style={thStyle("right")}>Impressions{kwArrow("impressions")}</th>
                        <th onClick={() => toggleKwSort("ctr")} style={thStyle("right")}>Avg CTR{kwArrow("ctr")}</th>
                        <th onClick={() => toggleKwSort("position")} style={thStyle("right")}>Avg Position{kwArrow("position")}</th>
                        <th style={{ ...thStyle("left"), cursor: "default" }}>Top Queries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGscPages.map((p, i) => {
                        const pagePath = (() => { try { return new URL(p.page).pathname; } catch { return p.page; } })();
                        return (
                          <tr
                            key={p.page + i}
                            style={{ borderBottom: `1px solid ${T.border}40`, transition: "background 0.15s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = T.panel + "80")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "10px 8px" }}>
                              <a href={p.page} target="_blank" rel="noopener noreferrer" style={{ color: T.tealLight, textDecoration: "none", fontWeight: 600 }}>
                                {pagePath}
                              </a>
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: T.yellow }}>{p.total_clicks.toLocaleString()}</td>
                            <td style={{ padding: "10px 8px", textAlign: "right", color: T.tealLight }}>{p.total_impressions.toLocaleString()}</td>
                            <td style={{ padding: "10px 8px", textAlign: "right", color: T.silver }}>{p.avg_ctr}%</td>
                            <td style={{ padding: "10px 8px", textAlign: "right" }}>
                              <span style={{
                                color: p.avg_position <= 3 ? T.green : p.avg_position <= 10 ? T.yellow : p.avg_position <= 20 ? T.orange : T.dim,
                                fontWeight: p.avg_position <= 10 ? 700 : 400,
                              }}>
                                {p.avg_position}
                              </span>
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12, color: T.silver }}>
                              {p.top_queries.slice(0, 3).map((q) => q.query).join(", ") || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
