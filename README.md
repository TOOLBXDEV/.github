# TOOLBX Sales Hub

Internal Next.js app: **sales heatmap**, **campaign dashboard**, **website traffic analytics**, and **static customer map** exports for TOOLBX.

| | |
|---|---|
| **Production** | https://toolbx-sales-hub-teal.vercel.app |
| **Repo** | https://github.com/TOOLBXDEV/toolbx-sales-hub |

## Quick start

```bash
cp .env.example .env.local   # add Redshift + HubSpot + GSC secrets
npm install
npm run dev
```

Open http://localhost:3000

## What's in the app

- **`/`** — Interactive sales heatmap (customers + pipeline from Redshift/HubSpot)
- **`/campaigns`** — Events Follow-Up Dashboard (HubSpot GTM Campaign analytics)
- **`/website-traffic`** — Apollo visitor intelligence + Google Search Console keywords
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

1. `git clone https://github.com/TOOLBXDEV/toolbx-sales-hub.git` (recommended)
   or run **`npm run package-handoff`** for a zip archive.
2. Copy **`.env.local`** separately — secrets are never in git or the zip.
3. Claude Code reads **`CLAUDE.md`** automatically for project context.
4. See **`docs/HANDOFF.md`** for full architecture, data rules, and ops runbooks.

## Deploy

Push to `main` triggers GitHub Actions deploy if `VERCEL_TOKEN` is set. If production is stale, see **DEPLOY.md** or run `npx vercel deploy --prod`.
