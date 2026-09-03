# Pre-Event Worklist — Document Structure

Section-by-section schema for the worklist JSON data file. This is the
authoritative reference for Step 6 (assemble JSON) in `SKILL.md`.

**The governing rule for every block below: it exists only because it is
assigned to the named person, or is required context for their assigned
items.** This document is NOT a copy of the Part 1 brief. If a block would
only make sense in a full account-strategy brief (a summary of the show
itself, priority-order table for field reps, "about the association", the
aggregate market-intel grid, manager takeaways, or a `Play` recommendation
per account) — it does not belong here. When genuinely unsure whether
something belongs, cut it.

**One explicit exception:** `executive_summary` (block 1.5) IS a summary —
but of THIS document's own findings, for a leadership audience who won't
read past page 1, not a copy of Part 1's show/room summary. It sits above
an explicit appendix divider; everything below the divider is unchanged
operational detail for Norman and the field team. Added in response to
direct feedback that the original all-operational-detail version wasn't
readable by a CEO — see the three-perspective review (executive brevity,
RevOps rigor, field usefulness) that shaped this block and the
`booth_brief` addition to each account card.

Top-level JSON keys, in render order:

1. `header` — title block
2. `executive_summary` — one-page leadership roll-up, then an appendix divider
3. `what_you_owe` — the assignment restated + due date
4. `stat_banner` — 4 summary metrics
5. `status_at_a_glance` — one row per account
6. `closed_lost` — HubSpot lost-reason table
7. `corrections` — discrepancies found vs. the Part 1 brief
8. `accounts` — per-account cards (each with a `booth_brief`), the core of the document
9. `crm_hygiene` — concrete CRM cleanup actions (conditional block)
10. `data_notes` — sourcing, refresh time, confidence caveats

Blocks 7 and 9 are **conditional** — omit them entirely if there is nothing
to report (no arithmetic/ownership discrepancies found; no hygiene issues
detected). Never render an empty section with just a heading.

---

## 1.5 `executive_summary`

A one-page, leadership-readable roll-up of this document's own findings —
built from the same underlying facts as the appendix below it, compressed
to what a CEO needs in under a minute. Always render this block first
(right after the header) and always follow it with the appendix divider
(handled automatically by the template — no JSON field needed for the
divider itself).

```json
{
  "headline": "≈$207K corrected recoverable pipeline · 7 accounts · IHI Conference 2026, Jul 29–30",
  "correction_note": "Part 1 stated ≈$142.8K — a $64,248 summation error on an already-listed deal, not new pipeline.",
  "prep_status": "20 of 22 prep items resolved. 2 open: attendance unconfirmed for Family Hardware and KB Home Center, pending campaign reply.",
  "rows": [
    {"account": "Home Lumber & Supply", "amount": "$90,636", "why_lost": "Went unresponsive twice", "angle": "Get their boss into the pricing conversation now", "blocker": "—"}
  ],
  "flagged_decision": "KB Home Center ($20K) was lost on a payments-rail blocker, not fit — the outcome of an internal fix attempt is unconfirmed. Check with finance before engaging; if unresolved, move this account to Skip."
}
```

Field notes, each one earned from a real mistake made building the first
draft of this block — don't reintroduce them:

- `headline` — the single number and fact set that would otherwise get
  buried in prose six sections down. If there's a corrected/disputed
  figure anywhere in `corrections`, that number belongs here, not a raw
  task-completion count (assigned/resolved/open is Norman's own tracking —
  real to him, meaningless to a CEO deciding what to do about $207K).
- `correction_note` — **must** make clear a corrected figure is a
  recomputation of already-known numbers, not new pipeline that appeared
  from nowhere. Compressing "Part 1 undercounted by $64K" into just "$64K
  more pipeline" is a materially misleading simplification — a RevOps
  rigor review specifically flagged this as the one number in the whole
  document that survives compression as a *correction*, never as *growth*.
- `prep_status` — one sentence, plain task-completion language. This is
  the only place `stat_banner`-shaped information belongs at this altitude.
- `rows` — exactly one row per account, in Part 1's priority order.
  `why_lost` and `angle` are compressed to a single clause each (3-6
  words / one short phrase) — the full multi-sentence version lives in the
  appendix's `accounts` cards, never duplicate it here.
  - `amount` — dollar figure at stake for that account (sum all of an
    account's lost deals). Round to whole dollars; the exact-cents version
    belongs in the appendix `closed_lost` table.
  - `blocker` — `"—"` for none. A real blocker (payments-rail limitation,
    unconfirmed attendance) goes here in a few words; template renders it
    in red automatically.
- `flagged_decision` — **exactly one**, the single thing a CEO or the
  sales manager actually needs to decide. If there's a genuine
  `needs_decision: true` correction in the appendix, this is almost always
  a compressed version of it — but never compress away the uncertainty. A
  correction stating an outcome is "unconfirmed" must stay unconfirmed
  here too; do not round it up to "resolved" or down to "dead end" for the
  sake of a cleaner sentence. If there's genuinely no flagged decision,
  state that plainly ("No decisions pending — proceed per the plan above")
  rather than omitting the field or manufacturing one.

**What never belongs here, no matter how tempting for brevity:** verbatim
rep quotes, deal IDs, Gong call counts, CRM property names, methodology
citations ("checked the Jun–Jul window..."), or anything with a
`needs_decision` nuance flattened into false certainty. If a fact can't be
stated accurately in one clause, it stays in the appendix and this block
just points at it (see `flagged_decision`'s handling of C3 above — it
gestures at "check with finance" rather than re-deriving the whole KB Home
Center Adyen story).

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

## 3. `what_you_owe`

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

## 4. `stat_banner`

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

## 5. `status_at_a_glance`

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

## 6. `closed_lost`

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

## 7. `corrections` (conditional)

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

## 8. `accounts`

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
      "booth_brief": {
        "say": "We know timing and pricing sign-off killed this last time — let's get your decision-maker in the room now.",
        "ask": "Did the meeting with Matt ever happen after Jameson's invite?",
        "watch_for": "Pushback on ERP-reintegration risk and multi-store payment consolidation — both came up repeatedly on past calls."
      },
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

- `booth_brief` — optional but strongly recommended when the account has
  enough resolved detail to compress. Exactly 3 fields (`say`, `ask`,
  `watch_for`), each one short sentence, meant to be read in the seconds
  before a live conversation. **This is a compression of facts already
  established in `resolved`/`open` below it — never a new judgment call.**
  If `say` states something not traceable to a `resolved` finding on this
  same card, that's a bug: either the underlying finding is missing or the
  `booth_brief` is inventing a recommendation the data doesn't support.
  For an account with a hard blocker (see KB Home Center in the golden
  example), `say` correctly becomes a hold instruction ("confirm X before
  re-pitching") rather than an opener — the field still gets used, just to
  say "don't," not "do." Omit the whole field only when an account is too
  thin to say anything useful yet (e.g., a brand-new open item with no
  resolved detail at all).
- **How `booth_brief` differs from the forbidden `play` field below:**
  `play` (Part 1's job, never ours) is a strategic account-approach
  recommendation constructed from company research, competitive context,
  and deal strategy. `booth_brief` is a compressed *restatement* of facts
  this document already resolved — it adds no strategy of its own, it just
  puts the existing findings into a scannable, in-the-moment format. If
  you find yourself reasoning about the account's fit or long-term
  strategy to write a `booth_brief`, stop — that's `play` territory, and
  it belongs in Part 1's next cycle, not here.
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

## 9. `crm_hygiene` (conditional)

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

## 10. `data_notes`

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
