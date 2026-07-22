# HubSpot company geography — runbook

Portal: **49044619**. This document explains why domain-auto-created companies lack address fields, the **team decision** on HubSpot settings, how to **bulk-fix** gaps, and how to **automate** going forward.

---

## 1. Verification (example record `52402678900`)

Confirmed via HubSpot CRM API (`crm/v3/objects/companies/{id}`). These properties match what you see under **Record source** / source detail in the UI:

| Property | Value |
|----------|--------|
| `hs_object_source` | `COMPANIES` |
| `hs_object_source_label` | `CRM_SETTING` |
| `hs_object_source_detail_1` | `"Create and associate companies with contacts" setting` |
| `hs_object_source_id` | `FetchAssociatedCompanyIdStep` |

**Interpretation:** HubSpot created this company row because the **Create and associate companies with contacts** CRM setting fetched/created a company from the contact’s email domain. That path sets **domain / website** (and sometimes **phone**) but does **not** populate **country**, **state**, **postal code**, or street address unless another process fills them.

---

## 2. Team decision: keep or disable auto company creation?

**Recommendation: keep the setting enabled** unless product explicitly wants to stop automatic contact–company association.

| Option | Pros | Cons |
|--------|------|------|
| **Keep** “Create and associate companies with contacts” | Contacts stay tied to companies by domain; less manual association work | Many “shell” companies without HQ address / country |
| **Disable** | Fewer empty shell companies | More manual work to associate contacts to companies; risk of orphan contacts |

**Mitigation (required if keeping):** use **workflows** and/or **enrichment** (below) so new auto-created companies get geography from a trusted source or get flagged for review.

Document this decision in your internal ops wiki if the team agrees.

---

## 3. Bulk fix: companies missing country / geography

### Scale (API snapshot, portal 49044619)

A search for companies where **`country`** is **not set** (`NOT_HAS_PROPERTY` on `country`) returned **1,468** total matches (as of implementation). Recent examples share the same record source: `CRM_SETTING` + Create and associate companies with contacts.

### In HubSpot UI

1. Go to **CRM** → **Companies**.
2. **Filter**: add **Country** → **is unknown** (or use **Postal Code** / **State/Region** unknown if your views use those).
3. Optional: add **Create date** or **Associated contact** filters to prioritize.
4. **Actions** → **Export** (if you need a spreadsheet for research or vendor enrichment).
5. **Bulk edit** country/state/zip when you have a trusted source (manual research, Salesforce sync, Clearbit, etc.).

### Sync / warehouse note (TOOLBX Sales Heatmap)

Pipeline companies are geocoded from **`properties_address`** (and city/state/zip/country) in Redshift (`hubspot_companies`). Companies with **no address** will not get pins from the address → Nominatim path until HubSpot (or an integration) fills those fields and the warehouse syncs.

---

## 4. Moving forward: workflows and integrations

HubSpot workflows must be created in **HubSpot** (Automation → Workflows). Suggested patterns:

### A. Data quality — flag shells without geography

**Enrollment:** Company-based workflow.

**Triggers (example):**

- Company property **Country** is **unknown** (or empty).
- AND **Company domain** is **known** (has any value).

**Actions:**

- Create a **task** for company owner: “Confirm HQ country/state/ZIP for domain-auto-created company.”
- Optional: set a **single-select** property e.g. `data_quality_geo` = `needs_review`.

### B. Enrichment

If your HubSpot subscription includes **Breeze Intelligence** or a third-party **enrichment** app, configure it to fill **company** address fields for new records. Effectiveness depends on public data for that domain.

### C. Integration mapping

If accounts originate in **Salesforce** (or similar), ensure **billing/shipping address** fields map into HubSpot **company** properties, not only contact fields.

### D. Forms and imports

For marketing/forms, map **Country** / **State** into **company** properties where appropriate. For CSV imports, map columns explicitly to `country`, `state`, `zip`, `address`.

---

## 5. API reference (for developers)

**Search companies with no country** (CRM search):

```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "country",
          "operator": "NOT_HAS_PROPERTY"
        }
      ]
    }
  ],
  "properties": ["name", "domain", "country", "city", "state", "zip", "hs_object_source_label", "hs_object_source_detail_1", "createdate"],
  "limit": 100
}
```

**Read one company’s source fields:**

`properties=hs_object_source,hs_object_source_label,hs_object_source_detail_1,hs_object_source_id`

---

## 6. Revision history

| Date | Notes |
|------|--------|
| 2026-04-15 | Initial runbook: verified `52402678900`, counted companies missing `country`, documented recommendation and workflow patterns |
