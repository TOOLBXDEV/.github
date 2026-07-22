# CLAUDE.md — TOOLBX Sales Hub

Instructions for Claude (or any AI assistant) working in this repository.

## What this is

**TOOLBX Sales Hub** is an internal Next.js app for TOOLBX sales ops:

1. **Sales Heatmap** (`/`) — interactive Leaflet map of customers and pipeline companies from Redshift (HubSpot sync).
2. **Campaign dashboard** (`/campaigns`) — Events Follow-Up Dashboard with HubSpot GTM Campaign analytics.
3. **Website Traffic** (`/website-traffic`) — Apollo visitor intelligence + Google Search Console keyword analytics.
4. **In-app docs** (`/docs`) — data logic reference (may lag code; see `docs/HANDOFF.md`).
5. **Static customer map export** — PNG for decks; not part of the live app.

**Production URL:** https://toolbx-sales-hub-teal.vercel.app  
**GitHub:** https://github.com/TOOLBXDEV/toolbx-sales-hub  
**HubSpot portal:** 49044619

## Quick start

```bash
cp .env.example .env.local   # fill Redshift + HubSpot secrets (never commit)
npm install
npm run dev                  # http://localhost:3000
npm run build                # verify before deploy
```

Redshift credentials are required for `/api/deals` and most scripts. Without them, the map falls back to `public/deals-snapshot.json` (bundled at build time).

## Architecture (read this first)

```
app/
  page.tsx                    → SalesMap (dynamic, no SSR)
  components/SalesMap.tsx     → map UI, filters, export, popups (~large file)
  campaigns/page.tsx          → Events Follow-Up Dashboard UI
  website-traffic/page.tsx    → Apollo visitor intelligence + GSC keywords
  docs/page.tsx               → in-app documentation
  api/deals/route.ts          → main data API (Redshift, 60s timeout on Vercel)
  api/bigbox/route.ts         → Lowe's / Home Depot overlay points
  api/campaign-dashboard/route.ts → campaign funnel metrics (HubSpot API)
  api/visitor-data/route.ts   → Apollo + HubSpot enriched visitor data
  api/gsc-keywords/route.ts   → Google Search Console keyword data (live)
  api/cron/geocode/route.ts   → weekly company geocoding cron
  api/cron/gsc-snapshot/route.ts → monthly GSC data archival cron
lib/
  types.ts              → Deal, Campaign types
  map-stages.ts         → DEFAULT_MAP_STAGES, LEAD_COMPANY_LIFECYCLE_SQL
  surcharge.ts          → credit card surcharge parsing for Customer popups
  redshift.ts           → pg Pool singleton
data/
  branch-locations.json     → geocoded branch pins (multi-location customers)
  company-locations.json    → HQ coordinate overrides (Nominatim/manual)
  visitor-companies.json    → Apollo company visitor data (refreshed periodically)
  visitor-people.json       → Apollo people visitor data (refreshed periodically)
  page-intelligence.json    → Apollo keyword/page intelligence mapping
  gsc-history.json          → monthly GSC keyword snapshots (permanent archive)
public/
  deals-snapshot.json   → offline fallback (~325 companies)
  big-box-stores.json   → big-box chain overlay
scripts/                → one-off maintenance & exports (see docs/HANDOFF.md)
output/                 → generated PNGs (gitignored except handoff zip)
```

### Data flow (heatmap)

1. `GET /api/deals` queries `hubspot_deals` + `hubspot_companies` + `hubspot_owners`.
2. Deals aggregated **one row per company** (closed-won OR open sales-pipeline deals).
3. Optional: `?includeLeads=1` adds ~8k lead-lifecycle companies (slow).
4. Company-only rows (no qualifying deal) gated behind `INCLUDE_COMPANY_ONLY_RECORDS=true`.
5. Coordinates: HubSpot lat/lng → override from `company-locations.json` → branch pins from `branch-locations.json`.
6. Surcharging: join `bi_ecommerce_config.credit_card_surcharge_config` + HubSpot surcharge fields.

### Customer lifecycle PNG (separate from heatmap)

`node scripts/generate-customer-map-image.mjs` → `output/customer-lifecycle-map.png`

- One dot = one HubSpot company (deduped by name).
- Includes lifecycle **Customer** OR closed-won + **In Flight / Awaiting Kick Off Call**.
- Does **not** plot branch pins (unlike live heatmap).
- Coordinate overrides in `data/company-locations.json` (e.g. Builders FirstSource → West Jordan UT).

## Environment variables

See `.env.example`. Critical ones:

| Variable | Purpose |
|----------|---------|
| `REDSHIFT_*` | Warehouse queries (heatmap, visitor enrichment) |
| `HUBSPOT_ACCESS_TOKEN` | Campaign dashboard + visitor HubSpot enrichment |
| `GSC_SERVICE_ACCOUNT_KEY` | Google Search Console API (JSON or base64 service account key) |
| `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` | CRM links in popups (default 49044619) |
| `INCLUDE_LEAD_COMPANIES` | `1` to load lead companies on `/api/deals` |
| `INCLUDE_COMPANY_ONLY_RECORDS` | `true` for ~9k company-only rows (slow) |
| `CRON_SECRET` | Bearer for `/api/cron/geocode` and `/api/cron/gsc-snapshot` |

## Deploy

See `DEPLOY.md`. Known issue: git push alone may **not** update production; use GitHub Action (needs `VERCEL_TOKEN` secret) or `npx vercel deploy --prod`.

Vercel project IDs are in `.github/workflows/deploy-vercel.yml` and `DEPLOY.md`.

After API/schema changes:

```bash
npm run export-deals-snapshot
# commit public/deals-snapshot.json, deploy
```

## Coding conventions

- Match existing patterns in `SalesMap.tsx` and `app/api/deals/route.ts`.
- Minimize scope; this is a focused internal tool, not a platform.
- Redshift ≠ Postgres: no `DISTINCT ON`, limited correlated subqueries; test SQL against Redshift.
- Do not commit `.env.local`, credentials, or `.vercel/`.
- Do not add columns to SQL without verifying they exist in Redshift (`information_schema.columns`).
- Brand colors live inline in `SalesMap.tsx` as `T` object (TOOLBX palette).

## Common tasks

| Task | Command |
|------|---------|
| Refresh deals fallback | `npm run export-deals-snapshot` |
| Regenerate customer PNG | `npm run generate-customer-map` |
| Geocode branches | `node scripts/geocode-branches.mjs` |
| Geocode companies | `node scripts/geocode-companies.mjs` |
| Package for handoff | `npm run package-handoff` |

## Key files to touch carefully

- `app/api/deals/route.ts` — production API; breaking changes empty the map.
- `app/components/SalesMap.tsx` — monolithic UI; search before editing.
- `app/api/visitor-data/route.ts` — complex enrichment pipeline; AE territory mapping lives here.
- `app/api/campaign-dashboard/route.ts` — campaign funnel logic; follow-up detection chain.
- `public/deals-snapshot.json` — large; refresh with script, don't hand-edit.
- `data/company-locations.json` — manual geo overrides; keep sorted roughly A–Z.
- `data/visitor-companies.json` / `data/visitor-people.json` — Apollo data; refresh from Apollo exports.

## Campaign dashboard (`/campaigns`) — deep dive

The campaign dashboard is the **Events Follow-Up Dashboard**, a full-featured analytics page for HubSpot GTM Campaign custom objects. It is the most actively developed part of the app.

### Architecture

```
app/campaigns/page.tsx          → Full dashboard UI (single large file)
app/api/campaign-dashboard/route.ts → Backend: Redshift + HubSpot API data fetching
lib/types.ts                    → TypeScript interfaces for all dashboard data
```

### Data sources (hybrid)

- **Redshift** (`getPool()`) — campaign summaries list (name, dates, deal counts). Used to populate the campaign dropdown.
- **HubSpot CRM API** (v3/v4) — granular real-time data: contacts, companies, deals, associations, owners, and custom GTM Campaign object properties.

### HubSpot object type IDs

| Object | Type ID |
|--------|---------|
| GTM Campaign (custom) | `2-41201412` |
| Campaign Member (custom) | `2-41201420` |
| Contact | `0-1` |
| Company | `0-2` |

### Contact & company funnel logic

The dashboard presents two parallel funnels (contact-based and company-based):

**Contact funnel:**
```
All Campaign Contacts (any association label)
  → Engaged Contacts (contacts with "Engaged" association label)
    → Engaged Non-Customers (company lifecyclestage ≠ "customer")
      → Followed Up With (activity after campaign end date)
      → Contacts Needing Follow Up (engaged non-customers NOT followed up)
```

**Company funnel:**
```
All Campaign Companies (via HubSpot v4 associations)
  → Engaged Companies (companies with ≥1 "Engaged"-labeled contact)
    → Engaged Non-Customer Companies (lifecyclestage ≠ "customer")
      → Companies Followed Up With (≥1 campaign contact with post-campaign activity)
      → Companies Needing Follow Up (non-customer co. NOT followed up)
```

### Follow-up detection (multi-field)

Follow-up activity is determined by taking the **max** of three HubSpot date fields:
- `notes_last_contacted` — manually logged calls, emails, meetings
- `hs_sales_email_last_replied` — email replies via connected inbox (Gmail/Outlook sync)
- `hs_last_sales_activity_timestamp` — outbound sales emails, calls, meetings

This was chosen to capture emails sent from outside HubSpot (which don't update `notes_last_contacted`) while excluding internal notes (which would update `notes_last_updated`).

**Company follow-up uses ALL campaign contacts** (any label), not just "Engaged" contacts. If any contact at a company on the campaign has post-campaign activity, the company counts as "followed up."

### Additional tiles

- **Closed Won ARR & Deals** — uses `hs_arr` (Annual Recurring Revenue), grouped by deal owner
- **Avg Win Rate** — closed-won / total deals per owner
- **Opportunities by Rep** — all campaign deals grouped by owner, using `hs_arr`
- **Efficiency KPIs** — revenue per $ spent, cost per closed-won deal, actual vs budgeted cost
- **Closed Lost Reasons** — breakdown by `closed_lost_reason__c`
- **Avg Days to Follow Up** — days between campaign end date and first post-campaign activity

### Admin features

- **Password-gated admin mode** (`toolbx2026`) — enables drag-and-drop layout editing, tile deletion, tile renaming
- **Layout engine** — `react-grid-layout` (Responsive), free positioning (no vertical compaction), collision prevention
- **Layout persistence** — `localStorage` with automatic merging of new tiles from `DEFAULT_LAYOUT`
- **DEFAULT_LAYOUT** — hardcoded in `page.tsx`; update this to change what all users see by default

### Campaign filter

- Searchable typeahead with **date range filters** (start/end date)
- Shows campaign metadata when selected: Type, Status, Channel Entity, dates, location
- Campaigns sourced from Redshift `hubspot_gtm_campaigns` table

### Detail modals

- Clicking any KPI opens a detail modal with individual records
- Contact/company names are **hyperlinks to HubSpot** (`https://app.hubspot.com/contacts/49044619/record/0-1/{id}/`)
- **Excel export** available in detail modals (removed from tile surfaces)
- Owner column shown in all detail views

### Tooltips

Every tile title has a hover tooltip (CSS-based, Tailwind `group/tooltip`) explaining how the metric is calculated. Tooltips render above adjacent tiles (no `overflow-hidden` on widget container).

### Key gotchas

- `lifecyclestage` from HubSpot API returns internal IDs for custom stages (e.g., `"1324949332"` = "Closed Lost - Re-engage"), but standard stages return lowercase strings (e.g., `"customer"`, `"lead"`). The code compares against `"customer"` string.
- Campaign `end_date` from Redshift can be malformed (e.g., `"Wed Mar 04"`); always use `campaignDetails.end_date` from HubSpot API which returns ISO format `"2026-03-04"`.
- Layout customizations are per-browser (`localStorage`). To change default layout for all users, update `DEFAULT_LAYOUT` in code.

## Website traffic (`/website-traffic`) — deep dive

Apollo Visitor Intelligence + Google Search Console analytics page. Three tabs: Companies, People, Keywords.

### Architecture

```
app/website-traffic/page.tsx       → Full UI (~888 lines, single file)
app/api/visitor-data/route.ts      → Apollo data + HubSpot enrichment (~1,119 lines)
app/api/gsc-keywords/route.ts      → Live GSC keyword data (~263 lines)
app/api/cron/gsc-snapshot/route.ts  → Monthly GSC archival cron (~234 lines)
data/visitor-companies.json        → Apollo company visitor data (static, refreshed periodically)
data/visitor-people.json           → Apollo people visitor data (static, refreshed periodically)
data/page-intelligence.json        → Apollo keyword/page intelligence mapping
data/gsc-history.json              → Permanent GSC monthly snapshots
```

### Data flow

1. **Apollo data** (static JSON) — `visitor-companies.json` and `visitor-people.json` are periodically refreshed from Apollo's visitor intelligence. These provide company names, domains, visit counts, intent scores.
2. **HubSpot enrichment** (live) — `/api/visitor-data` merges Apollo data with live Redshift/HubSpot queries to add: lifecycle stage, HubSpot owner, active deals, company links, contact counts.
3. **AE territory mapping** — State/province codes mapped to Account Executives via `STATE_TO_AE` and `OWNER_ID_TO_AE` lookups in `visitor-data/route.ts`.
4. **GSC keywords** (live) — `/api/gsc-keywords` queries Google Search Console API for keyword performance (clicks, impressions, CTR, position).
5. **Keyword attribution** — Individual keywords are attributed to visitor companies via `page-intelligence.json` with confidence scoring.

### Key data files

- `data/visitor-companies.json` — ~50 companies (latest refresh). Can be expanded to 1,178 companies from full Apollo dataset.
- `data/visitor-people.json` — ~25 people (latest refresh). Can be expanded to 776 people.
- `data/page-intelligence.json` — maps page URLs to keywords and topics for attribution.
- `data/gsc-history.json` — monthly GSC snapshots. Cron runs 1st of each month to persist data before GSC's 16-month rolling window expires.

### AE territory assignments

Hardcoded in `app/api/visitor-data/route.ts` (`STATE_TO_AE` map). Update there when territory assignments change.

### Refreshing Apollo data

Apollo visitor data is stored as static JSON files. To refresh:
1. Export from Apollo Visitor Intelligence
2. Update `data/visitor-companies.json` and `data/visitor-people.json`
3. Commit and deploy

See `scripts/refresh-visitor-data-notes.md` and `VISITOR_DATA_REFRESH_COMPLETE.md` for process details.

## Related docs

- `docs/START-HERE.md` — handoff entry point (read first in Claude)
- `docs/HANDOFF.md` — full project history, stats, script inventory, Cursor→Claude migration
- `DEPLOY.md` — Vercel troubleshooting
- `docs/hubspot-company-geography-runbook.md` — HubSpot geo data quality
- `HUBSPOT_DATA_INTEGRITY_LOG.md` — known CRM data issues

## When stuck

1. Hit `/api/deals` locally or on prod; check for SQL errors in JSON response.
2. Compare live API vs `public/deals-snapshot.json` deal count.
3. Verify Redshift column names before adding SELECT fields.
4. Read `docs/HANDOFF.md` § "Troubleshooting" and § "Recent changes".
5. For campaign dashboard issues, check `/api/campaign-dashboard?campaignId=<id>` response directly.
6. For follow-up detection issues, verify: (a) contact has "Engaged" label on the specific campaign, (b) company lifecyclestage ≠ "customer", (c) max of the three activity date fields > campaign end date.
7. For website traffic issues, check `/api/visitor-data?type=companies` and `/api/gsc-keywords` responses.
8. If GSC returns auth errors, verify `GSC_SERVICE_ACCOUNT_KEY` env var is set (JSON or base64).
