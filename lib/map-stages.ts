/** HubSpot lifecycle stages shown as "leads" on the sales map (display names). */
export const LEAD_STAGE_NAMES = [
  "Subscriber",
  "Lead",
  "Marketing Qualified Lead",
  "Sales Qualified Lead",
  "Closed Lost - Re-engage",
] as const;

/** Lifecycle stages enabled when the map first loads. */
export const DEFAULT_MAP_STAGES = ["Customer", "Opportunity"];

/** SQL filter: company-only rows for lead funnel stages (HubSpot raw values). */
export const LEAD_COMPANY_LIFECYCLE_SQL = `
  AND (
    LOWER(TRIM(c.properties_lifecyclestage)) IN (
      'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'subscriber'
    )
    OR TRIM(c.properties_lifecyclestage) = '1324949332'
  )
  AND NULLIF(TRIM(c.properties_hs_latitude::text), '') IS NOT NULL
  AND NULLIF(TRIM(c.properties_hs_longitude::text), '') IS NOT NULL
`;
