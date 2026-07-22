# Fix empty map on Vercel

## What is wrong

**`https://toolbx-sales-hub-teal.vercel.app` is stuck on an old deployment** (April-era build). Git pushes to `main` do **not** update that URL.

Proof (as of May 2026):

| URL | Expected | Actual |
|-----|----------|--------|
| `/api/deals` | JSON with `"build": "…"` and hundreds of deals | **500** — `properties_primary_industry__c does not exist` |
| `/deals-snapshot.json` | 325 companies JSON | **404** |

Until Vercel runs a **new production deployment**, the live site cannot change.

## Fix (choose one)

### Option A — Redeploy in Vercel (fastest if you have dashboard access)

1. [Vercel Dashboard](https://vercel.com) → project that owns **`toolbx-sales-hub-teal.vercel.app`** (likely named `toolbx-sales-hub` or `toolbx-sales-hub-teal`).
2. **Deployments** → latest from **`main`** → **Redeploy** (enable “Use existing Build Cache” **off**).
3. **Settings → Environment Variables** (Production): `REDSHIFT_HOST`, `REDSHIFT_DB`, `REDSHIFT_USER`, `REDSHIFT_PASSWORD`.
4. After **Ready**, verify:
   - `https://toolbx-sales-hub-teal.vercel.app/api/deals` — no `primary_industry` error; `"deals"` array is large.
   - Map shows **TOTAL > 0**.

### Option B — GitHub Actions auto-deploy (recommended long-term)

1. Create a [Vercel token](https://vercel.com/account/tokens).
2. GitHub → **TOOLBXDEV/toolbx-sales-hub** → **Settings → Secrets → Actions** → **New secret** → `VERCEL_TOKEN`.
3. Push to `main` (or run workflow **Deploy Vercel Production** manually).
4. Confirm the workflow succeeds and repeat step 4 above.

Project IDs used by the workflow (from local `.vercel/project.json`):

- `VERCEL_ORG_ID`: `team_zqiqDqyPUMVKHXu2awGmAseq`
- `VERCEL_PROJECT_ID`: `prj_zVoRPEIJHiKtGdWGkEdwwvNXy0ea`

### Option C — CLI from your machine

```bash
cd toolbx-sales-hub
npx vercel login
npx vercel link   # pick the teal / toolbx-sales-hub project
npx vercel --prod
```

## Local use (works without Vercel)

```bash
npm run export-deals-snapshot   # refresh public/deals-snapshot.json
npm run dev
```

Open http://localhost:3000 — data loads from Redshift via `/api/deals`, with bundled snapshot fallback.

## Refresh cached data

```bash
npm run export-deals-snapshot
git add public/deals-snapshot.json && git commit -m "chore: refresh deals snapshot" && git push
```

Then redeploy Vercel so the new JSON is in the bundle and static file.

## Primary domain note

`toolbx-sales-hub.vercel.app` may point at a **different** Vercel project (legacy Vite app or deployment protection). The heatmap for **this repo** is intended on **`toolbx-sales-hub-teal.vercel.app`** until you move domains in Vercel → Settings → Domains.
