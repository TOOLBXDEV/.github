import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — TOOLBX Sales Heatmap",
  description: "Data sources, logic, and filters behind the TOOLBX Sales Heatmap",
};

const T = {
  white: "#FFFFFF",
  slateBlack: "#1C1C1E",
  darkSlate: "#2D2D30",
  darkGrey: "#494949",
  silverGrey: "#CCCCCC",
  seaweed: "#457F86",
  sunriseYellow: "#FFCA05",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2
        className="text-lg font-bold mb-3 pb-1"
        style={{ color: T.sunriseYellow, borderBottom: `1px solid ${T.darkGrey}40` }}
      >
        {title}
      </h2>
      <div className="text-[13px] leading-relaxed space-y-3" style={{ color: T.silverGrey }}>
        {children}
      </div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold shrink-0" style={{ color: T.seaweed, minWidth: 180 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen" style={{ background: T.slateBlack, color: T.silverGrey }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <a
          href="/"
          className="text-[12px] inline-block mb-6 hover:underline"
          style={{ color: T.seaweed }}
        >
          &larr; Back to Heatmap
        </a>
        <h1 className="text-2xl font-bold mb-1" style={{ color: T.white }}>
          TOOLBX Sales Heatmap — Documentation
        </h1>
        <p className="text-[12px] mb-8" style={{ color: T.darkGrey }}>
          Last updated: April 2026
        </p>

        <Section title="Overview">
          <p>
            The TOOLBX Sales Heatmap is an interactive map that visualizes the
            sales pipeline — both existing customers and active prospects — on a
            geographic map. Data is pulled live from HubSpot via a Redshift data
            warehouse and refreshed on every page load.
          </p>
        </Section>

        <Section title="Data Source">
          <KV label="Primary database">Amazon Redshift (analytics cluster)</KV>
          <KV label="Core tables">
            <span className="font-mono text-[12px]">hubspot_deals</span>,{" "}
            <span className="font-mono text-[12px]">hubspot_companies</span>,{" "}
            <span className="font-mono text-[12px]">hubspot_owners</span>
          </KV>
          <KV label="Sync frequency">HubSpot → Redshift sync managed by the data pipeline; map refreshes on each page load</KV>
          <KV label="Static data files">
            <span className="font-mono text-[12px]">branch-locations.json</span> (geocoded branch coordinates),{" "}
            <span className="font-mono text-[12px]">company-locations.json</span> (geocoded HQ coordinates)
          </KV>
        </Section>

        <Section title="Which Deals Are Included">
          <p>The query fetches deals matching <strong>either</strong> of these conditions:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Closed-won deals</strong> from any pipeline (Sales, Renewal, etc.) — these define Customers</li>
            <li><strong>Open deals</strong> from the Sales Pipeline only (<span className="font-mono text-[12px]">pipeline = &apos;default&apos;</span>) — these are active Prospects</li>
          </ul>
          <p>
            Deals are then <strong>aggregated at the company level</strong> — each
            company appears as a single data point on the map, regardless of how
            many deals it has.
          </p>
          <p className="mt-3">
            In addition, the API loads <strong>company-only</strong> rows from{" "}
            <span className="font-mono text-[12px]">hubspot_companies</span> when there is{" "}
            <strong>no</strong> deal matching the rules above on that company (via primary company association),
            and the company&apos;s lifecycle stage is in the prospect funnel (lead, MQL, SQL, opportunity, etc.),
            empty/unknown, or certain custom numeric stages — excluding <span className="font-mono text-[12px]">customer</span> and churned.
            Those records appear on the map as &quot;Company record&quot; with a link to HubSpot; they are deduped by name against deal-backed companies.
          </p>
        </Section>

        <Section title="Lifecycle Stage Logic">
          <p>Each company&apos;s stage is determined by the following logic:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>If a company has <strong>any closed-won deal</strong>, it is always classified as <strong>&quot;Customer&quot;</strong>, regardless of the HubSpot lifecycle stage field</li>
            <li>Otherwise, the stage is read from HubSpot&apos;s <span className="font-mono text-[12px]">properties_lifecyclestage</span> and mapped to a display name</li>
          </ul>
          <p className="mt-2">HubSpot lifecycle stage mapping:</p>
          <div
            className="rounded-md p-3 mt-1 text-[12px] font-mono space-y-0.5"
            style={{ background: `${T.darkSlate}80`, border: `1px solid ${T.darkGrey}30` }}
          >
            <div>customer → Customer</div>
            <div>opportunity → Opportunity</div>
            <div>lead → Lead</div>
            <div>marketingqualifiedlead → Marketing Qualified Lead</div>
            <div>salesqualifiedlead → Sales Qualified Lead</div>
            <div>subscriber → Subscriber</div>
            <div>evangelist → Evangelist</div>
            <div>other → Other</div>
            <div>1020959500 → Churned</div>
            <div>1050035316 → In Flight</div>
            <div>1050035315 → Awaiting Kick Off Call</div>
            <div>(null / empty) → Unknown</div>
          </div>
          <p className="mt-2">
            <strong>&quot;Other&quot;</strong> companies are those set to <span className="font-mono text-[12px]">other</span> in HubSpot.
            Many of these are industry partners (buying groups, associations, ERPs) rather than traditional customers.{" "}
            <strong>&quot;Unknown&quot;</strong> companies have a null or empty lifecycle stage, often due to orphaned deals with no matching company record.
          </p>
        </Section>

        <Section title="Company Aggregation">
          <p>
            Multiple deals for the same company are merged into a single record:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Products</strong> — union of all products across deals</li>
            <li><strong>ERP</strong> — union of all ERP values</li>
            <li><strong>Cumulative Deal Value</strong> — sum of all deal amounts</li>
            <li><strong>Deal Breakdown</strong> — individual deal amounts by product, shown in the popup</li>
            <li><strong>Earliest Created Date</strong> — oldest <span className="font-mono text-[12px]">createdat</span> across deals</li>
            <li><strong>Earliest Won Date</strong> — oldest <span className="font-mono text-[12px]">hs_closed_won_date</span> across deals</li>
            <li><strong>Last Updated</strong> — most recent <span className="font-mono text-[12px]">updatedat</span> across deals (used for result sort order)</li>
          </ul>
        </Section>

        <Section title="Pipeline Stat">
          <p>
            The &quot;Pipeline&quot; figure in the stats bar shows the total dollar value of
            <strong> open (not yet closed) deals from the Sales Pipeline only</strong>.
            This excludes all closed-won amounts and all deals from non-Sales pipelines (e.g., Renewals).
            It represents the active opportunity value being worked.
          </p>
        </Section>

        <Section title="Map Pin Placement">
          <p>Pin location is resolved in this priority order:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li><strong>Branch-level pins</strong> — for multi-branch companies, each branch gets its own pin using geocoded coordinates from <span className="font-mono text-[12px]">branch-locations.json</span> (sourced from TOOLBX platform&apos;s <span className="font-mono text-[12px]">bi_branch</span> table, geocoded via Nominatim)</li>
            <li><strong>Address-geocoded HQ</strong> — for single-location companies, the address from HubSpot&apos;s <span className="font-mono text-[12px]">properties_address</span> field is geocoded and stored in <span className="font-mono text-[12px]">company-locations.json</span></li>
            <li><strong>HubSpot auto-enriched lat/lng</strong> — fallback to <span className="font-mono text-[12px]">properties_hs_latitude</span> / <span className="font-mono text-[12px]">properties_hs_longitude</span> when no geocoded result is available</li>
          </ol>
          <p className="mt-2">
            <strong>Note:</strong> HubSpot&apos;s auto-enriched coordinates are derived from domain/company intelligence
            and may not match the manually entered address. The geocoded coordinates (options 1 and 2) are preferred for accuracy.
          </p>
        </Section>

        <Section title="Data Normalization">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>State/Province</strong> — two-letter abbreviations (e.g., FL, ON) are expanded to full names. Known typos (e.g., &quot;Road Island&quot;) are corrected.</li>
            <li><strong>Buying Group</strong> — resolved from the company&apos;s <span className="font-mono text-[12px]">properties_buying_group</span> Salesforce Account ID by joining back to <span className="font-mono text-[12px]">hubspot_companies</span>. A hardcoded fallback maps the Home Hardware SFID.</li>
            <li><strong>Industry</strong> — underscores replaced with spaces, title-cased. Falls back to <span className="font-mono text-[12px]">primary_industry__c</span> if the standard field is empty.</li>
          </ul>
        </Section>

        <Section title="Filters">
          <p className="font-semibold" style={{ color: T.seaweed }}>Lifecycle Stage (toggle buttons)</p>
          <p>Toggle one or more stages to show/hide companies. Default view: Customer + Opportunity.</p>

          <p className="font-semibold mt-3" style={{ color: T.seaweed }}>Company Profile</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Employees</strong> — range buckets (1-10, 11-50, … 1000+). <em>Currently disabled.</em></li>
            <li><strong>Revenue</strong> — annual revenue range buckets. <em>Currently disabled.</em></li>
            <li><strong>Industries</strong> — from HubSpot company industry field</li>
            <li><strong>Products</strong> — TOOLBX product names (eCommerce, Payment Portal, etc.)</li>
            <li><strong>ERP Systems</strong> — from deal ERP/POS field</li>
            <li><strong>Countries</strong> — from HubSpot company country</li>
            <li><strong>Buying Groups</strong> — resolved buying group name</li>
            <li><strong>Territories</strong> — from HubSpot company territory field</li>
            <li><strong>ARR</strong> — Annual Recurring Revenue from HubSpot <span className="font-mono text-[12px]">properties_arr</span>, bucketed into ranges</li>
            <li><strong># of Locations</strong> — from HubSpot <span className="font-mono text-[12px]">properties_of_locations__c</span>, bucketed (1, 2-5, 6-10, … 50+)</li>
          </ul>

          <p className="font-semibold mt-3" style={{ color: T.seaweed }}>Location &amp; Deal</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>States/Provinces</strong> — normalized state/province names</li>
            <li><strong>Owners</strong> — HubSpot deal owner</li>
            <li><strong>Deal Sizes</strong> — filters by any individual closed-won deal amount for a company</li>
            <li><strong>Cumulative Deal Value</strong> — filters by the sum of all deal amounts for a company</li>
            <li><strong>Won Since</strong> — filters companies by earliest won date within a time window (Last 3, 6, 12, or 24 months)</li>
            <li><strong>Created Since</strong> — filters companies by earliest created date within a time window (Last 3, 6, 12, or 24 months)</li>
          </ul>

          <p className="mt-2">All dropdown filters support type-ahead search.</p>
        </Section>

        <Section title="Heatmap View">
          <p>
            Toggle between the default <strong>pin/cluster view</strong> and a <strong>heat density overlay</strong>
            using the &quot;Heatmap&quot; / &quot;Pins&quot; button in the top-right corner of the map.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>The heat layer shows geographic concentration of companies in the current filtered view</li>
            <li>Colors gradient from teal (low density) through yellow to red (high density)</li>
            <li>All active filters and lifecycle stage toggles apply to the heat layer</li>
            <li>Click &quot;Pins&quot; to return to the standard marker/cluster view</li>
          </ul>
        </Section>

        <Section title="Territory Visualization">
          <p>
            Toggle the &quot;Territories&quot; button in the top-right corner to overlay TOOLBX sales territories on the map.
            US states are grouped into four territories matching HubSpot&apos;s <span className="font-mono text-[12px]">properties_territory</span> field:
          </p>
          <div
            className="rounded-md p-3 mt-1 text-[12px] font-mono space-y-0.5"
            style={{ background: `${T.darkSlate}80`, border: `1px solid ${T.darkGrey}30` }}
          >
            <div><span style={{ color: "#457F86" }}>■</span> East Coast — ME, NH, VT, MA, RI, CT, NY, NJ, PA, DE, MD, VA, WV, NC, SC, GA, FL, DC</div>
            <div><span style={{ color: "#93C1C8" }}>■</span> West Coast — WA, OR, CA, NV, AZ, HI, AK, ID, MT, WY, UT</div>
            <div><span style={{ color: "#FFCA05" }}>■</span> NE/Midwest — OH, MI, IN, IL, WI, MN, IA, MO, ND, SD, NE, KS</div>
            <div><span style={{ color: "#EFB600" }}>■</span> Central — TX, OK, AR, LA, MS, AL, TN, KY, CO, NM</div>
          </div>
          <p className="mt-2">
            Territory colors appear in the legend when the overlay is active. Hover over any state to see its territory name.
          </p>
        </Section>

        <Section title="Nearby Prospects">
          <p>
            When you click any marker to open its popup, a <strong>&quot;Nearby Companies&quot;</strong> section automatically appears
            at the bottom listing up to 5 companies within 80 km. Each entry shows the company name, lifecycle stage,
            and distance — useful for identifying cross-sell opportunities and territory density at a glance.
          </p>
        </Section>

        <Section title="Shareable URLs">
          <p>
            All filter state — lifecycle stage toggles, search text, dropdown selections, and time range filters — is
            automatically encoded in the URL as query parameters. This means:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Use the <strong>&quot;Copy Link&quot;</strong> button to copy the current filtered view URL to your clipboard</li>
            <li>Share the URL with a colleague — they&apos;ll see the exact same filtered view</li>
            <li>Bookmark frequently used filter combinations for quick access</li>
            <li>The URL updates in real-time as you change filters (no page reload needed)</li>
          </ul>
        </Section>

        <Section title="Scheduled Re-Geocoding">
          <p>
            A Vercel Cron job runs every Monday at 6:00 AM UTC, calling <span className="font-mono text-[12px]">/api/cron/geocode</span>.
            This endpoint:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Queries Redshift for all pipeline companies with addresses</li>
            <li>Compares against the existing <span className="font-mono text-[12px]">company-locations.json</span> to identify newly added companies</li>
            <li>Geocodes up to 30 new companies per run via Nominatim (with rate limiting and city/state fallback)</li>
            <li>Returns a report with counts and action items if more companies need geocoding</li>
          </ul>
          <p className="mt-2">
            For larger batches of new companies, run <span className="font-mono text-[12px]">scripts/geocode-companies.mjs</span> locally
            and commit the updated <span className="font-mono text-[12px]">company-locations.json</span>.
          </p>
        </Section>

        <Section title="Mobile Responsiveness">
          <p>
            On screens 768px and narrower (phones and small tablets), the filter panel collapses into a full-screen overlay:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>A hamburger menu icon appears in the top-left to open the panel</li>
            <li>The panel displays full-screen with a close button (&times;)</li>
            <li>Clicking a result in the list auto-closes the panel and flies to that location on the map</li>
            <li>The legend repositions to the bottom-left on mobile</li>
            <li>Map overlay buttons (Heatmap, Territories) remain accessible in the top-right</li>
          </ul>
        </Section>

        <Section title="Known Data Quality Issues">
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong>Renewal deal amounts included in cumulative values</strong> — closed-won deals from
              all pipelines (including Renewals) contribute to a company&apos;s cumulative deal value and deal breakdown.
              This can inflate the per-company total. The &quot;Pipeline&quot; stat is not affected (it only counts open Sales Pipeline deals).
            </li>
            <li>
              <strong>Companies with &quot;Other&quot; or &quot;Unknown&quot; stage</strong> — a small number of records
              have a lifecycle stage of &quot;Other&quot; (often industry partners) or &quot;Unknown&quot; (null/empty,
              often orphaned deals). These should be cleaned up in HubSpot.
            </li>
            <li>
              <strong>Branch geocoding gaps</strong> — approximately 20% of branch names could not be geocoded
              via Nominatim. These branches fall back to the company HQ pin. Using Google Places API with the
              stored <span className="font-mono text-[12px]">google_places_id</span> would improve coverage.
            </li>
            <li>
              <strong>Static geocoded data</strong> — branch and company HQ coordinates are stored in static
              JSON files. A weekly Vercel Cron job checks for new companies and geocodes up to 30 per run.
              For larger batches, run the geocoding scripts locally and commit the updated JSON files.
            </li>
          </ul>
        </Section>

        <Section title="HubSpot company geography (auto-created companies)">
          <p>
            When HubSpot&apos;s <strong>Create and associate companies with contacts</strong> setting creates a
            company from a contact&apos;s email domain, it typically fills <span className="font-mono text-[12px]">domain</span>{" "}
            / <span className="font-mono text-[12px]">website</span> but not street, city, state, postal code, or country unless
            another source provides them. That affects map accuracy: HQ pins prefer geocoded addresses from Redshift (
            <span className="font-mono text-[12px]">hubspot_companies</span>) via <span className="font-mono text-[12px]">company-locations.json</span>.
          </p>
          <p className="mt-2">
            <strong>Team guidance:</strong> keep auto company creation unless product needs to turn it off; mitigate with
            HubSpot workflows (e.g. task when country is unknown but domain is set), enrichment, and integration field mapping.
            A full runbook with API verification, bulk-list steps, and workflow patterns is in the repo at{" "}
            <span className="font-mono text-[12px]">docs/hubspot-company-geography-runbook.md</span>.
          </p>
        </Section>

        <Section title="Architecture">
          <div
            className="rounded-md p-3 text-[12px] font-mono space-y-0.5"
            style={{ background: `${T.darkSlate}80`, border: `1px solid ${T.darkGrey}30` }}
          >
            <div>Framework: Next.js 16 (App Router) on Vercel</div>
            <div>Map: Leaflet.js + leaflet.markercluster + leaflet.heat</div>
            <div>API: /api/deals → Redshift SQL → JSON</div>
            <div>Cron: /api/cron/geocode → weekly incremental geocoding (Vercel Cron)</div>
            <div>Styling: Tailwind CSS + CartoDB dark/light tiles</div>
            <div>Geocoding: Nominatim (OpenStreetMap), batch scripts + weekly cron</div>
            <div>Territory GeoJSON: US states fetched from CDN at runtime</div>
            <div>Export: xlsx (client-side Excel generation)</div>
          </div>
        </Section>

        <Section title="Changelog">
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-[12px]" style={{ color: T.white }}>April 2026</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2 text-[12px]">
                <li>Added internal runbook for HubSpot auto-created companies missing geography (see docs folder)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[12px]" style={{ color: T.white }}>March 2026</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2 text-[12px]">
                <li>Added heat density layer toggle (switch between pins and heatmap)</li>
                <li>Added territory visualization overlay with color-coded US state boundaries</li>
                <li>Added time-based filters: Won Since and Created Since (3, 6, 12, 24 months)</li>
                <li>Added shareable URLs — all filter state encoded in query parameters with Copy Link button</li>
                <li>Added nearby prospects in popups — shows up to 5 companies within 80 km</li>
                <li>Added mobile responsiveness — collapsible panel, hamburger menu, adapted layout</li>
                <li>Added weekly Vercel Cron for incremental geocoding of new companies</li>
                <li>Added Excel export for filtered results</li>
                <li>Added churned customer handling — Churned stage preserved even with closed-won deals</li>
                <li>Added dynamic cluster colors based on dominant stage</li>
                <li>Added ARR and # of Locations filters</li>
                <li>Changed Pipeline stat to reflect open Sales Pipeline value only</li>
                <li>Added branch-level pins for multi-location companies</li>
                <li>Geocoded company addresses for accurate pin placement</li>
                <li>Added Buying Group and Territory filters</li>
                <li>Segmented by HubSpot lifecycle stage (replaced status/stage)</li>
                <li>Company-level deduplication with deal breakdown</li>
                <li>State/province normalization</li>
                <li>Default view: Customer + Opportunity</li>
                <li>Results sorted by most recently updated in HubSpot</li>
                <li>TOOLBX brand color scheme with dark map styling</li>
                <li>Added documentation page</li>
              </ul>
            </div>
          </div>
        </Section>

        <p className="text-[11px] mt-12 pt-4" style={{ color: T.darkGrey, borderTop: `1px solid ${T.darkGrey}30` }}>
          TOOLBX Sales Heatmap &middot; Internal Tool &middot; Questions? Reach out to the data team.
        </p>
      </div>
    </div>
  );
}
