export interface CampaignSummary {
  id: string;
  name: string;
  campaign_name: string;
  status: string;
  type: string;
  start_date: string;
  end_date: string;
  pipeline_source: string;
  sub_pipeline_source: string;
  contacts_in_campaign: number;
  potential_accounts_reached: number;
  prospects_in_campaign: number;
  deals_in_campaign: number;
  closed_won_deals: number;
  closed_won_amount: number;
  deal_amount: number;
}

export interface CampaignMember {
  id: string;
  name: string;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  status: string;
  lead_contact_status: string;
  engaged_at_event: boolean;
  engaged_pre_event: boolean;
  has_post_campaign_activity: boolean;
  days_since_last_activity: number | null;
  associated_company_id?: string;
  company_lifecyclestage?: string;
  last_activity_date?: string;
  owner_id?: string;
  owner_name?: string;
}

export interface CompanyContactLabel {
  company: string;
  label: "Single Contact" | "Multi Contact";
  contacts: CampaignMember[];
}

export interface ClosedWonByOwner {
  owner_id: string;
  owner_name: string;
  total_amount: number;
  deal_count: number;
  deals: { id: string; name: string; amount: number; close_date: string; company: string }[];
}

export interface WinRateByOwner {
  owner_id: string;
  owner_name: string;
  total_deals: number;
  closed_won_deals: number;
  win_rate: number;
}

export interface AssociatedCompany {
  id: string;
  name: string;
  domain: string;
  industry: string;
  city: string;
  state: string;
  contact_label?: string;
  lifecyclestage?: string;
  owner_id?: string;
  owner_name?: string;
}

export interface CampaignDetails {
  type: string;
  approval_status: string;
  status: string;
  channel_entity: string;
  start_date: string;
  end_date: string;
  city: string;
  state: string;
  country: string;
  actual_cost: number;
  budgeted_cost: number;
  revenue_per_dollar_spent: number;
  cost_per_closed_won_deal: number;
  closed_won_deals_in_campaign: number;
}

export interface OpportunityByOwner {
  owner_id: string;
  owner_name: string;
  deal_count: number;
  total_amount: number;
  deals: { id: string; name: string; amount: number; stage: string; create_date: string; company: string }[];
}

export interface ClosedLostReason {
  reason: string;
  count: number;
  deals: { id: string; name: string; amount: number; company: string; owner: string }[];
}

export interface FollowUpStats {
  avg_days: number;
  followed_up_count: number;
  not_followed_up_count: number;
  total_engaged: number;
}

export interface CampaignDashboardData {
  campaigns: CampaignSummary[];
  selected_campaign: CampaignSummary | null;
  members: CampaignMember[];
  company_labels: CompanyContactLabel[];
  closed_won_by_owner: ClosedWonByOwner[];
  win_rate_by_owner: WinRateByOwner[];
  associated_companies: AssociatedCompany[];
  contacted_companies: AssociatedCompany[];
  targeted_contacts: CampaignMember[];
  engaged_contacts: CampaignMember[];
  engaged_non_customers: CampaignMember[];
  post_campaign_active: CampaignMember[];
  contacted_non_customer_companies: AssociatedCompany[];
  contacts_needing_follow_up: CampaignMember[];
  companies_followed_up: AssociatedCompany[];
  companies_needing_follow_up: AssociatedCompany[];
  campaign_details: CampaignDetails | null;
  opportunities_by_owner: OpportunityByOwner[];
  closed_lost_reasons: ClosedLostReason[];
  follow_up_stats: FollowUpStats | null;
  metrics: {
    targeted_companies: number;
    total_contacts: number;
    companies_with_contacts: number;
    single_contact_companies: number;
    multi_contact_companies: number;
    conversion_rate: number;
    deals_in_campaign: number;
    closed_won_deals: number;
    closed_won_amount: number;
    engaged_at_event: number;
    engaged_pre_event: number;
    post_campaign_activity: number;
    status_breakdown: Record<string, number>;
    associated_companies_count: number;
    contacted_companies_count: number;
    targeted_contacts_count: number;
    engaged_contacts_count: number;
    engaged_non_customers_count: number;
    post_campaign_active_count: number;
    contacted_non_customer_companies_count: number;
    contacts_needing_follow_up_count: number;
    companies_followed_up_count: number;
    companies_needing_follow_up_count: number;
  } | null;
  updated_at: string;
}

export interface DealLine {
  product: string;
  amount: number;
}

export interface Branch {
  branch_name: string;
  lat: number | null;
  lng: number | null;
}

export interface Deal {
  name: string;
  company: string;
  status: "Customer" | "Prospect";
  stage: string;
  amount: number;
  erp: string;
  owner: string;
  created: string;
  won_date: string;
  product: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  industry: string;
  employees: number;
  revenue: number;
  domain: string;
  phone: string;
  address: string;
  website: string;
  emp_range: string;
  rev_range: string;
  amt_range: string;
  cum_amt_range: string;
  deal_breakdown: DealLine[];
  buying_group: string;
  territory: string;
  branches: Branch[];
  arr: number;
  arr_range: string;
  num_locations: number;
  loc_range: string;
  open_pipeline_value: number;
  updated_at: string;
  /** HubSpot company record ID (for CRM links); set for company-only rows from warehouse sync */
  hubspot_company_id?: string;
  /** deal = from hubspot_deals aggregation; company = hubspot_companies row with no qualifying deal */
  record_source?: "deal" | "company";
  /** Credit-card surcharging (bi_ecommerce_config or HubSpot company fields) */
  surcharge_orders?: boolean | null;
  surcharge_payments?: boolean | null;
  surcharge_orders_rate_pct?: number | null;
  surcharge_payments_rate_pct?: number | null;
  surcharge_source?: "platform" | "hubspot" | null;
}
