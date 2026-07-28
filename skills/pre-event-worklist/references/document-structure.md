# Pre-Event Worklist — Document Structure

Section-by-section schema for the worklist JSON data file. This is the
authoritative reference for Step 6 (assemble JSON) in `SKILL.md`.

**The governing rule for every block below: it exists only because it is
assigned to the named person, or is required context for their assigned
items.** This document is NOT a copy of the Part 1 brief. If a block would
only make sense in a full account-strategy brief (executive summary of the
show, priority-order table for field reps, "about the association", the
aggregate market-intel grid, manager takeaways, or a `Play` recommendation
per account) — it does not belong here. When genuinely unsure whether
something belongs, cut it.

Top-level JSON keys, in render order:

1. `header` — title block
2. `what_you_owe` — the assignment restated + due date
3. `stat_banner` — 4 summary metrics
4. `status_at_a_glance` — one row per account
5. `closed_lost` — HubSpot lost-reason table
6. `corrections` — discrepancies found vs. the Part 1 brief
7. `accounts` — per-account cards, the core of the document
8. `crm_hygiene` — concrete CRM cleanup actions (conditional block)
9. `data_notes` — sourcing, refresh time, confidence caveats

Blocks 6 and 8 are **conditional** — omit them entirely if there is nothing
to report (no arithmetic/ownership discrepancies found; no hygiene issues
detected). Never render an empty section with just a heading.

---

## 1. `header`

```json
{
  "doc_kind": "PRE-EVENT WORKLIST",
  "event_name": "IHI Conference 2026",
  "subtitle": "Part 2 — Red Shift + Gong · assigned to Norman Kuan",
  "logistics": "Independent Home Improvement Conf. (NHPA) · July 29–30, 2026 · JW Marriott Orlando, Grande Lakes · Booth 9",
  "provenance": "Source: Part 1 brief v1 (Jul 21, 2026) · HubSpot refreshed July 28, 2026 · v1"
}
```

- `subtitle` always follows the pattern `"Part 2 — <data sources> · assigned to <Person>"`.
- `logistics` — copy verbatim from the Part 1 brief's own header line if
  available; otherwise from the event/campaign record.
- `provenance` — always cites the Part 1 brief's version/date AND the
  HubSpot refresh timestamp for this run. This is a follow-up document; its
  lineage must be traceable.

---

## 2. `what_you_owe`

Restates the assignment in the person's own document — a reader should not
need the Part 1 brief in hand to know what this is.

```json
{
  "paragraphs": [
    "Part 1 (CRM + pipeline) named you to complete Part 2 — Red Shift activity and Gong call notes — and deliver a consolidated brief two days before the show.",
    "Seven accounts, 22 assigned items. This document tracks what HubSpot could already answer and what's still open."
  ],
  "due_label": "Consolidated brief due",
  "due_value": "July 27, 2026",
  "overdue": true,
  "overdue_note": "Show opens July 29. 12 items still open."
}
```

- `due_value` is computed as **2 calendar days before the event's first
  day**, per the Part 1 brief's own stated convention ("delivers the
  consolidated brief two days out"). If the Part 1 brief states a different
  cadence explicitly, use that instead and note it.
- `overdue` — `true` if `due_value` < today. When `true`, render `due_value`
  in Alert Red (`#DC2626`) with an `OVERDUE` pill (see styling.md #3).
- `overdue_note` — one sentence, always states the open-item count so the
  urgency is concrete, not just a date.

---

## 3. `stat_banner`

Exactly 4 cards. Unlike `elt-pre-read`'s company-metric cards, these are
**work-tracking metrics**, always in this fixed order:

```json
[
  {"value": "22", "label": "ITEMS ASSIGNED"},
  {"value": "10", "label": "RESOLVED FROM HUBSPOT"},
  {"value": "12", "label": "STILL OPEN"},
  {"value": "7",  "label": "ACCOUNTS"}
]
```

All 4 values are **computed**, never estimated: `ITEMS ASSIGNED` = count of
extracted atomic items across all accounts; `RESOLVED` + `STILL OPEN` sum to
`ITEMS ASSIGNED`; `ACCOUNTS` = count of account cards in block 7. Recompute
these from the `accounts` block rather than hand-entering — if the numbers
drift from the per-account item counts, that's a bug in assembly, not a
rounding choice.

---

## 4. `status_at_a_glance`

One row per account, in the Part 1 brief's own priority order (carry the
`rank` field through so the two documents line up when read side by side).

```json
{
  "rows": [
    {"rank": 1, "account": "Home Lumber & Supply", "items": 3, "resolved": 1, "open": 2, "blocker": "—"},
    {"rank": 2, "account": "Gold Beach Lumber",     "items": 3, "resolved": 2, "open": 1, "blocker": "—"},
    {"rank": 6, "account": "KB Home Center",        "items": 3, "resolved": 1, "open": 2, "blocker": "Adyen unsupported in TC"}
  ]
}
```

- `blocker` — a short phrase for anything that makes an account structurally
  hard to close regardless of Booth conversation (a payments/product-fit
  issue, e.g.), sourced from a `closed_lost_detail__c` note. `"—"` if none.
- This table is a scanning aid, not a restatement of the Part 1 priority
  table — no "why it earns your time" narrative column here, that belongs
  to Part 1.

---

## 5. `closed_lost`

The HubSpot lost-reason pull — the single highest-value addition this
skill makes, since it directly answers the most common item type ("the
lost reason") across nearly every account.

```json
{
  "intro": "Pulled live from HubSpot on July 28, 2026. Picklist reason plus the closing rep's own note — the note is where the actual objection lives.",
  "rows": [
    {
      "account": "Home Lumber & Supply",
      "amount": "$64,248",
      "closed": "Jul 25, 2025",
      "reasons": ["Lost communication / Unresponsive"],
      "detail": "unresponsive",
      "owner": "Jameson Labuguen",
      "deal_id": "33267747684",
      "emphasis": true
    }
  ]
}
```

- One row per **deal**, not per account — an account with two lost deals
  (e.g. Home Lumber) gets two rows.
- `reasons` — array, rendered `; `-joined. Source: `closed_lost_reasons`
  (multi-value picklist).
- `detail` — **always pull `closed_lost_detail__c` alongside the picklist.**
  This free-text field is where reps write what actually happened, and it
  routinely contradicts or sharpens the picklist value (e.g. a picklist of
  "Not in ICP" whose detail is a concrete payments-rail incompatibility).
  Preserve source typos; do not silently correct them — bracket a fix
  instead (`"not in ICP - Adyen nort supported"` → render as `no[t]`, not a
  silent rewrite).
- `emphasis: true` on the single largest-exposure deal in the set — bolds
  the row.
- If `closed_lost_detail__c` is empty for a deal, still render the row with
  `detail: ""` and let the template omit the quoted line; do not fabricate
  a plausible-sounding note.

---

## 6. `corrections` (conditional)

Reconciliation findings — arithmetic, ownership, or classification
discrepancies between what the Part 1 brief states and what HubSpot shows
live today. **This block is not optional editorializing: recomputing the
Part 1 brief's own stated totals from its own per-account figures is a
standing step (see SKILL.md Step 6), not a one-off audit.** Omit the whole
block only if reconciliation finds nothing.

```json
{
  "items": [
    {
      "tag": "C1",
      "title": "Recoverable pipeline understated by $64,248",
      "body": "Part 1 headlines ≈$142.8K. Summing the per-account figures Part 1 itself prints gives $207,081. The $64,248 Home Lumber deal (closed Jul 25, 2025) is counted in that account's card but excluded from every total. True recoverable ≈ $207.1K.",
      "severity": "high",
      "needs_decision": false
    },
    {
      "tag": "C3",
      "title": "Three accounts flagged \"Not in ICP\" — one is a hard blocker",
      "body": "KB Home Center's own lost-reason note: \"not in ICP - Adyen no[t] supported in Turks & Caicos.\" A payments-rail limitation, not a sales objection — it can't close regardless of the booth conversation unless Adyen's coverage has changed. Recommend Skip rather than #6 in the priority order, but this is a re-ranking call, not made here.",
      "severity": "high",
      "needs_decision": true
    }
  ]
}
```

- `severity` — `"high"` or `"medium"`. Purely for potential future sort
  order; both render identically today.
- `needs_decision: true` — adds a `YOUR CALL` pill (styling.md #3). Use this
  when the finding requires a human judgment call (a re-ranking, a
  reclassification) rather than being a pure fact correction.
- Each `body` should be self-contained — a reader who has never seen the
  Part 1 brief should still understand the finding.

---

## 7. `accounts`

The core of the document. One card per account **that has at least one
item assigned to this person** — an account with zero assigned items does
not get a card here, even if it appears in the Part 1 brief.

```json
{
  "cards": [
    {
      "rank": 1,
      "name": "Home Lumber & Supply Co.",
      "location": "Meade, KS",
      "status_pill": "CLOSED LOST ×2 · RE-ENGAGE",
      "company_id": "54970345103",
      "facts": [
        {"label": "Lifecycle",    "value": "Re-engage"},
        {"label": "CRM owner",    "value": "Pouyan Mirsaeidi"},
        {"label": "Contacts",     "value": "6 in CRM"},
        {"label": "Last activity","value": "Jun 11, 2026"},
        {"label": "Lost deals",   "value": "$26,388 (Oct 2025) + $64,248 (Jul 2025)"},
        {"label": "Deal owner",   "value": "Jameson Labuguen"}
      ],
      "resolved": [
        {
          "item_id": "1a",
          "label": "Both 2025 lost reasons",
          "finding": "$64,248 (Jul 2025) — Lost communication / Unresponsive, rep note \"unresponsive\". $26,388 (Oct 2025) — Not Ready, rep note \"not the right time\". Two different failure modes: the big one went dark, the small one was timing."
        }
      ],
      "open": [
        {"item_id": "1b", "label": "Whether the logged follow-up ever happened", "source": "Red Shift activity"},
        {"item_id": "1c", "label": "Gong notes across the 6 contacts", "source": "Gong"}
      ]
    }
  ]
}
```

Field notes:

- `facts` — always exactly the 6 fields shown (Lifecycle, CRM owner,
  Contacts, Last activity, Lost deal(s), Deal owner), matching the Part 1
  brief's own per-account grid so a reader can cross-reference at a glance.
  Do not add company-strategy facts here (size/intel, competitive context)
  — those belong to Part 1, not this document.
- `resolved` — one entry per item this pass could answer. `finding` is the
  actual answer in prose, written so it stands alone (it will often be read
  without re-opening HubSpot). Render via styling.md component #4 (teal
  band). **Omit the whole `resolved` array (and the band) if empty.**
- `open` — one entry per item still outstanding. `source` names *which*
  system should eventually answer it (`"Gong"`, `"Red Shift activity"`,
  `"Campaign engagement"`) so the next pass knows where to look. Render via
  styling.md component #5 (yellow band). **Omit the whole `open` array (and
  the band) if empty** — a fully-resolved account gets no yellow band at
  all, which is itself a meaningful signal.
- **No `play` field.** The recommended sales approach for an account is
  Part 1's job. Including it here would start turning this into a copy of
  Part 1 — the one failure mode to guard against above all others.
- `item_id` values should be stable and traceable back to the Part 1 brief's
  original bands (see `data-sources.md` for the extraction convention) so a
  reader can always ask "where did this come from."

---

## 8. `crm_hygiene` (conditional)

Concrete, executable-without-a-lookup CRM cleanup actions surfaced while
resolving items — always attach the actual record IDs.

```json
{
  "actions": [
    {
      "action": "Merge duplicate",
      "detail": "Randy's Do it Best Hardware (Timberville, VA · 50279900086) is an empty shell — lifecycle \"lead\", 0 contacts, 0 deals. Merge into Randy's Hardware (Broadway, VA · 37086608223).",
      "records": ["50279900086", "37086608223"]
    },
    {
      "action": "Set missing deal amount",
      "detail": "Handy Ace Hardware deal 41502765436 has no `amount` value — the source of Part 1's \"no value recorded\". Never scoped; rep note \"need to rebook\".",
      "records": ["41502765436"]
    }
  ]
}
```

This skill is **read-only against HubSpot** (see SKILL.md) — this block
recommends actions, it does not execute them. Omit the block entirely if no
hygiene issues were found during resolution.

---

## 9. `data_notes`

Sourcing and confidence, mirroring the Part 1 brief's own closing
convention.

```json
{
  "bullets": [
    "Deal and company data pulled live from HubSpot on July 28, 2026 (portal 49044619).",
    "\"Re-engage\" is HubSpot custom lifecycle stage 1324949332 (Closed Lost – Re-engage), matching Part 1's usage.",
    "Closed-lost reasons combine the `closed_lost_reasons` picklist and the `closed_lost_detail__c` free-text field — the latter is the rep's own words and is quoted verbatim.",
    "Gong / Red Shift items marked open were not resolved in this pass — see each account's \"still to add\" band for what remains and which system should answer it.",
    "Corrections in this document were found by recomputing Part 1's own stated totals from its own per-account figures, and by diffing Part 1's ownership/lifecycle claims against live HubSpot data."
  ]
}
```

Always include: the portal ID + refresh date, the lifecycle stage ID if
used, which two lost-reason properties were combined, and an explicit note
that open items are open (not silently resolved with a guess).

---

## Defaults summary — when data is missing

| Situation | Behavior |
|---|---|
| An account has zero resolved items | Omit `resolved` array + teal band entirely |
| An account has zero open items | Omit `open` array + yellow band entirely (this account is done) |
| `closed_lost_detail__c` is empty | Render the row without a quoted line; never fabricate one |
| No corrections found on reconciliation | Omit block 6 entirely |
| No CRM hygiene issues found | Omit block 8 entirely |
| An item's text matches no resolver rule | It stays in `open` — do not force a resolution |
| Part 1 brief doesn't state a Part 2 due-date cadence | Ask the user rather than guessing |
| Company name search is ambiguous | Ask the user; never guess between candidates |
