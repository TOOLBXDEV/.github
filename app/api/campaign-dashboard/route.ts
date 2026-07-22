import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/redshift";
import type {
  CampaignSummary,
  CampaignMember,
  CompanyContactLabel,
  CampaignDashboardData,
  ClosedWonByOwner,
  WinRateByOwner,
  AssociatedCompany,
  CampaignDetails,
  OpportunityByOwner,
  ClosedLostReason,
  FollowUpStats,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_BASE = "https://api.hubapi.com";
const CAMPAIGN_OBJECT = "2-41201412";
const MEMBER_OBJECT = "2-41201420";

async function hubspotFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${body}`);
  }
  return res.json();
}

async function fetchAllCampaigns(): Promise<CampaignSummary[]> {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      id,
      properties_name as name,
      properties_campaign_name as campaign_name,
      properties_status as status,
      properties_type as type,
      properties_startdate as start_date,
      properties_enddate as end_date,
      properties_pipeline_source as pipeline_source,
      properties_sub_pipeline_source as sub_pipeline_source,
      COALESCE(properties_contacts_in_campaign, 0) as contacts_in_campaign,
      COALESCE(properties_potential_accounts_reached__c, 0) as potential_accounts_reached,
      COALESCE(properties_prospects_in_campaign__c, 0) as prospects_in_campaign,
      COALESCE(properties_deals_in_campaign, 0) as deals_in_campaign,
      COALESCE(properties_closed_won_deals_in_campaign, 0) as closed_won_deals,
      COALESCE(properties_closed_won_deals_amount_in_campaign, 0) as closed_won_amount,
      COALESCE(properties_deal_amount_in_campaign, 0) as deal_amount
    FROM hubspot_sfdc_campaigns
    WHERE properties_campaign_name IS NOT NULL
      AND properties_campaign_name != ''
    ORDER BY properties_campaign_name
  `);

  return rows.map((r) => ({
    id: r.id,
    name: r.name || "",
    campaign_name: r.campaign_name || "",
    status: r.status || "",
    type: r.type || "",
    start_date: r.start_date ? String(r.start_date).slice(0, 10) : "",
    end_date: r.end_date ? String(r.end_date).slice(0, 10) : "",
    pipeline_source: r.pipeline_source || "",
    sub_pipeline_source: r.sub_pipeline_source || "",
    contacts_in_campaign: Number(r.contacts_in_campaign) || 0,
    potential_accounts_reached: Number(r.potential_accounts_reached) || 0,
    prospects_in_campaign: Number(r.prospects_in_campaign) || 0,
    deals_in_campaign: Number(r.deals_in_campaign) || 0,
    closed_won_deals: Number(r.closed_won_deals) || 0,
    closed_won_amount: Number(r.closed_won_amount) || 0,
    deal_amount: Number(r.deal_amount) || 0,
  }));
}

async function fetchCampaignMemberIds(campaignId: string): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;

  while (true) {
    const url = `/crm/v4/objects/${CAMPAIGN_OBJECT}/${campaignId}/associations/${MEMBER_OBJECT}?limit=500${after ? `&after=${after}` : ""}`;
    const data = await hubspotFetch(url);
    for (const r of data.results || []) {
      ids.push(String(r.toObjectId));
    }
    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }
  return ids;
}

async function fetchMemberDetails(
  memberIds: string[]
): Promise<CampaignMember[]> {
  if (memberIds.length === 0) return [];

  const members: CampaignMember[] = [];
  const batchSize = 100;

  for (let i = 0; i < memberIds.length; i += batchSize) {
    const batch = memberIds.slice(i, i + batchSize);
    const data = await hubspotFetch(
      `/crm/v3/objects/${MEMBER_OBJECT}/batch/read`,
      {
        method: "POST",
        body: JSON.stringify({
          inputs: batch.map((id) => ({ id })),
          properties: [
            "companyoraccount",
            "name",
            "firstname",
            "lastname",
            "email",
            "status",
            "lead_contact_status__c",
            "engaged_at_event__c",
            "engaged_pre_event__c",
            "has_post_campaign_activity__c",
            "combined_last_activity_date__c",
          ],
        }),
      }
    );

    for (const r of data.results || []) {
      const p = r.properties || {};
      members.push({
        id: r.id,
        name: p.name || "",
        firstname: p.firstname || "",
        lastname: p.lastname || "",
        email: p.email || "",
        company: p.companyoraccount || "",
        status: p.status || "",
        lead_contact_status: p.lead_contact_status__c || "",
        engaged_at_event: p.engaged_at_event__c === "true",
        engaged_pre_event: p.engaged_pre_event__c === "true",
        has_post_campaign_activity: Number(p.has_post_campaign_activity__c) > 0,
        days_since_last_activity:
          p.combined_last_activity_date__c != null
            ? Number(p.combined_last_activity_date__c)
            : null,
      });
    }
  }
  return members;
}

async function fetchCampaignDealIds(campaignId: string): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  while (true) {
    const url = `/crm/v4/objects/${CAMPAIGN_OBJECT}/${campaignId}/associations/deals?limit=500${after ? `&after=${after}` : ""}`;
    const data = await hubspotFetch(url);
    for (const r of data.results || []) {
      ids.push(String(r.toObjectId));
    }
    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }
  return ids;
}

async function fetchDealAnalyticsByOwner(
  dealIds: string[]
): Promise<{
  closedWonByOwner: ClosedWonByOwner[];
  winRateByOwner: WinRateByOwner[];
  opportunitiesByOwner: OpportunityByOwner[];
  closedLostReasons: ClosedLostReason[];
}> {
  if (dealIds.length === 0) return { closedWonByOwner: [], winRateByOwner: [], opportunitiesByOwner: [], closedLostReasons: [] };

  const closedWonMap = new Map<
    string,
    {
      owner_id: string;
      total_amount: number;
      deals: { id: string; name: string; amount: number; close_date: string; company: string }[];
    }
  >();

  const winRateMap = new Map<string, { owner_id: string; total: number; won: number }>();

  const oppsMap = new Map<
    string,
    {
      owner_id: string;
      total_amount: number;
      deals: { id: string; name: string; amount: number; stage: string; create_date: string; company: string }[];
    }
  >();

  const lostReasonsMap = new Map<
    string,
    { reason: string; deals: { id: string; name: string; amount: number; company: string; owner: string }[] }
  >();

  const batchSize = 100;
  const allOwnerIdsSet = new Set<string>();

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const data = await hubspotFetch(`/crm/v3/objects/deals/batch/read`, {
      method: "POST",
      body: JSON.stringify({
        inputs: batch.map((id) => ({ id })),
        properties: [
          "dealname",
          "dealstage",
          "hs_arr",
          "hs_is_closed_won",
          "hs_is_closed_lost",
          "hubspot_owner_id",
          "closedate",
          "createdate",
          "company_name",
          "pipeline",
          "closed_lost_reason__c",
        ],
      }),
    });

    for (const r of data.results || []) {
      const p = r.properties || {};
      const ownerId = p.hubspot_owner_id || "unassigned";
      const isClosedWon = p.hs_is_closed_won === "true";
      const isClosedLost = p.hs_is_closed_lost === "true";
      const hasStage = !!p.dealstage;
      const arr = Number(p.hs_arr) || 0;

      if (ownerId !== "unassigned") allOwnerIdsSet.add(ownerId);

      if (!oppsMap.has(ownerId)) {
        oppsMap.set(ownerId, { owner_id: ownerId, total_amount: 0, deals: [] });
      }
      const oppsEntry = oppsMap.get(ownerId)!;
      oppsEntry.total_amount += arr;
      oppsEntry.deals.push({
        id: r.id,
        name: p.dealname || "",
        amount: arr,
        stage: p.dealstage || "",
        create_date: p.createdate ? String(p.createdate).slice(0, 10) : "",
        company: p.company_name || "",
      });

      if (isClosedWon) {
        if (!closedWonMap.has(ownerId)) {
          closedWonMap.set(ownerId, { owner_id: ownerId, total_amount: 0, deals: [] });
        }
        const entry = closedWonMap.get(ownerId)!;
        entry.total_amount += arr;
        entry.deals.push({
          id: r.id,
          name: p.dealname || "",
          amount: arr,
          close_date: p.closedate ? String(p.closedate).slice(0, 10) : "",
          company: p.company_name || "",
        });
      }

      if (isClosedLost) {
        const reason = p.closed_lost_reason__c || "Not specified";
        if (!lostReasonsMap.has(reason)) {
          lostReasonsMap.set(reason, { reason, deals: [] });
        }
        lostReasonsMap.get(reason)!.deals.push({
          id: r.id,
          name: p.dealname || "",
          amount: arr,
          company: p.company_name || "",
          owner: ownerId,
        });
      }

      if (hasStage) {
        if (!winRateMap.has(ownerId)) {
          winRateMap.set(ownerId, { owner_id: ownerId, total: 0, won: 0 });
        }
        const wr = winRateMap.get(ownerId)!;
        wr.total += 1;
        if (isClosedWon) wr.won += 1;
      }
    }
  }

  const ownerNames = new Map<string, string>();
  if (allOwnerIdsSet.size > 0) {
    try {
      const data = await hubspotFetch(`/crm/v3/owners/`, { method: "GET" });
      for (const o of data.results || []) {
        const name = [o.firstName, o.lastName].filter(Boolean).join(" ");
        ownerNames.set(String(o.id), name || `Owner ${o.id}`);
      }
    } catch {
      /* owner lookup is best-effort */
    }
  }

  function resolveOwnerName(id: string): string {
    return ownerNames.get(id) || (id === "unassigned" ? "Unassigned" : `Owner ${id}`);
  }

  const closedWonByOwner = Array.from(closedWonMap.values())
    .map((entry) => ({
      ...entry,
      owner_name: resolveOwnerName(entry.owner_id),
      deal_count: entry.deals.length,
    }))
    .sort((a, b) => b.total_amount - a.total_amount);

  const winRateByOwner = Array.from(winRateMap.values())
    .map((entry) => ({
      owner_id: entry.owner_id,
      owner_name: resolveOwnerName(entry.owner_id),
      total_deals: entry.total,
      closed_won_deals: entry.won,
      win_rate: entry.total > 0 ? Math.round((entry.won / entry.total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.win_rate - a.win_rate);

  const opportunitiesByOwner = Array.from(oppsMap.values())
    .map((entry) => ({
      ...entry,
      owner_name: resolveOwnerName(entry.owner_id),
      deal_count: entry.deals.length,
    }))
    .sort((a, b) => b.deal_count - a.deal_count);

  const closedLostReasons: ClosedLostReason[] = Array.from(lostReasonsMap.values())
    .map((entry) => ({
      ...entry,
      count: entry.deals.length,
      deals: entry.deals.map((d) => ({ ...d, owner: resolveOwnerName(d.owner) })),
    }))
    .sort((a, b) => b.count - a.count);

  return { closedWonByOwner, winRateByOwner, opportunitiesByOwner, closedLostReasons };
}

async function fetchLabeledCompanyIds(
  campaignId: string
): Promise<{ all: string[]; contacted: { id: string; label: string }[] }> {
  const all: string[] = [];
  const contacted: { id: string; label: string }[] = [];
  let after: string | undefined;

  while (true) {
    const url = `/crm/v4/objects/${CAMPAIGN_OBJECT}/${campaignId}/associations/0-2?limit=500${after ? `&after=${after}` : ""}`;
    const data = await hubspotFetch(url);
    for (const r of data.results || []) {
      const id = String(r.toObjectId);
      all.push(id);
      const types: { label?: string }[] = r.associationTypes || [];
      const contactLabel = types.find((t) => {
        const lbl = (t.label || "").toLowerCase();
        return lbl === "single contact" || lbl === "multi-contact" || lbl === "multi contact";
      });
      if (contactLabel) {
        contacted.push({ id, label: contactLabel.label || "" });
      }
    }
    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }
  return { all, contacted };
}

async function fetchCompanyDetails(
  companyIds: string[]
): Promise<AssociatedCompany[]> {
  if (companyIds.length === 0) return [];
  const companies: AssociatedCompany[] = [];
  const batchSize = 100;

  for (let i = 0; i < companyIds.length; i += batchSize) {
    const batch = companyIds.slice(i, i + batchSize);
    const data = await hubspotFetch(`/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      body: JSON.stringify({
        inputs: batch.map((id) => ({ id })),
        properties: ["name", "domain", "industry", "city", "state", "lifecyclestage", "hubspot_owner_id"],
      }),
    });
    for (const r of data.results || []) {
      const p = r.properties || {};
      companies.push({
        id: r.id,
        name: p.name || "",
        domain: p.domain || "",
        industry: p.industry || "",
        city: p.city || "",
        state: p.state || "",
        lifecyclestage: p.lifecyclestage || "",
        owner_id: p.hubspot_owner_id || "",
      });
    }
  }
  return companies;
}

async function fetchLabeledContactIds(
  campaignId: string
): Promise<{ all: string[]; targeted: string[]; engaged: string[] }> {
  const all: string[] = [];
  const targeted: string[] = [];
  const engaged: string[] = [];
  let after: string | undefined;

  while (true) {
    const url = `/crm/v4/objects/${CAMPAIGN_OBJECT}/${campaignId}/associations/0-1?limit=500${after ? `&after=${after}` : ""}`;
    const data = await hubspotFetch(url);
    for (const r of data.results || []) {
      const id = String(r.toObjectId);
      all.push(id);
      const types: { label?: string }[] = r.associationTypes || [];
      if (types.some((t) => t.label === "Targeted")) targeted.push(id);
      if (types.some((t) => t.label === "Engaged")) engaged.push(id);
    }
    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }
  return { all, targeted, engaged };
}

async function fetchContactDetails(
  contactIds: string[]
): Promise<CampaignMember[]> {
  if (contactIds.length === 0) return [];
  const contacts: CampaignMember[] = [];
  const batchSize = 100;

  for (let i = 0; i < contactIds.length; i += batchSize) {
    const batch = contactIds.slice(i, i + batchSize);
    const data = await hubspotFetch(`/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      body: JSON.stringify({
        inputs: batch.map((id) => ({ id })),
        properties: [
          "firstname", "lastname", "email", "company", "jobtitle",
          "associatedcompanyid", "notes_last_contacted", "hubspot_owner_id",
          "hs_sales_email_last_replied", "hs_last_sales_activity_timestamp",
        ],
      }),
    });
    for (const r of data.results || []) {
      const p = r.properties || {};
      const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || "";
      const activityDates = [
        p.notes_last_contacted,
        p.hs_sales_email_last_replied,
        p.hs_last_sales_activity_timestamp,
      ].filter(Boolean).map((d) => new Date(d as string).getTime()).filter((t) => !isNaN(t));
      const latestActivity = activityDates.length > 0
        ? new Date(Math.max(...activityDates)).toISOString()
        : "";
      contacts.push({
        id: r.id,
        name,
        firstname: p.firstname || "",
        lastname: p.lastname || "",
        email: p.email || "",
        company: p.company || "",
        status: p.jobtitle || "",
        lead_contact_status: "",
        engaged_at_event: false,
        engaged_pre_event: false,
        has_post_campaign_activity: false,
        days_since_last_activity: null,
        associated_company_id: p.associatedcompanyid || "",
        last_activity_date: latestActivity,
        owner_id: p.hubspot_owner_id || "",
      });
    }
  }
  return contacts;
}

async function enrichContactsWithLifecyclestage(
  contacts: CampaignMember[]
): Promise<CampaignMember[]> {
  const companyIds = [...new Set(
    contacts.map((c) => c.associated_company_id).filter((id): id is string => !!id)
  )];
  if (companyIds.length === 0) return contacts;

  const lifecycleMap = new Map<string, string>();
  const batchSize = 100;
  for (let i = 0; i < companyIds.length; i += batchSize) {
    const batch = companyIds.slice(i, i + batchSize);
    const data = await hubspotFetch(`/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      body: JSON.stringify({
        inputs: batch.map((id) => ({ id })),
        properties: ["lifecyclestage"],
      }),
    });
    for (const r of data.results || []) {
      lifecycleMap.set(r.id, (r.properties?.lifecyclestage || "").toLowerCase());
    }
  }

  return contacts.map((c) => ({
    ...c,
    company_lifecyclestage: c.associated_company_id
      ? lifecycleMap.get(c.associated_company_id) || ""
      : "",
  }));
}

async function fetchCampaignDetails(campaignId: string): Promise<CampaignDetails> {
  const props = [
    "type", "approval_status", "status", "channel_entity",
    "startdate", "enddate", "city", "state", "country",
    "actual_cost", "budgeted_cost", "revenue_per___spent",
    "cost_per_closed_won_deal", "closed_won_deals_in_campaign",
  ].join(",");
  const data = await hubspotFetch(
    `/crm/v3/objects/${CAMPAIGN_OBJECT}/${campaignId}?properties=${props}`
  );
  const p = data.properties || {};
  return {
    type: p.type || "",
    approval_status: p.approval_status || "",
    status: p.status || "",
    channel_entity: p.channel_entity || "",
    start_date: p.startdate ? String(p.startdate).slice(0, 10) : "",
    end_date: p.enddate ? String(p.enddate).slice(0, 10) : "",
    city: p.city || "",
    state: p.state || "",
    country: p.country || "",
    actual_cost: Number(p.actual_cost) || 0,
    budgeted_cost: Number(p.budgeted_cost) || 0,
    revenue_per_dollar_spent: Number(p.revenue_per___spent) || 0,
    cost_per_closed_won_deal: Number(p.cost_per_closed_won_deal) || 0,
    closed_won_deals_in_campaign: Number(p.closed_won_deals_in_campaign) || 0,
  };
}

function computeFollowUpStats(
  engagedContacts: CampaignMember[],
  campaignEndDate: Date | null
): FollowUpStats {
  if (!campaignEndDate || engagedContacts.length === 0) {
    return { avg_days: 0, followed_up_count: 0, not_followed_up_count: engagedContacts.length, total_engaged: engagedContacts.length };
  }
  let totalDays = 0;
  let followedUp = 0;
  for (const c of engagedContacts) {
    if (!c.last_activity_date) continue;
    const actDate = new Date(c.last_activity_date);
    if (actDate > campaignEndDate) {
      const diffMs = actDate.getTime() - campaignEndDate.getTime();
      totalDays += Math.round(diffMs / (1000 * 60 * 60 * 24));
      followedUp++;
    }
  }
  return {
    avg_days: followedUp > 0 ? Math.round((totalDays / followedUp) * 10) / 10 : 0,
    followed_up_count: followedUp,
    not_followed_up_count: engagedContacts.length - followedUp,
    total_engaged: engagedContacts.length,
  };
}

async function fetchAllOwnerNames(): Promise<Map<string, string>> {
  const ownerNames = new Map<string, string>();
  try {
    const data = await hubspotFetch(`/crm/v3/owners/`, { method: "GET" });
    for (const o of data.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ");
      ownerNames.set(String(o.id), name || `Owner ${o.id}`);
    }
  } catch { /* best-effort */ }
  return ownerNames;
}

function resolveOwnerName(ownerNames: Map<string, string>, id: string): string {
  return ownerNames.get(id) || (id === "unassigned" || !id ? "Unassigned" : `Owner ${id}`);
}

function computeCompanyLabels(members: CampaignMember[]): CompanyContactLabel[] {
  const companyMap = new Map<string, CampaignMember[]>();
  for (const m of members) {
    const key = (m.company || "Unknown").trim().toLowerCase();
    if (!companyMap.has(key)) companyMap.set(key, []);
    companyMap.get(key)!.push(m);
  }

  return Array.from(companyMap.entries())
    .map(([, contacts]) => ({
      company: contacts[0].company || "Unknown",
      label: (contacts.length === 1 ? "Single Contact" : "Multi Contact") as
        | "Single Contact"
        | "Multi Contact",
      contacts,
    }))
    .sort((a, b) => a.company.localeCompare(b.company));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    const campaigns = await fetchAllCampaigns();

    if (!campaignId) {
      const response: CampaignDashboardData = {
        campaigns,
        selected_campaign: null,
        members: [],
        company_labels: [],
        closed_won_by_owner: [],
        win_rate_by_owner: [],
        associated_companies: [],
        contacted_companies: [],
        targeted_contacts: [],
        engaged_contacts: [],
        engaged_non_customers: [],
        post_campaign_active: [],
        contacted_non_customer_companies: [],
        contacts_needing_follow_up: [],
        companies_followed_up: [],
        companies_needing_follow_up: [],
        campaign_details: null,
        opportunities_by_owner: [],
        closed_lost_reasons: [],
        follow_up_stats: null,
        metrics: null,
        updated_at: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    const selected = campaigns.find((c) => c.id === campaignId) || null;

    const [memberIds, dealIds, labeledCompanyIds, labeledContactIds, campaignDetails] = await Promise.all([
      fetchCampaignMemberIds(campaignId),
      fetchCampaignDealIds(campaignId),
      fetchLabeledCompanyIds(campaignId),
      fetchLabeledContactIds(campaignId),
      fetchCampaignDetails(campaignId),
    ]);

    const [members, dealAnalytics, allCompanyDetailsRaw, allContactDetailsRaw, engagedContactDetailsRaw, ownerNames] = await Promise.all([
      fetchMemberDetails(memberIds),
      fetchDealAnalyticsByOwner(dealIds),
      fetchCompanyDetails(labeledCompanyIds.all),
      fetchContactDetails(labeledContactIds.all),
      fetchContactDetails(labeledContactIds.engaged),
      fetchAllOwnerNames(),
    ]);
    const { closedWonByOwner, winRateByOwner, opportunitiesByOwner, closedLostReasons } = dealAnalytics;

    const enrichWithOwner = <T extends { owner_id?: string }>(items: T[]): (T & { owner_name: string })[] =>
      items.map((item) => ({ ...item, owner_name: resolveOwnerName(ownerNames, item.owner_id || "") }));

    const allCompanyDetails = enrichWithOwner(allCompanyDetailsRaw);
    const allContactDetails = enrichWithOwner(allContactDetailsRaw);

    const engagedContactDetailsEnriched = await enrichContactsWithLifecyclestage(engagedContactDetailsRaw);
    const engagedContactDetails = enrichWithOwner(engagedContactDetailsEnriched);

    const engagedNonCustomers = engagedContactDetails.filter(
      (c) => c.company_lifecyclestage !== "customer"
    );

    const campaignEndDate = campaignDetails?.end_date ? new Date(campaignDetails.end_date) : null;

    const hasPostCampaignActivity = (c: CampaignMember) => {
      if (!c.last_activity_date || !campaignEndDate) return false;
      return new Date(c.last_activity_date) > campaignEndDate;
    };

    const allContactsPostCampaign = allContactDetails.filter(hasPostCampaignActivity);

    const postCampaignActive = engagedNonCustomers.filter(hasPostCampaignActivity);

    const postCampaignActiveIds = new Set(postCampaignActive.map((c) => c.id));
    const contactsNeedingFollowUp = engagedNonCustomers.filter((c) => !postCampaignActiveIds.has(c.id));

    const followUpStats = computeFollowUpStats(engagedContactDetails, campaignEndDate);

    const engagedCompanyIds = new Set(
      engagedContactDetails.map((c) => c.associated_company_id).filter(Boolean)
    );
    const contactedCompanyDetails = allCompanyDetails
      .filter((c) => engagedCompanyIds.has(c.id));

    const contactedNonCustomerCompanies = contactedCompanyDetails.filter(
      (c) => (c.lifecyclestage || "").toLowerCase() !== "customer"
    );

    const followedUpCompanyIds = new Set(
      allContactsPostCampaign.map((c) => c.associated_company_id).filter(Boolean)
    );
    const companiesFollowedUp = contactedNonCustomerCompanies.filter((c) => followedUpCompanyIds.has(c.id));
    const companiesFollowedUpIds = new Set(companiesFollowedUp.map((c) => c.id));
    const companiesNeedingFollowUp = contactedNonCustomerCompanies.filter((c) => !companiesFollowedUpIds.has(c.id));

    const companyLabels = computeCompanyLabels(members);

    const singleCount = companyLabels.filter(
      (c) => c.label === "Single Contact"
    ).length;
    const multiCount = companyLabels.filter(
      (c) => c.label === "Multi Contact"
    ).length;
    const companiesWithContacts = companyLabels.length;
    const targetedCompanies = selected?.potential_accounts_reached || companiesWithContacts;

    const statusBreakdown: Record<string, number> = {};
    for (const m of members) {
      const s = m.status || "Unknown";
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    }

    const response: CampaignDashboardData = {
      campaigns,
      selected_campaign: selected,
      members,
      company_labels: companyLabels,
      closed_won_by_owner: closedWonByOwner,
      win_rate_by_owner: winRateByOwner,
      associated_companies: allCompanyDetails,
      contacted_companies: contactedCompanyDetails,
      targeted_contacts: allContactDetails,
      engaged_contacts: engagedContactDetails,
      engaged_non_customers: engagedNonCustomers,
      post_campaign_active: postCampaignActive,
      contacted_non_customer_companies: contactedNonCustomerCompanies,
      contacts_needing_follow_up: contactsNeedingFollowUp,
      companies_followed_up: companiesFollowedUp,
      companies_needing_follow_up: companiesNeedingFollowUp,
      campaign_details: campaignDetails,
      opportunities_by_owner: opportunitiesByOwner,
      closed_lost_reasons: closedLostReasons,
      follow_up_stats: followUpStats,
      metrics: {
        targeted_companies: targetedCompanies,
        total_contacts: members.length,
        companies_with_contacts: companiesWithContacts,
        single_contact_companies: singleCount,
        multi_contact_companies: multiCount,
        conversion_rate:
          targetedCompanies > 0
            ? Math.round((companiesWithContacts / targetedCompanies) * 10000) /
              100
            : 0,
        deals_in_campaign: selected?.deals_in_campaign || 0,
        closed_won_deals: selected?.closed_won_deals || 0,
        closed_won_amount: selected?.closed_won_amount || 0,
        engaged_at_event: members.filter((m) => m.engaged_at_event).length,
        engaged_pre_event: members.filter((m) => m.engaged_pre_event).length,
        post_campaign_activity: members.filter(
          (m) => m.has_post_campaign_activity
        ).length,
        status_breakdown: statusBreakdown,
        associated_companies_count: allCompanyDetails.length,
        contacted_companies_count: contactedCompanyDetails.length,
        targeted_contacts_count: allContactDetails.length,
        engaged_contacts_count: engagedContactDetails.length,
        engaged_non_customers_count: engagedNonCustomers.length,
        post_campaign_active_count: postCampaignActive.length,
        contacted_non_customer_companies_count: contactedNonCustomerCompanies.length,
        contacts_needing_follow_up_count: contactsNeedingFollowUp.length,
        companies_followed_up_count: companiesFollowedUp.length,
        companies_needing_follow_up_count: companiesNeedingFollowUp.length,
      },
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Campaign dashboard error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch campaign data", detail: message },
      { status: 500 }
    );
  }
}
