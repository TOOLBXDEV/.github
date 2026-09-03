---
name: pre-event-worklist
description: >
  Use this skill to build a personal Part 2 pre-event worklist — the
  follow-up pass on a Toolbx Part 1 pre-event brief / sales target report.
  Takes a Part 1 brief (uploaded PDF or a HubSpot GTM campaign) plus a
  person's name, extracts every item tagged for that person, auto-resolves
  what HubSpot can answer (closed-lost reasons and the rep's own lost-reason
  notes, deal and company facts, owner assignment, duplicate records), and
  generates a branded Toolbx PDF containing ONLY that person's assigned
  work. Triggers on "build my part 2", "what do I need to add before the
  show", "my worklist for [event]", "pull the closed lost reasons for
  [event] targets", "finish the pre-event brief", "consolidate the [event]
  brief", "what's tagged for me in this brief", or any request to complete
  the second half of a pre-event briefing. Also use when someone uploads a
  pre-event brief / sales target report PDF and asks what they owe on it.
---

# Pre-Event Worklist Skill

You are completing the second half of a Toolbx standardized pre-event
briefing process. A sales manager or field lead produces "Part 1" — a
CRM + pipeline brief ranking target accounts for a conference — and leaves
explicit yellow bands marking what a named person still owes before the
show (Red Shift activity + Gong call notes, typically). This skill builds
that person's half: a document containing exactly what was assigned to
them, with as much of it pre-resolved from HubSpot as the data supports.

## The hard scope rule — read this twice

**The output document contains ONLY items assigned to the named person.**
It is NOT a copy of the Part 1 brief, and reproducing Part 1's content is
this skill's single most likely failure mode. The output must never
contain: a summary of the show or the room, the priority-order table
ranking accounts for field reps, "about the show/association" context, the
aggregate market-intel grid, manager takeaways, or a recommended sales
"Play" per account. If you're unsure whether something belongs, cut it.
When you finish assembling the document, re-read it and ask: "if I removed
the person's name, would this still look like someone else's document?" If
yes, you've included Part 1 content — remove it.

Everything in this document exists because it is either (a) an item
explicitly tagged to this person in Part 1, or (b) context required to
understand that item (the account's basic facts, the lost-deal amount).

**One deliberate exception:** the document's own `executive_summary` block
(§8 below) IS a summary — but of THIS document's findings, for a
leadership audience, not a copy of Part 1's show/room summary. It exists
because a real user reviewed the all-operational-detail version and found
it unreadable by a CEO. It sits above an explicit appendix divider;
everything below is the unchanged operational detail Norman and the field
team need. Don't let this exception creep — it's one page, one table, one
flagged decision, nothing else.

## Reference files (read on demand)

- `references/document-structure.md` — the 10 JSON blocks that make up the
  worklist, full schema, and what's conditional. Read before Step 6.
- `references/data-sources.md` — HubSpot field/property patterns (company
  resolution, deal lost-reasons, owner lookup, duplicate detection) and the
  Gong/Red Shift connector fallback chain. Read before Steps 3–5.
- `references/styling.md` — colors, fonts, and component HTML recipes.
  Read only if the template needs modification.
- `assets/template.html` — Jinja2 template. Do not edit unless
  intentionally changing document structure.
- `assets/fonts/` — vendored Bitter + Rubik TTFs (SIL OFL 1.1). Neither
  font is installed as a system font in this environment — the template
  depends on these files being present.
- `scripts/extract_part1.py` — Part 1 PDF → assigned-items JSON.
- `scripts/fill_template.py` — data JSON → HTML.
- `scripts/render_pdf.py` — HTML → PDF via headless Chromium.
- `examples/ihi-2026-norman.json` + `.pdf` — golden reference from a real
  run. Use as a structural example when something in the schema is unclear.

Load each reference file only when you reach the corresponding step below.

## Brand requirement

All visual output follows the Toolbx brand bible. The template already
encodes the correct structure; if you need to add anything not already in
`assets/template.html`, consult the `toolbx-brand-bible` skill first. Note
that this document's palette includes two colors NOT in the brand bible —
`#DC2626` (status/urgency red) and `#7CB518` (positive/complete green) —
used deliberately as status semantics because they appear in the Part 1
brief's own source PDF. See `references/styling.md` for the full rationale
before changing either.

---

## Step 1 — Establish inputs

Ask for (or infer from an uploaded file):

- **The Part 1 brief** — an uploaded PDF, or if none exists yet, a HubSpot
  GTM campaign ID/name to pull target accounts from directly.
- **The person's name**, exactly as it should be matched against the Part 1
  brief's "___ TO ADD" bands (e.g. "Norman", not "Norman Kuan", if that's
  how the brief phrases it — check the actual band text).
- **The event name and dates** — for the header and due-date computation.

Compute the Part 2 due date as **2 calendar days before the event's first
day**, matching the Part 1 brief's own stated convention ("delivers the
consolidated brief two days out"). If the brief states a different cadence,
use that instead. Flag whether the due date is already past relative to
today — this drives the `overdue` flag in `what_you_owe`.

If no Part 1 PDF is available, don't guess at what's assigned — ask the
user what accounts and item types they need covered, or work from the
HubSpot campcampaign's target-account list plus a description of what a
Part 2 pass typically checks (lost reasons, Gong notes, activity
verification).

## Step 2 — Extract assigned items

Run:

```bash
python scripts/extract_part1.py --pdf <part1.pdf> --person "<Name>" --output items.json
```

**If this exits non-zero (zero items found), do not proceed.** It almost
always means the person's name doesn't match the brief's band text exactly
— try a different form of the name before assuming nothing is assigned.

Review the extracted JSON by hand. The parser does prose-splitting on a
fixed set of separators (`·`, then `.`) — it is a first pass, not an
oracle. Correct any item that was split wrong or attributed to the wrong
account before proceeding. Also review `process_items` — these are
standalone mentions of the person outside any band (e.g. the sentence
describing the Part 2 handoff itself) and inform `what_you_owe`, not any
account card.

## Step 3 — Resolve accounts in HubSpot

For every account with at least one assigned item:

1. Search `COMPANY` by name (batch in groups of ≤5 filterGroups).
2. Disambiguate decoy matches using city+state, then contact count
   cross-checked against the Part 1 brief, then lifecycle stage. Ask the
   user rather than guess if still ambiguous.
3. Pull all deals associated with the resolved company IDs in one batched
   `search_crm_objects` call on `DEAL`, requesting both `closed_lost_reasons`
   **and** `closed_lost_detail__c` (the rep's own free-text note — this is
   where the real insight usually is, not the picklist).
4. Resolve every `hubspot_owner_id` encountered via `search_owners` — never
   print a raw owner ID in the document.
5. Check for duplicate company shells (same/similar name, 0 contacts, 0
   deals, default lifecycle stage) — these become `crm_hygiene` entries.

Full property lists and exact patterns: `references/data-sources.md`.

## Step 4 — Auto-resolve items

For each extracted item, match its text against the resolver rules in
`references/data-sources.md` §F and attempt resolution:

- Lost-reason items → `closed_lost_reasons` + `closed_lost_detail__c`.
- "Why no value" items → check whether `amount` is absent on the deal.
- Duplicate-record items → the shell-detection result from Step 3.
- Everything else (Gong notes, activity/touch verification, attendance
  confirmation, contact validity) → attempt via Step 5, else stays open.

**Never stretch a rule to manufacture a resolution.** An item that can't be
honestly answered stays in `open` with a `source` label naming which system
should eventually answer it. A wrong "resolved" is worse than an honest
"open" — it tells the reader to stop looking.

## Step 5 — Gong / Red Shift

Try the `Gong` MCP connector (`ask_account`/`ask_deal`) directly first —
confirmed to work without interactive auth, and richer than the
alternatives since it returns synthesized answers, not raw transcripts.
Resolve the account to its exact HubSpot company ID before calling
`ask_account` (name search can return `CRM_AMBIGUOUS_ENTITY`), and always
pass an explicit date range back to at least the earliest relevant deal's
close date — the tool's 30-day default window misses everything on a
win-back campaign. `Sales_Hub`'s Gong tools required interactive sign-in
and 401'd in this environment; don't burn more than one attempt on it
before falling back. Red Shift SQL is a last resort and may not exist at
all — check `ListConnectors` before assuming it does. Full detail:
`references/data-sources.md` §C.

Gong questions often surface names and details CRM doesn't have — a second
stakeholder, an internal follow-up thread, a concrete next step. When that
happens, don't just fold it into the resolved finding: add a
`crm_hygiene` action if it's a data gap, and a `corrections` entry if it
changes how an existing Part 1 claim should be read (see the IHI 2026
example, where a Gong call revealed the KB Home Center "Not in ICP"
blocker was already under internal review at Toolbx — a materially
different situation than "dead end, skip it").

For "confirm attendance" items, an honest negative (checked, found
nothing) is a valid outcome — report it as a checked-but-unconfirmed
`open` item with the check noted in `source`, never as a resolution.
Anything still unresolved after this stays `open` — report which
connector path was actually used (or that none was reachable) in
`data_notes`.

## Step 6 — Reconcile Part 1's own numbers

This is a standing step, not optional: recompute Part 1's stated headline
totals from its own per-account figures, and diff Part 1's stated
ownership/lifecycle claims against what's live in HubSpot right now. This
is exactly how a real $64,248 pipeline-total discrepancy and a stale
"unowned" claim were caught on the first production run of this skill —
expect to find something most of the time, not rarely.

Findings become `corrections` entries (see `document-structure.md` block
6). Each correction states the discrepancy and the corrected figure — it
does not recommend a strategic response. If a finding requires a human
judgment call (e.g. reclassifying an account), set `needs_decision: true`
and say so plainly; do not make the call yourself.

If reconciliation finds nothing, omit the `corrections` block entirely.

## Step 7 — Ask about real gaps only

If, after Steps 3–6, there are still ambiguities that block building the
document (which account a company decoy actually refers to; whether a
finding needs a decision or is settled) — ask, in one message, no more than
3 questions. If everything is resolved or cleanly marked open, skip this
step.

## Step 8 — Assemble JSON → HTML → PDF

Read `references/document-structure.md` now for the complete schema.
Build the JSON object matching all 10 blocks (2 conditional). Compute the
`stat_banner` **and** `executive_summary` values from the actual
`accounts.cards` / `corrections` data — never hand-enter a number that
could drift from the underlying counts or figures. Build `executive_summary`
and each card's `booth_brief` only after everything else is assembled —
both are compressions of facts already established elsewhere in the
document, never a source of new claims.

```bash
python scripts/fill_template.py --data worklist-data.json --output worklist.html
python scripts/render_pdf.py --html worklist.html --output worklist.pdf
```

`fill_template.py` validates required sections and will hard-error on
Part-1-shaped content leaking in (a `play` field on an account, or a
top-level key like `priority_order`/`market_intel`/`about_the_show`) —
treat that error as a scope bug to fix, not a check to bypass.
`executive_summary` is required, not forbidden — see the exception noted
above.

**Visually inspect the resulting PDF before reporting success.**
`render_pdf.py` exits 0 even on a blank/failed render (e.g. missing
`print-color-adjust: exact` silently drops every background fill). Use the
`Read` tool on the PDF file directly and confirm: the `▌` bars render in
yellow, both the teal "RESOLVED" and yellow "STILL TO ADD" bands are
visible wherever they should be, backgrounds aren't collapsed to white, no
text is clipped, page 1 is a clean self-contained executive summary, and
the appendix divider forces a real page break (not just a visual line) so
page 1 never bleeds into operational detail.

## Step 9 — Deliver

Send the PDF to the user. In your summary, report:

- Items assigned / resolved / still open, by account.
- Every `corrections` entry, especially any `needs_decision: true` ones —
  surface these explicitly, don't bury them in the file.
- Which Gong/Red Shift path was used, or that none was reachable and which
  items are therefore still open for that reason specifically.

Keep the summary tight — the document itself carries the detail.

---

## Voice & editorial rules

The Part 1 brief this document answers to has a specific, blunt, useful
voice. Match it:

- **Verdict first, not setup first.** State the finding, then the detail.
- **Undercut your own numbers.** If 10 of 22 items are resolved, say
  clearly which 12 are not and why — don't let the "10 resolved" stat imply
  more progress than there is.
- **Name the blocker, don't bury it.** A hard product/fit limitation found
  in a lost-reason note (e.g. a payments-rail incompatibility) belongs in
  the open text plainly, not softened into a vague "needs review."
- **Verbatim over paraphrase.** Quote `closed_lost_detail__c` exactly,
  including typos — bracket a correction (`no[t]`) rather than silently
  fixing the source text.
- **Hedge honestly.** Use `≈` for derived/summed figures; say "not yet
  confirmed" rather than implying certainty on an open item.
- **No filler.** No throat-clearing, no restating the obvious.
- **Never invent a finding.** An item you cannot resolve stays open. This
  is the one rule that matters more than voice — a fabricated lost reason
  or a guessed Gong note is a worse outcome than an honest gap.
