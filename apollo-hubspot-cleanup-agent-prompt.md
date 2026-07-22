# Apollo → HubSpot Junk Record Cleanup — Agent Execution Prompt

## Context

Apollo's Website Visitor Tracking script on toolbx.com has been auto-creating junk contacts and companies in HubSpot via its integration sync. Every anonymous website visitor's company gets reverse-IP identified, a contact person is pulled from Apollo's database, and both are pushed to HubSpot as new records. This has created **~699 contacts** and **~501 companies** since June 1, 2026 — the vast majority completely irrelevant to TOOLBX (insurance companies, universities, government agencies, tech companies, etc.).

However, a subset of these records ARE legitimate — building materials, lumber, hardware, and construction companies that your sales reps have already started working. Those must be preserved.

**Your job:** Identify and delete the junk while preserving every legitimate record. Zero tolerance for false positives — if in doubt, keep the record.

## Prerequisites

### HubSpot API Token
Read the token from the file at `/Users/normankuan/Documents/toolbx-sales-hub/.env.local`. The variable is `HUBSPOT_ACCESS_TOKEN`. You will use this for all HubSpot REST API calls. **Never log or print this token in any output.**

### HubSpot Portal
Portal ID: `49044619`

### Apollo Push Settings (BROWSER TASK — DO FIRST)
Before doing anything else, navigate to Apollo and disable the two push settings that are creating these records. You need to use the Chrome browser tools for this:

1. Navigate to `https://app.apollo.io/#/settings/integrations/crm/hubspot/contacts/sync`
2. Scroll down to "Push contact records" section
3. **Uncheck** the "Push contact" checkbox
4. Wait for save confirmation
5. Navigate to the Accounts tab → Sync sub-tab (`https://app.apollo.io/#/settings/integrations/crm/hubspot/accounts/sync`)
6. Scroll down to "Push account records" section
7. **Uncheck** the "Push account" checkbox
8. Wait for save confirmation
9. Take a screenshot to confirm both are disabled

**IMPORTANT:** Ask the user for permission before clicking these checkboxes, as this modifies integration settings.

---

## Step 1: Collect ALL Apollo-created contacts since June 1

Use the HubSpot MCP `search_crm_objects` tool to paginate through every contact matching:
- `hs_object_source_detail_1` = `"Apollo Integration"`
- `createdate` >= `"2026-06-01"`

Request these properties:
```
firstname, lastname, email, company, lifecyclestage, hubspot_owner_id,
notes_last_contacted, hs_last_sales_activity_timestamp, num_associated_deals, createdate
```

Set `limit: 200` and paginate using `offset` until you've collected all records. Store every record's ID and properties in memory.

**Expected:** ~699 contacts across ~4 pages.

---

## Step 2: Collect ALL Apollo-created companies since June 1

Same approach:
- `hs_object_source_detail_1` = `"Apollo Integration"`
- `createdate` >= `"2026-06-01"`

Request these properties:
```
name, domain, industry, lifecyclestage, hubspot_owner_id,
num_associated_contacts, num_associated_deals, createdate
```

**Expected:** ~501 companies across ~3 pages.

---

## Step 3: Classify each CONTACT as KEEP or DELETE

For each contact, mark as **KEEP** if **ANY** of the following are true:

### 3a. Activity/engagement signals (highest priority)
- `lifecyclestage` is NOT `"lead"` (includes: customer, opportunity, marketingqualifiedlead, salesqualifiedlead, evangelist, other, subscriber, or any custom stage ID like `1050035315`, `1050035316`, `1324949332`)
- `hubspot_owner_id` is NOT `"88239302"` AND is not empty/null/blank (someone other than the default Apollo owner claimed this contact)
- `notes_last_contacted` has any value (someone logged a call/email/meeting)
- `hs_last_sales_activity_timestamp` has any value (outbound sales activity occurred)
- `num_associated_deals` > 0 (contact is tied to pipeline activity)

### 3b. Company name keyword match (case-insensitive, partial match)
If the contact's `company` field contains ANY of these keywords, mark as **KEEP**:

```
lumber, building, supply, hardware, construction, roofing, flooring, plumbing,
materials, millwork, concrete, masonry, drywall, paint, decor, tool, fastener,
deck, fence, window, door, siding, insulation, hvac, cabinet, countertop,
tile, brick, steel, metal, kitchen, bath, plywood, truss, pallet, wood,
forest, moulding, molding, trim, railing, home center, home improvement,
lumberyard, electric supply, surfaces, coatings, glass, ceramic, stucco,
waterproofing, adhesive, aggregate, gravel, sand, cement, rebar, framing,
sheathing, joist, beam, post, treated, composite, vinyl, copper, pipe,
fitting, valve, fixture, faucet, shower, tub, vanity, garage, shed,
barn, greenhouse, pergola, awning, gutter, downspout, soffit, fascia,
shingle, membrane, flashing, caulk, sealant, primer, stain, varnish,
polyurethane, epoxy, grout, mortar, thinset, backer, underlayment
```

**IMPORTANT edge cases to handle:**
- "Richwood Bank" — contains "wood" but is a bank. Check: if the company name ALSO matches a clearly non-relevant pattern (bank, insurance, university, school, hospital, church, government, county, city of, department of, museum, library, foundation), do NOT keep it. The non-relevant pattern takes precedence.
- "Children's Home" — contains "home" but is not home improvement. Same rule applies.

Non-relevant override patterns (if name matches these AND a keyword, still DELETE):
```
bank, credit union, insurance, university, college, school district,
hospital, medical center, health care, healthcare, church, ministry,
county government, city of, department of, museum, library, foundation,
philanthropy, law firm, attorney, legal, veterinary, dental, orthodontic,
casino, hotel, resort, restaurant, brewery, winery, distillery,
airline, cruise, salon, spa, fitness, gym, daycare, preschool,
cemetery, funeral, mortuary
```

### 3c. Everything else → DELETE

---

## Step 4: Classify each COMPANY as KEEP or DELETE

For each company, mark as **KEEP** if **ANY** of the following are true:

### 4a. Activity/engagement signals
- `lifecyclestage` is NOT `"lead"`
- `num_associated_deals` > 0

### 4b. Industry whitelist
If the company's `industry` field matches any of these values:
```
BUILDING_MATERIALS
CONSTRUCTION
GLASS_CERAMICS_CONCRETE
CIVIL_ENGINEERING
PAPER_FOREST_PRODUCTS
ARCHITECTURE_PLANNING
Lumber & Building Materials
Hardware & Home Improvement
Millwork
Flooring
Drywall
Roofing
Masonry
Paint & Decor
Home Improvement & Hardware Retail
Commercial & Residential Construction
Architecture, Engineering & Design
```

### 4c. Company name keyword match
Same keyword list and override logic as Step 3b, but applied to the company's `name` field.

### 4d. Has a KEEP contact
If the company has ANY associated contact that was marked KEEP in Step 3, mark the company as KEEP too. To determine this, cross-reference: for each company in the DELETE candidate list, check if any of its associated contacts (by matching the `company` field from the contacts data) were marked KEEP. If so, move the company to KEEP.

### 4e. Everything else → DELETE

---

## Step 5: Generate audit CSV

Before deleting anything, write a CSV file to `/Users/normankuan/Documents/toolbx-sales-hub/apollo-cleanup-audit.csv` with these columns:

```
object_type, hs_object_id, name, email, company_name, industry, lifecyclestage, owner_id, has_activity, has_deals, action, keep_reason
```

Where:
- `object_type` = "contact" or "company"
- `action` = "KEEP" or "DELETE"
- `keep_reason` = which rule triggered the KEEP (e.g., "non-lead lifecycle", "owner reassigned", "industry whitelist: CONSTRUCTION", "keyword match: lumber", "has associated KEEP contact", etc.). Empty for DELETE records.

Sort the CSV: KEEP records first (sorted by keep_reason), then DELETE records (sorted by name).

**Print a summary to the user:**
```
CONTACTS: X to keep, Y to delete (out of Z total)
COMPANIES: X to keep, Y to delete (out of Z total)

KEEP breakdown:
  - Non-lead lifecycle: N contacts, N companies
  - Owner reassigned: N contacts
  - Has sales activity: N contacts
  - Has deals: N contacts, N companies
  - Industry whitelist: N companies
  - Keyword match: N contacts, N companies
  - Has KEEP contact: N companies

Audit CSV saved to: [path]
```

**Ask the user to confirm before proceeding to deletion.** Say: "I've saved the audit CSV. Please review it if you'd like. Ready to proceed with deleting Y contacts and Y companies? (These will be archived in HubSpot, not permanently destroyed — they can be restored within 90 days from Settings → Objects → Contacts → Recycle Bin.)"

---

## Step 6: Batch archive contacts

Use the HubSpot REST API to archive contacts in batches of 100:

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/contacts/batch/archive" \
  -H "Authorization: Bearer $HUBSPOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs": [{"id":"CONTACT_ID_1"},{"id":"CONTACT_ID_2"},...]}' 
```

- Process DELETE contacts in batches of 100
- Add a 500ms sleep between batches to respect rate limits
- Log each batch: "Archived contacts batch N/M (IDs: first..last)"
- If any batch fails, log the error, skip that batch, and continue with the next
- Track total success and failure counts

---

## Step 7: Batch archive companies

Wait 10 seconds after all contacts are archived (for HubSpot to update association counts), then archive companies using the same batch approach:

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/companies/batch/archive" \
  -H "Authorization: Bearer $HUBSPOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs": [{"id":"COMPANY_ID_1"},{"id":"COMPANY_ID_2"},...]}' 
```

Same batching, sleeping, logging, and error handling as Step 6.

---

## Step 8: Verify

After all deletions, run verification queries:

1. Count remaining Apollo Integration contacts since June 1:
```
search_crm_objects(contacts, source_detail_1 = "Apollo Integration", createdate >= "2026-06-01")
```
Check the `total` field. Should be ~104 (the KEEP count from Step 3).

2. Count remaining Apollo Integration companies since June 1:
```
search_crm_objects(companies, source_detail_1 = "Apollo Integration", createdate >= "2026-06-01")
```
Should be ~40 (the KEEP count from Step 4).

3. Spot-check 5 remaining contacts — verify they all have legitimate keep reasons (non-lead stage, different owner, sales activity, or relevant industry).

**Print final report:**
```
CLEANUP COMPLETE
================
Contacts archived: X of Y attempted (Z failures)
Companies archived: X of Y attempted (Z failures)

Remaining Apollo records (since June 1):
  Contacts: N
  Companies: N

Apollo push settings: DISABLED (verified)
```

---

## Error handling

- If the HubSpot API token is missing or invalid, STOP and tell the user.
- If a batch archive returns 429 (rate limited), wait 10 seconds and retry that batch (max 3 retries).
- If a batch archive returns 400/404 for specific IDs, log those IDs and continue.
- If more than 20% of any batch fails, STOP and report the error to the user before continuing.
- Never delete a record that was classified as KEEP.
- If the total DELETE count is less than 400 contacts or 300 companies, something is likely wrong with the classification — pause and report to the user for review before proceeding.

---

## Key constraints

- **Norman's owner ID:** `88239302` — this is the default Apollo auto-assignment. Contacts with this owner AND no activity are deletion candidates.
- **HubSpot Portal ID:** `49044619`
- **TOOLBX is always capitalized** in any output or messages.
- **Archives are reversible:** HubSpot keeps archived records in the recycle bin for 90 days. This is NOT a permanent delete.
- **Do not create any new records** in HubSpot during this process.
- **Do not modify any KEEP records** — this is a read + delete operation only.
