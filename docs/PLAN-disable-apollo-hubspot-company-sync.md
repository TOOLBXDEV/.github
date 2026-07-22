# Plan: Disable Apollo → HubSpot Company Auto-Creation & Clean Up Ghost Records

## Problem

Apollo's HubSpot integration is auto-creating new company records in HubSpot for every company it identifies via website visitor tracking (reverse-IP) and every company touched by the enrichment API. This has created ~900+ "ghost" companies in HubSpot that have no lifecycle stage, no owner, no deal, and no business context. These pollute the CRM, inflate company counts, and create cleanup overhead.

## Constraint

- Apollo-only companies must NOT exist in HubSpot (established rule)
- We must continue using Apollo for visitor identification and keyword enrichment
- HubSpot is the system of record for companies

## Architecture Context

- **HubSpot Portal ID**: 49044619
- **Two Vercel projects**:
  - Next.js API: `toolbx-sales-hub-teal.vercel.app` (team `norman-kuans-projects`, repo `TOOLBXDEV/toolbx-sales-hub`)
  - Vite SPA: `toolbx-sales-hub.vercel.app` (team `toolbx-growth-122690cf`)
- **Data flow**: `/api/visitor-data` in the Next.js app reads from `data/visitor-companies.json` (static Apollo data with keywords), enriches with live Redshift queries against `hubspot_companies`, `hubspot_deals`, `hubspot_owners`, and `hubspot_contacts`
- **Apollo data is stored locally** in `data/visitor-companies.json` with fields: `apollo_keywords`, `apollo_industries`, `apollo_description`, `company_name`, `domain`, `industry`, `annual_revenue`, `employees`, `state`, `country`, `apollo_visits`, `apollo_visitors`, etc.
- **Keyword enrichment** was done via `apollo_organizations_enrich` / `apollo_organizations_bulk_enrich` API calls for 933 domains. The keywords are already saved to the JSON file — they do NOT need to flow through HubSpot.

---

## Execution Plan (4 Steps)

### Step 1: Audit Apollo → HubSpot Sync Settings (via Chrome)

**Goal**: Document the current sync configuration before changing anything.

1. Navigate to Apollo → Settings → Integrations → HubSpot (or `https://app.apollo.io/#/settings/integrations/hubspot`)
2. Screenshot the current settings for all of these:
   - **Company sync direction** (Apollo → HubSpot, HubSpot → Apollo, bidirectional)
   - **"Create new companies in HubSpot"** toggle
   - **"Update existing companies in HubSpot"** toggle
   - **Sync rules / filters** if any exist
   - **Field mappings** for companies
3. Also check: Settings → Integrations → HubSpot → **Sync History** or **Activity Log** to see recent company creation events
4. Save all screenshots to `docs/apollo-hubspot-sync-audit/` for reference

### Step 2: Disable Company Auto-Creation in Apollo

**Goal**: Stop Apollo from creating NEW company records in HubSpot, while preserving updates to EXISTING companies.

1. In Apollo → Settings → Integrations → HubSpot:
   - **Turn OFF** "Create new companies in HubSpot" (or equivalent toggle)
   - **Keep ON** "Update existing companies in HubSpot" (so Apollo can still enrich companies that already exist)
   - If there's no separate toggle and it's a single "Sync companies" toggle, look for sync rules that let you set "Only update existing records, do not create new ones"
2. If Apollo doesn't offer granular create vs. update toggles:
   - Option A: Disable company sync entirely (both directions) — this is the safer choice since our pipeline doesn't depend on Apollo→HubSpot company sync
   - Option B: Add a sync rule/filter like "Only sync companies where [some field] is not empty" using a field that Apollo-identified visitor companies won't have
3. Screenshot the new settings after changes
4. **Verify the change took effect**: Check Apollo's sync queue or activity log to confirm no new company creation jobs are queued

### Step 3: Identify and Delete Apollo-Created Ghost Companies in HubSpot

**Goal**: Find all companies Apollo auto-created (that shouldn't be there) and remove them.

#### 3a. Build the identification query

Run this SQL against Redshift to find Apollo-created ghost companies. These are companies that:
- Have a domain matching our Apollo visitor list
- Have NO lifecycle stage (or lifecycle = blank/lead with no further context)
- Have NO owner
- Have NO associated deals
- Were likely created recently (after Apollo integration was enabled)

```sql
-- Find ghost companies: HubSpot companies with domains matching Apollo visitor list
-- but no meaningful CRM activity (no owner, no deals, no lifecycle progression)
SELECT
  c.id::varchar AS hubspot_company_id,
  c.properties_name AS company_name,
  LOWER(TRIM(c.properties_domain)) AS domain,
  c.properties_lifecyclestage AS lifecycle_stage,
  c.properties_hubspot_owner_id AS owner_id,
  c.properties_hs_analytics_source AS original_source,
  c.createdat AS created_date,
  c.properties_state AS state,
  c.properties_industry AS industry
FROM hubspot_companies c
LEFT JOIN hubspot_deals d
  ON ROUND(d.properties_hs_primary_associated_company)::bigint = c.id::bigint
WHERE c.properties_domain IS NOT NULL
  AND TRIM(c.properties_domain) <> ''
  AND d.id IS NULL                                    -- no associated deals
  AND (c.properties_hubspot_owner_id IS NULL 
       OR c.properties_hubspot_owner_id = '')          -- no owner assigned
  AND (c.properties_lifecyclestage IS NULL 
       OR c.properties_lifecyclestage = '' 
       OR c.properties_lifecyclestage = 'subscriber'
       OR c.properties_lifecyclestage = 'lead')        -- no lifecycle progression
  AND c.properties_hs_analytics_source = 'OFFLINE'    -- Apollo-created typically show as OFFLINE
ORDER BY c.createdat DESC;
```

**Important**: The `properties_hs_analytics_source = 'OFFLINE'` filter is a heuristic — Apollo-created companies often have this source. Verify by cross-referencing the first 20 results against the Apollo visitor list in `data/visitor-companies.json`.

#### 3b. Cross-reference against Apollo visitor list

```python
# Run after the SQL query to cross-reference
# Load Apollo visitor domains
import json
with open('data/visitor-companies.json') as f:
    apollo_companies = json.load(f)
apollo_domains = set(c.get('domain', '').lower() for c in apollo_companies if c.get('domain'))

# The SQL results (ghost_companies) should be loaded here
# Filter to only companies whose domain is in our Apollo visitor list
apollo_ghosts = [c for c in ghost_companies if c['domain'] in apollo_domains]
print(f"Apollo ghost companies to delete: {len(apollo_ghosts)}")
```

#### 3c. Manual review before deletion

Before deleting anything:
1. Export the list to CSV
2. Manually spot-check 10-15 companies to confirm they're truly Apollo-created ghosts and not legitimate companies that just haven't been assigned yet
3. Look for any that have:
   - Contact associations (even without deals, they might have known contacts)
   - Notes or logged activities
   - Any custom property values that suggest manual creation
4. If a company has contacts associated but no deals/owner, it might still be legitimate — err on the side of keeping it

#### 3d. Bulk delete ghost companies

Use the HubSpot API to delete confirmed ghost companies:

```python
# Using the HubSpot MCP connector
# For each ghost company, call the HubSpot API to archive it
# Use: mcp__1219abee-eabf-4c16-a8e7-039615ccb567__manage_crm_objects
# with operation "archive" and objectType "companies"
#
# IMPORTANT: Do this in batches of 10-20, not all at once
# Verify after each batch that no legitimate companies were removed
```

Alternatively, you can do this directly in HubSpot:
1. Go to HubSpot → Contacts → Companies
2. Create a saved view with filters: No owner, No deals, Source = Offline, Lifecycle = Lead/blank
3. Cross-reference with your ghost company list
4. Select and delete in batches

### Step 4: Verify the Fix

**Goal**: Confirm no new ghost companies are being created.

#### 4a. Baseline count

```sql
-- Record the current company count in HubSpot
SELECT COUNT(*) AS total_companies FROM hubspot_companies
WHERE properties_domain IS NOT NULL AND TRIM(properties_domain) <> '';
```

Save this number.

#### 4b. Wait 24-48 hours, then re-check

After the sync disable has been in effect:

```sql
-- Check for any new companies created after the disable timestamp
SELECT
  c.id::varchar AS hubspot_company_id,
  c.properties_name AS company_name,
  LOWER(TRIM(c.properties_domain)) AS domain,
  c.properties_lifecyclestage AS lifecycle_stage,
  c.createdat AS created_date
FROM hubspot_companies c
WHERE c.createdat > '[TIMESTAMP_OF_SYNC_DISABLE]'
ORDER BY c.createdat DESC;
```

If new companies are still appearing with OFFLINE source and no owner, the sync disable didn't fully take effect — re-check Apollo settings.

#### 4c. Verify Website Traffic page still works

1. Open `https://toolbx-sales-hub.vercel.app/website-traffic`
2. Confirm company count is still ~1,058 (Apollo + HubSpot merged)
3. Confirm HubSpot-enriched columns (Owner, Active Deal, Lifecycle, AE Territory) still populate for known HubSpot companies
4. Confirm Apollo-only companies still show with their keywords, industries, and visit data

The Website Traffic page is NOT affected by this change because it reads Apollo data from `visitor-companies.json` (static file) and HubSpot data from Redshift (live query). Removing ghost companies from HubSpot doesn't remove them from the visitor list — it just means fewer false matches in the Redshift enrichment join.

---

## What This Does NOT Change

- Apollo visitor tracking continues to identify companies visiting toolbx.com
- Apollo enrichment API calls continue to work for keywords/industries
- The weekly scheduled Apollo scrape (task #107) continues to update `visitor-companies.json`
- The `/api/visitor-data` endpoint continues to merge Apollo + HubSpot data
- HubSpot companies that were created through normal sales workflows are unaffected
- Apollo can still UPDATE existing HubSpot companies (if that toggle is available and left on)

## Risk Assessment

- **Low risk**: Disabling company auto-creation is a settings toggle, easily reversible
- **Medium risk**: Bulk deleting ghost companies — mitigated by the manual review step and batch approach. Deleted companies go to HubSpot's recycle bin and can be restored within 90 days.
- **No risk to Website Traffic page**: It reads from its own data sources, not from HubSpot company existence

## Tools Needed

- Chrome browser (for Apollo settings)
- Apollo MCP connector (for checking sync config if available via API)
- HubSpot MCP connector (`mcp__1219abee-eabf-4c16-a8e7-039615ccb567__*`) for:
  - `query_crm_data` or `search_crm_objects` to find ghost companies
  - `manage_crm_objects` to archive/delete ghost companies
- Redshift access (via `/api/visitor-data` route's `getPool()`) for the identification SQL
- Access to `data/visitor-companies.json` in the `toolbx-sales-hub` repo for cross-referencing Apollo domains
