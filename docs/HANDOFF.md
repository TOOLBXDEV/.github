# TOOLBX Sales Hub — Handoff Package

This document captures everything needed to continue maintaining this project **without Cursor**. It was assembled May 2026 after the project was built and iterated primarily in Cursor.

---

## 1. Project summary

| Item | Value |
|------|-------|
| **Purpose** | Internal sales heatmap + campaign analytics for TOOLBX |
| **Stack** | Next.js 16, React 19, TypeScript, Tailwind 4, Leaflet, Redshift (`pg`), Vercel |
| **Repo** | https://github.com/TOOLBXDEV/toolbx-sales-hub |
| **Production** | https://toolbx-sales-hub-teal.vercel.app |
| **HubSpot portal** | 49044619 |
| **Vercel project ID** | `prj_zVoRPEIJHiKtGdWGkEdwwvNXy0ea` |
| **Vercel org ID** | `team_zqiqDqyPUMVKHXu2awGmAseq` |

### Pages

| Route | Description |
|-------|-------------|
| `/` | Interactive sales heatmap (`SalesMap.tsx`) |
| `/campaigns` | HubSpot campaign dashboard |
| `/docs` | In-app documentation (partial; this file is authoritative for ops) |

---

## 2. What was built (timeline highlights)

Built iteratively in Cursor (~2025–2026):

- **Core heatmap** — Redshift-backed deal/company map with stage filters, clustering, popups, Excel export.
- **Branch pins** — Multi-location customers via `data/branch-locations.json` (geocoded from `bi_branch`).
- **HQ overrides** — `data/company-locations.json` for companies with bad/missing HubSpot coords.
- **Big box overlay** — Lowe's / Home Depot from `public/big-box-stores.json`; off by default.
- **Company-only records** — HubSpot companies without qualifying deals (optional, env-gated).
- **Lead companies** — `?includeLeads=1` loads lead-lifecycle companies (~8.6k with coords).
- **Surcharging** — Customer popup shows credit-card surcharge config from platform + HubSpot.
- **Resilience** — `public/deals-snapshot.json` + bundled import when `/api/deals` fails.
- **Campaign dashboard** — Separate HubSpot API integration at `/campaigns`.
- **Static customer map PNG** — `scripts/generate-customer-map-image.mjs` for marketing/deck use.
- **Deploy fixes** — GitHub Action for Vercel; docs for manual redeploy when auto-deploy stale.

---

## 3. Data model & business rules

### Heatmap: who appears on the map?

**Deal-backed companies** (primary query in `app/api/deals/route.ts`):

- Any **closed-won** deal (any pipeline), OR
- **Open** deal on Sales Pipeline (`properties_pipeline = 'default'`).

Aggregated to **one pin per company name**.

**Stage display logic:**

- Closed-won → stage **Customer** (even if HubSpot lifecycle ≠ customer).
- Else → mapped from `properties_lifecyclestage` (see `LIFECYCLE_MAP` in deals route).

**Optional add-ons:**

- `includeLeads=1` — lead-funnel lifecycle companies with lat/lng.
- `INCLUDE_COMPANY_ONLY_RECORDS=true` — companies with no qualifying deal (~9k rows, slow).

### Customer lifecycle PNG (static export)

Separate rules in `scripts/generate-customer-map-image.mjs`:

- HubSpot lifecycle = **customer**, OR
- Closed-won + lifecycle **In Flight** (`1050035316`) or **Awaiting Kick Off Call** (`1050035315`).
- One dot per company; **no branch pins**.
- Overrides from `company-locations.json` (e.g. **Builders FirstSource → West Jordan, UT** for BFS Utah pilot).

**Counts (July 2026):**

| Rule set | Qualifying companies | Plotted on PNG |
|----------|---------------------|----------------|
| Current export rules | 162 | 159 |
| Customer lifecycle only | 131 | 129 |

**Location totals (July 2026):**

| Measure | Customer lifecycle only | Current map rules |
|---------|------------------------|-------------------|
| Pins on map | 129 | 159 |
| Platform active branches | 323 (98 cos.) | 401 (115 cos.) |
| Geocoded branch pins | 202 | 220 |
| HubSpot `# of locations` sum | 1,032 (71 cos.) | 1,254 (88 cos.) |

**Planned:** switch location metric from `properties_of_locations__c` to HubSpot **`properties_toolbx_active_stores`** (`toolbx_active_stores`) — better coverage on customers (~127 filled vs ~119 for # of locations); lower totals (~452 vs ~1,320 for customer lifecycle).

**Locations (for customer-lifecycle-only, 128 companies):**

- Map pins: 128 (1 per company)
- Platform branches (`bi_branch`): ~323 across 98 companies
- Geocoded branch file: 202 pins across 37 companies

### Redshift tables used

| Table | Use |
|-------|-----|
| `hubspot_deals` | Pipeline, amounts, closed-won, company name |
| `hubspot_companies` | Lifecycle, geo, firmographics, owner |
| `hubspot_owners` | Owner names |
| `bi_ecommerce_config` | Surcharge config, display names |
| `bi_branch` | Branch/store records (geocoding scripts) |

**Important:** HubSpot company association on deals uses `properties_company_name` (string match), not `properties_associatedcompanyid` (column does not exist in this warehouse schema).

---

## 4. Repository layout

```
toolbx-sales-hub/
├── CLAUDE.md                 ← AI assistant instructions (start here)
├── README.md                 ← Human quick start
├── DEPLOY.md                 ← Vercel deploy troubleshooting
├── docs/
│   ├── HANDOFF.md            ← this file
│   └── hubspot-company-geography-runbook.md
├── app/
│   ├── page.tsx
│   ├── components/SalesMap.tsx    # Main UI (~thousands of lines)
│   ├── api/deals/route.ts         # Core API
│   ├── api/bigbox/route.ts
│   ├── api/campaign-dashboard/route.ts
│   ├── api/cron/geocode/route.ts
│   ├── campaigns/page.tsx
│   └── docs/page.tsx
├── lib/
│   ├── types.ts
│   ├── map-stages.ts
│   ├── surcharge.ts
│   └── redshift.ts
├── data/
│   ├── branch-locations.json      # ~2.4k branch pin rows
│   ├── company-locations.json     # ~300 HQ overrides
│   └── .geocode-truevalue.json    # geocode cache (optional)
├── public/
│   ├── deals-snapshot.json        # ~325 companies fallback
│   └── big-box-stores.json
├── scripts/                       # See §5
├── output/                        # Generated PNGs (gitignored)
└── .github/workflows/deploy-vercel.yml
```

---

## 5. Scripts inventory

| Script | Purpose |
|--------|---------|
| `export-deals-snapshot.mjs` | Refresh `public/deals-snapshot.json` from Redshift |
| `generate-customer-map-image.mjs` | PNG export → `output/customer-lifecycle-map.png` |
| `geocode-branches.mjs` | Regenerate `data/branch-locations.json` via Nominatim |
| `geocode-companies.mjs` | Regenerate HQ overrides in `company-locations.json` |
| `fetch-all-big-box.mjs` | Refresh big-box store data |
| `fetch-big-box-stores.mjs` | OSM-based big-box fetch variant |
| `hubspot-apply-lifecycle-updates.mjs` | Bulk HubSpot lifecycle updates |
| `hubspot_apply_lifecycle_updates.py` | Python variant of lifecycle updates |
| `copy_deal_blanks_merge.py` | Deal property backfill helper |
| `company-owner-cleanup.gs` | Google Apps Script for owner cleanup |
| `package-handoff.sh` | Create zip archive for migration |

Most scripts read `.env.local` for Redshift credentials (same pattern as API).

---

## 6. Secrets & migration checklist

### Copy separately (never in git)

- [ ] `.env.local` from your machine — or recreate from `.env.example`:
  - `REDSHIFT_HOST`, `REDSHIFT_PORT`, `REDSHIFT_DB`, `REDSHIFT_USER`, `REDSHIFT_PASSWORD`
  - `HUBSPOT_ACCESS_TOKEN`
  - `CRON_SECRET` (if using cron geocode)
- [ ] Vercel env vars (Production): same Redshift keys + optional flags
- [ ] GitHub secret `VERCEL_TOKEN` for Actions deploy workflow
- [ ] HubSpot private app token (campaign dashboard)

### On new machine

```bash
git clone https://github.com/TOOLBXDEV/toolbx-sales-hub.git
cd toolbx-sales-hub
cp .env.example .env.local   # paste secrets
npm install
npx playwright install chromium   # only if running customer-map PNG script
npm run dev
```

### Using Claude Code

1. Open repo root in Claude Code (or your IDE with Claude).
2. Claude reads `CLAUDE.md` automatically.
3. Point Claude at `docs/HANDOFF.md` for deeper context.
4. Prefer `npm run build` before deploy-related changes.

---

## 7. Deploy & operations

See `DEPLOY.md` for full detail. Short version:

```bash
# Local verify
npm run build

# Refresh fallback data
npm run export-deals-snapshot

# Deploy (if GitHub Action not wired)
npx vercel login
npx vercel link    # select toolbx-sales-hub project
npx vercel deploy --prod
```

**Verify production:**

- `GET https://toolbx-sales-hub-teal.vercel.app/api/deals` — large `deals` array, no SQL errors
- Map shows TOTAL > 0

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty map (0 deals) | Stale Vercel deploy or API 500 | Redeploy; check `/api/deals` error message |
| SQL column does not exist | Redshift schema drift | Remove/rename column in SQL; verify via `information_schema.columns` |
| API timeout (~28s) | Company-only or leads query too large | Keep `INCLUDE_COMPANY_ONLY_RECORDS` off; use `includeLeads=1` only when needed |
| Wrong pin location | Bad HubSpot HQ geo | Add override to `company-locations.json` |
| Missing new customer on PNG | Lifecycle not Customer yet | Extend rules in `generate-customer-map-image.mjs` or update HubSpot lifecycle |
| Sunpro-style gaps | Closed-won but pre-Customer lifecycle | Already handled in PNG export; heatmap uses closed-won → Customer |

---

## 9. Notable customers / edge cases

Documented during development:

- **Sunpro** — Closed-won Jun 2026; lifecycle still *Awaiting Kick Off Call*; Orem UT; on PNG via in-flight rule.
- **Builders FirstSource (BFS Utah)** — Lifecycle Customer; HQ in HubSpot is NC; PNG uses West Jordan UT override for pilot location.
- **Paradigm Technology** — BFS tech arm; separate HubSpot company; Middleton WI; closed-won deal Nov 2025.

---

## 10. Campaign dashboard — detailed architecture (added Jun 2026)

The **Events Follow-Up Dashboard** (`/campaigns`) was built iteratively from Feb–Jun 2026. It is the most complex and actively developed feature.

### Data flow

```
Redshift (hubspot_gtm_campaigns) → campaign list + summaries
HubSpot CRM API v4 → associations (contacts/companies ↔ GTM Campaign)
HubSpot CRM API v3 → contact details, company details, deals, owners
                    → GTM Campaign custom object properties
```

### HubSpot custom object IDs

- GTM Campaign: `2-41201412`
- Campaign Member: `2-41201420`
- Association label type IDs: `101` (unlabeled), `265` ("Targeted"/"Engaged"/etc.)

### Contact funnel stages

1. **All Campaign Contacts** — all contacts associated with the GTM Campaign (any label)
2. **Engaged Contacts** — contacts with the `"Engaged"` association label
3. **Engaged Non-Customers** — engaged contacts whose associated company `lifecyclestage ≠ "customer"`
4. **Followed Up With** — engaged non-customers with post-campaign activity
5. **Contacts Needing Follow Up** — engaged non-customers NOT in stage 4, grouped by owner

### Company funnel stages

1. **All Campaign Companies** — via HubSpot v4 company associations
2. **Engaged Companies** — companies with ≥1 contact bearing the "Engaged" label (derived from contact-level data, NOT from company association labels)
3. **Non-Customer Companies** — engaged companies where `lifecyclestage ≠ "customer"`
4. **Companies Followed Up With** — non-customer companies where ANY campaign contact (any label) has post-campaign activity
5. **Companies Needing Follow Up** — non-customer companies NOT in stage 4, grouped by owner

### Follow-up detection (multi-field approach)

`last_activity_date` = max of:
- `notes_last_contacted` (logged calls, emails, meetings)
- `hs_sales_email_last_replied` (email replies via connected inbox)
- `hs_last_sales_activity_timestamp` (outbound sales activity)

This was chosen to capture emails sent from outside HubSpot while excluding internal notes. Company follow-up checks ALL campaign contacts at the company, not just "Engaged" ones.

### Deal-based tiles

- **Closed Won ARR & Deals** — `hs_arr` property, grouped by deal owner
- **Opportunities by Rep** — all campaign deals, `hs_arr`, grouped by owner
- **Efficiency KPIs** — revenue/$ spent, cost/deal, actual vs budgeted cost
- **Closed Lost Reasons** — `closed_lost_reason__c` property
- **Avg Win Rate** — per owner

### UI system

- `react-grid-layout` (Responsive) with free positioning, no vertical compaction, collision prevention
- Admin mode gated by password `toolbx2026`
- Layout, hidden tiles, custom names persisted in `localStorage`
- `DEFAULT_LAYOUT` in code = what new/cleared browsers see
- Tooltips via CSS (`group/tooltip`), no `overflow-hidden` on widget container
- All record names in detail modals hyperlink to HubSpot (`/contacts/49044619/record/0-1/{id}/` or `0-2/{id}/`)
- Excel export in detail modals only (removed from tile surfaces Jun 2026)
- Date range filter on campaign dropdown (start/end date inputs)
- Brand colors: TOOLBX palette — primary `#FFCA05` (yellow), accent `#457F86` (teal), dark bg `#1E1E20`

### Key files

- `app/campaigns/page.tsx` — monolithic UI component (~1500+ lines). Contains `WIDGET_LABELS`, `WIDGET_TOOLTIPS`, `DEFAULT_LAYOUT`, all tile rendering, modals, admin logic.
- `app/api/campaign-dashboard/route.ts` — all data fetching and metric computation (~800 lines). Contains `fetchLabeledContactIds`, `fetchContactDetails`, `fetchCompanyDetails`, `fetchCampaignDetails`, `enrichContactsWithLifecyclestage`, `fetchAllOwnerNames`, and the main `GET` handler.
- `lib/types.ts` — `CampaignMember`, `AssociatedCompany`, `CampaignDashboardData` interfaces.

### Known issues & edge cases

- `lifecyclestage` returns internal numeric IDs for custom stages (e.g., `"1324949332"` = "Closed Lost - Re-engage") but lowercase strings for standard stages (`"customer"`, `"lead"`). Code checks against `"customer"`.
- Campaign `end_date` from Redshift can be malformed; always use HubSpot API's `enddate` property.
- Contacts can have multiple association labels (e.g., `["Engaged", "Conversation", "Pending", "New logo"]`); code checks for presence of "Engaged" or "Targeted".
- Some contacts have no `associatedcompanyid`; these are excluded from company-level metrics.

---

## 11. Recent changes (Jun 2026)

| Change | Files | Date |
|--------|-------|------|
| Multi-field follow-up detection (3 HubSpot date fields) | `route.ts` | Jun 2026 |
| Company follow-up broadened to all campaign contacts | `route.ts` | Jun 2026 |
| Date range filtering on campaign dropdown | `page.tsx` | Jun 2026 |
| Excel buttons removed from tile surfaces | `page.tsx` | Jun 2026 |
| "Engaged Companies" derived from contact-level "Engaged" label | `route.ts` | Jun 2026 |
| Default layout hardcoded to match admin preference | `page.tsx` | Jun 2026 |
| Owner column in detail modals | `page.tsx`, `route.ts` | Jun 2026 |
| HubSpot record hyperlinks in detail modals | `page.tsx` | Jun 2026 |
| Tile name wrapping (2-line support) | `page.tsx` | Jun 2026 |
| Tooltip z-index fix (overflow-hidden removal) | `page.tsx` | Jun 2026 |
| TOOLBX brand theme applied | `page.tsx` | Jun 2026 |

---

## 12. Uncommitted / local-only state

Check `git status` before starting. As of Jun 2026, there may be uncommitted changes to `app/api/deals/route.ts` and untracked scripts in `scripts/`.

---

## 13. Cursor → Claude migration notes

**Handoff entry point:** `docs/START-HERE.md` → `CLAUDE.md` → this file.

The handoff zip (`npm run package-handoff`) includes **sales heatmap core only**. The full GitHub repo may also have Apollo visitor intelligence, website-traffic/GSC pages, and cleanup audits — those are excluded from the zip (see `HANDOFF-MANIFEST.txt` in the archive).

This project had **no `.cursor/` rules** in-repo; conventions live in `CLAUDE.md` now.

Cursor-specific artifacts **not** needed for Claude:

- Cursor agent transcripts (optional reference only)
- `.cursor/skills` (global to Cursor install, not project)

What Claude needs:

1. This repo (git clone or handoff zip)
2. `CLAUDE.md` (comprehensive project context — Claude reads this automatically)
3. Secrets in `.env.local`
4. Optional: HubSpot MCP if you configure it in Claude's environment

### Using Claude Code

```bash
git clone https://github.com/TOOLBXDEV/toolbx-sales-hub.git
cd toolbx-sales-hub
cp .env.example .env.local   # paste secrets
npm install
# Claude Code will automatically read CLAUDE.md for project context
```

Claude Code looks for `CLAUDE.md` at the project root. The file contains architecture, conventions, data flow, and key file descriptions. For deeper context, point Claude at `docs/HANDOFF.md`.

---

## 14. Contact & ownership

Internal TOOLBX project. Data pipeline (HubSpot → Redshift) is managed outside this repo; this app is a **read-mostly consumer** except HubSpot maintenance scripts.

For CRM data quality issues, see `HUBSPOT_DATA_INTEGRITY_LOG.md` and `docs/hubspot-company-geography-runbook.md`.
