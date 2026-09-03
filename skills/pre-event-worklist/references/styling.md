# Styling Reference — Pre-Event Worklist

Extracted directly from the content stream of a real Toolbx Part 1 pre-event
brief (`IHI2026SalesTargetReport.pdf`) — these are the actual RGB values and
embedded font names used in that document, not a re-derivation from the
brand bible. Read this file only if you need to modify `assets/template.html`.

For the full Toolbx brand bible, consult the `toolbx-brand-bible` skill.
This file is a focused subset for the worklist document specifically.

---

## Colors (CSS hex values)

| Token | Hex | Where used in this document | In brand bible? |
|---|---|---|---|
| Slate Black | `#1C1C1E` | Dark header band, section titles, table headers, body text | ✅ |
| Dark Grey | `#494949` | Labels, subtext, fact-grid labels | ✅ |
| White | `#FFFFFF` | Page background, text on dark bands | ✅ |
| Sunrise Yellow | `#FFCA05` | `▌` accent bars, "STILL TO ADD" band border, callout borders | ✅ |
| Light Grey | `#F2F2F2` | Stat card backgrounds, callout backgrounds, "STILL TO ADD" band fill | ✅ |
| Silver Grey | `#CCCCCC` | Table borders | ✅ |
| Metallic Seaweed | `#457F86` | "RESOLVED FROM HUBSPOT" band border + label text | ✅ (data accent) |
| Azure X 11 | `#D6E8EA` | "RESOLVED FROM HUBSPOT" band background | ✅ (light accent fill) |
| **Alert Red** | **`#DC2626`** | Status pills (`CLOSED LOST`), `OVERDUE` marker, `YOUR CALL` pill | ❌ extension — see note below |
| **Signal Green** | **`#7CB518`** | Positive/complete markers (rare — a fully-resolved account) | ❌ extension — see note below |

**On the two extension colors:** `#DC2626` and `#7CB518` are not in the
Toolbx brand bible, but they appear in the source Part 1 brief's own
content stream (verified by inspecting the PDF's raw color operators) and
carry specific status semantics — red for a closed-lost/urgent state, green
for a fully-resolved one. They are used here deliberately, sparingly, and
only for status signaling, never as decorative color. If this document
family expands, raise these two with brand as candidates for formal
adoption rather than reinventing them per-document.

**Ratios for this document:**
- Slate Black / Dark Grey — dominant for headers and body text
- Sunrise Yellow — sharp accent only (`▌` bars, open-item band border)
- Metallic Seaweed / Azure X11 — resolved-item band only, never elsewhere
- Alert Red — status pills and urgency markers only; never body text or backgrounds
- Light Grey / White — page structure, breathing room

---

## Typography

```css
/* Headings */
font-family: 'Bitter', Georgia, 'Times New Roman', serif;
font-weight: 700;

/* Body */
font-family: 'Rubik', 'DM Sans', 'Helvetica Neue', Arial, sans-serif;
font-weight: 400;
```

**Note the deliberate divergence from the brand bible:** the brand bible
specifies DM Sans for body text. The actual Part 1 brief this skill answers
to has embedded `Rubik-Regular` / `Rubik-Bold` in its body text (confirmed
from the PDF's embedded font table), not DM Sans. This document matches the
artifact it's paired with — Rubik first, DM Sans as the fallback if Rubik
is ever unavailable, so the stack degrades toward brand-bible-compliant
rather than away from it.

Both fonts are vendored locally at `assets/fonts/*.ttf` (SIL OFL 1.1
licensed — see `assets/fonts/OFL.txt`) and loaded via `@font-face` in the
template, because neither Bitter nor Rubik nor DM Sans is installed as a
system font in the execution environment. Do not rely on system font
availability.

Sizes (in pt, matching the source document):
- Header band title: 16pt bold
- Section heading (`▌` level): 14pt bold
- Sub-section heading: 11–12pt bold
- Body: 11pt regular
- Table cell text: 10pt regular
- Stat banner large value: 18pt bold
- Stat banner label: 8pt bold uppercase, `letter-spacing: 1px`
- Status pill / band label text: 8pt bold uppercase

---

## Section accent bar (▌)

Every major section heading is preceded by a yellow vertical bar character —
the signature Toolbx element carried over unchanged from the Part 1 brief:

```html
<h2 style="font-family:'Bitter',Georgia,serif; font-size:14pt; color:#1C1C1E; margin:20px 0 10px 0;">
  <span style="color:#FFCA05;">▌</span> Section Title
</h2>
```

Character is U+258C (LEFT HALF BLOCK). Do not remove or substitute it.

Sub-bullets in "manager takeaway"-style lists use `▪` (U+25AA BLACK SMALL
SQUARE) — not used in this document's default blocks, but preserve the
convention if a future block needs bulleted takeaways.

---

## Component recipes

### 1. Dark header band

```html
<table style="width:100%; background:#1C1C1E; color:#FFFFFF; border-collapse:collapse; margin:0 0 16px 0;">
  <tr>
    <td style="padding:14px 18px; font-family:'Rubik',Arial,sans-serif;">
      <span style="font-weight:700; letter-spacing:1px;">TOOLBX</span>
      &nbsp;&nbsp;<span style="color:#FFCA05; font-size:14pt;">▌</span>&nbsp;&nbsp;
      <span style="font-family:'Bitter',Georgia,serif; font-weight:700; font-size:16pt;">PRE-EVENT WORKLIST</span>
      <br>
      <span style="font-size:11pt; font-weight:400;">{{ header.event_name }}</span>
      &nbsp;&middot;&nbsp;
      <span style="font-size:10pt; font-style:italic; color:#CCCCCC;">{{ header.subtitle }}</span>
    </td>
  </tr>
</table>
```

### 2. Stat card row (4-up)

```html
<table style="width:100%; border-collapse:collapse; margin:12px 0;">
  <tr>
    <td style="width:25%; background:#F2F2F2; text-align:center; padding:14px 8px; border:1px solid #CCCCCC;">
      <div style="font-family:'Bitter',Georgia,serif; font-size:18pt; font-weight:700; color:#1C1C1E; line-height:1.1;">{{ stat.value }}</div>
      <div style="font-size:8pt; font-weight:700; color:#494949; letter-spacing:1px;">{{ stat.label }}</div>
    </td>
    <!-- 3 more cells -->
  </tr>
</table>
```

### 3. Status pill

```html
<span style="display:inline-block; background:#DC2626; color:#FFFFFF; font-size:8pt; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; padding:2px 8px; border-radius:2px;">{{ status_pill }}</span>
```

Used for account status pills (`CLOSED LOST ×2 · RE-ENGAGE`) and for the
`OVERDUE` / `YOUR CALL` markers on the "what you owe" and corrections
blocks.

### 4. Resolved band (new component — not in elt-pre-read or the source Part 1 brief)

```html
<table style="width:100%; background:#D6E8EA; border-left:4px solid #457F86; border-collapse:collapse; margin:8px 0;">
  <tr>
    <td style="padding:10px 14px;">
      <div style="font-weight:700; color:#457F86; font-size:8pt; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">RESOLVED FROM HUBSPOT</div>
      {% for item in resolved %}
      <div style="margin:4px 0; font-size:10pt; color:#1C1C1E;"><strong>{{ item.label }}.</strong> {{ item.finding }}</div>
      {% endfor %}
    </td>
  </tr>
</table>
```

Omit this table entirely if `resolved` is empty for a card — never render
an empty band.

### 5. Open band ("STILL TO ADD")

Direct visual descendant of the Part 1 brief's yellow "NORMAN TO ADD"
band — same treatment, generalized label:

```html
<table style="width:100%; background:#F2F2F2; border-left:4px solid #FFCA05; border-collapse:collapse; margin:8px 0;">
  <tr>
    <td style="padding:10px 14px;">
      <div style="font-weight:700; color:#1C1C1E; font-size:8pt; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px;">STILL TO ADD (RED SHIFT + GONG)</div>
      <div style="font-size:10pt; color:#1C1C1E;">
        {{ open_items | map(attribute='label') | join(' &middot; ') }}
      </div>
    </td>
  </tr>
</table>
```

Omit entirely if `open` is empty for a card.

### 6. Account fact grid

```html
<table style="width:100%; border-collapse:collapse; border:1px solid #CCCCCC; margin:8px 0;">
  <tr>
    <td style="background:#F2F2F2; font-weight:600; font-size:8pt; text-transform:uppercase; color:#494949; padding:6px 10px; border:1px solid #CCCCCC; width:20%;">{{ fact.label }}</td>
    <td style="padding:6px 10px; border:1px solid #CCCCCC; font-size:10pt;">{{ fact.value }}</td>
    <!-- repeat, 3 per row -->
  </tr>
</table>
```

### 7. Corrections callout

```html
<table style="width:100%; background:#F2F2F2; border-left:4px solid #FFCA05; border-collapse:collapse; margin:10px 0;">
  <tr>
    <td style="padding:12px 16px;">
      <span style="display:inline-block; background:#1C1C1E; color:#FFCA05; font-size:8pt; font-weight:700; padding:1px 6px; margin-right:6px;">{{ item.tag }}</span>
      <strong style="font-family:'Bitter',Georgia,serif; color:#1C1C1E;">{{ item.title }}</strong>
      {% if item.needs_decision %}<span style="display:inline-block; background:#DC2626; color:#FFFFFF; font-size:7pt; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; padding:2px 6px; border-radius:2px; margin-left:6px;">YOUR CALL</span>{% endif %}
      <div style="margin-top:6px; font-size:10pt; color:#1C1C1E;">{{ item.body }}</div>
    </td>
  </tr>
</table>
```

### 8. Closed-lost detail table

Two-tier text within a cell — picklist reason as a tag-like label, then the
rep's verbatim note in italics to visually mark it as a quote:

```html
<table style="width:100%; border-collapse:collapse; border:1px solid #CCCCCC;">
  <thead>
    <tr style="background:#1C1C1E; color:#FFFFFF;">
      <th style="padding:8px 10px; text-align:left; font-size:9pt; letter-spacing:1px; border:1px solid #1C1C1E;">ACCOUNT</th>
      <th style="padding:8px 10px; text-align:right; font-size:9pt; letter-spacing:1px; border:1px solid #1C1C1E;">AMOUNT</th>
      <th style="padding:8px 10px; text-align:left; font-size:9pt; letter-spacing:1px; border:1px solid #1C1C1E;">CLOSED</th>
      <th style="padding:8px 10px; text-align:left; font-size:9pt; letter-spacing:1px; border:1px solid #1C1C1E;">REASON &amp; REP'S NOTE</th>
      <th style="padding:8px 10px; text-align:left; font-size:9pt; letter-spacing:1px; border:1px solid #1C1C1E;">OWNER</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:6px 10px; border:1px solid #CCCCCC; {% if row.emphasis %}font-weight:700;{% endif %}">{{ row.account }}</td>
      <td style="padding:6px 10px; border:1px solid #CCCCCC; text-align:right; {% if row.emphasis %}font-weight:700;{% endif %}">{{ row.amount }}</td>
      <td style="padding:6px 10px; border:1px solid #CCCCCC;">{{ row.closed }}</td>
      <td style="padding:6px 10px; border:1px solid #CCCCCC;">{{ row.reasons | join('; ') }}<br><span style="font-style:italic; color:#494949;">&ldquo;{{ row.detail }}&rdquo;</span></td>
      <td style="padding:6px 10px; border:1px solid #CCCCCC;">{{ row.owner }}</td>
    </tr>
  </tbody>
</table>
```

---

## 9. Executive summary block (leadership roll-up)

```html
<table style="width:100%; background:#F2F2F2; border:1px solid #CCCCCC; margin:0 0 4px 0;">
  <tr>
    <td style="padding:16px 18px;">
      <div style="font-family:'Bitter',Georgia,serif; font-size:20pt; font-weight:700; color:#1C1C1E;">{{ executive_summary.headline }}</div>
      <div style="font-size:9pt; color:#494949; margin-top:4px;">{{ executive_summary.correction_note }}</div>
      <div style="font-size:10pt; color:#1C1C1E; margin-top:10px;">{{ executive_summary.prep_status }}</div>
    </td>
  </tr>
</table>
```

20pt headline — the single largest text in the document, deliberately.
Followed by the compact 7-column-free account table (account / $ at stake /
why lost / angle / blocker) and a red-bordered "FLAG" callout for the one
decision that needs a human. See `document-structure.md` §1.5 for what
belongs in each field.

## 10. Appendix divider

```html
<div style="break-before:page; page-break-before:always;"></div>
<table style="width:100%; background:#1C1C1E; margin:0 0 16px 0;">
  <tr>
    <td style="padding:8px 18px;">
      <span style="color:#FFCA05; font-weight:700; font-size:9pt; letter-spacing:1.5px; text-transform:uppercase;">Appendix — operational detail</span>
    </td>
  </tr>
</table>
```

Forces a page break so the executive summary is always a clean, standalone
page 1 — regardless of how long the summary table happens to render.

## 11. Booth brief (per-account compressed action box)

```html
<table style="width:100%; background:#1C1C1E; color:#FFFFFF; border-left:4px solid #FFCA05; margin:0 0 8px 0;">
  <tr>
    <td style="padding:9px 12px; font-size:9.5pt;">
      <strong style="color:#FFCA05;">Say:</strong> {{ card.booth_brief.say }}<br>
      <strong style="color:#FFCA05;">Ask:</strong> {{ card.booth_brief.ask }}<br>
      <strong style="color:#FFCA05;">Watch for:</strong> {{ card.booth_brief.watch_for }}
    </td>
  </tr>
</table>
```

Dark background (inverted from the rest of the card) so it reads as a
distinct "read this first" block at the top of each account card, before
the fact grid and the resolved/open bands. Omit entirely if `card.booth_brief`
is absent — same never-render-an-empty-block rule as every other
conditional component here.

---

## Jinja2 gotcha: fields literally named `items`

Two schema fields are literally named `items` (`corrections.items`, and
`status_at_a_glance.rows[].items` — the assigned-item count). In Jinja2,
`somedict.items` resolves to Python's builtin `dict.items()` **method**,
not the dict's `"items"` key, when accessed with dot notation on a plain
dict. Always use bracket subscript syntax for these two fields —
`corrections['items']`, `row['items']` — never `corrections.items` /
`row.items`. The template already does this; preserve it if you touch
either block.

---

## What NOT to do

- **No CSS flexbox or grid** — use tables for layout (keeps a Google Docs
  upload path open even though this document renders to PDF by default).
- **No external stylesheets** — inline all styles.
- **No SVG/image accents** — use Unicode characters (`▌`, `▪`, `·`, `×`).
- **No background images.**
- **No fixed pixel widths on tables** — use percentages.
- **No JavaScript.**
- **Never render an empty band** — a card with no resolved items omits the
  teal band entirely; a card with no open items omits the yellow band
  entirely. An empty band with a heading and no content is worse than no
  band.

---

## Print CSS (required for the PDF render path)

```css
@page { size: Letter portrait; margin: 0.5in; }
body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.card, .band, tr { break-inside: avoid; page-break-inside: avoid; }
h2 { break-after: avoid; }
```

`print-color-adjust: exact` is mandatory. Without it, headless Chromium
drops all background-color fills on print and the entire design collapses
to a plain white document — dark header band, stat cards, and both
resolved/open bands all lose their backgrounds silently. This is the
single most common way this template fails, and it fails with exit code 0.

---

## Reusable Jinja2 macros (in template)

- `{% macro section_heading(title) %}` — `▌` + title heading.
- `{% macro stat_card(value, label) %}` — single stat card cell.
- `{% macro status_pill(text, color='#DC2626') %}` — inline pill.
- `{% macro resolved_band(items) %}` — teal band; renders nothing if `items` is empty.
- `{% macro open_band(items) %}` — yellow band; renders nothing if `items` is empty.
- `{% macro fact_grid(facts) %}` — label/value grid, 3 per row.
- `{% macro correction(item) %}` — corrections callout with optional `YOUR CALL` pill.

Use these for consistency rather than re-writing inline HTML per block.
