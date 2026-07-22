#!/usr/bin/env bash
# Creates a clean handoff archive (no secrets, no node_modules, no .next).
# Usage: npm run package-handoff
# Output: ../toolbx-sales-hub-handoff-YYYYMMDD.zip

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATE_STAMP="$(date +%Y%m%d)"
OUT_NAME="toolbx-sales-hub-handoff-${DATE_STAMP}"
OUT_DIR="$(dirname "$ROOT")/${OUT_NAME}"
ZIP_PATH="$(dirname "$ROOT")/${OUT_NAME}.zip"

echo "Packaging TOOLBX Sales Hub handoff..."
echo "  Source: $ROOT"
echo "  Output: $ZIP_PATH"

rm -rf "$OUT_DIR" "$ZIP_PATH"
mkdir -p "$OUT_DIR"

rsync -a \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.vercel' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.*.local' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude 'output/_customer-map-render.html' \
  "$ROOT/" "$OUT_DIR/"

# Include generated PNG if present (useful for decks)
if [[ -f "$ROOT/output/customer-lifecycle-map.png" ]]; then
  mkdir -p "$OUT_DIR/output"
  cp "$ROOT/output/customer-lifecycle-map.png" "$OUT_DIR/output/"
fi

# Reminder file inside archive
cat > "$OUT_DIR/HANDOFF-SECRETS.txt" <<'EOF'
SECRETS NOT INCLUDED IN THIS ARCHIVE
====================================

Copy separately before running the app:

1. Create .env.local from .env.example with:
   - REDSHIFT_HOST, REDSHIFT_PORT, REDSHIFT_DB, REDSHIFT_USER, REDSHIFT_PASSWORD
   - HUBSPOT_ACCESS_TOKEN
   - CRON_SECRET (optional)
   - NEXT_PUBLIC_HUBSPOT_PORTAL_ID (optional, default 49044619)

2. Vercel Production environment variables (same Redshift keys).

3. GitHub Actions secret VERCEL_TOKEN for auto-deploy.

Start here: CLAUDE.md and docs/HANDOFF.md
EOF

cd "$(dirname "$OUT_DIR")"
zip -r -q "$ZIP_PATH" "$(basename "$OUT_DIR")"
rm -rf "$OUT_DIR"

echo ""
echo "Done: $ZIP_PATH"
echo "Size: $(du -h "$ZIP_PATH" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Copy .env.local separately (never into the zip)"
echo "  2. Unzip on target machine → npm install → npm run dev"
echo "  3. Open CLAUDE.md for AI assistant context"
