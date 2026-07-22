"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { Deal } from "@/lib/types";
import { formatSurchargeSummary } from "@/lib/surcharge";
import { DEFAULT_MAP_STAGES } from "@/lib/map-stages";
import bundledSnapshot from "@/public/deals-snapshot.json";
import * as XLSX from "xlsx";

const BUNDLED_DEALS: Deal[] = Array.isArray((bundledSnapshot as { deals?: Deal[] }).deals)
  ? (bundledSnapshot as { deals: Deal[] }).deals
  : [];
const BUNDLED_UPDATED_AT =
  typeof (bundledSnapshot as { updated_at?: string }).updated_at === "string"
    ? (bundledSnapshot as { updated_at: string }).updated_at
    : "";

const T = {
  white: "#FFFFFF",
  slateBlack: "#1C1C1E",
  sunriseYellow: "#FFCA05",
  trueBlack: "#000000",
  darkSlate: "#2D2D30",
  darkGrey: "#494949",
  silverGrey: "#CCCCCC",
  lightGrey: "#F2F2F2",
  seaweed: "#457F86",
  skyBlue: "#93C1C8",
  azure: "#D6E8EA",
  overEasy: "#EFB600",
};

/** Big box overlay (OSM-sourced static JSON) */
const BIG_BOX_ORANGE = "#FF8C00";
const BIG_BOX_LABEL = "Big Box Stores";

const HUBSPOT_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? "49044619";

const STAGE_COLORS: Record<string, string> = {
  Customer: T.sunriseYellow,
  "In Flight": T.seaweed,
  "Awaiting Kick Off Call": T.skyBlue,
  Opportunity: "#6B9DA6",
  "Sales Qualified Lead": T.azure,
  "Marketing Qualified Lead": T.silverGrey,
  Lead: "#8A8A8E",
  Subscriber: "#666666",
  Evangelist: T.overEasy,
  Churned: "#CC4444",
  "Closed Lost - Re-engage": "#C96B2D",
  Other: "#777777",
  Unknown: "#555555",
};

const EMP_RANGES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const REV_RANGES = ["Under $1M", "$1M - $5M", "$5M - $10M", "$10M - $50M", "$50M - $100M", "$100M+"];
const AMT_RANGES = ["Under $10K", "$10K - $25K", "$25K - $50K", "$50K - $100K", "$100K+"];
const ARR_RANGES = ["Under $10K", "$10K - $25K", "$25K - $50K", "$50K - $100K", "$100K+"];
const LOC_RANGES = ["1", "2-5", "6-10", "11-25", "26-50", "50+"];
const TIME_RANGES = ["Last 3 months", "Last 6 months", "Last 12 months", "Last 24 months"];

const TERRITORY_COLORS: Record<string, string> = {
  "East Coast": "#457F86",
  "West Coast": "#93C1C8",
  "NE/Midwest": "#FFCA05",
  "Central": "#EFB600",
};

const TERRITORY_STATES: Record<string, string[]> = {
  "East Coast": [
    "Maine", "New Hampshire", "Vermont", "Massachusetts", "Rhode Island",
    "Connecticut", "New York", "New Jersey", "Pennsylvania", "Delaware",
    "Maryland", "Virginia", "West Virginia", "North Carolina", "South Carolina",
    "Georgia", "Florida", "District of Columbia",
  ],
  "West Coast": [
    "Washington", "Oregon", "California", "Nevada", "Arizona",
    "Hawaii", "Alaska", "Idaho", "Montana", "Wyoming", "Utah",
  ],
  "NE/Midwest": [
    "Ohio", "Michigan", "Indiana", "Illinois", "Wisconsin", "Minnesota",
    "Iowa", "Missouri", "North Dakota", "South Dakota", "Nebraska", "Kansas",
  ],
  "Central": [
    "Texas", "Oklahoma", "Arkansas", "Louisiana", "Mississippi", "Alabama",
    "Tennessee", "Kentucky", "Colorado", "New Mexico",
  ],
};

const STATE_TO_TERRITORY: Record<string, string> = {};
for (const [territory, states] of Object.entries(TERRITORY_STATES)) {
  for (const state of states) STATE_TO_TERRITORY[state] = territory;
}

/** Canadian provinces / territories → sales territory (approximate) */
const CA_PROVINCE_TO_TERRITORY: Record<string, string> = {
  Ontario: "East Coast",
  Quebec: "East Coast",
  "British Columbia": "West Coast",
  Alberta: "Central",
  Manitoba: "NE/Midwest",
  Saskatchewan: "NE/Midwest",
  "Nova Scotia": "East Coast",
  "New Brunswick": "East Coast",
  "Prince Edward Island": "East Coast",
  "Newfoundland and Labrador": "East Coast",
  Yukon: "West Coast",
  "Northwest Territories": "NE/Midwest",
  Nunavut: "NE/Midwest",
};

const ADMIN_BORDER_COLOR = "#a8e8f5";
const ADMIN_BORDER_WEIGHT = 2.8;

function regionLabelFromFeature(feature: { properties?: Record<string, unknown> }): string {
  const p = feature.properties || {};
  if (typeof p.name === "string" && p.name) return p.name;
  const en = p.prov_name_en;
  if (Array.isArray(en) && en[0]) return String(en[0]);
  if (typeof en === "string") return en;
  return "";
}

function salesTerritoryForRegion(regionName: string): string | undefined {
  if (STATE_TO_TERRITORY[regionName]) return STATE_TO_TERRITORY[regionName];
  return CA_PROVINCE_TO_TERRITORY[regionName];
}

function amtRange(n: number): string {
  if (!n) return "";
  if (n < 10_000) return "Under $10K";
  if (n < 25_000) return "$10K - $25K";
  if (n < 50_000) return "$25K - $50K";
  if (n < 100_000) return "$50K - $100K";
  return "$100K+";
}

const LIFECYCLE_ORDER = [
  "Customer", "In Flight", "Awaiting Kick Off Call", "Opportunity",
  "Sales Qualified Lead", "Marketing Qualified Lead", "Lead",
  "Subscriber", "Evangelist", "Churned", "Closed Lost - Re-engage", "Other", "Unknown",
];

function fmtMoney(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  return "$" + n.toLocaleString();
}

function fmtRev(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  return "$" + n.toLocaleString();
}

function fmtDate(s: string) {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


function SelectFilter({
  id, label, options, value, onChange, disabled,
}: {
  id: string; label: string; options: string[]; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const shown = query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <div ref={ref} className="relative" id={id}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full px-2 py-1.5 rounded-md text-[11px] outline-none text-left truncate ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        style={{
          border: `1px solid ${disabled ? `${T.darkGrey}60` : T.darkGrey}`,
          background: T.darkSlate,
          color: disabled ? "#6a6a6e" : value ? T.white : T.silverGrey,
        }}
        disabled={disabled}
      >
        {value || `All ${label}`}
      </button>
      {open && (
        <div
          className="absolute z-[9999] mt-1 w-full rounded-md overflow-hidden shadow-lg"
          style={{ background: T.darkSlate, border: `1px solid ${T.darkGrey}` }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="w-full px-2 py-1.5 text-[11px] outline-none"
            style={{ background: T.slateBlack, color: T.white, borderBottom: `1px solid ${T.darkGrey}` }}
          />
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full px-2 py-1.5 text-[11px] text-left hover:brightness-125 transition-colors"
              style={{ color: !value ? T.sunriseYellow : T.silverGrey, background: !value ? `${T.darkGrey}44` : "transparent" }}
            >
              All {label}
            </button>
            {shown.map((o) => (
              <button
                type="button"
                key={o}
                onClick={() => { onChange(o); setOpen(false); }}
                className="w-full px-2 py-1.5 text-[11px] text-left hover:brightness-125 transition-colors"
                style={{ color: o === value ? T.sunriseYellow : T.silverGrey, background: o === value ? `${T.darkGrey}44` : "transparent" }}
              >
                {o}
              </button>
            ))}
            {shown.length === 0 && (
              <p className="px-2 py-1.5 text-[11px]" style={{ color: T.darkGrey }}>No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_STAGES = DEFAULT_MAP_STAGES;
const DEFAULT_FILTERS = {
  state: "", industry: "", erp: "", owner: "", employees: "", revenue: "",
  amount: "", cumAmount: "", product: "", country: "", buyingGroup: "",
  territory: "", arr: "", locations: "", wonSince: "", createdSince: "",
};

export default function SalesMap() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"api" | "snapshot" | "bundled" | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [search, setSearch] = useState("");
  const [activeStages, setActiveStages] = useState<Set<string>>(new Set(DEFAULT_STAGES));
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [showHeat, setShowHeat] = useState(false);
  const [showTerritories, setShowTerritories] = useState(false);
  const [showBigBoxStores, setShowBigBoxStores] = useState(false);
  /** Set when big-box overlay loads (helps tell clusters apart from pipeline pins). */
  const [bigBoxLoadedCount, setBigBoxLoadedCount] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const heatRef = useRef<any>(null);
  const territoryRef = useRef<any>(null);
  const bigBoxClusterRef = useRef<any>(null);
  const showTerritoriesRef = useRef(false);
  const leafletRef = useRef<any>(null);

  showTerritoriesRef.current = showTerritories;
  const markersRef = useRef<any[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletLoaded = useRef(false);
  const urlInitialized = useRef(false);

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    if (mq.matches) setPanelOpen(false);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) setPanelOpen(false);
      else setPanelOpen(true);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Read URL params on mount
  useEffect(() => {
    if (urlInitialized.current) return;
    urlInitialized.current = true;
    const p = new URLSearchParams(window.location.search);
    if (p.has("stages")) {
      const s = p.get("stages")!.split(",").filter(Boolean);
      if (s.length) setActiveStages(new Set(s));
      else setActiveStages(new Set(DEFAULT_STAGES));
    }
    if (p.has("q")) setSearch(p.get("q") || "");
    const fKeys = Object.keys(DEFAULT_FILTERS) as (keyof typeof DEFAULT_FILTERS)[];
    const newF = { ...DEFAULT_FILTERS };
    let hasFilter = false;
    for (const k of fKeys) {
      if (p.has(k)) { newF[k] = p.get(k) || ""; hasFilter = true; }
    }
    if (hasFilter) setFilters(newF);
    if (p.get("bigbox") === "1") setShowBigBoxStores(true);
  }, []);

  // Write URL params on change
  useEffect(() => {
    if (!urlInitialized.current) return;
    const p = new URLSearchParams();
    const stages = Array.from(activeStages);
    const stagesSorted = [...stages].sort().join(",");
    const defaultSorted = [...DEFAULT_STAGES].sort().join(",");
    if (stages.length > 0 && stagesSorted !== defaultSorted) {
      p.set("stages", stages.join(","));
    }
    if (search) p.set("q", search);
    for (const [k, v] of Object.entries(filters)) {
      if (v) p.set(k, v);
    }
    if (showBigBoxStores) p.set("bigbox", "1");
    const qs = p.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [activeStages, search, filters, showBigBoxStores]);

  useEffect(() => {
    let cancelled = false;

    function loadBundled(): { deals: Deal[]; updated_at: string; source: "bundled" } {
      if (BUNDLED_DEALS.length === 0) {
        throw new Error("Bundled deals snapshot is empty. Run: npm run export-deals-snapshot");
      }
      return { deals: BUNDLED_DEALS, updated_at: BUNDLED_UPDATED_AT, source: "bundled" };
    }

    async function loadSnapshot(): Promise<{
      deals: Deal[];
      updated_at: string;
      source: "snapshot" | "bundled";
    }> {
      try {
        const snapRes = await fetch("/deals-snapshot.json", { cache: "no-store" });
        const snap = await snapRes.json();
        if (snapRes.ok && Array.isArray(snap.deals) && snap.deals.length > 0) {
          return {
            deals: snap.deals,
            updated_at: snap.updated_at || "",
            source: "snapshot",
          };
        }
      } catch {
        /* use bundled JSON baked into the JS bundle */
      }
      return loadBundled();
    }

    (async () => {
      try {
        const r = await fetch("/api/deals?includeLeads=1", { cache: "no-store" });
        const data = await r.json();
        if (r.ok && !data.error && Array.isArray(data.deals) && data.deals.length > 0) {
          if (cancelled) return;
          setLoadError(null);
          setDataSource("api");
          setDeals(data.deals);
          setUpdatedAt(data.updated_at || "");
          setLoading(false);
          return;
        }
        const apiErr = data.detail || data.error || `HTTP ${r.status}`;
        console.warn("[SalesMap] /api/deals failed, using snapshot:", apiErr);
        const snap = await loadSnapshot();
        if (cancelled) return;
        setLoadError(null);
        setDataSource(snap.source);
        setDeals(snap.deals);
        setUpdatedAt(snap.updated_at);
        setLoading(false);
      } catch (err: unknown) {
        try {
          const snap = await loadSnapshot();
          if (cancelled) return;
          setLoadError(null);
          setDataSource(snap.source);
          setDeals(snap.deals);
          setUpdatedAt(snap.updated_at);
          setLoading(false);
        } catch {
          if (cancelled) return;
          setLoadError(err instanceof Error ? err.message : "Failed to load map data");
          setDeals([]);
          setDataSource(null);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // If every lifecycle stage is off, restore defaults so the map is not blank
  useEffect(() => {
    if (loading || deals.length === 0) return;
    if (activeStages.size === 0) setActiveStages(new Set(DEFAULT_STAGES));
  }, [loading, deals.length, activeStages.size]);

  const allStages = useMemo(() => {
    const found = new Set(deals.map((d) => d.stage));
    const ordered = LIFECYCLE_ORDER.filter((s) => found.has(s));
    found.forEach((s) => { if (!ordered.includes(s)) ordered.push(s); });
    return ordered;
  }, [deals]);

  const filterOptions = useMemo(() => {
    const s = (key: keyof Deal) =>
      Array.from(new Set(deals.map((d) => String(d[key])).filter(Boolean))).sort();
    const split = (key: keyof Deal) =>
      Array.from(new Set(deals.flatMap((d) => String(d[key]).split(",").map((v) => v.trim())).filter(Boolean))).sort();
    return {
      states: s("state"), industries: s("industry"), erps: split("erp"),
      owners: s("owner"), products: split("product"), countries: s("country"),
      buyingGroups: s("buying_group"), territories: s("territory"),
    };
  }, [deals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const wonCutoff = filters.wonSince ? monthsAgoISO(parseInt(filters.wonSince)) : "";
    const createdCutoff = filters.createdSince ? monthsAgoISO(parseInt(filters.createdSince)) : "";
    return deals.filter((d) => {
      if (!activeStages.has(d.stage)) return false;
      if (filters.state && d.state !== filters.state) return false;
      if (filters.industry && d.industry !== filters.industry) return false;
      if (filters.erp && !d.erp.split(",").map((v) => v.trim()).includes(filters.erp)) return false;
      if (filters.owner && d.owner !== filters.owner) return false;
      if (filters.employees && d.emp_range !== filters.employees) return false;
      if (filters.revenue && d.rev_range !== filters.revenue) return false;
      if (filters.amount && d.deal_breakdown && !d.deal_breakdown.some((ln: any) => amtRange(ln.amount) === filters.amount)) return false;
      if (filters.cumAmount && d.cum_amt_range !== filters.cumAmount) return false;
      if (filters.product && !d.product.split(",").map((v) => v.trim()).includes(filters.product)) return false;
      if (filters.country && d.country !== filters.country) return false;
      if (filters.buyingGroup && d.buying_group !== filters.buyingGroup) return false;
      if (filters.territory && d.territory !== filters.territory) return false;
      if (filters.arr && d.arr_range !== filters.arr) return false;
      if (filters.locations && d.loc_range !== filters.locations) return false;
      if (wonCutoff && (!d.won_date || d.won_date < wonCutoff)) return false;
      if (createdCutoff && (!d.created || d.created < createdCutoff)) return false;
      if (q) {
        const hay = [d.company, d.name, d.city, d.state, d.industry, d.erp, d.owner, d.zip, d.country, d.domain, d.product, d.buying_group, d.territory, d.hubspot_company_id].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deals, search, activeStages, filters]);

  const stats = useMemo(() => {
    const custs = filtered.filter((d) => d.status === "Customer").length;
    const prosps = filtered.length - custs;
    const val = filtered.reduce((s, d) => s + (d.open_pipeline_value || 0), 0);
    let pins = 0;
    for (const d of filtered) {
      if (d.branches && d.branches.length > 1) {
        const bp = d.branches.filter((b) => b.lat && b.lng).length;
        pins += bp || (d.lat && d.lng ? 1 : 0);
      } else if (d.lat && d.lng) pins += 1;
    }
    return { total: filtered.length, custs, prosps, val, mapped: pins };
  }, [filtered]);

  const initMap = useCallback(async () => {
    if (leafletLoaded.current || !mapContainerRef.current) return;
    leafletLoaded.current = true;

    const L = (await import("leaflet")).default || (await import("leaflet"));
    await import("leaflet/dist/leaflet.css");
    await import("leaflet.markercluster");
    await import("leaflet.markercluster/dist/MarkerCluster.css");
    await import("leaflet.markercluster/dist/MarkerCluster.Default.css");
    await import("leaflet.heat");

    leafletRef.current = L;

    const style = document.createElement("style");
    style.textContent = [
      `.land-base { filter: brightness(0); }`,
      `.water-tint { filter: invert(1) grayscale(1) brightness(3) contrast(5) sepia(1) hue-rotate(190deg) saturate(3) brightness(0.3); }`,
    ].join("\n");
    document.head.appendChild(style);

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([39.5, -98.5], 4);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd", className: "land-base",
    }).addTo(map);

    const waterPane = map.createPane("waterPane");
    waterPane.style.zIndex = "250";
    waterPane.style.mixBlendMode = "screen";
    waterPane.style.opacity = "1";

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd", pane: "waterPane", className: "water-tint",
    }).addTo(map);

    const labelsPane = map.createPane("mapLabels");
    labelsPane.style.zIndex = "650";
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd", pane: "mapLabels", opacity: 0.95,
    }).addTo(map);

    const cg = new (L as any).MarkerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const n = cluster.getChildCount();
        const sz = n < 10 ? 34 : n < 50 ? 42 : 50;
        const ch = cluster.getAllChildMarkers();
        const counts: Record<string, number> = {};
        for (const m of ch) {
          const stage = (m.options as any).dd?.stage || "Unknown";
          counts[stage] = (counts[stage] || 0) + 1;
        }
        let dominant = "Unknown";
        let max = 0;
        for (const [stage, count] of Object.entries(counts)) {
          if (count > max) { max = count; dominant = stage; }
        }
        const col = STAGE_COLORS[dominant] || T.silverGrey;
        const textCol = dominant === "Customer" ? T.slateBlack : T.white;
        return L.divIcon({
          html: `<div style="background:${col};color:${textCol};width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${sz < 40 ? 11 : 13}px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid rgba(255,255,255,0.15)">${n}</div>`,
          className: "",
          iconSize: [sz, sz] as [number, number],
        });
      },
    });
    map.addLayer(cg);

    style.textContent += `
      .leaflet-tooltip.bigbox-tooltip {
        background: #2D2D30 !important; color: #F2F2F2 !important;
        border: 1px solid #494949 !important; border-radius: 6px !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.45) !important;
        padding: 6px 10px !important;
        font-size: 11px !important;
      }
      .leaflet-tooltip.bigbox-tooltip::before { border-top-color: #2D2D30 !important; }
      .leaflet-tooltip.admin-region-label {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        color: #d4f1f8 !important;
        font-weight: 700 !important;
        font-size: 12px !important;
        text-shadow: 0 0 6px #000, 0 0 12px #000, 0 1px 2px #000;
      }
      .leaflet-tooltip.admin-region-label::before { display: none !important; }
    `;

    const bigCg = new (L as any).MarkerClusterGroup({
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const n = cluster.getChildCount();
        const sz = n < 10 ? 34 : n < 100 ? 42 : 50;
        return L.divIcon({
          html: `<div style="background:${BIG_BOX_ORANGE};color:#fff;width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${sz < 40 ? 11 : 13}px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid rgba(255,255,255,0.2)">${n}</div>`,
          className: "",
          iconSize: [sz, sz] as [number, number],
        });
      },
    });
    bigBoxClusterRef.current = bigCg;

    // US + Canada province/territory boundaries (always visible; fill when "Territories" on)
    try {
      const adminPane = map.createPane("adminBoundaries");
      adminPane.style.zIndex = "385";
      const [usRes, caRes] = await Promise.all([
        fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"),
        fetch(
          "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-canada-province/exports/geojson?limit=-1"
        ),
      ]);
      const features: any[] = [];
      if (usRes.ok) {
        const usData = await usRes.json();
        if (usData.features) features.push(...usData.features);
      }
      if (caRes.ok) {
        const caData = await caRes.json();
        if (caData.features) features.push(...caData.features);
      }
      if (features.length > 0) {
        const geoData = { type: "FeatureCollection" as const, features };
        const adminStyle = (feature: any) => {
          const label = regionLabelFromFeature(feature);
          const terr = label ? salesTerritoryForRegion(label) : undefined;
          const showFill = showTerritoriesRef.current;
          return {
            color: terr ? TERRITORY_COLORS[terr] : ADMIN_BORDER_COLOR,
            weight: ADMIN_BORDER_WEIGHT,
            opacity: 0.95,
            fillColor: showFill && terr ? TERRITORY_COLORS[terr] : "transparent",
            fillOpacity: showFill && terr ? 0.18 : 0,
          };
        };
        const layer = L.geoJSON(geoData, {
          pane: "adminBoundaries",
          style: adminStyle,
          onEachFeature: (feature: any, lay: any) => {
            const label = regionLabelFromFeature(feature);
            if (label) {
              lay.bindTooltip(label, {
                permanent: true,
                direction: "center",
                className: "admin-region-label",
              });
            }
          },
        });
        territoryRef.current = layer;
        layer.addTo(map);
      }
    } catch { /* GeoJSON fetch failed, skip admin boundaries */ }

    mapRef.current = map;
    clusterRef.current = cg;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!loading && deals.length > 0) initMap();
  }, [loading, deals.length, initMap]);

  // Render markers / heat layer
  useEffect(() => {
    if (!mapReady) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!map || !clusterRef.current || !L) return;

    clusterRef.current.clearLayers();
    if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }

    const newMarkers: any[] = [];
    const heatPoints: [number, number, number][] = [];

    function buildPopup(d: Deal, branchName?: string) {
      const stageCol = STAGE_COLORS[d.stage] || T.silverGrey;
      const row = (l: string, v: string) =>
        `<div style="font-size:11px;color:${T.darkGrey};margin-bottom:2px"><strong style="color:${T.slateBlack}">${l}:</strong> ${v}</div>`;
      const divider = `<div style="border-top:1px solid ${T.silverGrey}40;margin:6px 0"></div>`;

      let p = `<div style="font-size:14px;font-weight:700;margin-bottom:4px;color:${T.slateBlack}">${d.company || d.name}</div>`;
      if (branchName) {
        p += `<div style="font-size:11px;color:${T.seaweed};font-weight:600;margin-bottom:4px">${branchName}</div>`;
      }
      p += `<div style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;margin-bottom:6px;background:${stageCol}25;color:${stageCol}">${d.stage}</div>`;
      if (d.record_source === "company") {
        p += `<div style="font-size:10px;color:${T.darkGrey};margin:4px 0 6px;line-height:1.35">Company record — no qualifying deal in the pipeline query (closed-won or open Sales pipeline).</div>`;
      }
      if (branchName && d.branches.length > 1) {
        p += `<span style="font-size:9px;color:${T.darkGrey};margin-left:6px">${d.branches.length} locations</span>`;
      }

      if (d.deal_breakdown && d.deal_breakdown.length > 0) {
        for (const ln of d.deal_breakdown) {
          p += row(ln.product || "Deal", ln.amount ? "$" + ln.amount.toLocaleString() : "$0");
        }
        if (d.deal_breakdown.length > 1 && d.amount) {
          p += `<div style="font-size:11px;color:${T.slateBlack};margin-top:3px;font-weight:700"><strong>Cumulative Deal Value:</strong> $${d.amount.toLocaleString()}</div>`;
        }
      } else if (d.amount) {
        p += row("Deal Value", "$" + d.amount.toLocaleString());
      }
      if (d.city || d.state) p += row("HQ Location", [d.address, d.city, d.state, d.zip].filter(Boolean).join(", "));
      if (d.country) p += row("Country", d.country);
      p += divider;
      if (d.industry) p += row("Industry", d.industry);
      if (d.employees) p += row("Employees", d.employees.toLocaleString());
      if (d.revenue) p += row("Annual Revenue", fmtRev(d.revenue));
      if (d.erp) p += row("ERP", d.erp);
      if (d.product) p += row("Products", d.product);
      if (d.arr) p += row("ARR", fmtMoney(d.arr));
      if (d.num_locations) p += row("# Locations", d.num_locations.toLocaleString());
      if (d.buying_group) p += row("Buying Group", d.buying_group);
      if (d.territory) p += row("Territory", d.territory);
      if (d.status === "Customer" || d.surcharge_source) {
        p += row(
          "Surcharging",
          formatSurchargeSummary({
            orders_enabled: d.surcharge_orders ?? null,
            payments_enabled: d.surcharge_payments ?? null,
            orders_rate_pct: d.surcharge_orders_rate_pct ?? null,
            payments_rate_pct: d.surcharge_payments_rate_pct ?? null,
            source: d.surcharge_source ?? null,
          }),
        );
      }
      p += divider;
      if (d.owner) p += row("Owner", d.owner);
      if (d.won_date) p += row("Earliest Won Date", fmtDate(d.won_date));
      if (d.created) p += row("Earliest Created Date", fmtDate(d.created));
      if (d.phone) p += row("Phone", d.phone);
      if (d.website || d.domain) {
        const url = d.website?.startsWith("http") ? d.website : d.website ? "https://" + d.website : "#";
        p += row("Web", `<a href="${url}" target="_blank" style="color:${T.seaweed}">${d.domain || d.website}</a>`);
      }
      if (d.hubspot_company_id) {
        const hsUrl = `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-2/${d.hubspot_company_id}`;
        p += row(
          "HubSpot",
          `<a href="${hsUrl}" target="_blank" rel="noopener noreferrer" style="color:${T.seaweed}">Open company record</a>`,
        );
      }

      // Nearby companies
      if (d.lat && d.lng) {
        const nearby = filtered
          .filter((o) => o.company !== d.company && o.lat && o.lng)
          .map((o) => ({ ...o, dist: haversineKm(d.lat!, d.lng!, o.lat!, o.lng!) }))
          .filter((o) => o.dist <= 80)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5);
        if (nearby.length > 0) {
          p += divider;
          p += `<div style="font-size:10px;font-weight:700;color:${T.slateBlack};margin-bottom:4px">Nearby Companies (within 80 km)</div>`;
          for (const n of nearby) {
            const nc = STAGE_COLORS[n.stage] || T.darkGrey;
            p += `<div style="font-size:10px;margin-bottom:2px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${nc};margin-right:4px"></span><span style="color:${T.slateBlack}">${n.company}</span> <span style="color:${T.darkGrey}">${Math.round(n.dist)} km · ${n.stage}</span></div>`;
          }
        }
      }

      return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${p}</div>`;
    }

    function addMarker(lat: number, lng: number, d: Deal, branchName?: string) {
      heatPoints.push([lat, lng, 0.5]);
      if (showHeat) return;
      const col = STAGE_COLORS[d.stage] || T.silverGrey;
      const icon = L.divIcon({
        html: `<div style="width:13px;height:13px;background:${col};border-radius:50%;border:2px solid rgba(255,255,255,0.4);box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
        className: "",
        iconSize: [13, 13] as [number, number],
        iconAnchor: [6.5, 6.5] as [number, number],
      });
      const m = L.marker([lat, lng], { icon, dd: d });
      m.bindPopup(buildPopup(d, branchName), { maxWidth: 340 });
      newMarkers.push(m);
      clusterRef.current!.addLayer(m);
    }

    for (const d of filtered) {
      if (d.branches && d.branches.length > 1) {
        let placed = false;
        for (const br of d.branches) {
          if (br.lat && br.lng) { addMarker(br.lat, br.lng, d, br.branch_name); placed = true; }
        }
        if (!placed && d.lat && d.lng) addMarker(d.lat, d.lng, d);
      } else {
        if (d.lat && d.lng) addMarker(d.lat, d.lng, d);
      }
    }

    if (showHeat && heatPoints.length > 0 && (L as any).heatLayer) {
      heatRef.current = (L as any).heatLayer(heatPoints, {
        radius: 25, blur: 20, maxZoom: 10, max: 1.0,
        gradient: { 0.2: T.skyBlue, 0.4: T.seaweed, 0.6: T.sunriseYellow, 0.8: T.overEasy, 1.0: "#FF4444" },
      }).addTo(map);
    }

    markersRef.current = newMarkers;
  }, [filtered, mapReady, showHeat]);

  // Territory fill toggle (boundaries stay on map)
  useEffect(() => {
    if (!mapReady || !territoryRef.current) return;
    territoryRef.current.setStyle((feature: any) => {
      const label = regionLabelFromFeature(feature);
      const terr = label ? salesTerritoryForRegion(label) : undefined;
      const showFill = showTerritories;
      return {
        color: terr ? TERRITORY_COLORS[terr] : ADMIN_BORDER_COLOR,
        weight: ADMIN_BORDER_WEIGHT,
        opacity: 0.95,
        fillColor: showFill && terr ? TERRITORY_COLORS[terr] : "transparent",
        fillOpacity: showFill && terr ? 0.18 : 0,
      };
    });
  }, [showTerritories, mapReady]);

  // Big box stores overlay (static JSON)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !leafletRef.current || !bigBoxClusterRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const bigCg = bigBoxClusterRef.current;

    const buildMarkers = async () => {
      type Row = { chain: string; name: string; lat: number; lng: number; address?: string };
      bigCg.clearLayers();
      async function loadBigBoxJson(): Promise<string | null> {
        const urls = ["/api/bigbox", "/api/big-box-stores", "/big-box-stores.json"];
        for (const u of urls) {
          const r = await fetch(u, { cache: "no-store" });
          const t = r.ok ? await r.text() : "";
          if (r.ok && !t.trimStart().startsWith("<!")) return t;
        }
        return null;
      }
      const rawText = await loadBigBoxJson();
      if (rawText === null) {
        setBigBoxLoadedCount(0);
        return;
      }
      let payload: { stores?: Row[] };
      try {
        payload = JSON.parse(rawText) as { stores?: Row[] };
      } catch {
        setBigBoxLoadedCount(0);
        return;
      }
      const stores: Row[] = payload.stores || [];
      let added = 0;
      for (const s of stores) {
        if (typeof s.lat !== "number" || typeof s.lng !== "number") continue;
        const icon = L.divIcon({
          html: `<div style="width:11px;height:11px;background:${BIG_BOX_ORANGE};border-radius:50%;border:2px solid rgba(255,255,255,0.45);box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
          className: "",
          iconSize: [11, 11] as [number, number],
          iconAnchor: [5.5, 5.5] as [number, number],
        });
        const m = L.marker([s.lat, s.lng], { icon });
        const detail = (s.address && s.address.trim()) || s.name || "";
        const tip =
          `<div style="font-weight:700">${escapeHtml(s.chain)}</div>` +
          `<div style="font-size:11px;opacity:0.95;margin-top:4px;max-width:260px;line-height:1.35">${escapeHtml(detail)}</div>`;
        m.bindTooltip(tip, { sticky: true, direction: "top", opacity: 1, className: "bigbox-tooltip" });
        m.bindPopup(tip, { maxWidth: 300 });
        bigCg.addLayer(m);
        added++;
      }
      setBigBoxLoadedCount(added);
    };

    void (async () => {
      if (!showBigBoxStores) {
        setBigBoxLoadedCount(null);
        if (map.hasLayer(bigCg)) map.removeLayer(bigCg);
        return;
      }
      await buildMarkers();
      if (!map.hasLayer(bigCg)) bigCg.addTo(map);
    })();
  }, [showBigBoxStores, mapReady]);

  const flyTo = useCallback((lat: number, lng: number) => {
    if (!mapRef.current) return;
    mapRef.current.setView([lat, lng], 13);
    setTimeout(() => {
      markersRef.current.forEach((m) => {
        const dd = (m.options as any).dd;
        if (dd?.lat === lat && dd?.lng === lng) m.openPopup();
      });
    }, 400);
  }, []);

  const toggleStage = (stage: string) => {
    setActiveStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      return next;
    });
  };

  const resetAll = () => {
    setSearch("");
    setActiveStages(new Set(DEFAULT_STAGES));
    setFilters({ ...DEFAULT_FILTERS });
    setShowBigBoxStores(false);
    mapRef.current?.setView([39.5, -98.5], 4);
  };

  const setFilter = (key: string, val: string) => setFilters((p) => ({ ...p, [key]: val }));

  const sortedResults = useMemo(
    () => [...filtered].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")),
    [filtered]
  );

  const exportToExcel = useCallback(() => {
    const rows = sortedResults.map((d) => ({
      Company: d.company || d.name,
      Stage: d.stage,
      Source: d.record_source === "company" ? "Company record" : "Deal",
      City: d.city,
      "State/Province": d.state,
      "Deal Value": d.amount || 0,
      Employees: d.employees || "",
      "Revenue Range": d.rev_range,
      "HubSpot company ID": d.hubspot_company_id || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, `TOOLBX_Sales_Heatmap_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [sortedResults]);

  const shareUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: T.slateBlack }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: `${T.sunriseYellow} transparent ${T.sunriseYellow} ${T.sunriseYellow}` }} />
          <p style={{ color: T.silverGrey }} className="text-sm">Loading heatmap data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center px-6" style={{ background: T.slateBlack }}>
        <div className="text-center max-w-md">
          <p className="text-sm font-semibold mb-2" style={{ color: T.sunriseYellow }}>Could not load map data</p>
          <p className="text-[12px] mb-4" style={{ color: T.silverGrey }}>{loadError}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setLoadError(null); window.location.reload(); }}
            className="text-[12px] px-4 py-2 rounded-md font-semibold"
            style={{ background: T.sunriseYellow, color: T.slateBlack }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative" style={{ background: T.slateBlack }}>
      {(dataSource === "snapshot" || dataSource === "bundled") && (
        <div
          className="absolute top-0 left-0 right-0 z-[1200] px-4 py-2 text-center text-[11px]"
          style={{ background: `${T.overEasy}22`, color: T.overEasy, borderBottom: `1px solid ${T.overEasy}55` }}
        >
          Live API unavailable — showing cached data ({updatedAt ? updatedAt.slice(0, 10) : "snapshot"}).
          Redeploy Vercel from <span className="font-mono">main</span> to restore live HubSpot sync.
        </div>
      )}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Mobile hamburger */}
      {isMobile && !panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute top-3 left-3 z-[1100] p-2 rounded-lg"
          style={{ background: `${T.slateBlack}e6`, border: `1px solid ${T.darkGrey}60` }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect y="3" width="20" height="2" rx="1" fill={T.silverGrey} />
            <rect y="9" width="20" height="2" rx="1" fill={T.silverGrey} />
            <rect y="15" width="20" height="2" rx="1" fill={T.silverGrey} />
          </svg>
        </button>
      )}

      {/* Controls Panel */}
      {panelOpen && (
        <div
          className={`absolute top-0 md:top-3 left-0 md:left-14 z-[1000] backdrop-blur-xl md:rounded-xl p-4 shadow-2xl overflow-y-auto ${
            isMobile ? "w-full h-full" : "w-[360px] max-h-[calc(100vh-24px)] rounded-xl"
          }`}
          style={{ background: `${T.slateBlack}f0`, border: isMobile ? "none" : `1px solid ${T.darkGrey}60` }}
        >
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold" style={{ color: T.white }}>TOOLBX Sales Heatmap</h1>
              <div className="w-2 h-2 rounded-full" style={{ background: T.sunriseYellow }} />
            </div>
            {isMobile && (
              <button onClick={() => setPanelOpen(false)} className="text-lg px-2" style={{ color: T.silverGrey }}>&times;</button>
            )}
          </div>
          <p className="text-[11px] mb-1" style={{ color: T.darkGrey }}>
            Live from HubSpot
            {updatedAt && (
              <span>
                {" "}&middot; Updated{" "}
                {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
          <p className="text-[10px] mb-3 leading-relaxed" style={{ color: T.silverGrey }}>
          Explore prospects in the sales pipeline as well as existing customers through an interactive map.
          </p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, city, state, zip, industry, ERP..."
            className="w-full px-3 py-2 rounded-lg text-[13px] outline-none mb-3"
            style={{ border: `1px solid ${T.darkGrey}`, background: T.darkSlate, color: T.lightGrey }}
          />

          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.darkGrey }}>
            Lifecycle Stage
          </p>
          <div className="flex flex-wrap gap-1 mb-3">
            {allStages.map((s) => {
              const active = activeStages.has(s);
              const col = STAGE_COLORS[s] || T.darkGrey;
              return (
                <button key={s} onClick={() => toggleStage(s)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all"
                  style={{
                    borderColor: active ? col : `${T.darkGrey}50`,
                    color: active ? col : T.darkGrey,
                    background: active ? col + "20" : `${T.darkSlate}80`,
                  }}
                >{s}</button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowBigBoxStores((v) => !v)}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all"
              style={{
                borderColor: showBigBoxStores ? BIG_BOX_ORANGE : `${T.darkGrey}50`,
                color: showBigBoxStores ? BIG_BOX_ORANGE : T.darkGrey,
                background: showBigBoxStores ? BIG_BOX_ORANGE + "20" : `${T.darkSlate}80`,
              }}
            >{BIG_BOX_LABEL}</button>
          </div>
          {showBigBoxStores && bigBoxLoadedCount !== null && (
            <p className="text-[10px] leading-snug mb-3 -mt-1" style={{ color: T.seaweed }}>
              Big box overlay: <strong style={{ color: T.white }}>{bigBoxLoadedCount.toLocaleString()}</strong> locations
              {bigBoxLoadedCount > 0 && (
                <span style={{ color: T.darkGrey }}> — zoom in; orange circles are clusters (many stores each).</span>
              )}
              {bigBoxLoadedCount === 0 && (
                <span style={{ color: T.darkGrey }}> — No store data. Ensure <span className="font-mono text-[9px]">public/big-box-stores.json</span> is committed and redeploy, or run <span className="font-mono text-[9px]">npm run fetch-big-box</span>.</span>
              )}
            </p>
          )}

          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.darkGrey }}>
            Company Profile
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <SelectFilter id="fEmp" label="Employees" options={EMP_RANGES} value={filters.employees} onChange={(v) => setFilter("employees", v)} disabled />
            <SelectFilter id="fRev" label="Revenue" options={REV_RANGES} value={filters.revenue} onChange={(v) => setFilter("revenue", v)} disabled />
            <SelectFilter id="fInd" label="Industries" options={filterOptions.industries} value={filters.industry} onChange={(v) => setFilter("industry", v)} />
            <SelectFilter id="fProd" label="Products" options={filterOptions.products} value={filters.product} onChange={(v) => setFilter("product", v)} />
            <SelectFilter id="fERP" label="ERP Systems" options={filterOptions.erps} value={filters.erp} onChange={(v) => setFilter("erp", v)} />
            <SelectFilter id="fCountry" label="Countries" options={filterOptions.countries} value={filters.country} onChange={(v) => setFilter("country", v)} />
            <SelectFilter id="fBG" label="Buying Groups" options={filterOptions.buyingGroups} value={filters.buyingGroup} onChange={(v) => setFilter("buyingGroup", v)} />
            <SelectFilter id="fTerritory" label="Territories" options={filterOptions.territories} value={filters.territory} onChange={(v) => setFilter("territory", v)} />
            <SelectFilter id="fARR" label="ARR" options={ARR_RANGES} value={filters.arr} onChange={(v) => setFilter("arr", v)} />
            <SelectFilter id="fLoc" label="# of Locations" options={LOC_RANGES} value={filters.locations} onChange={(v) => setFilter("locations", v)} />
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.darkGrey }}>
            Location &amp; Deal
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <SelectFilter id="fState" label="States/Provinces" options={filterOptions.states} value={filters.state} onChange={(v) => setFilter("state", v)} />
            <SelectFilter id="fOwner" label="Owners" options={filterOptions.owners} value={filters.owner} onChange={(v) => setFilter("owner", v)} />
            <SelectFilter id="fAmt" label="Deal Sizes" options={AMT_RANGES} value={filters.amount} onChange={(v) => setFilter("amount", v)} />
            <SelectFilter id="fCumAmt" label="Cumulative Deal Value" options={AMT_RANGES} value={filters.cumAmount} onChange={(v) => setFilter("cumAmount", v)} />
            <SelectFilter id="fWon" label="Won Since" options={TIME_RANGES} value={filters.wonSince} onChange={(v) => setFilter("wonSince", v)} />
            <SelectFilter id="fCreated" label="Created Since" options={TIME_RANGES} value={filters.createdSince} onChange={(v) => setFilter("createdSince", v)} />
          </div>

          <div className="flex gap-1.5 mb-2">
            <button onClick={resetAll}
              className="flex-1 px-2 py-1.5 rounded-md text-[11px] transition-all hover:opacity-80"
              style={{ border: `1px solid ${T.darkGrey}`, background: T.darkSlate, color: T.silverGrey }}>
              Reset All
            </button>
            <button onClick={shareUrl}
              className="px-3 py-1.5 rounded-md text-[11px] transition-all hover:opacity-80"
              style={{ border: `1px solid ${T.seaweed}60`, background: `${T.seaweed}15`, color: T.seaweed }}>
              Copy Link
            </button>
            <a href="/campaigns"
              className="px-3 py-1.5 rounded-md text-[11px] transition-all hover:opacity-80"
              style={{ border: `1px solid ${T.overEasy}60`, background: `${T.overEasy}15`, color: T.overEasy }}>
              Campaigns
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[
              { label: "Total", value: stats.total, sub: `${stats.mapped} on map`, color: T.white },
              { label: "Pipeline", value: fmtMoney(stats.val), color: T.sunriseYellow },
              { label: "Customers", value: stats.custs, color: T.sunriseYellow },
              { label: "Prospects", value: stats.prosps, color: T.seaweed },
            ].map((s) => (
              <div key={s.label} className="rounded-lg p-2"
                style={{ background: `${T.darkSlate}90`, border: `1px solid ${T.darkGrey}30` }}>
                <p className="text-[9px] uppercase tracking-wide" style={{ color: T.darkGrey }}>{s.label}</p>
                <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                {"sub" in s && s.sub && (
                  <p className="text-[8px]" style={{ color: T.darkGrey }}>{s.sub}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.darkGrey }}>Results</p>
            <button onClick={exportToExcel}
              className="px-2 py-0.5 rounded text-[9px] font-semibold transition-all hover:opacity-80"
              style={{ border: `1px solid ${T.seaweed}60`, background: `${T.seaweed}15`, color: T.seaweed }}>
              Export Excel
            </button>
          </div>
          <div className={isMobile ? "max-h-[40vh] overflow-y-auto" : "max-h-[220px] overflow-y-auto"}>
            {sortedResults.slice(0, 80).map((d, i) => {
              const hasLocation = !!(d.lat && d.lng);
              return (
                <div key={i}
                  onClick={() => { if (hasLocation) { flyTo(d.lat!, d.lng!); if (isMobile) setPanelOpen(false); } }}
                  className={`p-2 rounded-md border border-transparent mb-0.5 transition-all ${hasLocation ? "cursor-pointer" : "opacity-50"}`}
                  onMouseEnter={(e) => { if (hasLocation) { e.currentTarget.style.background = `${T.seaweed}15`; e.currentTarget.style.borderColor = `${T.seaweed}30`; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <p className="font-semibold text-[12px]" style={{ color: STAGE_COLORS[d.stage] || T.lightGrey }}>
                    {d.company || d.name}
                    {!hasLocation && <span className="text-[9px] ml-1.5 font-normal" style={{ color: T.darkGrey }}>(no location)</span>}
                  </p>
                  <p className="text-[10px] leading-relaxed" style={{ color: T.darkGrey }}>
                    {d.stage + " · "}
                    {[d.city, d.state].filter(Boolean).join(", ")}
                    {d.amount ? " · $" + d.amount.toLocaleString() : ""}
                    {d.employees ? " · " + d.employees + " emp" : ""}
                    {d.rev_range ? " · " + d.rev_range + " rev" : ""}
                  </p>
                </div>
              );
            })}
            {filtered.length > 80 && (
              <p className="text-center text-[10px] py-2" style={{ color: T.darkGrey }}>{filtered.length - 80} more not shown</p>
            )}
          </div>
        </div>
      )}

      {/* Map overlay controls */}
      <div className={`absolute ${isMobile ? "top-3 right-3" : "top-3 right-4"} z-[1000] flex gap-1.5`}>
        <button
          onClick={() => setShowHeat(!showHeat)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
          style={{
            background: showHeat ? `${T.seaweed}` : `${T.slateBlack}e6`,
            color: showHeat ? T.white : T.silverGrey,
            border: `1px solid ${showHeat ? T.seaweed : T.darkGrey}60`,
          }}
        >
          {showHeat ? "Pins" : "Heatmap"}
        </button>
        <button
          onClick={() => setShowTerritories(!showTerritories)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
          style={{
            background: showTerritories ? `${T.seaweed}` : `${T.slateBlack}e6`,
            color: showTerritories ? T.white : T.silverGrey,
            border: `1px solid ${showTerritories ? T.seaweed : T.darkGrey}60`,
          }}
        >
          Territories
        </button>
      </div>

      {/* Legend */}
      <div
        className={`absolute ${isMobile ? "bottom-3 left-3" : "bottom-5 right-4"} z-[1000] rounded-lg p-3 text-[11px]`}
        style={{ background: `${T.slateBlack}e6`, border: `1px solid ${T.darkGrey}60` }}
      >
        {allStages.map((stage) => (
          <div key={stage} className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLORS[stage] || T.darkGrey }} />
            <span style={{ color: T.silverGrey }}>{stage}</span>
          </div>
        ))}
        {showTerritories && (
          <>
            <div style={{ borderTop: `1px solid ${T.darkGrey}40`, margin: "6px 0" }} />
            {Object.entries(TERRITORY_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded" style={{ background: color, opacity: 0.5 }} />
                <span style={{ color: T.silverGrey }}>{name}</span>
              </div>
            ))}
          </>
        )}
        {showBigBoxStores && (
          <>
            <div style={{ borderTop: `1px solid ${T.darkGrey}40`, margin: "6px 0" }} />
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: BIG_BOX_ORANGE }} />
              <span style={{ color: T.silverGrey }}>{BIG_BOX_LABEL}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
