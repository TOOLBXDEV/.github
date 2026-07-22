# TOOLBX Google Ads Account Audit

**Account:** TOOLBX (USD) — Portal 1003143585
**Audit date:** July 13, 2026
**Date range analyzed:** All time (Jul 25, 2022 – Jul 13, 2026)
**Scope:** Read-only review. No changes were made to the account, campaigns, keywords, ads, or billing during this audit.

---

## 1. Billing & Campaign Status

### 1.1 Billing issue (root cause)

The account currently displays a **"New form of payment required"** banner ("Your current payment methods can't be charged"). Root cause: the payment method on file — a **Visa card ending in 2753, expired 10/25** — has lapsed, and **no backup payment method is configured**. This is a simple, low-effort fix (add a current card and, ideally, a backup card), but it is the single blocking issue preventing the account from spending at all, even if campaigns were otherwise ready to run.

### 1.2 Campaign inventory (all 5 campaigns, lifetime)

The default "Enabled, Paused" campaign filter in the UI hides two older campaigns entirely. Switching the filter to **"All"** reveals the full picture:

| Campaign | Status | Budget/day | Bid strategy | Networks | Start | End | Location | Impr. | Clicks | Cost | Conv. rate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ERP Integration & A/R Automation - 2025-Q2 | **Paused** | $25.00 | Maximize clicks | Google Search | Apr 30, 2025 | — | Canada; United States | 23,962 | 383 | $2,759.55 | 0.00% |
| E-Commerce & Customer Portal - 2025-Q2 | **Ended** | $25.00 | Maximize clicks | Google Search | Apr 30, 2025 | Jun 30, 2025 | Canada; United States | 8,826 | 561 | $1,506.82 | 0.89% |
| Modernizing Operations - 2025-Q2 | **Paused** | $15.00 | Maximize clicks | Google Search | May 2, 2025 | — | Canada; United States | 3,199 | 92 | $768.00 | 1.09% |
| [Dealer] - Boston - DB&S - Non-Branded | **Removed** | $95.00 | Maximize clicks | Search + Search partners | Jul 25, 2022 | — | Boston; 22 mi radius | 36,162 | 1,545 | $3,604.03 | 0.00% |
| [Dealer] - Boston - DB&S - Branded | **Removed** | $95.00 | Maximize clicks | Search + Search partners | Aug 19, 2022 | — | Boston; 25 mi radius | 983 | 108 | $268.96 | 1.85% |
| **Total (account, all time)** | | | | | | | | **73,132** | **2,689** | **$8,907.36** | **0.30%** |

**Key findings:**

- **Every campaign in the account's history is currently inactive.** Nothing is Enabled. The account is not spending, not serving ads, and not generating leads right now — independent of the billing problem.
- **All 5 campaigns use "Maximize clicks" bidding**, with no Target CPA, Target ROAS, or Maximize Conversions strategy ever used, despite the account having tracked conversions with assigned dollar values (see §2). This means every dollar spent historically was optimized purely for click volume, not for lead quality or value.
- **A hidden, older campaign structure dwarfs the current one in spend.** The two `[Dealer] - Boston - DB&S` campaigns (2022, geo-targeted to a 22–25 mile radius around Boston, MA, at a much higher $95/day budget, running on Search **and** Search Partners) account for **$3,873.00 — 43% of all-time spend** — yet are invisible in the default campaign view because they're marked "Removed." These look like a co-branded or single-dealer pilot (name pattern suggests a specific Boston-area building supply dealer, "DB&S") using a completely different targeting model (hyper-local, branded lumber delivery messaging) than the current company-wide 2025-Q2 campaigns. Worth confirming with whoever ran this whether it was a one-off test and whether learnings (e.g., its 5.71–11.62% CTRs, notably higher than the current campaigns' 1.6–6.4%) were carried forward.
- **One draft campaign** exists in the account ("Drafts in progress: 1") but was not reviewed in depth as part of this audit — worth checking before rebuilding campaigns from scratch, in case it already contains partially-built work.
- Current campaigns target **Canada + United States** broadly, with no state/province-level refinement — worth revisiting against TOOLBX's actual serviceable/priority markets (see §5).

---

## 2. Conversion Tracking Audit

### 2.1 Conversion actions

Only **one conversion action carries real data**:

| Conversion action | Goal | Optimization | Source | All-time conversions | All-time value | Status |
|---|---|---|---|---|---|---|
| **Demo lead form** | Submit lead form (account-default) | Primary | Website | **6.00** | **$162,000.00** | Awaiting conversions |

- The **$162,000 total value implies a flat ~$27,000 assigned value per lead** (confirmed: one specific ad headline's single conversion is individually logged at exactly $27,000). This is a **static assumed deal value**, not a value pulled from actual HubSpot deal outcomes — every "Demo lead form" submission is credited identically regardless of company size, fit, or whether it ever closes.
- Status shows **"Awaiting conversions"** even though 6 conversions exist historically — this reflects that no *recent* conversions have been recorded (unsurprising, since every campaign is paused/ended; see §1).
- **Enhanced Conversions is active** ("All enhanced conversion actions are active!") — first-party data matching is correctly configured for whatever conversions do fire.

Two other conversion actions exist and are flagged **"Misconfigured,"** but they are not actually a problem worth fixing:

| Conversion action | Goal | Source | Conversions | Status |
|---|---|---|---|---|
| YouTube channel subscriptions | Engagement | YouTube hosted | 0.00 | Misconfigured |
| (YouTube follow-on views goal, same action) | YouTube follow-on views | YouTube hosted | 0.00 | Misconfigured |

These are Google Ads' auto-created default YouTube engagement goals. **TOOLBX runs Search-only campaigns with no video/YouTube ads**, so these are irrelevant defaults, not a tracking gap. They can be safely ignored or removed for account hygiene.

### 2.2 Gaps

- **No custom goals** are configured.
- **Customer lifecycle / audience-based bidding is not usable**: the account needs an audience segment of 100+ active members in at least one network to unlock customer-acquisition and lapsed-customer bid adjustments — none exists today.
- **No dynamic value rules** connecting conversion value to actual deal characteristics (company size, location, product line) — everything is the flat $27K assumption.
- **No visible loop back to HubSpot deal outcomes.** Once a "Demo lead form" conversion fires, there's no evidence the eventual won/lost deal value or ARR is fed back into Google Ads (e.g., via offline conversion import) to replace the flat estimate with reality. See §4 for the closing-the-loop plan.

---

## 3. Search Terms Analysis

### 3.1 Data captured

- **Full export saved to:** `google-ads-search-terms-export.csv` (in this repo)
- The account's Search Terms report lists **3,980 total search-term/ad-group rows** across its lifetime. The report is **sorted by clicks descending**, and confirmed to be a *global* sort (not per-segment): the entire set of **339 search terms with 1+ click** was captured in full — verified against Google's own reported subtotal for this bucket (**794 clicks / $3,823.29**, exact match to the export). The remaining ~3,640 rows are single-impression, zero-click long-tail queries; the export includes a representative sample of ~1,540 of these for completeness, alongside all 339 non-zero rows.
- Note: Google's Search Terms report separately shows a **"Total: Other search terms"** bucket of **885 clicks / $2,744.21** — these are individual queries Google withholds from advertiser view for user-privacy/low-volume reasons and cannot be retrieved at the row level by any means (this is a Google Ads platform limitation, not a gap in this audit).

### 3.2 Top 50 search terms by clicks — relevance categorization

TOOLBX sells B2B e-commerce, customer-portal, and ERP-integration software specifically to **lumber & building materials (LBM) dealers/distributors**. Terms are judged against that specific buyer, not "e-commerce" or "ERP" in general.

**🔴 Clearly irrelevant (wrong product/wrong audience) — already leaking budget:**

| Term | Clicks | Cost | Why it's off-target |
|---|---|---|---|
| indiamart | 49 | $70.36 | Indian B2B marketplace — wrong platform, wrong geography |
| vendors for reselling / vendor reseller / world resellers / best vendors for reselling | 7+5+6+2=20 | $15.91+$17.51+$11.88+$6.10=$51.40 | People looking to become resellers or find reseller networks — TOOLBX is not a marketplace |
| crossborderly | 7 | $10.05 | Cross-border logistics/customs tool, unrelated |
| shopify | 7 | $10.51 | Direct competitor platform search — generic e-commerce shopper, not LBM |
| udaan app | 6 | $8.78 | Indian B2B wholesale app |
| isnetworld | 4 | $23.12 | Contractor safety/compliance database — different product category entirely |
| meesho supplier panel | 4 | $5.81 | Indian social-commerce reseller platform |
| tradewheel | 4 | $9.43 | Generic B2B marketplace directory |
| launch cart | 3 | $5.75 | Unrelated checkout/course-sales SaaS tool |
| aura distribution / boxful / devx commerce / ecomstreet / porcore | 8+2+2+2+9=23 | $12.48+$2.60+$5.40+$4.22+$61.92=$86.62 | Unrelated companies/tools (moving/storage, dev agency, unclear entities) |
| **Subtotal** | **~148 clicks** | **~$309** | **~19% of the top-50's clicks, ~13% of its spend — pure waste** |

**🟡 Generic, not building-materials-specific (broad-match drift, low buyer-intent signal):**
ecommerce usa, ecommerce partners, e commerce, e commerce company in usa, e commerce usa, e commerce company usa, e commerce clients in usa, usa vendor, b2b website in usa, b2b websites in usa, top 10 b2b websites in usa, cross border e commerce, ecomm, ecommerce, ecommerce companies in usa, ecommerce development services in usa, vendor websites, distributors website — roughly **60 clicks / $115** in the top 50. These are almost entirely triggered by two broad-match keywords in ad group **2B: Customer Portal Software** ("ecommerce platform for distributors," "b2b distributor ecommerce"), which Google has expanded into generic small-business e-commerce searches with no LBM signal at all.

**🟢 Relevant (on-topic for the ERP/company/industry context):**

| Term | Clicks | Cost |
|---|---|---|
| erp system | 96 | $635.14 |
| erp | 52 | $326.03 |
| epicor | 42 | $295.92 |
| toolbx us inc *(branded)* | 17 | $109.02 |
| erp system examples | 13 | $82.88 |
| epicor software | 6 | $40.13 |
| what is erp system | 6 | $44.88 |
| building connected *(construction bid-management platform — adjacent audience)* | 5 | $38.98 |
| toolbx *(branded)* | 5 | $2.84 |
| erp systems | 4 | $27.36 |
| what is erp integration | 3 | $20.64 |
| sap erp system examples | 3 | $22.03 |
| what is an erp system | 3 | $18.33 |
| **Subtotal** | **~255 clicks** | **~$1,664 — the bulk of top-50 spend** |

**Takeaway:** the "relevant" bucket is dominated by **single-word, extremely generic ERP terms** ("erp," "erp system," "epicor") on **broad match**. These are the single highest-cost terms in the account and are inherently ambiguous — "erp" and "epicor" are searched by people in every industry, not just LBM. This is simultaneously the account's best-performing traffic (by click volume) and its highest-risk traffic (by targeting precision) — see §5 for match-type recommendations.

### 3.3 Existing negative keyword coverage — gaps found

The account already has **21 negative keywords**, all **exact match**, all applied **only to the E-Commerce & Customer Portal campaign** (none on ERP Integration or Modernizing Operations):

`[all wholesale commerce]` `[arbitrage wholesale]` `[aura distribution]` `[boxful]` `[crossborderly]` `[empire distribution usa]` `[indiamart]` `[isnetworld]` `[meesho supplier panel]` `[resell vendors]` `[reseller vendors]` `[reselling vendors]` `[shopify]` `[shopify dropshipping suppliers]` `[tapcart]` `[udaan app]` `[us suppliers for dropshipping]` `[usa supplier for dropshipping]` `[wholesale dropshipping suppliers usa]` `[wholesale dropshipping usa]` `[world resellers]`

This is a good start — someone has clearly been reacting to bad search terms already. But it has two structural gaps:

1. **Exact match only, so phrasing variants leak straight through it.** e.g., `[reseller vendors]` is negated, but **"vendors for reselling"** and **"vendor reseller"** and **"best vendors for reselling"** (different word order) are *not* — and all three still appear with real clicks/spend in the data.
2. **Only one of three campaigns is covered.** ERP Integration & A/R Automation and Modernizing Operations have zero negative keywords, so if any of these same bad-fit terms trigger there via broad match, nothing blocks them today.

Recommended additions (broad match, applied **account-wide**): `vendors for reselling`, `vendor reseller`, `best vendors for reselling`, `tradewheel`, `launch cart`, `devx commerce`, `ecomstreet`, `porcore`, `samcart`, `sam cart`, plus a broader shared negative list (see §5).

---

## 4. Website Traffic Enrichment Plan — PostHog UTM Integration

**Current state (confirmed directly in PostHog, project "toolbx.com," id 40775):** Google Ads traffic arriving at toolbx.com currently carries **zero UTM parameters and zero `gclid` values** in the event data. There is no way today to answer "what did a Google Ads visitor do on the site" or "which search term/ad led to a signup" — Google Ads and the website analytics stack are completely disconnected.

### 4.1 Why this matters

Right now the only feedback loop the ads account has is its own click/cost/conversion numbers. It cannot see:
- Whether Google Ads visitors bounce immediately or engage deeply with the site
- Which landing pages (go.toolbx.com/lumberyard/customer-portal, /erp-integration/ar-automation, /building-supply/ecommerce, /building-supply/lumberyard) actually convert vs. leak
- Whether a "Demo lead form" submission ever becomes a real HubSpot deal, and for how much — the $27,000 flat value in §2 is a guess, not a measurement

### 4.2 Recommended plan

1. **Turn on auto-tagging in Google Ads** (Settings → Auto-tagging), if not already enabled, so every click carries a `gclid`.
2. **Ensure landing pages preserve UTM/gclid params** through to the first PostHog pageview event. Since all current landing pages sit on the `go.toolbx.com` subdomain, confirm the PostHog snippet there captures `$current_url` with query string intact (default PostHog behavior does this automatically — verify it isn't being stripped by a redirect or cleaned URL rule).
3. **Add explicit event properties** for the lead-form-submission event (the actual HubSpot form tied to "Demo lead form"): `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`. PostHog can auto-capture these as person/event properties if UTM params are present on first touch — this just needs verifying they're not being dropped.
4. **Pass `gclid` into HubSpot** on form submission (as a hidden field synced to the contact/deal record) — this is the critical link that lets a HubSpot deal be traced back to the exact Google Ads click that generated it.
5. **Close the loop back into Google Ads** using **Enhanced Conversions for Leads** or **offline conversion import**: when a HubSpot deal tied to a `gclid` closes (won or lost), upload the real deal value (via `hs_arr`, per this repo's own convention — see the Sales Hub CLAUDE.md) back into the "Demo lead form" conversion action. This replaces the static $27,000 assumption with the actual dollar value TOOLBX gets from that customer.
6. Once real deal-value data flows back for even a few months, this unlocks moving off "Maximize clicks" and onto **Maximize Conversion Value** or **Target ROAS** bidding — which today's flat, ungrounded conversion value makes impossible to trust.

---

## 5. Campaign Rework Strategy

### 5.1 Before anything else

1. **Fix billing** — add a current payment method and a backup card. Nothing below matters until the account can spend again.
2. **Check the 1 existing draft campaign** before building anything new — it may already contain relevant work.
3. **Decide whether to formally retire the two `[Dealer] - Boston - DB&S` campaigns**, or mine their learnings (higher CTR, Search Partners inclusion, hyper-local radius targeting) into the new structure — they're currently just sitting as "Removed" history.

### 5.2 Structural fixes

- **3 of the 7 existing ad groups have keywords but zero ads were ever built**: `1B: A/R & Fraud Prevention`, `1C: Suppli` (competitor-conquesting against a brand called "Suppli"/"GoSuppli"), and `3B: Compete with Big Box`. Either write ad copy for these (they already have well-targeted, building-materials-specific keywords sitting unused — see below) or prune them.
- **Tighten match types on the leakiest ad group** (`2B: Customer Portal Software`) — its broad-match keywords ("ecommerce platform for distributors," "b2b distributor ecommerce," "e commerce for distributors") are the source of nearly all the generic and irrelevant search-term drift identified in §3. Move these to phrase match, or broad match + strong negative coverage.
- **Apply the negative keyword list account-wide**, not just to one campaign (§3.3).
- **Reconsider "Maximize clicks" as the account-wide bid strategy** — pair with §4's plan to get real conversion values flowing, then move to Maximize Conversion Value.
- **Revisit Canada + United States as a blanket location target** — confirm this matches TOOLBX's actual serviceable/priority markets; state or DMA-level targeting may perform better once reactivated, especially in higher-density LBM regions (Southeast, Texas, Pacific Northwest, Northeast).

### 5.3 Building-materials-specific keyword recommendations by ad group

The account already contains well-written, LBM-specific keywords that simply never got the chance to run (paused/ended before generating real volume). These are good and worth keeping/expanding on relaunch:

**1A: ERP Integration Solutions** (keep, tighten match type)
- Phrase/Exact: "lumberyard ERP integration", "ERP software for lumberyards", "ERP integration for building suppliers", "Epicor BisTrack integration", "Spruce ERP integration", "dealer ERP integration software"
- Add: "building materials ERP software", "lumberyard accounting software integration", "BisTrack API integration", "Epicor Eagle integration for lumber"

**1B: A/R & Fraud Prevention** (needs ads — keywords already exist and are good)
- "A/R automation for lumberyards", "secure online payments lumber", "fraud protection for building supply dealers", "automated invoicing for lumberyards", "digital A/R collections for construction" — write RSAs against these now; they're currently dead weight with zero ads.

**1C: Suppli** (competitor conquesting — needs ads)
- "suppli software", "suppli payments", "suppli ar", "gosuppli login" — confirm this competitor-targeting strategy is still wanted, then build ads; currently 100% inert.

**2A: Online Storefront Platform**
- Keep: "e-commerce platform for building supplies", "online storefront for building materials", "B2B e-commerce platform for LBM", "lumberyard e-commerce software", "e-commerce for lumberyards"
- Add: "building materials online ordering system", "lumber yard online catalog software", "B2B storefront for building suppliers"

**2B: Customer Portal Software** (tighten — see §5.2)
- Keep (already good): "B2B customer portal for lumberyards", "self-service portal for building materials", "customer portal for suppliers", "digital portal for building suppliers"
- Move off broad match: "ecommerce platform for distributors", "b2b distributor ecommerce", "distributor b2b ecommerce platform"

**3A: Digital Transformation LBM**
- Keep: "digital transformation for lumberyards", "modernize lumberyard operations", "software for building materials dealers", "streamline lumberyard operations", "LBM digital solutions"

**3B: Compete with Big Box** (needs ads — keywords already exist)
- "lumberyard software vs big box stores", "stay competitive with Home Depot", "compete with Home Depot online", "B2B platform to compete with Lowes", "digital storefront for independent lumberyards" — good competitive-positioning keyword set, currently unused.

### 5.4 Account-wide negative keyword list (recommended, broad match unless noted)

`indiamart` `shopify` `udaan app` `meesho supplier` `meesho` `isnetworld` `tradewheel` `launch cart` `samcart` `sam cart` `boxful` `devx commerce` `ecomstreet` `porcore` `vendor reseller` `vendors for reselling` `best vendors for reselling` `reseller vendors` `resell vendors` `world resellers` `dropshipping` `wholesale dropshipping` `arbitrage` `kibo` `jtvendors`

---

## Appendix: Ad copy inventory (current live/paused campaigns only)

Full headline/description sets were pulled for the 4 ad groups that have live ads. The other 3 ad groups (1B, 1C, 3B) have no ads at all — see §5.2.

**2A: Online Storefront Platform** — landing page `go.toolbx.com/building-supply/ecommerce`
Headlines: Launch Your E-Commerce Store · Sell Lumber Online with TOOLBX · Launch in Weeks, Not Months · Build an Online Store Today · Create Your Online Store Now · TOOLBX: E-Commerce for LBM · TOOLBX: E-Commerce for Dealers · E-Commerce Platform for LBM · Online Store for LBM Dealers · Create a Storefront for Pros · E-Commerce Made Easy for LBM · Sell Online with TOOLBX · Building Supply E-Commerce · Drive Revenue 24/7 for LBM · Unlock Building Supply Growth
Descriptions: "Create a professional online store for your lumberyard with TOOLBX's e-commerce platform." · "Expand your business online with TOOLBX's customizable and secure e-commerce solutions." · "Easily sell building supplies online and offer contractors a seamless shopping experience." · "Build your online storefront in minutes with TOOLBX, designed for building supply dealers."

**2B: Customer Portal Software** — landing page `go.toolbx.com/lumberyard/customer-portal`
Headlines: Create a Customer Portal Today · Self-Service Portal for Pros · Self-Serve Customer Portal · Pro Customer Portal for LBM · Payment Portal for LBM Dealers · Empower Contractors Online · TOOLBX: Contractor Portal · Easy Access for Contractors · Easy Payments for Contractors · Contractors Pay Bills Online · TOOLBX: Streamline Billing · ERP-Integrated Customer Portal · Simplify Billing for Pros · Accept Payments Online · Contractor Self-Service Portal
Descriptions: "Give contractors access to orders, invoices, and payments with TOOLBX's portal." · "TOOLBX's portal integrates with your ERP to give contractors real-time access to data." · "Let contractors track orders, pay bills, and view statements with TOOLBX's portal." · "TOOLBX's contractor portal makes managing orders and payments quick and easy."

**1A: ERP Integration Solutions** — landing page `go.toolbx.com/erp-integration/ar-automation`
Headlines: Integrate ERP with TOOLBX · Simplify ERP Integration · Connect Your ERP & A/R · Streamline A/R with TOOLBX · LBM ERP Integration · Building Supply A/R Automation · Simplify A/R Payments · Stop Chasing Payments
Descriptions: "Connect your ERP with TOOLBX for seamless integration and better A/R automation" · "Integrate your ERP and automate A/R for faster payments and reduced fraud risk." · "Say goodbye to manual ERP processes. Use TOOLBX to streamline your operations." · "Automate payments and improve efficiency by integrating ERP with TOOLBX's solution."

**3A: Digital Transformation LBM** — landing page `go.toolbx.com/building-supply/lumberyard`
Headlines: Modernize Your Operations Now · Upgrade Your Lumberyard Today · Digital Tools for LBM Dealers · TOOLBX for Lumberyard Growth · Stay Competitive with TOOLBX · Digitalize Your Lumberyard · LBM Digital Tools for Growth · Outcompete Big-Box Stores · For Independent LBM Dealers · Digital Platform for LBM · Building Supply Platform · Modernize Your Lumberyard · Compete With Big-Box Stores
Descriptions: "Digitally transform your lumberyard with TOOLBX's solutions designed for LBM dealers." · "Modernize your operations and stay competitive with TOOLBX's LBM digital solutions." · "TOOLBX helps independent dealers adopt the latest tech solutions to improve efficiency." · "Improve your business with TOOLBX's comprehensive suite of digital tools for LBM dealers."

## Appendix: Keywords with all-time spend (top, all currently "Not eligible" due to paused/ended campaigns)

| Keyword | Match | Ad group | Status detail | Impr. | Clicks | Cost | Conversions |
|---|---|---|---|---|---|---|---|
| building materials ERP integration | Broad | 1A | Campaign is paused | 17,798 | 298 | $1,962.04 | 0 |
| ecommerce platform for distributors | Broad | 2B | Campaign has ended | 2,101 | 133 | $294.79 | 0 |
| b2b distributor ecommerce | Broad | 2B | Campaign has ended | 1,401 | 91 | $208.02 | 1 |
| construction supply digital transformation | Broad | 3A | Campaign is paused, Low search volume | 3,071 | 88 | $738.11 | 1 |
| e commerce for distributors | Broad | 2B | Campaign has ended | 1,390 | 87 | $195.84 | 1 |
| "distributor ecommerce" | Phrase | 2A | Campaign has ended | 1,179 | 80 | $195.42 | 0 |
| distributor b2b ecommerce platform | Broad | 2B | Campaign has ended | 1,299 | 78 | $121.49 | 2 |
| epicor ar automation | Broad | 1A | Campaign is paused | 5,130 | 65 | $448.84 | 0 |

Quality Score is blank ("—") for all 89 keywords in the account — Google does not calculate/display Quality Score while a keyword's campaign is paused or ended, so this metric cannot be assessed until campaigns are reactivated.
