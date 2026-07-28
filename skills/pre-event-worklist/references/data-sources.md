# Data Sources — HubSpot, Gong, Red Shift

Where each item in the worklist comes from, and the exact patterns to use.
Read this before Steps 3–5 in `SKILL.md`.

---

## A. Extracting assigned items from the Part 1 brief

Handled by `scripts/extract_part1.py` — see that script's docstring for the
exact regex/parsing approach. Summary of the convention it relies on:

- Part 1 briefs mark a person's assignment with a band matching (case
  insensitive) `^\s*{PERSON}\s+TO\s+ADD[^:]*:` — e.g. `NORMAN TO ADD BEFORE
  SHOW (RED SHIFT + GONG):`. The band body runs until the next heading and
  its items are `·`-separated.
- Each band is attributed to the nearest preceding account heading, matched
  against a line shaped like `<Name> — <City, ST>` followed by a status
  pill line (`CLOSED LOST...` / `...RE-ENGAGE`).
- The brief may also name the person outside any band — in manager
  takeaways or a data-notes section, describing a **process-level**
  obligation (e.g. "Norman completes Part 2 ... and delivers the
  consolidated brief two days out"). Capture these separately as
  `process_items` — they inform `what_you_owe` and the due-date
  computation, not any single account card.
- **If zero bands match for the given person, the script exits non-zero.**
  Do not proceed to generate a worklist with zero items — that almost
  certainly means the person's name doesn't match the brief's band text
  exactly (check for a nickname vs. full name mismatch) rather than meaning
  there is genuinely nothing assigned.

## B. Resolving accounts in HubSpot (Step 3)

### Find each company

`search_crm_objects` on `COMPANY`. Use `CONTAINS_TOKEN` on `name` per
account, one filterGroup per account (filterGroups OR together). **HubSpot
allows a maximum of 5 filterGroups per search call** — batch account names
into groups of 5 if there are more than 5 target accounts.

```
objectType: COMPANY
filterGroups: [
  { filters: [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: "<account name>" }] },
  ... up to 5 per call
]
properties: name, city, state, lifecyclestage, hubspot_owner_id,
            num_associated_contacts, num_associated_deals,
            notes_last_contacted, annualrevenue, numberofemployees
```

**Company name search returns decoys.** A `CONTAINS_TOKEN` search for "Home
Lumber" matches every company with those words anywhere in the name — in
production this returned 8+ unrelated companies (different states, unrelated
deal history) alongside the actual target. Disambiguate using, in order:

1. **City + state** — should match the Part 1 brief's stated location exactly.
2. **Contact count** — cross-check `num_associated_contacts` against the
   Part 1 brief's stated contact count for that account. This was a
   reliable signal in practice (all 7 IHI accounts matched exactly).
3. **Lifecycle stage** — target accounts should be on the "Closed Lost –
   Re-engage" stage (see below) if the Part 1 brief says so.

If more than one candidate survives all three checks, **ask the user** —
never guess between two plausible companies.

### Get all deals for the resolved companies

One `search_crm_objects` call on `DEAL` covering every company ID found
above, using an association filter with `IN`:

```
objectType: DEAL
filterGroups: [{
  associatedWith: [{ objectType: "companies", operator: "IN", objectIdValues: [<id1>, <id2>, ...] }]
}]
properties: dealname, amount, deal_currency_code, dealstage, closedate,
            createdate, pipeline, dealtype, hubspot_owner_id,
            closed_lost_reason, closed_lost_reasons, closed_lost_reason__c,
            closed_lost_detail__c, loss_reason__c, hs_is_closed_lost,
            description, notes_last_contacted
```

**Important:** if `amount` is requested, `deal_currency_code` must also be
requested — the platform cannot narrate a currency-typed property without
its matching currency-code property present in the same request.

**A deal with no `amount` value at all is a finding, not a gap.** If the
Part 1 brief states "no value recorded" for a deal and the live HubSpot
record confirms `amount` is absent (not zero — absent), that confirms the
deal was never scoped/priced before it went cold. Report this as a resolved
item (the answer to "why did this deal carry no value"), not as missing
data to chase further.

### Lost-reason properties — pull both, always

HubSpot exposes several closed-lost-reason-shaped properties. In practice
only two carry real data for New Business deals in this portal:

| Property | Type | What it holds |
|---|---|---|
| `closed_lost_reasons` | multi-value picklist (`;`-delimited) | Structured reason(s): "Not in ICP", "ROI - Price sensitivity", "Lost communication / Unresponsive", "Not Ready", "Lack of prioritization", "Other", etc. |
| `closed_lost_detail__c` | free text | **The rep's own words.** Often sharper and more specific than the picklist — e.g. picklist "Not in ICP" with detail "Adyen not supported in Turks & Caicos" turns a vague classification into a concrete, checkable blocker. |
| `closed_lost_reason` | string | Present in the schema but empty on every deal checked — do not rely on it. |
| `closed_lost_reason__c` | — | Same — empty in practice. |
| `loss_reason__c` | — | Same — empty in practice. |

**Always populate `closed_lost.rows[].detail` from `closed_lost_detail__c`
even when the picklist alone seems to answer the question.** The free-text
field is routinely where the actionable insight actually lives — see
`document-structure.md` block 5 for the KB Home Center example.

If a portal's schema differs and the free-text field has a different
internal name, use `search_properties` on `DEAL` with keywords like
`["closed_lost_reason", "lost_reason", "closed_lost_detail", "lost_notes"]`
to relocate it before assuming the data doesn't exist.

### Resolve owner names

Owner IDs (`hubspot_owner_id` on companies, deals) are opaque integers —
**never print a raw owner ID in the document.** Resolve via:

```
search_owners: { ownerIds: [<id1>, <id2>, ...] }
```

Batch all owner IDs encountered into a single lookup rather than one call
per ID.

### Duplicate detection

A company record matching a target account's name, but distinct from the
company resolved above, is a candidate duplicate if **all** of:

- `lifecyclestage` is the default/unengaged value (e.g. `"lead"`), not the
  target's actual lifecycle stage
- `num_associated_contacts` is `0`
- `num_associated_deals` is `0` (or absent)

This combination means an empty shell record — safe to recommend merging
into the real account in `crm_hygiene`. If the candidate has **any**
contacts or deals, do not recommend a merge automatically; surface it as a
"possible duplicate, needs manual review" note instead, since merging a
record with real activity risks losing data.

---

## C. Gong (Step 4 — call notes)

Try connectors in this order and use the first that's available; note in
`data_notes` which path was actually used.

### Path 1 — Gong MCP connector directly (preferred, confirmed working)

Tools: `ask_account`, `ask_deal`, `generate_brief`. Confirmed working
end-to-end on the IHI 2026 run with no interactive auth step — this is the
connector to reach for first, not a fallback. Two things that mattered in
practice:

- **`ask_account` needs the exact CRM ID, not a fuzzy name.** A name search
  for an account with a common name pattern (e.g. "Home Lumber & Supply")
  returned `CRM_AMBIGUOUS_ENTITY` with 2–3 candidate accounts. Resolve the
  company in HubSpot first (§B), then call `ask_account` with that
  `company_id` as `crmAccount` directly — this always resolved cleanly.
- **The default date window is only the last 30 days — too narrow for a
  win-back campaign.** These are accounts closed lost in 2025/early 2026;
  a default-window query returned zero calls even for accounts with real
  Gong history. Always pass explicit `fromDateTime`/`toDateTime` covering
  back to at least the earliest deal's close date (e.g. `2025-01-01` to
  today) on the first pass.
- Ask account-scoped, targeted questions per item rather than one generic
  "summarize this account" query — e.g. "What was the outcome of the touch
  on [date]? Are there other stakeholders mentioned besides the CRM
  contact?" maps directly onto specific worklist items and often surfaces
  named people (a second stakeholder, an unrecorded decision-maker) that
  aren't in CRM at all — when that happens, add a `crm_hygiene` action and
  a `corrections` entry, don't just fold the name into the resolved finding
  and move on.
- For "confirm attendance"-type items, a **negative result is still a
  result worth stating explicitly.** Re-run the question narrowed to the
  most recent window (e.g. the last 4–8 weeks) specifically for
  event/trade-show mentions. Zero hits across both the full history and the
  recent window is a real, reportable finding — state it as "no signal
  found" in the item's `source` field, not as a resolution. The absence of
  a mention is not evidence of non-attendance; only the actual attendance
  channel (campaign reply, registration list) can resolve those items.

### Path 2 — Sales_Hub MCP connector

Tools: `get_deal_gong_calls`, `ask_deal_question`, `get_deal_handover`,
`get_deal_reasons`. **In practice this connector requires interactive
sign-in and returned `401 Unauthorized: Sign in required` on every call in
a non-interactive session**, even with the connector's tools loaded and
callable. Try it, but don't spend more than one round-trip on it before
falling back to Path 1 — if Path 1 (direct Gong) is reachable, prefer it
outright rather than treating Sales_Hub as the primary path. If Sales_Hub
does authenticate successfully in a given session, `get_deal_reasons` /
`generate_deal_reasons` can independently corroborate the HubSpot
`closed_lost_reasons` pull — if it disagrees with the picklist, note the
discrepancy rather than picking one silently.

### Path 3 — Red Shift SQL (last resort)

**No Redshift connector was available in this environment** — `ListConnectors`
with database/warehouse keywords returned only Supabase (not enabled), no
Redshift. If a future environment does expose one, the `elt-pre-read` skill
documents a query pattern for Gong data in its own
`references/data-sources.md` (`analytics.gong_calls` /
`analytics.gong_call_transcripts`, filtered by `account_name ILIKE`). Don't
assume this path exists — confirm with `ListConnectors` before relying on
it, and don't burn time hunting for a bare SQL tool if Path 1 is reachable;
direct Gong access is both simpler and richer (synthesized answers, not
raw transcripts to parse yourself).

### If none of the above are reachable

Do not fail silently and do not fabricate. Leave the item in `open` with
`source: "Gong"` and say so plainly in the final summary to the user — this
is exactly the kind of gap the worklist exists to make visible, not paper
over.

---

## D. Red Shift activity (Step 4 — activity/touch verification)

For items like "did the logged follow-up ever happen" or "what was the
outcome of the Jul 2 touch":

1. Prefer direct Red Shift access if available in the environment.
2. Fallback: HubSpot engagement objects associated with the deal/company —
   `NOTE`, `CALL`, `EMAIL`, `MEETING_EVENT`, `TASK` (all readable per this
   portal's tool availability) — plus the `notes_last_contacted` property
   already pulled in Step 3. A note or call logged on/after the date in
   question is reasonable (not certain) evidence the touch happened; label
   it explicitly as inferred from engagement timestamps, not confirmed.

## E. Attendance confirmation

For "confirm attendance via campaign reply" items: check the relevant
`CAMPAIGN` object (read-only access is available) for contact-level
engagement, and check contact/email engagement timestamps against the
pre-show send date. In the absence of a definitive "registered" signal,
this item almost always stays `open` — that is expected and correct, not a
resolution failure. Do not treat "no reply yet" as equivalent to "not
attending."

---

## F. Resolver rules — matching extracted item text to a data source

Applied during Step 4. Match on intent, not exact string — item phrasing
varies brief to brief.

| Item text pattern (case-insensitive, fuzzy) | Resolved by | Resolution type |
|---|---|---|
| "lost reason", "why ... lost", "both ... reasons" | `closed_lost_reasons` + `closed_lost_detail__c` | HubSpot |
| "what changed their mind" | `closed_lost_detail__c`, if it states a concrete cause | HubSpot |
| "why ... no value", "carried no value" | Absence of `amount` on the deal | HubSpot |
| "duplicate record", "merge", "verify the duplicate" | Duplicate-shell detection (§B) | HubSpot |
| "confirm attendance" | Campaign engagement (§E) | Usually stays open |
| "Gong notes", "Gong history", "Gong notes if any" | Gong connector (§C) | Gong |
| "follow-up happened", "touch outcome", "outcome of the ... touch" | Engagement objects / Red Shift (§D) | Red Shift / HubSpot engagements |
| "who else to add", "still the right contact", "right one" | Contact list + `notes_last_contacted` | HubSpot (often partial) |

An item matching no rule above stays in `open` with a best-guess `source`
label. **Do not stretch a rule to manufacture a resolution** — an
incorrectly "resolved" item is a worse outcome than an honestly open one,
because it tells the reader they can stop chasing something they can't.

---

## G. Reconciliation — checking Part 1's own numbers (Step 6)

This is what surfaced the two real corrections in the IHI 2026 run, and is
a **standing step**, not a one-time audit:

1. **Recompute Part 1's headline totals from its own per-account figures.**
   Sum every deal amount printed in Part 1's account cards and compare
   against Part 1's stated aggregate stat. A mismatch usually means one
   deal was silently excluded from the total while still appearing in an
   individual account card — flag the excluded deal specifically, don't
   just report "the totals don't match."
2. **Diff ownership/lifecycle claims against live HubSpot.** Part 1 is a
   snapshot from its own stated refresh date; HubSpot may have moved since
   (an account got assigned an owner, a lifecycle stage changed). Compare
   Part 1's stated owner/stage per account against what's live now and
   report any account where they differ.
3. **Do not editorialize beyond the data.** A correction states what
   changed and why it matters in one or two sentences — it does not
   recommend a strategic pivot. That's Part 1's job on the next cycle, not
   this document's.
