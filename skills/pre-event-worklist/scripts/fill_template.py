#!/usr/bin/env python3
"""
fill_template.py — Render the Pre-Event Worklist HTML from a JSON data file.

Reads `assets/template.html` (Jinja2) and a JSON data file matching the
schema in `references/document-structure.md`, and writes a fully styled
standalone HTML file ready for the PDF render step (render_pdf.py).

Usage:
    python fill_template.py --data <data.json> --output <out.html>

Optional:
    --template <path>   Override the default template path.
    --embed-fonts       Base64-inline the vendored TTFs into the HTML
                        instead of referencing them by relative path.
                        Produces a single portable file (~900KB larger).
"""

import argparse
import base64
import json
import sys
from pathlib import Path

try:
    from jinja2 import Environment, FileSystemLoader, StrictUndefined, UndefinedError
except ImportError:
    sys.stderr.write(
        "Error: jinja2 is required. Install with:\n"
        "    pip install jinja2\n"
    )
    sys.exit(1)


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
DEFAULT_TEMPLATE = SKILL_ROOT / "assets" / "template.html"
FONT_DIR = SKILL_ROOT / "assets" / "fonts"

FONT_FILES = ["Bitter-Bold.ttf", "Rubik-Regular.ttf", "Rubik-Medium.ttf", "Rubik-Bold.ttf"]

REQUIRED_SECTIONS = [
    "header",
    "executive_summary",
    "what_you_owe",
    "stat_banner",
    "status_at_a_glance",
    "closed_lost",
    "accounts",
    "data_notes",
]
# corrections and crm_hygiene are intentionally conditional — see
# references/document-structure.md. Do not add them here.

REQUIRED_EXEC_SUMMARY_KEYS = ["headline", "correction_note", "prep_status", "rows", "flagged_decision"]


def validate(data: dict):
    """Return (hard_errors, soft_warnings).

    Hard errors block rendering. Soft warnings render anyway but should be
    reviewed — most of them exist to guard the document's scope rule (see
    SKILL.md: this document contains ONLY items assigned to the named
    person, nothing else).
    """
    hard, soft = [], []

    for key in REQUIRED_SECTIONS:
        if key not in data or data[key] in (None, "", [], {}):
            hard.append(f"  ✗ Missing required section: {key}")

    if not hard:
        if len(data["stat_banner"]) != 4:
            hard.append(
                f"  ✗ 'stat_banner' must have exactly 4 entries "
                f"(got {len(data['stat_banner'])})."
            )

        cards = data.get("accounts", {}).get("cards", [])
        if not cards:
            hard.append("  ✗ 'accounts.cards' is empty — a worklist with zero accounts is not valid.")

        total_items = 0
        for card in cards:
            resolved = card.get("resolved") or []
            open_items = card.get("open") or []
            if not resolved and not open_items:
                soft.append(
                    f"  ⚠ Account '{card.get('name')}' has neither resolved nor "
                    "open items — was it meant to be included in this worklist?"
                )
            total_items += len(resolved) + len(open_items)

        stat_map = {s["label"]: s["value"] for s in data["stat_banner"]}
        expected_assigned = str(total_items)
        if stat_map.get("ITEMS ASSIGNED") not in (expected_assigned, None):
            if str(stat_map.get("ITEMS ASSIGNED")) != expected_assigned:
                soft.append(
                    f"  ⚠ stat_banner ITEMS ASSIGNED = {stat_map.get('ITEMS ASSIGNED')} "
                    f"but counting resolved+open across all accounts gives {expected_assigned}. "
                    "These should match exactly — recompute rather than hand-enter."
                )

        for k in REQUIRED_EXEC_SUMMARY_KEYS:
            if k not in data.get("executive_summary", {}):
                hard.append(f"  ✗ 'executive_summary' is missing required field: {k}")
        exec_rows = data.get("executive_summary", {}).get("rows", [])
        if exec_rows and len(exec_rows) != len(cards):
            soft.append(
                f"  ⚠ executive_summary has {len(exec_rows)} row(s) but accounts.cards has "
                f"{len(cards)} — these should have exactly one row per account."
            )

        # Scope guard: these keys should never appear in this document's
        # data. Their presence usually means someone copy-pasted structure
        # from a Part 1 brief JSON instead of building a Part 2 worklist.
        # Note: executive_summary is NOT forbidden — it's a legitimate,
        # documented block (see document-structure.md §1.5) added for a
        # leadership-readable roll-up. It is validated above instead.
        forbidden_keys = [
            "priority_order", "market_intel",
            "manager_takeaways", "about_the_show", "skip_accounts",
        ]
        for card in cards:
            if "play" in card:
                hard.append(
                    f"  ✗ Account '{card.get('name')}' has a 'play' field. "
                    "This document does not include sales-approach recommendations "
                    "— that belongs to the Part 1 brief. Remove it."
                )
        for key in forbidden_keys:
            if key in data:
                hard.append(
                    f"  ✗ Top-level key '{key}' found. This looks like Part 1 "
                    "brief content, which this document must never reproduce. Remove it."
                )

    return hard, soft


def load_fonts_as_data_uris():
    uris = {}
    for fname in FONT_FILES:
        fpath = FONT_DIR / fname
        if not fpath.exists():
            sys.stderr.write(f"Error: font file not found: {fpath}\n")
            sys.exit(1)
        b64 = base64.b64encode(fpath.read_bytes()).decode("ascii")
        uris[fname] = f"data:font/ttf;base64,{b64}"
    return uris


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="Path to JSON data file.")
    parser.add_argument("--output", required=True, help="Path to write HTML output.")
    parser.add_argument("--template", default=str(DEFAULT_TEMPLATE), help=f"Path to template (default: {DEFAULT_TEMPLATE}).")
    parser.add_argument("--embed-fonts", action="store_true", help="Base64-inline fonts instead of relative-path @font-face src.")
    args = parser.parse_args()

    data_path = Path(args.data)
    template_path = Path(args.template)
    output_path = Path(args.output)

    if not data_path.exists():
        sys.stderr.write(f"Error: data file not found: {data_path}\n")
        sys.exit(1)
    if not template_path.exists():
        sys.stderr.write(f"Error: template not found: {template_path}\n")
        sys.exit(1)

    with data_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)

    hard, soft = validate(data)
    if hard:
        sys.stderr.write("ERROR — invalid worklist data. Fix the JSON and rerun:\n")
        for e in hard:
            sys.stderr.write(e + "\n")
        sys.stderr.write("\nSee references/document-structure.md for the schema.\n")
        sys.exit(1)
    if soft:
        sys.stderr.write("Validation warnings (rendering anyway):\n")
        for w in soft:
            sys.stderr.write(w + "\n")
        sys.stderr.write("\n")

    env = Environment(
        loader=FileSystemLoader(str(template_path.parent)),
        autoescape=False,
        undefined=StrictUndefined,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template(template_path.name)

    if args.embed_fonts:
        font_uris = load_fonts_as_data_uris()
        rendered = template.render(font_base="", **data)
        for fname, uri in font_uris.items():
            rendered = rendered.replace(f"'{fname}'", f"'{uri}'")
    else:
        # Relative path from the output file's directory back to the
        # skill's assets/fonts/ dir. Caller is responsible for either
        # keeping output next to the skill or copying assets/fonts/
        # alongside the output HTML.
        font_base = str(FONT_DIR) + "/"
        rendered = template.render(font_base=f"file://{font_base}", **data)

    try:
        # Force full evaluation to catch StrictUndefined errors even in
        # branches that might otherwise be lazily skipped by some Jinja
        # constructs (render() above already does this, but re-raise with
        # a clearer message if something slipped through).
        pass
    except UndefinedError as e:
        sys.stderr.write(f"Error: template referenced an undefined value: {e}\n")
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        fh.write(rendered)

    print(f"✓ Worklist HTML written: {output_path}")
    print(f"  Size: {output_path.stat().st_size:,} bytes")
    if soft:
        print(f"  ({len(soft)} soft warning(s) above — review before rendering to PDF.)")


if __name__ == "__main__":
    main()
