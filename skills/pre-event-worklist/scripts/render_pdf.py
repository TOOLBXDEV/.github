#!/usr/bin/env python3
"""
render_pdf.py — Render the worklist HTML to PDF via headless Chromium.

Uses the Chromium binary already present in this environment at
/opt/pw-browsers/chromium (do NOT run `playwright install` — it's
pre-installed and PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set).

Usage:
    python render_pdf.py --html <in.html> --output <out.pdf>

Notes:
- Requires an ABSOLUTE file:// URL — Chromium resolves relative @font-face
  src paths against the working directory otherwise, not the HTML file's
  location, and fonts silently fall back to system substitutes.
- --no-sandbox is required because this runs as root in this environment.
- The template's print CSS sets `print-color-adjust: exact` — without it
  Chromium drops every background-color fill on PDF export and the whole
  design collapses to a plain white page. That failure mode still exits 0,
  which is why this script checks output size as a sanity floor and the
  skill's own checklist requires a visual read of the resulting PDF.
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

CHROMIUM_CANDIDATES = [
    "/opt/pw-browsers/chromium",
    "/opt/pw-browsers/chromium_headless_shell-1194/chrome-headless-shell",
]

MIN_OUTPUT_BYTES = 20_000  # a real multi-page rendered PDF; a blank/failed
                           # render is reliably much smaller than this.


def find_chromium() -> str:
    for candidate in CHROMIUM_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    found = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if found:
        return found
    sys.stderr.write(
        "Error: no Chromium binary found. Expected one of:\n  "
        + "\n  ".join(CHROMIUM_CANDIDATES)
        + "\nDo not run `playwright install` — Chromium should already be "
        "present in this environment.\n"
    )
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", required=True, type=Path, help="Path to the rendered HTML file.")
    parser.add_argument("--output", required=True, type=Path, help="Path to write the PDF.")
    parser.add_argument("--chromium", default=None, help="Override the Chromium binary path.")
    args = parser.parse_args()

    html_path = args.html.resolve()
    output_path = args.output.resolve()

    if not html_path.exists():
        sys.stderr.write(f"Error: HTML file not found: {html_path}\n")
        sys.exit(1)

    chromium = args.chromium or find_chromium()
    file_url = f"file://{html_path}"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        chromium,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-software-rasterizer",
        f"--print-to-pdf={output_path}",
        "--no-pdf-header-footer",
        "--virtual-time-budget=10000",
        file_url,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        sys.stderr.write(f"Error: Chromium exited {result.returncode}\n")
        sys.stderr.write(result.stderr)
        sys.exit(1)

    if not output_path.exists():
        sys.stderr.write("Error: Chromium exited 0 but produced no output file.\n")
        sys.exit(1)

    size = output_path.stat().st_size
    if size < MIN_OUTPUT_BYTES:
        sys.stderr.write(
            f"Error: output PDF is only {size:,} bytes (expected at least "
            f"{MIN_OUTPUT_BYTES:,}). This usually means the page rendered "
            "blank — check that fonts loaded (absolute file:// URL required) "
            "and that the template's print-color-adjust:exact rule is intact.\n"
        )
        sys.exit(1)

    print(f"✓ PDF written: {output_path}")
    print(f"  Size: {size:,} bytes")
    print("  IMPORTANT: visually inspect this PDF before considering the task done —")
    print("  a successful exit code does not confirm the design rendered correctly.")


if __name__ == "__main__":
    main()
