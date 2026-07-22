"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Responsive, useContainerWidth, noCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const freeNoOverlap = { ...noCompactor, preventCollision: true } as const;
import type {
  CampaignDashboardData,
  CampaignMember,
  CompanyContactLabel,
  ClosedWonByOwner,
  WinRateByOwner,
  AssociatedCompany,
  OpportunityByOwner,
  ClosedLostReason,
} from "@/lib/types";

const ADMIN_PASSWORD = "toolbx2026";
const LAYOUT_STORAGE_KEY = "events-dashboard-layout-v2";
const HIDDEN_WIDGETS_KEY = "events-dashboard-hidden-widgets";
const CUSTOM_NAMES_KEY = "events-dashboard-custom-names";

type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };

const WIDGET_LABELS: Record<string, string> = {
  "company-funnel-kpi": "Targeted Companies",
  "company-contacted-kpi": "Engaged Companies",
  "company-noncustomer-kpi": "Engaged Non-Customer Companies",
  "contact-targeted-kpi": "All Campaign Contacts",
  "contact-engaged-kpi": "Engaged Contacts",
  "contact-noncustomer-kpi": "Engaged Non-Customer Contacts",
  "contact-postcampaign-kpi": "Engaged Non-Customer Contacts Followed Up With",
  "closed-won": "Closed Won ARR & Deals",
  "win-rate": "Avg Win Rate by Deal Owner",
  "opps-by-rep": "Opportunities Created by Rep",
  "efficiency-kpis": "Efficiency KPIs",
  "closed-lost": "Closed Lost Reasons",
  "follow-up-days": "Avg Days to Follow Up",
  "kpi-strip": "Key Metrics",
  "status-table": "Member Status Breakdown",
  "conversion-panel": "Conversion & Labels",
  "members-table": "All Deals on the Database",
  "contacts-needing-followup": "Contacts Needing Follow Up",
  "companies-followed-up-kpi": "Companies Followed Up With",
  "companies-needing-followup": "Companies Needing Follow Up",
};

const WIDGET_TOOLTIPS: Record<string, string> = {
  "company-funnel-kpi": "Total companies associated with this GTM Campaign via HubSpot v4 associations (object type 0-2).",
  "company-contacted-kpi": "Companies that have at least one contact with the 'Engaged' association label on this GTM Campaign. CVR = this count / all campaign companies.",
  "company-noncustomer-kpi": "Engaged companies whose company lifecyclestage is not 'customer'. CVR = this count / engaged companies.",
  "contact-targeted-kpi": "All contacts associated with this GTM Campaign regardless of association label (Targeted, Engaged, or unlabeled).",
  "contact-engaged-kpi": "Contacts with the 'Engaged' association label on this GTM Campaign. CVR = this count / all campaign contacts.",
  "contact-noncustomer-kpi": "Engaged contacts whose associated company's lifecyclestage is not 'customer'. CVR = this count / engaged contacts.",
  "contact-postcampaign-kpi": "Engaged non-customer contacts with correspondence or sales activity after the campaign end date. Uses the latest of notes_last_contacted, email replies, and sales activity timestamps. CVR = this count / engaged non-customers.",
  "closed-won": "Closed-won deal Annual Recurring Revenue (hs_arr) and count, grouped by deal owner.",
  "win-rate": "Win rate per deal owner: closed-won deals / total deals with a stage. Average shown across all owners.",
  "opps-by-rep": "All deals on this campaign grouped by deal owner. Amount uses Annual Recurring Revenue (hs_arr).",
  "efficiency-kpis": "Campaign ROI: revenue per $ spent, cost per closed-won deal, actual cost vs. budgeted cost. Sourced from GTM Campaign properties.",
  "closed-lost": "Deals marked closed-lost on this campaign, grouped by closed_lost_reason__c property.",
  "follow-up-days": "Average days between campaign end date and the most recent correspondence/sales activity for engaged contacts who were followed up. Excludes contacts not yet contacted.",
  "kpi-strip": "Summary KPIs: targeted companies (from Redshift), campaign members, closed-won ARR and deal count.",
  "status-table": "Campaign member status breakdown with engagement and post-campaign activity counts.",
  "conversion-panel": "Conversion from targeted companies to contacted, plus single vs. multi-contact label split.",
  "members-table": "Full list of all campaign members with status, engagement, and activity details.",
  "contacts-needing-followup": "Engaged non-customer contacts minus those with correspondence or sales activity after campaign end date. Grouped by contact owner.",
  "companies-followed-up-kpi": "Non-customer companies where at least one campaign contact (any label) has correspondence or sales activity after the campaign end date. CVR = this count / non-customer companies.",
  "companies-needing-followup": "Non-customer companies minus those in 'Companies Followed Up With'. No campaign contact at the company has correspondence or sales activity post-campaign. Grouped by company owner.",
};

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "closed-won", x: 0, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
  { i: "win-rate", x: 6, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
  { i: "company-funnel-kpi", x: 0, y: 8, w: 2, h: 4, minW: 2, minH: 3 },
  { i: "company-contacted-kpi", x: 2, y: 8, w: 2, h: 4, minW: 2, minH: 3 },
  { i: "company-noncustomer-kpi", x: 4, y: 8, w: 2, h: 4, minW: 2, minH: 3 },
  { i: "companies-followed-up-kpi", x: 6, y: 8, w: 3, h: 4, minW: 2, minH: 3 },
  { i: "companies-needing-followup", x: 9, y: 8, w: 3, h: 8, minW: 3, minH: 5 },
  { i: "contact-targeted-kpi", x: 0, y: 12, w: 2, h: 4, minW: 2, minH: 3 },
  { i: "contact-engaged-kpi", x: 2, y: 12, w: 2, h: 4, minW: 2, minH: 3 },
  { i: "contact-noncustomer-kpi", x: 4, y: 12, w: 2, h: 4, minW: 2, minH: 3 },
  { i: "contact-postcampaign-kpi", x: 6, y: 12, w: 3, h: 4, minW: 2, minH: 3 },
  { i: "contacts-needing-followup", x: 9, y: 12, w: 3, h: 8, minW: 3, minH: 5 },
  { i: "opps-by-rep", x: 0, y: 16, w: 4, h: 8, minW: 3, minH: 6 },
  { i: "closed-lost", x: 4, y: 16, w: 4, h: 8, minW: 3, minH: 6 },
  { i: "follow-up-days", x: 8, y: 16, w: 4, h: 8, minW: 3, minH: 4 },
  { i: "efficiency-kpis", x: 0, y: 24, w: 12, h: 5, minW: 6, minH: 4 },
  { i: "kpi-strip", x: 0, y: 29, w: 12, h: 4, minW: 6, minH: 3 },
  { i: "status-table", x: 0, y: 33, w: 8, h: 8, minW: 4, minH: 5 },
  { i: "conversion-panel", x: 8, y: 33, w: 4, h: 8, minW: 3, minH: 5 },
  { i: "members-table", x: 0, y: 41, w: 12, h: 12, minW: 6, minH: 6 },
];

type MetricKey =
  | "targeted_companies"
  | "total_contacts"
  | "companies_with_contacts"
  | "single_contact_companies"
  | "multi_contact_companies"
  | "deals_in_campaign"
  | "closed_won_deals"
  | "engaged_at_event"
  | "engaged_pre_event"
  | "post_campaign_activity"
  | "unworked_contacts"
  | "associated_companies"
  | "contacted_companies"
  | "targeted_contacts"
  | "engaged_contacts"
  | "engaged_non_customers"
  | "post_campaign_active"
  | "contacts_needing_follow_up";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function getUnworkedContacts(members: CampaignMember[]): CampaignMember[] {
  return members.filter(
    (m) => m.days_since_last_activity === null || m.days_since_last_activity > 7
  );
}

function getFilteredContacts(data: CampaignDashboardData, metricKey: MetricKey): CampaignMember[] {
  switch (metricKey) {
    case "single_contact_companies":
      return data.company_labels.filter((c) => c.label === "Single Contact").flatMap((c) => c.contacts);
    case "multi_contact_companies":
      return data.company_labels.filter((c) => c.label === "Multi Contact").flatMap((c) => c.contacts);
    case "engaged_at_event":
      return data.members.filter((m) => m.engaged_at_event);
    case "engaged_pre_event":
      return data.members.filter((m) => m.engaged_pre_event);
    case "post_campaign_activity":
      return data.members.filter((m) => m.has_post_campaign_activity);
    case "unworked_contacts":
      return getUnworkedContacts(data.members);
    case "targeted_contacts":
      return data.targeted_contacts;
    case "engaged_contacts":
      return data.engaged_contacts;
    case "engaged_non_customers":
      return data.engaged_non_customers;
    case "post_campaign_active":
      return data.post_campaign_active;
    case "contacts_needing_follow_up":
      return data.contacts_needing_follow_up;
    default:
      return data.members;
  }
}

function getFilteredCompanies(data: CampaignDashboardData, metricKey: MetricKey): CompanyContactLabel[] {
  switch (metricKey) {
    case "single_contact_companies":
      return data.company_labels.filter((c) => c.label === "Single Contact");
    case "multi_contact_companies":
      return data.company_labels.filter((c) => c.label === "Multi Contact");
    default:
      return data.company_labels;
  }
}

async function exportToExcel(rows: Record<string, string | number | boolean | null>[], filename: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function exportContacts(contacts: CampaignMember[], campaignName: string, label: string) {
  const rows = contacts.map((c) => ({
    Name: c.name, "First Name": c.firstname, "Last Name": c.lastname,
    Email: c.email, Company: c.company, Owner: c.owner_name || "", Status: c.status,
    "Lead/Contact Status": c.lead_contact_status,
    "Engaged At Event": c.engaged_at_event ? "Yes" : "No",
    "Engaged Pre Event": c.engaged_pre_event ? "Yes" : "No",
    "Post Campaign Activity": c.has_post_campaign_activity ? "Yes" : "No",
    "Days Since Last Activity": c.days_since_last_activity,
  }));
  exportToExcel(rows, `${campaignName} - ${label}`);
}

function exportAssociatedCompanies(companies: AssociatedCompany[], campaignName: string, label: string) {
  const rows = companies.map((c) => ({
    Company: c.name, Domain: c.domain, Industry: c.industry,
    City: c.city, State: c.state, Owner: c.owner_name || "",
    ...(c.contact_label ? { "Contact Label": c.contact_label } : {}),
  }));
  exportToExcel(rows, `${campaignName} - ${label}`);
}

function exportCompanies(companies: CompanyContactLabel[], campaignName: string, label: string) {
  const rows = companies.map((c) => ({
    Company: c.company, Label: c.label, "# Contacts": c.contacts.length,
    Contacts: c.contacts.map((m) => m.name).join("; "),
    Emails: c.contacts.map((m) => m.email).filter(Boolean).join("; "),
  }));
  exportToExcel(rows, `${campaignName} - ${label} (Companies)`);
}

/* ═══════════════════════════════════════════════════
   SIDEBAR NAV ITEMS
   ═══════════════════════════════════════════════════ */
const NAV_SECTIONS = [
  {
    title: "GENERAL",
    items: [
      { label: "Dashboard", href: "/campaigns", icon: "grid", active: true },
      { label: "Sales Map", href: "/", icon: "map" },
    ],
  },
  {
    title: "DATA",
    items: [
      { label: "Campaigns", href: "/campaigns", icon: "flag" },
      { label: "Companies", href: "#", icon: "building" },
      { label: "Contacts", href: "#", icon: "users" },
    ],
  },
];

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function CampaignDashboard() {
  const [data, setData] = useState<CampaignDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [modal, setModal] = useState<{ title: string; metricKey: MetricKey } | null>(null);
  const [companyModal, setCompanyModal] = useState<{ title: string; companies: AssociatedCompany[] } | null>(null);
  const [activeTab, setActiveTab] = useState<"contacts" | "companies">("contacts");
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState<Record<string, LayoutItem[]> | null>(null);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [showRestoreMenu, setShowRestoreMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const initialLoadDone = useRef(false);
  const { width: containerWidth, containerRef } = useContainerWidth();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored) setSavedLayouts(JSON.parse(stored));
      const hidden = localStorage.getItem(HIDDEN_WIDGETS_KEY);
      if (hidden) setHiddenWidgets(JSON.parse(hidden));
      const names = localStorage.getItem(CUSTOM_NAMES_KEY);
      if (names) setCustomNames(JSON.parse(names));
    } catch { /* ignore */ }
  }, []);

  const currentLayouts = useMemo(() => {
    const filterHidden = (items: LayoutItem[]) => items.filter((l) => !hiddenWidgets.includes(l.i));

    function mergeNewWidgets(saved: LayoutItem[]): LayoutItem[] {
      const existingKeys = new Set(saved.map((l) => l.i));
      const missing = DEFAULT_LAYOUT.filter((l) => !existingKeys.has(l.i));
      return [...saved, ...missing];
    }

    const lg = filterHidden(savedLayouts?.lg ? mergeNewWidgets(savedLayouts.lg) : DEFAULT_LAYOUT);
    const md = filterHidden(savedLayouts?.md ? mergeNewWidgets(savedLayouts.md) : DEFAULT_LAYOUT.map((l) => ({ ...l, w: Math.min(l.w, 10) })));
    const sm = filterHidden(savedLayouts?.sm ? mergeNewWidgets(savedLayouts.sm) : DEFAULT_LAYOUT.map((l) => ({ ...l, x: 0, w: 6 })));
    return { lg, md, sm };
  }, [savedLayouts, hiddenWidgets]);

  function handleLayoutChange(_current: readonly LayoutItem[], allLayouts: Partial<Record<string, readonly LayoutItem[]>>) {
    if (!isAdmin) return;
    const mutable = Object.fromEntries(
      Object.entries(allLayouts).map(([k, v]) => [k, v ? [...v] : []])
    );
    setSavedLayouts(mutable);
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(mutable)); } catch { /* ignore */ }
  }

  function hideWidget(widgetKey: string) {
    const updated = [...hiddenWidgets, widgetKey];
    setHiddenWidgets(updated);
    try { localStorage.setItem(HIDDEN_WIDGETS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function restoreWidget(widgetKey: string) {
    const updated = hiddenWidgets.filter((k) => k !== widgetKey);
    setHiddenWidgets(updated);
    try { localStorage.setItem(HIDDEN_WIDGETS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
    if (updated.length === 0) setShowRestoreMenu(false);
  }

  function restoreAllWidgets() {
    setHiddenWidgets([]);
    try { localStorage.removeItem(HIDDEN_WIDGETS_KEY); } catch { /* ignore */ }
    setShowRestoreMenu(false);
  }

  function updateCustomName(widgetKey: string, name: string) {
    const updated = { ...customNames, [widgetKey]: name };
    if (!name) delete updated[widgetKey];
    setCustomNames(updated);
    try { localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function getWidgetName(widgetKey: string): string {
    return customNames[widgetKey] || WIDGET_LABELS[widgetKey] || widgetKey;
  }

  function handleAdminToggle() {
    if (isAdmin) { setIsAdmin(false); return; }
    setShowPasswordPrompt(true);
    setPasswordInput("");
    setPasswordError(false);
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true); setShowPasswordPrompt(false); setPasswordInput(""); setPasswordError(false);
    } else { setPasswordError(true); }
  }

  const loadData = useCallback(async (campaignId?: string) => {
    try {
      if (campaignId) setLoadingMembers(true); else setLoading(true);
      const url = campaignId ? `/api/campaign-dashboard?campaignId=${campaignId}` : "/api/campaign-dashboard";
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (err) { console.error("Failed to load campaign data:", err); }
    finally { setLoading(false); setLoadingMembers(false); }
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("campaignId") || "";
    if (id) { setSelectedCampaignId(id); loadData(id); } else { loadData(); }
  }, [loadData]);

  function handleCampaignChange(id: string) {
    setSelectedCampaignId(id); setModal(null);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("campaignId", id); else url.searchParams.delete("campaignId");
    window.history.replaceState({}, "", url.toString());
    loadData(id || undefined);
  }

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function openModal(title: string, metricKey: MetricKey) {
    setModal({ title, metricKey }); setActiveTab("contacts");
  }

  function openCompanyModal(title: string, companies: AssociatedCompany[]) {
    setCompanyModal({ title, companies });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1C1C1E] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#FFCA05] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#CCCCCC] text-sm">Loading campaign data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#1C1C1E] flex items-center justify-center">
        <p className="text-red-400">Failed to load campaign data.</p>
      </div>
    );
  }

  const metrics = data.metrics;
  const selected = data.selected_campaign;
  const campaignName = selected?.campaign_name || "Campaign";

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#E5E5E5] flex">
      {/* ═══════ SIDEBAR ═══════ */}
      <aside className={`${sidebarCollapsed ? "w-16" : "w-56"} flex-shrink-0 bg-[#000000] border-r border-[#2D2D30]/60 flex flex-col transition-all duration-200 fixed h-full z-30`}>
        <div className="px-4 py-5 flex items-center justify-between border-b border-[#2D2D30]/40">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FFCA05] flex items-center justify-center text-black text-xs font-bold">T</div>
              <span className="text-sm font-semibold text-white tracking-wide">TOOLBX</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-[#494949] hover:text-white p-1 rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} /></svg>
          </button>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              {!sidebarCollapsed && <p className="px-4 text-[10px] font-semibold text-[#494949] uppercase tracking-widest mb-2">{section.title}</p>}
              {section.items.map((item) => (
                <a key={item.label} href={item.href}
                  className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-[13px] transition-colors ${item.active ? "bg-[#FFCA05]/10 text-[#FFCA05]" : "text-[#CCCCCC] hover:text-white hover:bg-[#2D2D30]/50"}`}>
                  <SidebarIcon name={item.icon} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="px-4 py-4 border-t border-[#2D2D30]/40 text-[10px] text-[#494949]">
            Last updated: {data ? new Date(data.updated_at).toLocaleTimeString() : "—"}
          </div>
        )}
      </aside>

      {/* ═══════ MAIN AREA ═══════ */}
      <div className={`flex-1 ${sidebarCollapsed ? "ml-16" : "ml-56"} transition-all duration-200 flex flex-col min-h-screen`}>
        {/* ── TOP BAR ── */}
        <header className="sticky top-0 z-20 bg-[#1C1C1E]/80 backdrop-blur-md border-b border-[#2D2D30]/40">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-white whitespace-nowrap">Events Follow-Up</h1>
              <CampaignTypeahead
                campaigns={data.campaigns}
                selectedId={selectedCampaignId}
                onSelect={handleCampaignChange}
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleAdminToggle} title={isAdmin ? "Lock layout" : "Edit layout"}
                className={`p-1.5 rounded-lg border transition-colors ${isAdmin ? "bg-[#EFB600]/20 border-[#EFB600]/40 text-[#EFB600]" : "bg-[#2D2D30]/50 border-[#494949]/40 text-[#CCCCCC] hover:text-white"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isAdmin
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />}
                </svg>
              </button>
              <button onClick={copyShareLink}
                className="p-1.5 rounded-lg bg-[#2D2D30]/50 border border-[#494949]/40 text-[#CCCCCC] hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              </button>
              {copied && <span className="text-[11px] text-[#FFCA05] animate-pulse">Copied!</span>}
            </div>
          </div>
          {data.campaign_details && selected && (
            <div className="px-6 py-2 border-t border-[#2D2D30]/30 flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
              {[
                { l: "Type", v: data.campaign_details.type },
                { l: "Approval", v: data.campaign_details.approval_status },
                { l: "Status", v: data.campaign_details.status },
                { l: "Channel", v: data.campaign_details.channel_entity },
                { l: "Start", v: data.campaign_details.start_date },
                { l: "End", v: data.campaign_details.end_date },
                { l: "Location", v: [data.campaign_details.city, data.campaign_details.state, data.campaign_details.country].filter(Boolean).join(", ") },
              ].filter((f) => f.v).map((f) => (
                <span key={f.l} className="text-[#494949]">{f.l}: <span className="text-[#CCCCCC]">{f.v}</span></span>
              ))}
            </div>
          )}
          {isAdmin && (
            <div className="px-6 py-2 bg-[#EFB600]/5 border-t border-[#EFB600]/10 flex items-center justify-between">
              <p className="text-[11px] text-[#EFB600]">Layout editing active — drag widget headers to move, resize from corners, or delete tiles</p>
              <div className="flex items-center gap-3">
                {hiddenWidgets.length > 0 && (
                  <div className="relative">
                    <button onClick={() => setShowRestoreMenu(!showRestoreMenu)}
                      className="text-[11px] text-[#FFCA05] hover:text-[#FFCA05] underline flex items-center gap-1">
                      Restore tiles ({hiddenWidgets.length})
                      <svg className={`w-3 h-3 transition-transform ${showRestoreMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showRestoreMenu && (
                      <div className="absolute right-0 top-6 bg-[#2D2D30] border border-[#494949]/60 rounded-lg shadow-xl py-1 z-50 min-w-[200px]">
                        {hiddenWidgets.map((key) => (
                          <button key={key} onClick={() => restoreWidget(key)}
                            className="w-full text-left px-3 py-2 text-[12px] text-[#CCCCCC] hover:bg-[#494949]/40 flex items-center gap-2">
                            <svg className="w-3 h-3 text-[#93C1C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            {WIDGET_LABELS[key] || key}
                          </button>
                        ))}
                        <div className="border-t border-[#494949]/40 mt-1 pt-1">
                          <button onClick={restoreAllWidgets}
                            className="w-full text-left px-3 py-2 text-[12px] text-[#FFCA05] hover:bg-[#494949]/40">
                            Restore all tiles
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => { setSavedLayouts(null); localStorage.removeItem(LAYOUT_STORAGE_KEY); }}
                  className="text-[11px] text-[#CCCCCC] hover:text-white underline">Reset layout</button>
              </div>
            </div>
          )}
        </header>

        {/* ── CONTENT ── */}
        <main ref={containerRef as React.Ref<HTMLDivElement>} className="flex-1 px-6 py-5">
          {showPasswordPrompt && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
              <form onSubmit={handlePasswordSubmit} className="bg-[#2D2D30] rounded-xl border border-[#494949] p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-lg font-semibold text-white mb-2">Admin Access</h3>
                <p className="text-sm text-[#CCCCCC] mb-4">Enter password to edit the dashboard layout.</p>
                <input type="password" value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                  placeholder="Password" autoFocus
                  className={`w-full px-4 py-2.5 bg-[#2D2D30] border rounded-lg text-white placeholder-[#494949] focus:outline-none focus:ring-2 focus:ring-[#FFCA05] text-sm mb-3 ${passwordError ? "border-red-500" : "border-[#494949]"}`} />
                {passwordError && <p className="text-red-400 text-xs mb-3">Incorrect password.</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowPasswordPrompt(false)} className="px-4 py-2 bg-[#2D2D30] text-[#CCCCCC] rounded-lg text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-[#457F86] hover:bg-[#457F86] text-white rounded-lg text-sm">Unlock</button>
                </div>
              </form>
            </div>
          )}

          {loadingMembers && (
            <div className="bg-[#2D2D30]/30 rounded-xl border border-[#494949]/40 p-12 mb-5 text-center">
              <div className="w-8 h-8 border-2 border-[#FFCA05] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#CCCCCC] text-sm">Loading campaign member data from HubSpot...</p>
            </div>
          )}

          {!selectedCampaignId && !loadingMembers && (
            <div className="bg-[#2D2D30]/20 rounded-xl border border-[#494949]/30 p-16 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-[#494949]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <p className="text-[#CCCCCC] text-base mb-1">Select a campaign to view metrics</p>
              <p className="text-[#494949] text-sm">{data.campaigns.length} campaigns available</p>
            </div>
          )}

          {metrics && !loadingMembers && (
            <Responsive
              className="layout"
              width={containerWidth || 1000}
              layouts={currentLayouts}
              breakpoints={{ lg: 1200, md: 768, sm: 0 }}
              cols={{ lg: 12, md: 10, sm: 6 }}
              rowHeight={30}
              dragConfig={{ enabled: isAdmin, handle: ".drag-handle" }}
              resizeConfig={{ enabled: isAdmin, handles: ["se"] }}
              onLayoutChange={handleLayoutChange}
              compactor={freeNoOverlap}
              margin={[14, 14] as const}
            >
              {/* ═══ COMPANY FUNNEL ═══ */}
              {!hiddenWidgets.includes("company-funnel-kpi") && (
                <div key="company-funnel-kpi">
                  <Widget title={getWidgetName("company-funnel-kpi")} widgetKey="company-funnel-kpi" tooltip={WIDGET_TOOLTIPS["company-funnel-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("company-funnel-kpi")} onRename={(n) => updateCustomName("company-funnel-kpi", n)}>
                    <FunnelKpi value={metrics.associated_companies_count} label="companies" onClick={() => openCompanyModal("Companies on Campaign", data.associated_companies)} />
                  </Widget>
                </div>
              )}

              {!hiddenWidgets.includes("company-contacted-kpi") && (
                <div key="company-contacted-kpi">
                  <Widget title={getWidgetName("company-contacted-kpi")} widgetKey="company-contacted-kpi" tooltip={WIDGET_TOOLTIPS["company-contacted-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("company-contacted-kpi")} onRename={(n) => updateCustomName("company-contacted-kpi", n)}>
                    <FunnelKpi value={metrics.contacted_companies_count} label="companies" onClick={() => openCompanyModal("Contacted Companies", data.contacted_companies)}
                      cvrFrom={metrics.associated_companies_count} cvrFromLabel="Campaign Companies" />
                  </Widget>
                </div>
              )}

              {!hiddenWidgets.includes("company-noncustomer-kpi") && (
                <div key="company-noncustomer-kpi">
                  <Widget title={getWidgetName("company-noncustomer-kpi")} widgetKey="company-noncustomer-kpi" tooltip={WIDGET_TOOLTIPS["company-noncustomer-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("company-noncustomer-kpi")} onRename={(n) => updateCustomName("company-noncustomer-kpi", n)}>
                    <FunnelKpi value={metrics.contacted_non_customer_companies_count} label="non-customer companies" onClick={() => openCompanyModal("Non-Customer Companies", data.contacted_non_customer_companies)}
                      cvrFrom={metrics.contacted_companies_count} cvrFromLabel="Engaged Companies" />
                  </Widget>
                </div>
              )}

              {!hiddenWidgets.includes("companies-followed-up-kpi") && (
                <div key="companies-followed-up-kpi">
                  <Widget title={getWidgetName("companies-followed-up-kpi")} widgetKey="companies-followed-up-kpi" tooltip={WIDGET_TOOLTIPS["companies-followed-up-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("companies-followed-up-kpi")} onRename={(n) => updateCustomName("companies-followed-up-kpi", n)}>
                    <FunnelKpi value={metrics.companies_followed_up_count} label="followed up" onClick={() => openCompanyModal("Companies Followed Up With", data.companies_followed_up)}
                      cvrFrom={metrics.contacted_non_customer_companies_count} cvrFromLabel="Non-Customer Co." />
                  </Widget>
                </div>
              )}

              {!hiddenWidgets.includes("companies-needing-followup") && (
                <div key="companies-needing-followup">
                  <Widget title={getWidgetName("companies-needing-followup")} widgetKey="companies-needing-followup" tooltip={WIDGET_TOOLTIPS["companies-needing-followup"]} isAdmin={isAdmin} onDelete={() => hideWidget("companies-needing-followup")} onRename={(n) => updateCustomName("companies-needing-followup", n)}>
                    <OwnerBreakdownTile items={data.companies_needing_follow_up.map((c) => ({ owner_name: c.owner_name || "Unassigned" }))} label="companies"
                      onClick={() => openCompanyModal("Companies Needing Follow Up", data.companies_needing_follow_up)} />
                  </Widget>
                </div>
              )}

              {/* ═══ CONTACT FUNNEL ═══ */}
              {!hiddenWidgets.includes("contact-targeted-kpi") && (
                <div key="contact-targeted-kpi">
                  <Widget title={getWidgetName("contact-targeted-kpi")} widgetKey="contact-targeted-kpi" tooltip={WIDGET_TOOLTIPS["contact-targeted-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("contact-targeted-kpi")} onRename={(n) => updateCustomName("contact-targeted-kpi", n)}>
                    <FunnelKpi value={metrics.targeted_contacts_count} label="contacts" onClick={() => openModal("All Campaign Contacts", "targeted_contacts")} />
                  </Widget>
                </div>
              )}

              {!hiddenWidgets.includes("contact-engaged-kpi") && (
                <div key="contact-engaged-kpi">
                  <Widget title={getWidgetName("contact-engaged-kpi")} widgetKey="contact-engaged-kpi" tooltip={WIDGET_TOOLTIPS["contact-engaged-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("contact-engaged-kpi")} onRename={(n) => updateCustomName("contact-engaged-kpi", n)}>
                    <FunnelKpi value={metrics.engaged_contacts_count} label="contacts" onClick={() => openModal("Engaged Contacts", "engaged_contacts")}
                      cvrFrom={metrics.targeted_contacts_count} cvrFromLabel="Campaign Contacts" />
                  </Widget>
                </div>
              )}

              {/* ═══ NON-CUSTOMER & POST-CAMPAIGN FUNNEL ═══ */}
              {!hiddenWidgets.includes("contact-noncustomer-kpi") && (
                <div key="contact-noncustomer-kpi">
                  <Widget title={getWidgetName("contact-noncustomer-kpi")} widgetKey="contact-noncustomer-kpi" tooltip={WIDGET_TOOLTIPS["contact-noncustomer-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("contact-noncustomer-kpi")} onRename={(n) => updateCustomName("contact-noncustomer-kpi", n)}>
                    <FunnelKpi value={metrics.engaged_non_customers_count} label="non-customers" onClick={() => openModal("Engaged Non-Customers", "engaged_non_customers")}
                      cvrFrom={metrics.engaged_contacts_count} cvrFromLabel="Engaged" />
                  </Widget>
                </div>
              )}

              {!hiddenWidgets.includes("contact-postcampaign-kpi") && (
                <div key="contact-postcampaign-kpi">
                  <Widget title={getWidgetName("contact-postcampaign-kpi")} widgetKey="contact-postcampaign-kpi" tooltip={WIDGET_TOOLTIPS["contact-postcampaign-kpi"]} isAdmin={isAdmin} onDelete={() => hideWidget("contact-postcampaign-kpi")} onRename={(n) => updateCustomName("contact-postcampaign-kpi", n)}>
                    <FunnelKpi value={metrics.post_campaign_active_count} label="active post-campaign" onClick={() => openModal("Post-Campaign Activity", "post_campaign_active")}
                      cvrFrom={metrics.engaged_non_customers_count} cvrFromLabel="Non-Customers" />
                  </Widget>
                </div>
              )}

              {!hiddenWidgets.includes("contacts-needing-followup") && (
                <div key="contacts-needing-followup">
                  <Widget title={getWidgetName("contacts-needing-followup")} widgetKey="contacts-needing-followup" tooltip={WIDGET_TOOLTIPS["contacts-needing-followup"]} isAdmin={isAdmin} onDelete={() => hideWidget("contacts-needing-followup")} onRename={(n) => updateCustomName("contacts-needing-followup", n)}>
                    <OwnerBreakdownTile items={data.contacts_needing_follow_up.map((c) => ({ owner_name: c.owner_name || "Unassigned" }))} label="contacts"
                      onClick={() => openModal("Contacts Needing Follow Up", "contacts_needing_follow_up")} />
                  </Widget>
                </div>
              )}

              {/* ── FOLLOW-UP DAYS ── */}
              {!hiddenWidgets.includes("follow-up-days") && data.follow_up_stats && (
                <div key="follow-up-days">
                  <Widget title={getWidgetName("follow-up-days")} widgetKey="follow-up-days" tooltip={WIDGET_TOOLTIPS["follow-up-days"]} isAdmin={isAdmin} onDelete={() => hideWidget("follow-up-days")} onRename={(n) => updateCustomName("follow-up-days", n)}>
                    <FollowUpDaysTile stats={data.follow_up_stats} />
                  </Widget>
                </div>
              )}

              {/* ── EFFICIENCY KPIs ── */}
              {!hiddenWidgets.includes("efficiency-kpis") && data.campaign_details && (
                <div key="efficiency-kpis">
                  <Widget title={getWidgetName("efficiency-kpis")} widgetKey="efficiency-kpis" tooltip={WIDGET_TOOLTIPS["efficiency-kpis"]} isAdmin={isAdmin} onDelete={() => hideWidget("efficiency-kpis")} onRename={(n) => updateCustomName("efficiency-kpis", n)}>
                    <EfficiencyKpis details={data.campaign_details} />
                  </Widget>
                </div>
              )}

              {/* ── OPPORTUNITIES BY REP ── */}
              {!hiddenWidgets.includes("opps-by-rep") && (
                <div key="opps-by-rep">
                  <Widget title={getWidgetName("opps-by-rep")} widgetKey="opps-by-rep" tooltip={WIDGET_TOOLTIPS["opps-by-rep"]} isAdmin={isAdmin} onDelete={() => hideWidget("opps-by-rep")} onRename={(n) => updateCustomName("opps-by-rep", n)}>
                    <OpportunitiesByRepChart data={data.opportunities_by_owner} />
                  </Widget>
                </div>
              )}

              {/* ── CLOSED LOST REASONS ── */}
              {!hiddenWidgets.includes("closed-lost") && (
                <div key="closed-lost">
                  <Widget title={getWidgetName("closed-lost")} widgetKey="closed-lost" tooltip={WIDGET_TOOLTIPS["closed-lost"]} isAdmin={isAdmin} onDelete={() => hideWidget("closed-lost")} onRename={(n) => updateCustomName("closed-lost", n)}>
                    <ClosedLostChart data={data.closed_lost_reasons} />
                  </Widget>
                </div>
              )}

              {/* ── CLOSED WON ARR CHART ── */}
              {!hiddenWidgets.includes("closed-won") && (
                <div key="closed-won">
                  <Widget title={getWidgetName("closed-won")} widgetKey="closed-won" tooltip={WIDGET_TOOLTIPS["closed-won"]} isAdmin={isAdmin} onDelete={() => hideWidget("closed-won")} onRename={(n) => updateCustomName("closed-won", n)}>
                    <ClosedWonChart data={data.closed_won_by_owner} />
                  </Widget>
                </div>
              )}

              {/* ── AVG WIN RATE ── */}
              {!hiddenWidgets.includes("win-rate") && (
                <div key="win-rate">
                  <Widget title={getWidgetName("win-rate")} widgetKey="win-rate" tooltip={WIDGET_TOOLTIPS["win-rate"]} isAdmin={isAdmin} onDelete={() => hideWidget("win-rate")} onRename={(n) => updateCustomName("win-rate", n)}>
                    <WinRateChart data={data.win_rate_by_owner} />
                  </Widget>
                </div>
              )}

              {/* ── KPI STRIP ── */}
              {!hiddenWidgets.includes("kpi-strip") && (
                <div key="kpi-strip">
                  <Widget title={getWidgetName("kpi-strip")} widgetKey="kpi-strip" tooltip={WIDGET_TOOLTIPS["kpi-strip"]} isAdmin={isAdmin} onDelete={() => hideWidget("kpi-strip")} onRename={(n) => updateCustomName("kpi-strip", n)}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 h-full">
                      <Kpi label="Targeted Companies" value={metrics.targeted_companies} onClick={() => openModal("Targeted Companies", "targeted_companies")} />
                      <Kpi label="Campaign Members" value={metrics.total_contacts} onClick={() => openModal("All Contacts", "total_contacts")} />
                      <Kpi label="Closed Won ARR" value={formatCurrency(metrics.closed_won_amount)} accent="emerald" />
                      <Kpi label="Closed Won Deals" value={metrics.closed_won_deals} accent="emerald" onClick={() => openModal("Closed Won Deals", "closed_won_deals")} />
                    </div>
                  </Widget>
                </div>
              )}

              {/* ── STATUS TABLE (Pipeline Source style) ── */}
              {!hiddenWidgets.includes("status-table") && (
                <div key="status-table">
                  <Widget title={getWidgetName("status-table")} widgetKey="status-table" tooltip={WIDGET_TOOLTIPS["status-table"]} isAdmin={isAdmin} onDelete={() => hideWidget("status-table")} onRename={(n) => updateCustomName("status-table", n)}>
                    <StatusTable data={data} metrics={metrics} openModal={openModal} />
                  </Widget>
                </div>
              )}

              {/* ── CONVERSION SIDE PANEL ── */}
              {!hiddenWidgets.includes("conversion-panel") && (
                <div key="conversion-panel">
                  <Widget title={getWidgetName("conversion-panel")} widgetKey="conversion-panel" tooltip={WIDGET_TOOLTIPS["conversion-panel"]} isAdmin={isAdmin} onDelete={() => hideWidget("conversion-panel")} onRename={(n) => updateCustomName("conversion-panel", n)}>
                    <ConversionPanel metrics={metrics} openModal={openModal} />
                  </Widget>
                </div>
              )}

              {/* ── FULL MEMBERS TABLE ── */}
              {!hiddenWidgets.includes("members-table") && (
                <div key="members-table">
                  <Widget title={getWidgetName("members-table")} widgetKey="members-table" tooltip={WIDGET_TOOLTIPS["members-table"]} isAdmin={isAdmin} onDelete={() => hideWidget("members-table")} onRename={(n) => updateCustomName("members-table", n)}
                    subtitle={`${data.members.length} records`}>
                    <MembersTable data={data} />
                  </Widget>
                </div>
              )}
            </Responsive>
          )}
        </main>
      </div>

      {/* ═══════ DETAIL MODAL ═══════ */}
      {modal && data && metrics && (
        <DetailModal title={modal.title} metricKey={modal.metricKey} data={data}
          campaignName={campaignName} activeTab={activeTab} setActiveTab={setActiveTab} onClose={() => setModal(null)} />
      )}

      {companyModal && (
        <CompanyDetailModal title={companyModal.title} companies={companyModal.companies}
          campaignName={campaignName} onClose={() => setCompanyModal(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════ */

function SidebarIcon({ name }: { name: string }) {
  const d: Record<string, string> = {
    grid: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    flag: "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z",
    building: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
    book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  };
  return <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d[name] || d.grid} /></svg>;
}

function Widget({ title, subtitle, tooltip, isAdmin, actions, onDelete, widgetKey, onRename, children }: {
  title: string; subtitle?: string; tooltip?: string; isAdmin: boolean; actions?: React.ReactNode;
  onDelete?: () => void; widgetKey?: string; onRename?: (name: string) => void; children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  function handleDoubleClick() {
    if (!isAdmin || !onRename) return;
    setEditValue(title);
    setEditing(true);
  }

  function commitEdit() {
    setEditing(false);
    if (onRename && editValue.trim()) onRename(editValue.trim());
  }

  return (
    <div className={`h-full w-full flex flex-col bg-[#2D2D30] rounded-xl border ${isAdmin ? "border-[#EFB600]/30" : "border-[#494949]/40"}`}>
      <div className={`flex items-start justify-between px-4 py-2.5 border-b border-[#494949]/30 ${isAdmin ? "drag-handle cursor-grab active:cursor-grabbing select-none" : ""}`}>
        <div className="flex items-center gap-2 min-w-0">
          {isAdmin && (
            <svg className="w-3 h-3 text-[#EFB600] flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="4" r="1.3" /><circle cx="8" cy="4" r="1.3" /><circle cx="13" cy="4" r="1.3" />
              <circle cx="3" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="13" cy="8" r="1.3" />
              <circle cx="3" cy="12" r="1.3" /><circle cx="8" cy="12" r="1.3" /><circle cx="13" cy="12" r="1.3" />
            </svg>
          )}
          {editing ? (
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="text-[13px] font-medium text-[#E5E5E5] bg-[#2D2D30] border border-[#FFCA05]/50 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#FFCA05] w-full max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="group/tooltip relative min-w-0" onDoubleClick={handleDoubleClick}>
              <h3 className={`text-[13px] font-medium text-[#E5E5E5] line-clamp-2 ${tooltip ? "border-b border-dotted border-[#494949]/50 cursor-help" : ""} ${isAdmin && onRename ? "hover:text-[#FFCA05]" : ""}`}>
                {title}
              </h3>
              {tooltip && (
                <span className="invisible group-hover/tooltip:visible absolute left-0 top-full mt-1.5 z-[9999] w-64 px-3 py-2 text-[11px] text-[#E5E5E5] bg-[#1C1C1E] border border-[#494949]/60 rounded-lg shadow-xl pointer-events-none whitespace-normal leading-relaxed">
                  {tooltip}
                </span>
              )}
            </span>
          )}
          {subtitle && <span className="text-[11px] text-[#494949]">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {isAdmin && onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Remove tile"
              className="p-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors border border-red-500/20">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">{children}</div>
    </div>
  );
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#457F86]/10 text-[#93C1C8] text-[11px] hover:bg-[#457F86]/30 transition-colors border border-[#457F86]/20">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      Excel
    </button>
  );
}

function Kpi({ label, value, accent, onClick }: { label: string; value: number | string; accent?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  const valColor = accent === "emerald" ? "text-[#93C1C8]" : "text-white";
  return (
    <Tag onClick={onClick}
      className={`bg-[#2D2D30]/40 rounded-lg border border-[#494949]/30 px-4 py-3 text-left transition-all ${onClick ? "hover:bg-[#494949]/40 hover:border-[#494949]/50 cursor-pointer group" : ""}`}>
      <p className={`text-xl font-bold ${valColor}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-[11px] text-[#494949] mt-0.5">{label}</p>
      {onClick && <p className="text-[9px] text-[#494949] mt-1 group-hover:text-[#FFCA05] transition-colors">View details &rarr;</p>}
    </Tag>
  );
}

function ClosedWonChart({ data }: { data: ClosedWonByOwner[] }) {
  const maxAmount = Math.max(...data.map((d) => d.total_amount), 1);
  const totalAmount = data.reduce((s, d) => s + d.total_amount, 0);
  const totalDeals = data.reduce((s, d) => s + d.deal_count, 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#494949] text-sm">No closed-won deals for this campaign.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">
      <div className="flex flex-col">
        <div className="flex items-center gap-4 mb-3 text-[10px] text-[#494949]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-[#457F86] inline-block" /> ARR</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-[#EFB600] inline-block" /> Deals</span>
        </div>
        <div className="space-y-2.5 flex-1">
          {data.map((d) => (
            <div key={d.owner_id}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[12px] text-[#CCCCCC] truncate max-w-[160px]">{d.owner_name}</span>
                <span className="text-[11px] text-[#494949] tabular-nums">{formatCurrency(d.total_amount)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-5 bg-[#2D2D30]/60 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#457F86] to-[#5A9BA3] rounded transition-all duration-500" style={{ width: `${(d.total_amount / maxAmount) * 100}%` }} />
                </div>
                <span className="text-[11px] font-medium text-[#EFB600] w-6 text-right tabular-nums">{d.deal_count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[#494949] border-b border-[#494949]/50">
              <th className="pb-2 pr-2 font-medium">Deal Owner</th>
              <th className="pb-2 pr-2 text-right font-medium">ARR</th>
              <th className="pb-2 text-right font-medium">Deals</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.owner_id} className="border-b border-[#2D2D30]/30 hover:bg-[#2D2D30]/20">
                <td className="py-1.5 pr-2 text-[#E5E5E5]">{d.owner_name}</td>
                <td className="py-1.5 pr-2 text-right text-[#93C1C8] tabular-nums">{formatCurrency(d.total_amount)}</td>
                <td className="py-1.5 text-right text-[#EFB600] tabular-nums">{d.deal_count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#494949]/50 font-medium">
              <td className="py-1.5 pr-2 text-[#CCCCCC]">Total</td>
              <td className="py-1.5 pr-2 text-right text-[#93C1C8] tabular-nums">{formatCurrency(totalAmount)}</td>
              <td className="py-1.5 text-right text-[#EFB600] tabular-nums">{totalDeals}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function WinRateChart({ data }: { data: WinRateByOwner[] }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#494949] text-sm">No deal data for this campaign.</div>;
  }

  const avgRate = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.win_rate, 0) / data.length * 100) / 100
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-[#494949] uppercase tracking-wider">Win Rate by Owner</span>
          <span className="text-[11px] text-[#CCCCCC]">Avg: <span className="text-[#FFCA05] font-medium">{avgRate}%</span></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 flex-1 content-start">
          {data.map((d) => {
            const color = d.win_rate >= 30 ? "text-[#93C1C8]" : d.win_rate >= 15 ? "text-[#EFB600]" : d.win_rate > 0 ? "text-[#EFB600]" : "text-[#494949]";
            return (
              <div key={d.owner_id} className="bg-[#2D2D30]/40 rounded-lg border border-[#494949]/30 px-3 py-2.5 text-center">
                <p className={`text-lg font-bold ${color}`}>{d.win_rate}%</p>
                <p className="text-[11px] text-[#CCCCCC] mt-0.5 truncate" title={d.owner_name}>{d.owner_name}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[#494949] border-b border-[#494949]/50">
              <th className="pb-2 pr-2 font-medium">Deal Owner</th>
              <th className="pb-2 pr-2 text-right font-medium">Win Rate</th>
              <th className="pb-2 pr-2 text-right font-medium">Won</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const color = d.win_rate >= 30 ? "text-[#93C1C8]" : d.win_rate >= 15 ? "text-[#EFB600]" : d.win_rate > 0 ? "text-[#EFB600]" : "text-[#494949]";
              return (
                <tr key={d.owner_id} className="border-b border-[#2D2D30]/30 hover:bg-[#2D2D30]/20">
                  <td className="py-1.5 pr-2 text-[#E5E5E5]">{d.owner_name}</td>
                  <td className={`py-1.5 pr-2 text-right font-medium tabular-nums ${color}`}>{d.win_rate}%</td>
                  <td className="py-1.5 pr-2 text-right text-[#FFCA05] tabular-nums">{d.closed_won_deals}</td>
                  <td className="py-1.5 text-right text-[#CCCCCC] tabular-nums">{d.total_deals}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#494949]/50 font-medium">
              <td className="py-1.5 pr-2 text-[#CCCCCC]">Average</td>
              <td className="py-1.5 pr-2 text-right text-[#FFCA05] tabular-nums">{avgRate}%</td>
              <td className="py-1.5 pr-2 text-right text-[#FFCA05] tabular-nums">{data.reduce((s, d) => s + d.closed_won_deals, 0)}</td>
              <td className="py-1.5 text-right text-[#CCCCCC] tabular-nums">{data.reduce((s, d) => s + d.total_deals, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function StatusTable({ data, metrics, openModal }: {
  data: CampaignDashboardData;
  metrics: NonNullable<CampaignDashboardData["metrics"]>;
  openModal: (title: string, key: MetricKey) => void;
}) {
  const statusColors: Record<string, string> = {
    Converted: "bg-[#457F86]", Responded: "bg-blue-500", Nurture: "bg-amber-500",
    Identified: "bg-[#494949]", Sent: "bg-orange-500",
  };

  const unworked = getUnworkedContacts(data.members);

  const rows = [
    { label: "# of Targeted Companies", val: metrics.targeted_companies, engaged: "—", post: "—", key: "targeted_companies" as MetricKey },
    { label: "# Companies w/ Single/Multi Contact", val: metrics.companies_with_contacts, engaged: "—", post: "—", key: "companies_with_contacts" as MetricKey },
    { label: "# of Campaign Members", val: metrics.total_contacts, engaged: String(metrics.engaged_at_event + metrics.engaged_pre_event), post: String(metrics.post_campaign_activity), key: "total_contacts" as MetricKey },
    { label: "Single Contact Companies", val: metrics.single_contact_companies, engaged: "—", post: "—", key: "single_contact_companies" as MetricKey },
    { label: "Multi Contact Companies", val: metrics.multi_contact_companies, engaged: "—", post: "—", key: "multi_contact_companies" as MetricKey },
    { label: "Unworked Contacts", val: unworked.length, engaged: "—", post: "—", key: "unworked_contacts" as MetricKey },
    { label: "# Contacts Engaged at Event", val: metrics.engaged_at_event, engaged: String(metrics.engaged_at_event), post: "—", key: "engaged_at_event" as MetricKey },
    { label: "# Post-Campaign Activity", val: metrics.post_campaign_activity, engaged: "—", post: String(metrics.post_campaign_activity), key: "post_campaign_activity" as MetricKey },
    { label: "# Deals in Campaign", val: metrics.deals_in_campaign, engaged: "—", post: "—", key: "deals_in_campaign" as MetricKey },
    { label: "Closed Won Deals", val: metrics.closed_won_deals, engaged: "—", post: formatCurrency(metrics.closed_won_amount), key: "closed_won_deals" as MetricKey },
  ];

  return (
    <div className="h-full flex flex-col">
      {Object.keys(metrics.status_breakdown).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(metrics.status_breakdown).sort(([, a], [, b]) => b - a).map(([status, count]) => (
            <span key={status} className="flex items-center gap-1.5 px-2 py-1 bg-[#2D2D30]/50 rounded text-[11px] text-[#CCCCCC] border border-[#494949]/30">
              <span className={`w-2 h-2 rounded-full ${statusColors[status] || "bg-[#494949]"}`} />
              {status}: {count}
            </span>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[#494949] border-b border-[#494949]/50">
              <th className="pb-2 pr-3 font-medium">Metric</th>
              <th className="pb-2 pr-3 text-right font-medium">Count</th>
              <th className="pb-2 pr-3 text-right font-medium">Engaged</th>
              <th className="pb-2 text-right font-medium">Post / ARR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-[#2D2D30]/30 hover:bg-[#2D2D30]/20 cursor-pointer" onClick={() => openModal(r.label, r.key)}>
                <td className="py-1.5 pr-3 text-[#CCCCCC]">{r.label}</td>
                <td className="py-1.5 pr-3 text-right text-white tabular-nums font-medium">{typeof r.val === "number" ? r.val.toLocaleString() : r.val}</td>
                <td className="py-1.5 pr-3 text-right text-[#CCCCCC] tabular-nums">{r.engaged}</td>
                <td className="py-1.5 text-right text-[#CCCCCC] tabular-nums">{r.post}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConversionPanel({ metrics, openModal }: {
  metrics: NonNullable<CampaignDashboardData["metrics"]>;
  openModal: (title: string, key: MetricKey) => void;
}) {
  const total = metrics.single_contact_companies + metrics.multi_contact_companies;
  const singlePct = total > 0 ? Math.round((metrics.single_contact_companies / total) * 100) : 0;
  const multiPct = total > 0 ? Math.round((metrics.multi_contact_companies / total) * 100) : 0;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Donut-style visual */}
      <div className="text-center">
        <p className="text-[11px] text-[#494949] mb-3">Contact Label Split</p>
        <div className="relative w-28 h-28 mx-auto mb-3">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#494949" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#3b82f6" strokeWidth="3"
              strokeDasharray={`${singlePct} ${100 - singlePct}`} strokeDashoffset="0" strokeLinecap="round" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#a855f7" strokeWidth="3"
              strokeDasharray={`${multiPct} ${100 - multiPct}`} strokeDashoffset={`${-singlePct}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{total}</span>
          </div>
        </div>
        <div className="flex justify-center gap-4 text-[11px]">
          <button onClick={() => openModal("Single Contact Companies", "single_contact_companies")} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Single ({metrics.single_contact_companies})
          </button>
          <button onClick={() => openModal("Multi Contact Companies", "multi_contact_companies")} className="flex items-center gap-1 text-purple-400 hover:text-purple-300">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> Multi ({metrics.multi_contact_companies})
          </button>
        </div>
      </div>

      {/* Conversion */}
      <div className="bg-[#2D2D30]/30 rounded-lg border border-[#494949]/30 p-3">
        <p className="text-[11px] text-[#494949] mb-2">Conversion Rate</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#93C1C8]">{metrics.conversion_rate}%</span>
          <span className="text-[10px] text-[#494949]">Targeted &rarr; Contacted</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#CCCCCC]">
          <span>{metrics.targeted_companies} targeted</span>
          <span className="text-[#494949]">&rarr;</span>
          <span>{metrics.companies_with_contacts} contacted</span>
        </div>
      </div>

      {/* Financial summary */}
      <div className="bg-[#2D2D30]/30 rounded-lg border border-[#494949]/30 p-3">
        <p className="text-[11px] text-[#494949] mb-2">Financial Summary</p>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-[#CCCCCC]">Closed Won ARR</span>
          <span className="text-lg font-bold text-[#93C1C8] ml-auto">{formatCurrency(metrics.closed_won_amount)}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[11px] text-[#CCCCCC]">Deals won / total</span>
          <span className="text-[13px] font-medium text-white ml-auto">{metrics.closed_won_deals} / {metrics.deals_in_campaign}</span>
        </div>
      </div>
    </div>
  );
}

function MembersTable({ data }: { data: CampaignDashboardData }) {
  if (data.members.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#494949] text-sm">No campaign members found.</div>;
  }
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[#2D2D30]">
          <tr className="text-left text-[#494949] border-b border-[#494949]/50">
            <th className="pb-2 pr-3 font-medium">Contact Name</th>
            <th className="pb-2 pr-3 font-medium">Company</th>
            <th className="pb-2 pr-3 font-medium">Label</th>
            <th className="pb-2 pr-3 font-medium">Status</th>
            <th className="pb-2 pr-3 font-medium text-center">Engaged</th>
            <th className="pb-2 font-medium text-center">Post Activity</th>
          </tr>
        </thead>
        <tbody>
          {data.members.map((c) => {
            const cl = data.company_labels.find((l) => l.company.toLowerCase().trim() === (c.company || "").toLowerCase().trim());
            return (
              <tr key={c.id} className="border-b border-[#2D2D30]/20 hover:bg-[#2D2D30]/20">
                <td className="py-1.5 pr-3 text-[#E5E5E5]">{c.name}</td>
                <td className="py-1.5 pr-3 text-[#CCCCCC]">{c.company}</td>
                <td className="py-1.5 pr-3">
                  {cl && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cl.label === "Multi Contact" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>{cl.label}</span>}
                </td>
                <td className="py-1.5 pr-3"><StatusBadge status={c.status} /></td>
                <td className="py-1.5 pr-3 text-center">{c.engaged_at_event ? <span className="text-[#93C1C8]">Yes</span> : <span className="text-[#494949]">—</span>}</td>
                <td className="py-1.5 text-center">{c.has_post_campaign_activity ? <span className="text-[#93C1C8]">Yes</span> : <span className="text-[#494949]">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-[#494949]/50 font-medium text-[#CCCCCC]">
            <td className="py-2 pr-3">Total: {data.members.length}</td>
            <td className="py-2 pr-3">{data.company_labels.length} companies</td>
            <td colSpan={4}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FunnelKpi({ value, label, onClick, cvrFrom, cvrFromLabel }: {
  value: number; label: string; onClick: () => void;
  cvrFrom?: number; cvrFromLabel?: string;
}) {
  const cvrRate = cvrFrom && cvrFrom > 0 ? Math.round((value / cvrFrom) * 10000) / 100 : null;
  const cvrColor = cvrRate !== null
    ? cvrRate >= 50 ? "text-[#93C1C8]" : cvrRate >= 25 ? "text-[#FFCA05]" : cvrRate > 0 ? "text-[#EFB600]" : "text-[#494949]"
    : "";
  return (
    <div className="h-full w-full">
      <button onClick={onClick} className="h-full w-full flex flex-col items-center justify-center text-center group">
        <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
        <p className="text-[11px] text-[#494949] mt-1">{label}</p>
        {cvrRate !== null && cvrFromLabel && (
          <p className={`text-[10px] mt-1 ${cvrColor}`}>{cvrRate}% from {cvrFromLabel}</p>
        )}
        <p className="text-[9px] text-[#494949] mt-1 group-hover:text-[#FFCA05] transition-colors">View details &rarr;</p>
      </button>
    </div>
  );
}

function CvrTile({ from, to, fromLabel, toLabel }: { from: number; to: number; fromLabel: string; toLabel: string }) {
  const rate = from > 0 ? Math.round((to / from) * 10000) / 100 : 0;
  const color = rate >= 50 ? "text-[#93C1C8]" : rate >= 25 ? "text-[#EFB600]" : rate > 0 ? "text-[#EFB600]" : "text-[#494949]";
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-1">
      <p className={`text-xl font-bold leading-tight ${color}`}>{rate}%</p>
      <div className="flex items-center gap-1 mt-1 text-[9px] text-[#494949] leading-tight">
        <span className="truncate max-w-[50px]">{fromLabel}</span>
        <svg className="w-2.5 h-2.5 text-[#494949] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        <span className="truncate max-w-[50px]">{toLabel}</span>
      </div>
      <p className="text-[9px] text-[#494949] mt-0.5 leading-tight">{to} of {from}</p>
    </div>
  );
}

function CampaignTypeahead({ campaigns, selectedId, onSelect }: {
  campaigns: { id: string; campaign_name: string; start_date?: string; end_date?: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [startAfter, setStartAfter] = useState("");
  const [endBefore, setEndBefore] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = campaigns.filter((c) => {
    if (query && !c.campaign_name.toLowerCase().includes(query.toLowerCase())) return false;
    if (startAfter && c.start_date && c.start_date < startAfter) return false;
    if (endBefore && c.end_date && c.end_date > endBefore) return false;
    return true;
  });

  const selectedName = campaigns.find((c) => c.id === selectedId)?.campaign_name || "";
  const hasDateFilter = startAfter || endBefore;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#494949] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder={selectedId ? selectedName : "Search campaigns..."}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setOpen(false); setQuery(""); }
            }}
            className="pl-8 pr-8 py-1.5 bg-[#2D2D30]/70 border border-[#494949]/60 rounded-lg text-[13px] text-white placeholder-[#CCCCCC] focus:outline-none focus:ring-1 focus:ring-[#FFCA05] w-72"
          />
          {selectedId && (
            <button onClick={() => { onSelect(""); setQuery(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#494949] hover:text-white">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#494949]">From</span>
          <input type="date" value={startAfter} onChange={(e) => { setStartAfter(e.target.value); setOpen(true); }}
            className="px-1.5 py-1 bg-[#2D2D30]/70 border border-[#494949]/60 rounded text-[11px] text-[#CCCCCC] focus:outline-none focus:ring-1 focus:ring-[#FFCA05] [color-scheme:dark]" />
          <span className="text-[10px] text-[#494949]">To</span>
          <input type="date" value={endBefore} onChange={(e) => { setEndBefore(e.target.value); setOpen(true); }}
            className="px-1.5 py-1 bg-[#2D2D30]/70 border border-[#494949]/60 rounded text-[11px] text-[#CCCCCC] focus:outline-none focus:ring-1 focus:ring-[#FFCA05] [color-scheme:dark]" />
          {hasDateFilter && (
            <button onClick={() => { setStartAfter(""); setEndBefore(""); }} className="text-[10px] text-[#494949] hover:text-white underline">Clear</button>
          )}
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-96 max-h-64 overflow-auto bg-[#2D2D30] border border-[#494949]/60 rounded-lg shadow-xl z-50">
          <div className="px-3 py-1.5 text-[10px] text-[#494949] border-b border-[#494949]/30">{filtered.length} campaign{filtered.length !== 1 ? "s" : ""}</div>
          {filtered.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c.id); setQuery(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#494949]/40 transition-colors flex items-center justify-between ${c.id === selectedId ? "text-[#FFCA05] bg-[#457F86]/5" : "text-[#CCCCCC]"}`}>
              <span className="truncate mr-2">{c.campaign_name}</span>
              {c.start_date && <span className="text-[9px] text-[#494949] whitespace-nowrap flex-shrink-0">{c.start_date}</span>}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-4 text-[12px] text-[#494949] text-center">No campaigns match your search.</p>}
        </div>
      )}
    </div>
  );
}

function OpportunitiesByRepChart({ data }: { data: OpportunityByOwner[] }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#494949] text-sm">No deals associated with this campaign.</div>;
  }
  const maxCount = Math.max(...data.map((d) => d.deal_count), 1);
  const totalDeals = data.reduce((s, d) => s + d.deal_count, 0);
  const totalAmount = data.reduce((s, d) => s + d.total_amount, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 text-[10px] text-[#494949]">
        <span>Total: {totalDeals} deals &middot; {formatCurrency(totalAmount)} ARR</span>
      </div>
      <div className="flex-1 overflow-auto space-y-2">
        {data.map((d) => (
          <div key={d.owner_id}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[12px] text-[#CCCCCC] truncate max-w-[160px]">{d.owner_name}</span>
              <span className="text-[11px] text-[#494949] tabular-nums">{d.deal_count} deals &middot; {formatCurrency(d.total_amount)}</span>
            </div>
            <div className="h-4 bg-[#2D2D30]/60 rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded transition-all duration-500" style={{ width: `${(d.deal_count / maxCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosedLostChart({ data }: { data: ClosedLostReason[] }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#494949] text-sm">No closed-lost deals for this campaign.</div>;
  }
  const totalLost = data.reduce((s, r) => s + r.count, 0);
  const maxCount = Math.max(...data.map((r) => r.count), 1);
  const colors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-rose-500", "bg-pink-500", "bg-fuchsia-500", "bg-violet-500"];

  return (
    <div className="h-full flex flex-col">
      <div className="text-[10px] text-[#494949] mb-3">Total closed-lost: {totalLost} deal{totalLost !== 1 ? "s" : ""}</div>
      <div className="flex-1 overflow-auto space-y-2.5">
        {data.map((r, idx) => {
          const pct = totalLost > 0 ? Math.round((r.count / totalLost) * 100) : 0;
          return (
            <div key={r.reason}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[12px] text-[#CCCCCC]">{r.reason}</span>
                <span className="text-[11px] text-[#494949] tabular-nums">{r.count} ({pct}%)</span>
              </div>
              <div className="h-4 bg-[#2D2D30]/60 rounded overflow-hidden">
                <div className={`h-full ${colors[idx % colors.length]} rounded transition-all duration-500 opacity-80`} style={{ width: `${(r.count / maxCount) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EfficiencyKpis({ details }: { details: { actual_cost: number; budgeted_cost: number; revenue_per_dollar_spent: number; cost_per_closed_won_deal: number; closed_won_deals_in_campaign: number } }) {
  const items = [
    { label: "Revenue / $ Spent", value: details.revenue_per_dollar_spent > 0 ? `${details.revenue_per_dollar_spent.toFixed(2)}x` : "—", accent: "text-[#93C1C8]" },
    { label: "Cost / Closed-Won Deal", value: details.cost_per_closed_won_deal > 0 ? formatCurrency(details.cost_per_closed_won_deal) : "—", accent: "text-[#EFB600]" },
    { label: "Closed Won Count", value: String(details.closed_won_deals_in_campaign), accent: "text-[#FFCA05]" },
    { label: "Actual Cost", value: details.actual_cost > 0 ? formatCurrency(details.actual_cost) : "—", accent: "text-white" },
    { label: "Budgeted Cost", value: details.budgeted_cost > 0 ? formatCurrency(details.budgeted_cost) : "—", accent: "text-[#CCCCCC]" },
  ];
  return (
    <div className="h-full grid grid-cols-5 gap-3">
      {items.map((it) => (
        <div key={it.label} className="bg-[#2D2D30]/40 rounded-lg border border-[#494949]/30 px-3 py-3 flex flex-col items-center justify-center text-center">
          <p className={`text-lg font-bold ${it.accent}`}>{it.value}</p>
          <p className="text-[10px] text-[#494949] mt-1 leading-tight">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

function FollowUpDaysTile({ stats }: { stats: { avg_days: number; followed_up_count: number; not_followed_up_count: number; total_engaged: number } }) {
  const pct = stats.total_engaged > 0 ? Math.round((stats.followed_up_count / stats.total_engaged) * 100) : 0;
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <p className="text-3xl font-bold text-white">{stats.avg_days > 0 ? stats.avg_days : "—"}</p>
      <p className="text-[11px] text-[#494949] mt-1">{stats.avg_days > 0 ? "avg days to follow up" : "no follow-ups yet"}</p>
      <div className="mt-3 w-full max-w-[160px]">
        <div className="h-2 bg-[#2D2D30]/60 rounded-full overflow-hidden">
          <div className="h-full bg-[#457F86] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-[#CCCCCC] mt-1">{stats.followed_up_count} of {stats.total_engaged} followed up</p>
      </div>
      {stats.not_followed_up_count > 0 && (
        <p className="text-[10px] text-[#EFB600]/80 mt-1">{stats.not_followed_up_count} not yet contacted</p>
      )}
    </div>
  );
}

function OwnerBreakdownTile({ items, label, onClick }: { items: { owner_name: string }[]; label: string; onClick?: () => void }) {
  if (items.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#494949] text-sm">No {label} needing follow up.</div>;
  }
  const grouped = new Map<string, number>();
  for (const item of items) {
    const owner = item.owner_name || "Unassigned";
    grouped.set(owner, (grouped.get(owner) || 0) + 1);
  }
  const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl font-bold text-white">{items.length}</span>
        <span className="text-[10px] text-[#CCCCCC]">{label} by owner</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px]">
          <tbody>
            {sorted.map(([owner, count]) => (
              <tr key={owner} className="border-b border-[#494949]/20">
                <td className="py-1.5 pr-3 text-[#CCCCCC]">{owner}</td>
                <td className="py-1.5 text-right text-white font-semibold tabular-nums">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onClick && (
        <button onClick={onClick} className="mt-2 text-[10px] text-[#494949] hover:text-[#FFCA05] transition-colors self-center">
          View details &rarr;
        </button>
      )}
    </div>
  );
}

function CompanyDetailModal({ title, companies, campaignName, onClose }: {
  title: string; companies: AssociatedCompany[]; campaignName: string; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-12 overflow-auto">
      <div className="bg-[#2D2D30] rounded-xl border border-[#494949]/60 w-full max-w-5xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#494949]/40">
          <h2 className="text-base font-semibold text-white">{title} ({companies.length})</h2>
          <button onClick={onClose} className="text-[#CCCCCC] hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex items-center justify-end px-5 pt-3">
          <ExportBtn onClick={() => exportAssociatedCompanies(companies, campaignName, title)} />
        </div>
        <div className="p-5 max-h-[60vh] overflow-auto">
          {companies.length === 0 ? <p className="text-[#494949] text-center py-8">No companies found.</p> : (
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[#CCCCCC] border-b border-[#494949]/40">
                <th className="pb-2 pr-3">Company</th><th className="pb-2 pr-3">Domain</th><th className="pb-2 pr-3">Industry</th>
                <th className="pb-2 pr-3">City</th><th className="pb-2 pr-3">State</th><th className="pb-2 pr-3">Owner</th>
                {companies.some((c) => c.contact_label) && <th className="pb-2">Label</th>}
              </tr></thead>
              <tbody>{companies.map((c) => (
                <tr key={c.id} className="border-b border-[#2D2D30]/30 hover:bg-[#2D2D30]/20">
                  <td className="py-2 pr-3 font-medium"><a href={`https://app.hubspot.com/contacts/49044619/record/0-2/${c.id}/`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FFCA05] underline decoration-[#494949]">{c.name || "—"}</a></td>
                  <td className="py-2 pr-3 text-[#CCCCCC]">{c.domain || "—"}</td>
                  <td className="py-2 pr-3 text-[#CCCCCC]">{c.industry || "—"}</td>
                  <td className="py-2 pr-3 text-[#CCCCCC]">{c.city || "—"}</td>
                  <td className="py-2 pr-3 text-[#CCCCCC]">{c.state || "—"}</td>
                  <td className="py-2 pr-3 text-[#CCCCCC]">{c.owner_name || "—"}</td>
                  {companies.some((co) => co.contact_label) && (
                    <td className="py-2 text-[#CCCCCC]">{c.contact_label || "—"}</td>
                  )}
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Converted: "bg-[#457F86]/10 text-[#93C1C8] border-[#457F86]/20",
    Responded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Nurture: "bg-[#EFB600]/10 text-[#EFB600] border-[#EFB600]/20",
    Identified: "bg-[#494949]/10 text-[#CCCCCC] border-[#494949]/20",
    Sent: "bg-[#EFB600]/10 text-[#EFB600] border-[#EFB600]/20",
  };
  const c = colors[status] || "bg-[#494949]/10 text-[#CCCCCC] border-[#494949]/20";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${c}`}>{status || "—"}</span>;
}

function DetailModal({ title, metricKey, data, campaignName, activeTab, setActiveTab, onClose }: {
  title: string; metricKey: MetricKey; data: CampaignDashboardData; campaignName: string;
  activeTab: "contacts" | "companies"; setActiveTab: (t: "contacts" | "companies") => void; onClose: () => void;
}) {
  const contacts = getFilteredContacts(data, metricKey);
  const companies = getFilteredCompanies(data, metricKey);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-12 overflow-auto">
      <div className="bg-[#2D2D30] rounded-xl border border-[#494949]/60 w-full max-w-5xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#494949]/40">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-[#CCCCCC] hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex items-center justify-between px-5 pt-3">
          <div className="flex gap-1.5">
            {(["contacts", "companies"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${activeTab === tab ? "bg-[#457F86] text-white" : "bg-[#2D2D30] text-[#CCCCCC] hover:text-white"}`}>
                {tab === "contacts" ? `Contacts (${contacts.length})` : `Companies (${companies.length})`}
              </button>
            ))}
          </div>
          <ExportBtn onClick={() => activeTab === "contacts" ? exportContacts(contacts, campaignName, title) : exportCompanies(companies, campaignName, title)} />
        </div>
        <div className="p-5 max-h-[60vh] overflow-auto">
          {activeTab === "contacts" ? (
            contacts.length === 0 ? <p className="text-[#494949] text-center py-8">No contacts found.</p> : (
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[#CCCCCC] border-b border-[#494949]/40">
                  <th className="pb-2 pr-3">Name</th><th className="pb-2 pr-3">Email</th><th className="pb-2 pr-3">Company</th>
                  <th className="pb-2 pr-3">Owner</th><th className="pb-2 pr-3">Status</th><th className="pb-2 text-center">Engaged</th><th className="pb-2 text-center">Post</th>
                </tr></thead>
                <tbody>{contacts.map((c) => (
                  <tr key={c.id} className="border-b border-[#2D2D30]/30 hover:bg-[#2D2D30]/20">
                    <td className="py-2 pr-3"><a href={`https://app.hubspot.com/contacts/49044619/record/0-1/${c.id}/`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FFCA05] underline decoration-[#494949]">{c.name}</a></td>
                    <td className="py-2 pr-3 text-[#CCCCCC]">{c.email || "—"}</td>
                    <td className="py-2 pr-3 text-[#CCCCCC]">{c.company}</td>
                    <td className="py-2 pr-3 text-[#CCCCCC]">{c.owner_name || "—"}</td>
                    <td className="py-2 pr-3"><StatusBadge status={c.status} /></td>
                    <td className="py-2 text-center">{c.engaged_at_event ? <span className="text-[#93C1C8]">Yes</span> : <span className="text-[#494949]">—</span>}</td>
                    <td className="py-2 text-center">{c.has_post_campaign_activity ? <span className="text-[#93C1C8]">Yes</span> : <span className="text-[#494949]">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            )
          ) : companies.length === 0 ? <p className="text-[#494949] text-center py-8">No companies found.</p> : (
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[#CCCCCC] border-b border-[#494949]/40">
                <th className="pb-2 pr-3">Company</th><th className="pb-2 pr-3">Label</th><th className="pb-2 pr-3"># Contacts</th><th className="pb-2">Contacts</th>
              </tr></thead>
              <tbody>{companies.map((c) => (
                <tr key={c.company} className="border-b border-[#2D2D30]/30 hover:bg-[#2D2D30]/20">
                  <td className="py-2 pr-3 text-white font-medium">{c.company}</td>
                  <td className="py-2 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.label === "Multi Contact" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>{c.label}</span></td>
                  <td className="py-2 pr-3 text-[#CCCCCC]">{c.contacts.length}</td>
                  <td className="py-2 text-[#CCCCCC] text-xs">{c.contacts.map((m) => m.name).join(", ")}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
