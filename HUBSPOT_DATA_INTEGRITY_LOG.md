# HubSpot Data Integrity Issues

Portal ID: 49044619

---

## Issue #1: `product` field missing on 91.6% of deals

**Discovered:** 2026-03-09
**Severity:** High — breaks revenue-by-product reporting
**Object:** Deals (Sales Pipeline)
**Property:** `product` (enumeration: eCommerce, Payment Portal)

**Details:**
- 1,269 of 1,386 deals (91.6%) have no `product` value
- Property was created 2025-05-20 but was never made required
- No workflow or automation is populating it
- Even deals created as recently as 2026-03-11 are missing the field
- Only 117 deals have been manually tagged
- This causes "(No Value)" to dominate the "Avg Win Rate By Product" report

**Impact:**
- Revenue breakdowns by product are incomplete
- Win rate by product report is misleading (18.91% shown under "No Value" represents the bulk of deals)

**Recommended fix:**
1. Make `product` a required field on deal creation or at a specific deal stage
2. Backfill existing deals (most should be classifiable based on deal name, line items, or associated data)
3. Consider a workflow to auto-populate based on deal attributes

---

## Issue #2: `pipeline_source__c` missing on 82% of deals

**Discovered:** 2026-03-09
**Severity:** High — breaks revenue-by-funnel-source reporting
**Object:** Deals (Sales Pipeline)
**Property:** `pipeline_source__c` (enumeration)

**Details:**
- 1,293 deals have no `pipeline_source__c` vs only 276 that do
- 215 closed-won deals are missing it
- Source data exists on the associated GTM Campaign records (`pipeline_source`, `sub_pipeline_source`) but is not copied to the deal
- Same issue applies to `sub_pipeline_source`, `lead_source__c`, and `lead_source_detail__c`

**Impact:**
- Revenue attribution by funnel source is incomplete at the deal level
- Reports built on deal-level source fields show most revenue under "(No Value)"

**Recommended fix:**
1. Build reports through the GTM Campaign object association rather than deal-level fields
2. Or create a workflow to copy `pipeline_source` from the associated GTM Campaign to `pipeline_source__c` on the deal
3. Backfill historical deals from their campaign associations

---

## Issue #3: "LBM Advantage Annual Buying Show (2026)" campaign has zero contact associations

**Discovered:** 2026-03-09
**Severity:** Medium — causes empty report when filtered
**Object:** GTM Campaigns (custom object 2-41201412)
**Record:** ID 34297921660

**Details:**
- Campaign exists with status "Planned" and `campaign_name` correctly set
- `contacts_in_campaign`: 0, `numberofcontacts`: null
- No Salesforce Object ID (`salesforceobjectid`: null) — unlike the 2025 version which was synced from Salesforce
- Not present in the `sfdc_campaigns` table
- When used as a dashboard filter, the "UNWORKED CONTACTS" report returns nothing because there are no contacts to filter

**Impact:**
- Dashboard report "REPORT - UNWORKED CONTACTS with ENGAGED Label and/or Last Activity > 7 Days Ago" shows blank when filtered to this campaign

**Recommended fix:**
1. Create the campaign in Salesforce and add campaign members (mirrors how 2025 campaigns were set up)
2. Or manually associate contacts to this GTM Campaign record in HubSpot
3. Or bulk import contact-campaign associations

---

## Issue #4: Dashboard date filter mismatch between reports

**Discovered:** 2026-03-09
**Severity:** Low — causes confusion but data is technically correct
**Object:** Dashboard 19257315

**Details:**
- "Closed Won Revenue by Funnel This Quarter" filters by **deal close date** in Q1 2026
- "Closed Won Revenue by GTM Campaign This Quarter" filters by **campaign date** in Q1 2026
- This causes campaigns from prior quarters (e.g., LBM Strategies Conference 2025, a Q4 2025 event) to be excluded from the second report even though deals attributed to it closed in Q1 2026
- Result: Report 1 shows 2 deals under "Trade Shows & Conferences" ($47,495) but Report 2 only shows 1 campaign (NEMEON Prosper Meeting for $23,748)

**Impact:**
- The two reports appear inconsistent, creating confusion about which campaigns drove this quarter's revenue

**Recommended fix:**
- Change the second report's date filter from campaign date to associated deal close date so both reports use the same time logic
