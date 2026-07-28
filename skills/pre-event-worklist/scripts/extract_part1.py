#!/usr/bin/env python3
"""
extract_part1.py — Extract one person's assigned items from a Part 1
pre-event brief PDF.

A Part 1 brief marks a person's Part 2 assignment with a band like:

    NORMAN TO ADD BEFORE SHOW (RED SHIFT + GONG):
    Both 2025 lost reasons (esp. the $64K deal) · whether the logged
    follow-up ever happened · Gong notes across the 6 contacts.

This script finds every such band for a given person, attributes each to
its nearest preceding account heading, splits the band body into atomic
items, and also captures any standalone process-level mention of the
person (e.g. "Norman completes Part 2 ... and delivers the consolidated
brief two days out").

Usage:
    python extract_part1.py --pdf <part1.pdf> --person "Norman" [--output items.json]

Requires: pypdf
    pip install pypdf
    pip install --ignore-installed cffi cryptography   # fixes a pyo3 import
                                                        # panic seen in this
                                                        # environment on a
                                                        # bare `pip install pypdf`
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    sys.stderr.write(
        "Error: pypdf is required. Install with:\n"
        "    pip install pypdf\n"
        "    pip install --ignore-installed cffi cryptography\n"
    )
    sys.exit(1)


# An account heading looks like:
#   Home Lumber & Supply Co. — Meade, KS    CLOSED LOST ×2 · RE-ENGAGE
# i.e. "<Name> — <City, ST/Country>" followed by 2+ spaces and a status
# phrase containing CLOSED LOST and/or RE-ENGAGE.
ACCOUNT_HEADING_RE = re.compile(
    r"^(?P<name>.+?)\s+[—\-]\s+(?P<location>[^\n]+?)\s{2,}"
    r"(?P<status>(?:CLOSED\s+LOST|RE-ENGAGE)[^\n]*)$",
    re.MULTILINE,
)

# A band start looks like (case-insensitive, name interpolated):
#   NORMAN TO ADD BEFORE SHOW (RED SHIFT + GONG):
def band_start_re(person: str) -> re.Pattern:
    escaped = re.escape(person.upper())
    return re.compile(
        rf"^\s*{escaped}\s+TO\s+ADD[^:\n]*:\s*$",
        re.MULTILINE | re.IGNORECASE,
    )


# Generic fallback if the person's name isn't in the band text itself but
# the brief still marks a "TO ADD BEFORE SHOW" band (e.g. a template where
# the assignee is named once in the process section, not per-band).
GENERIC_BAND_RE = re.compile(
    r"^\s*[A-Z][A-Z\s]*\bTO\s+ADD[^:\n]*:\s*$",
    re.MULTILINE,
)

# Every major section heading in a Part 1 brief is prefixed with the ▌
# (U+258C) accent bar, including ones with no CLOSED LOST/RE-ENGAGE status
# pill (e.g. "▌ Skip (and why)", "▌ Data notes & confidence"). The LAST
# band in the document has no following account heading or TO-ADD band to
# bound it, so without this it swallows everything to the end of the PDF
# text — always bound a band at the next section marker too, whichever
# comes first.
SECTION_MARKER_RE = re.compile(r"^\s*▌", re.MULTILINE)

# Matches a sentence mentioning the person outside of any band — used to
# capture process-level obligations (due dates, cadence).
def process_mention_re(person: str) -> re.Pattern:
    escaped = re.escape(person)
    return re.compile(rf"[^.]*\b{escaped}\b[^.]*\.", re.IGNORECASE)


def extract_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def find_account_headings(text: str):
    """Return list of (start_offset, name, location, status) in document order."""
    headings = []
    for m in ACCOUNT_HEADING_RE.finditer(text):
        headings.append(
            {
                "offset": m.start(),
                "name": m.group("name").strip(),
                "location": m.group("location").strip(),
                "status": re.sub(r"\s+", " ", m.group("status").strip()),
            }
        )
    return headings


def nearest_preceding_account(offset: int, headings):
    candidate = None
    for h in headings:
        if h["offset"] <= offset:
            candidate = h
        else:
            break
    return candidate


def split_band_items(body: str):
    """Split a band body into atomic items on the middle-dot separator,
    falling back to '.' if no middle dots are present."""
    body = re.sub(r"\s+", " ", body).strip().rstrip(".")
    if "·" in body:  # ·
        parts = [p.strip() for p in body.split("·")]
    else:
        parts = [p.strip() for p in body.split(".")]
    return [p for p in parts if p]


def extract_bands(text: str, person: str, headings):
    pattern = band_start_re(person)
    matches = list(pattern.finditer(text))

    used_generic = False
    if not matches:
        # Fall back to a generic "TO ADD BEFORE SHOW" band if the person's
        # name isn't embedded in the band text itself.
        matches = list(GENERIC_BAND_RE.finditer(text))
        used_generic = True

    section_markers = [m.start() for m in SECTION_MARKER_RE.finditer(text)]

    bands = []
    for i, m in enumerate(matches):
        band_start = m.end()
        band_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        # Stop a band at the next account heading if one falls inside the
        # naive slice (bands never span multiple accounts).
        for h in headings:
            if band_start < h["offset"] < band_end:
                band_end = h["offset"]
                break
        # Also stop at the next ▌ section marker — catches non-account
        # sections like "Skip (and why)" or "Data notes & confidence" that
        # would otherwise only be bounded by a following TO-ADD band, which
        # doesn't exist for the last band in the document.
        for marker_offset in section_markers:
            if band_start < marker_offset < band_end:
                band_end = marker_offset
                break
        body = text[band_start:band_end]
        account = nearest_preceding_account(m.start(), headings)
        items = split_band_items(body)
        bands.append(
            {
                "account_name": account["name"] if account else None,
                "account_location": account["location"] if account else None,
                "account_status": account["status"] if account else None,
                "raw_items": items,
            }
        )
    return bands, used_generic


def extract_process_items(text: str, person: str):
    pattern = process_mention_re(person)
    mentions = []
    for m in pattern.finditer(text):
        sentence = re.sub(r"\s+", " ", m.group(0)).strip()
        # Skip sentences that are actually inside a TO ADD band — those are
        # already captured as account-level items.
        if re.search(r"TO\s+ADD", sentence, re.IGNORECASE):
            continue
        mentions.append(sentence)
    return mentions


def assign_item_ids(bands):
    """Assign stable ids like 1a, 1b, 2a... per account in document order."""
    account_index = {}
    next_index = 1
    for band in bands:
        key = band["account_name"] or "__unassigned__"
        if key not in account_index:
            account_index[key] = next_index
            next_index += 1
        acct_num = account_index[key]
        for i, item in enumerate(band["raw_items"]):
            letter = chr(ord("a") + i)
            band.setdefault("items", []).append(
                {"item_id": f"{acct_num}{letter}", "text": item}
            )
    return bands


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path, help="Path to the Part 1 brief PDF")
    parser.add_argument("--person", required=True, help="Person's name as it appears in the brief's TO ADD bands")
    parser.add_argument("--output", type=Path, default=None, help="Output JSON path (default: stdout)")
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.stderr.write(f"Error: {args.pdf} does not exist\n")
        sys.exit(1)

    text = extract_text(args.pdf)
    headings = find_account_headings(text)
    bands, used_generic = extract_bands(text, args.person, headings)
    bands = assign_item_ids(bands)
    process_items = extract_process_items(text, args.person)

    total_items = sum(len(b["items"]) for b in bands)

    if total_items == 0:
        sys.stderr.write(
            f"Error: found zero assigned items for '{args.person}' in {args.pdf}.\n"
            "This almost certainly means the name doesn't match the brief's band\n"
            "text exactly (check full name vs. nickname), NOT that nothing is\n"
            "assigned. Refusing to emit an empty worklist — check the person\n"
            "argument and re-run.\n"
        )
        sys.exit(1)

    if used_generic:
        sys.stderr.write(
            f"Warning: no band matched '{args.person.upper()} TO ADD...' literally; "
            "fell back to matching any 'TO ADD BEFORE SHOW' band. Verify the "
            "extracted accounts are actually assigned to this person.\n"
        )

    result = {
        "person": args.person,
        "source_pdf": str(args.pdf),
        "accounts": bands,
        "process_items": process_items,
        "total_items": total_items,
        "matched_literally": not used_generic,
    }

    output_json = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(output_json, encoding="utf-8")
        sys.stderr.write(f"Wrote {total_items} items across {len(bands)} bands to {args.output}\n")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
