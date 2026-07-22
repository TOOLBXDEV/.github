# TOOLBX Sales Hub

Internal Next.js app: **sales heatmap**, **campaign dashboard**, and **static customer map** exports for TOOLBX.

| | |
|---|---|
| **Production** | https://toolbx-sales-hub-teal.vercel.app |
| **Repo** | https://github.com/TOOLBXDEV/toolbx-sales-hub |

## Quick start

```bash
cp .env.example .env.local   # add Redshift + HubSpot secrets
npm install
npm run dev
```

Open http://localhost:3000

## What’s in the app

- **`/`** — Interactive sales heatmap (customers + pipeline from Redshift/HubSpot)
- **`/campaigns`** — HubSpot campaign analytics
- **`/docs`** — In-app data documentation
- **`output/customer-lifecycle-map.png`** — Static PNG export (run script below)

## Common commands

```bash
npm run dev                      # local dev server
npm run build                    # production build check
npm run export-deals-snapshot    # refresh public/deals-snapshot.json
npm run generate-customer-map    # output/customer-lifecycle-map.png
npm run package-handoff          # zip for migration (no secrets)
```

## Documentation

| Doc | Audience |
|-----|----------|
| [**CLAUDE.md**](./CLAUDE.md) | AI assistants (Claude Code) — start here |
| [**docs/HANDOFF.md**](./docs/HANDOFF.md) | Full project handoff, architecture, scripts, troubleshooting |
| [**DEPLOY.md**](./DEPLOY.md) | Vercel deploy & production fixes |
| [**docs/hubspot-company-geography-runbook.md**](./docs/hubspot-company-geography-runbook.md) | HubSpot geo data quality |

## Moving from Cursor to Claude

1. Clone this repo (or use `npm run package-handoff` and unzip).
2. Copy `.env.local` separately — it is **not** in the handoff zip.
3. In Claude Code, open the repo root; **`CLAUDE.md`** is loaded automatically.
4. Read **`docs/HANDOFF.md`** for history, data rules, and ops runbooks.

## Deploy

Push to `main` triggers GitHub Actions deploy if `VERCEL_TOKEN` is set. If production is stale, see **DEPLOY.md** or run `npx vercel deploy --prod`.
