# Start here — Claude handoff

You are maintaining the **TOOLBX Sales Hub** (this repo). Read in this order:

1. **[CLAUDE.md](../CLAUDE.md)** — how to work in this codebase (architecture, env, commands)
2. **[HANDOFF.md](./HANDOFF.md)** — full history, data rules, deploy, troubleshooting
3. **[DEPLOY.md](../DEPLOY.md)** — Vercel production issues

## 60-second setup

```bash
cp .env.example .env.local   # paste Redshift + HubSpot + GSC secrets
npm install
npm run dev                  # http://localhost:3000
```

## What this project includes

**Sales heatmap core:**

- `/` — interactive map (`app/components/SalesMap.tsx`, `app/api/deals/route.ts`)
- `/campaigns` — Events Follow-Up Dashboard (HubSpot GTM Campaign analytics)
- `/website-traffic` — Apollo visitor intelligence + Google Search Console keywords
- `/docs` — in-app documentation
- Static customer map PNG script (`npm run generate-customer-map`)

**Data files:**

- `data/branch-locations.json`, `data/company-locations.json` — geo overrides
- `data/visitor-companies.json`, `data/visitor-people.json` — Apollo visitor data
- `data/page-intelligence.json` — keyword/page intelligence mapping
- `data/gsc-history.json` — monthly GSC keyword snapshots
- `public/deals-snapshot.json` — offline fallback for heatmap

## Secrets (copy separately)

Never commit or zip these:

- `.env.local` — Redshift + `HUBSPOT_ACCESS_TOKEN` + `GSC_SERVICE_ACCOUNT_KEY`
- Vercel Production env vars (same keys)
- GitHub `VERCEL_TOKEN` for Actions deploy

## Production

https://toolbx-sales-hub-teal.vercel.app

If the map is empty after a push, redeploy — see DEPLOY.md.
