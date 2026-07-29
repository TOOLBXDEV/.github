// icp-scoring-engine.js - v3.4
// Nightly full-book reconciliation + shared scoring logic used by the webhook.
// Run via GitHub Actions (see .github/workflows/icp-scoring.yml).
// Env: HUBSPOT_ACCESS_TOKEN (GitHub secret)

const hubspot = require('@hubspot/api-client');
const config  = require('./icp-scoring-config');

const client     = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
const BATCH_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Gate helpers
// ─────────────────────────────────────────────────────────────────────────────

function isCanada(country) {
  if (!country) return false;
  const c = country.trim().toLowerCase();
  return c === 'canada' || c === 'ca';
}

/** @returns {'Pass'|'Fail'} */
function geoGate(country) {
  if (!country) return 'Fail';
  return config.VALID_COUNTRIES.has(country.trim().toLowerCase()) ? 'Pass' : 'Fail';
}

/**
 * Vertical may be semicolon-separated; passes if ANY value matches.
 * @returns {'Pass'|'Fail'}
 */
function verticalGate(vertical) {
  if (!vertical || vertical.trim() === '') return 'Fail';
  return vertical.split(';').map(v => v.trim()).some(v => config.VALID_VERTICALS.has(v))
    ? 'Pass'
    : 'Fail';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-scorers
// ─────────────────────────────────────────────────────────────────────────────

function scoreRevenue(annualRevenue, country) {
  if (annualRevenue == null || annualRevenue === '') return config.REVENUE_SCORES.unknown;
  const rev = Number(annualRevenue);
  if (isNaN(rev) || rev <= 0) return config.REVENUE_SCORES.unknown;

  const t = isCanada(country)
    ? config.REVENUE_THRESHOLDS.CA
    : config.REVENUE_THRESHOLDS.US;

  if (rev < t.floor)    return config.REVENUE_SCORES.belowFloor;
  if (rev <= t.ceiling) return config.REVENUE_SCORES.inBand;
  return config.REVENUE_SCORES.aboveCeiling;
}

function scoreLocation(locations) {
  if (locations == null || locations === '') return config.LOCATION_SCORES.unknown;
  const loc = Number(locations);
  if (isNaN(loc) || loc <= 0) return config.LOCATION_SCORES.unknown;

  if (loc === 1)  return config.LOCATION_SCORES.single;
  if (loc <= 5)   return config.LOCATION_SCORES.smallChain;
  if (loc <= 50)  return config.LOCATION_SCORES.sweetSpot;
  return config.LOCATION_SCORES.megaCap;
}

/** v3.4: any non-blank value = 100, blank = 0 */
function scoreAssociation(association) {
  if (!association || association.trim() === '') return config.ASSOCIATION_SCORES.nonMember;
  return config.ASSOCIATION_SCORES.member;
}

function scoreERP(erp) {
  if (!erp || erp.trim() === '') return config.ERP_SCORES.unknown;
  return config.COMPATIBLE_ERPS.has(erp.trim())
    ? config.ERP_SCORES.compatible
    : config.ERP_SCORES.nonCompatible;
}

/** @returns {'Compatible'|'Non-Compatible'|'Unknown'} */
function erpClass(erp) {
  if (!erp || erp.trim() === '') return 'Unknown';
  return config.COMPATIBLE_ERPS.has(erp.trim()) ? 'Compatible' : 'Non-Compatible';
}

function computeComposite(revScore, locScore, assocScore, erpScore) {
  return Math.round(
    config.WEIGHTS.revenue     * revScore  +
    config.WEIGHTS.location    * locScore  +
    config.WEIGHTS.association * assocScore +
    config.WEIGHTS.erp         * erpScore,
  );
}

function assignCompositeTier(composite) {
  if (composite >= config.TIER_CUTOFFS.tier1) return 'Tier 1';
  if (composite >= config.TIER_CUTOFFS.tier2) return 'Tier 2';
  if (composite >= config.TIER_CUTOFFS.tier3) return 'Tier 3';
  return 'Disqualify - Composite';
}

// ─────────────────────────────────────────────────────────────────────────────
// Master scorer - returns 10-property dict for a single company
// ─────────────────────────────────────────────────────────────────────────────

function scoreCompany(properties) {
  const now  = new Date().toISOString();
  const geo  = geoGate(properties.country);
  const vert = verticalGate(properties.vertical);

  // Hard gate: Geo
  if (geo === 'Fail') {
    return {
      icp_geo_gate:          'Fail',
      icp_vertical_gate:     vert,
      icp_score_revenue:     '',
      icp_score_locations:   '',
      icp_score_association: '',
      icp_score_erp:         '',
      icp_score_composite:   '',
      icp_erp_class:         erpClass(properties.erp_pos__c),
      icp_tier:              'Disqualify - Geo Gate',
      icp_last_scored_at:    now,
    };
  }

  // Hard gate: Vertical
  if (vert === 'Fail') {
    return {
      icp_geo_gate:          'Pass',
      icp_vertical_gate:     'Fail',
      icp_score_revenue:     '',
      icp_score_locations:   '',
      icp_score_association: '',
      icp_score_erp:         '',
      icp_score_composite:   '',
      icp_erp_class:         erpClass(properties.erp_pos__c),
      icp_tier:              'Disqualify - Vertical Gate',
      icp_last_scored_at:    now,
    };
  }

  // Composite path
  const revScore   = scoreRevenue(properties.annualrevenue, properties.country);
  const locScore   = scoreLocation(properties.of_locations__c);
  const assocScore = scoreAssociation(properties.industry_association);
  const erpScore   = scoreERP(properties.erp_pos__c);
  const composite  = computeComposite(revScore, locScore, assocScore, erpScore);

  return {
    icp_geo_gate:          'Pass',
    icp_vertical_gate:     'Pass',
    icp_score_revenue:     String(revScore),
    icp_score_locations:   String(locScore),
    icp_score_association: String(assocScore),
    icp_score_erp:         String(erpScore),
    icp_score_composite:   String(composite),
    icp_erp_class:         erpClass(properties.erp_pos__c),
    icp_tier:              assignCompositeTier(composite),
    icp_last_scored_at:    now,
  };
}

/**
 * Returns true if any scored output differs from what is already in HubSpot.
 * Skips icp_last_scored_at intentionally (timestamp always differs).
 */
function hasChanged(current, computed) {
  const fields = [
    'icp_score_composite',
    'icp_score_revenue',
    'icp_score_locations',
    'icp_score_association',
    'icp_score_erp',
    'icp_erp_class',
    'icp_tier',
    'icp_geo_gate',
    'icp_vertical_gate',
  ];
  return fields.some(f => String(current[f] ?? '') !== String(computed[f] ?? ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// HubSpot API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function withRetry(fn, label = 'API call') {
  let retries = 0;
  while (retries <= 4) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.code === 429 || err.response?.status === 429;
      if (is429 && retries < 4) {
        retries++;
        const wait = Math.pow(2, retries) * 1000;
        console.log('  Rate limited (' + label + '), retry ' + retries + '/4 in ' + (wait / 1000) + 's...');
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

async function fetchAllCompanies() {
  const companies = [];
  let after = undefined;

  while (true) {
    const response = await withRetry(
      () => client.crm.companies.searchApi.doSearch({
        filterGroups: [],
        properties:   config.HUBSPOT_INPUT_PROPERTIES,
        limit:        BATCH_SIZE,
        after,
        sorts: [{ propertyName: 'hs_object_id', direction: 'ASCENDING' }],
      }),
      'company search',
    );

    companies.push(...response.results);

    if (response.paging?.next?.after) {
      after = response.paging.next.after;
    } else {
      break;
    }
  }

  return companies;
}

async function fetchCompaniesByIds(ids) {
  const inputs = ids.map(id => ({ id }));
  const response = await withRetry(
    () => client.crm.companies.batchApi.read({
      inputs,
      properties: config.HUBSPOT_INPUT_PROPERTIES,
    }),
    'batch read',
  );
  return response.results;
}

async function batchUpdate(updates) {
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch  = updates.slice(i, i + BATCH_SIZE);
    const inputs = batch.map(u => ({ id: u.id, properties: u.properties }));

    await withRetry(
      () => client.crm.companies.batchApi.update({ inputs }),
      'batch update',
    );

    console.log('  Batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ': ' + batch.length + ' companies updated');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main - nightly full-book reconciliation
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== TOOLBX ICP Scoring Engine v3.4 ===');
  console.log('Started: ' + new Date().toISOString() + '\n');

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('ERROR: HUBSPOT_ACCESS_TOKEN not set');
    process.exit(1);
  }

  const startedAt = Date.now();

  console.log('Fetching all companies from HubSpot...');
  const companies = await fetchAllCompanies();
  console.log('Fetched ' + companies.length + ' companies\n');

  const updates = [];
  const tierCounts = {
    'Tier 1':                   0,
    'Tier 2':                   0,
    'Tier 3':                   0,
    'Disqualify - Composite':   0,
    'Disqualify - Geo Gate':    0,
    'Disqualify - Vertical Gate': 0,
  };

  for (const company of companies) {
    const computed = scoreCompany(company.properties);
    tierCounts[computed.icp_tier] = (tierCounts[computed.icp_tier] ?? 0) + 1;

    if (hasChanged(company.properties, computed)) {
      updates.push({ id: company.id, properties: computed });
    }
  }

  console.log('Tier distribution (all companies):');
  for (const [tier, count] of Object.entries(tierCounts)) {
    const pct = ((count / companies.length) * 100).toFixed(1);
    console.log('  ' + tier + ': ' + count + ' (' + pct + '%)');
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\nScoring complete in ' + elapsed + 's. ' + updates.length + ' companies need updating.');

  if (updates.length > 0) {
    console.log('\nPushing updates to HubSpot...');
    await batchUpdate(updates);
    console.log('Done. ' + updates.length + ' companies updated.');
  } else {
    console.log('All companies already up to date.');
  }

  const summary = {
    run_at:    new Date().toISOString(),
    total:     companies.length,
    changed:   updates.length,
    tiers:     tierCounts,
    elapsed_s: Number(elapsed),
  };
  console.log('\n--- RUN SUMMARY (JSON) ---');
  console.log(JSON.stringify(summary, null, 2));
}

module.exports = {
  scoreCompany,
  hasChanged,
  fetchCompaniesByIds,
  batchUpdate,
  geoGate,
  verticalGate,
  scoreRevenue,
  scoreLocation,
  scoreAssociation,
  scoreERP,
  erpClass,
  computeComposite,
  assignCompositeTier,
};

if (require.main === module) {
  main().catch(err => {
    console.error('\nFATAL:', err.message);
    if (err.response?.body) {
      console.error('HubSpot error:', JSON.stringify(err.response.body, null, 2));
    }
    process.exit(1);
  });
}
const hubspot = require('@hubspot/api-client');
const config = require('./icp-scoring-config');

const client = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
const BATCH_SIZE = 100;

function isCanada(country) {
  if (!country) return false;
  const c = country.trim().toLowerCase();
  return c === 'canada' || c === 'ca';
}

function scoreRevenue(annualRevenue, country) {
  if (annualRevenue == null || annualRevenue === '') return config.REVENUE_SCORES.unknown;

  const rev = Number(annualRevenue);
  if (isNaN(rev) || rev <= 0) return config.REVENUE_SCORES.unknown;

  const thresholds = isCanada(country)
    ? config.REVENUE_THRESHOLDS.CA
    : config.REVENUE_THRESHOLDS.US;

  if (rev < thresholds.floor) return config.REVENUE_SCORES.belowFloor;
  if (rev <= thresholds.ceiling) return config.REVENUE_SCORES.inBand;
  return config.REVENUE_SCORES.aboveCeiling;
}

function scoreLocation(locations) {
  if (locations == null || locations === '') return config.LOCATION_SCORES.unknown;

  const loc = Number(locations);
  if (isNaN(loc) || loc <= 0) return config.LOCATION_SCORES.unknown;

  if (loc === 1) return config.LOCATION_SCORES.single;
  if (loc <= 5) return config.LOCATION_SCORES.smallChain;
  if (loc <= 50) return config.LOCATION_SCORES.sweetSpot;
  return config.LOCATION_SCORES.megaCap;
}

function scoreAssociation(association) {
  if (!association || association.trim() === '') return config.ASSOCIATION_SCORES.nonMember;
  return config.NAMED_ASSOCIATIONS.has(association.trim())
    ? config.ASSOCIATION_SCORES.member
    : config.ASSOCIATION_SCORES.nonMember;
}

function scoreERP(erp) {
  if (!erp || erp.trim() === '') return config.ERP_SCORES.unknown;
  return config.COMPATIBLE_ERPS.has(erp.trim())
    ? config.ERP_SCORES.compatible
    : config.ERP_SCORES.nonCompatible;
}

function erpCompatibilityFlag(erp) {
  if (!erp || erp.trim() === '') return 'Unknown';
  return config.COMPATIBLE_ERPS.has(erp.trim()) ? 'Yes' : 'No';
}

function computeComposite(revScore, locScore, assocScore, erpScore) {
  return Math.round(
    (config.WEIGHTS.revenue * revScore) +
    (config.WEIGHTS.location * locScore) +
    (config.WEIGHTS.association * assocScore) +
    (config.WEIGHTS.erp * erpScore)
  );
}

function assignTier(icpScore) {
  if (icpScore >= config.TIER_CUTOFFS.tier1) return 'Tier 1';
  if (icpScore >= config.TIER_CUTOFFS.tier2) return 'Tier 2';
  if (icpScore >= config.TIER_CUTOFFS.tier3) return 'Tier 3';
  return 'Disqualify';
}

function buildNotes(revScore, locScore, assocScore, erpScore, composite, tier, country) {
  const thresholdNote = isCanada(country) ? 'CA thresholds' : 'US thresholds';
  const date = new Date().toISOString().split('T')[0];
  return `Rev:${revScore} Loc:${locScore} Assoc:${assocScore} ERP:${erpScore} = ${composite} (${tier}) | ${thresholdNote} | Scored ${date}`;
}

function scoreCompany(properties) {
  const locations = properties.of_locations__c ?? properties.location_count ?? null;

  const revScore = scoreRevenue(properties.annualrevenue, properties.country);
  const locScore = scoreLocation(locations);
  const assocScore = scoreAssociation(properties.industry_association);
  const erpScore = scoreERP(properties.erp_pos__c);
  const composite = computeComposite(revScore, locScore, assocScore, erpScore);
  const tier = assignTier(composite);
  const isIcp = (tier === 'Tier 1' || tier === 'Tier 2') ? 'true' : 'false';
  const erpCompat = erpCompatibilityFlag(properties.erp_pos__c);
  const notes = buildNotes(revScore, locScore, assocScore, erpScore, composite, tier, properties.country);

  return {
    revenue_score: String(revScore),
    location_score: String(locScore),
    industry_association_score: String(assocScore),
    erp_score: String(erpScore),
    erp_compatible: erpCompat,
    icp_score: String(composite),
    icp_tier: tier,
    is_icp: isIcp,
    icp_score_notes: notes,
  };
}

function hasChanged(current, computed) {
  return String(current.icp_score ?? '') !== computed.icp_score
    || String(current.revenue_score ?? '') !== computed.revenue_score
    || String(current.location_score ?? '') !== computed.location_score
    || String(current.industry_association_score ?? '') !== computed.industry_association_score
    || String(current.erp_score ?? '') !== computed.erp_score
    || String(current.icp_tier ?? '') !== computed.icp_tier;
}

async function fetchAllCompanies() {
  const companies = [];
  let after = undefined;

  while (true) {
    let response;
    let retries = 0;

    while (retries < 4) {
      try {
        response = await client.crm.companies.searchApi.doSearch({
          filterGroups: [],
          properties: config.HUBSPOT_INPUT_PROPERTIES,
          limit: BATCH_SIZE,
          after: after,
          sorts: [{ propertyName: 'hs_object_id', direction: 'ASCENDING' }],
        });
        break;
      } catch (err) {
        if (err.code === 429 || (err.response && err.response.status === 429)) {
          retries++;
          const wait = Math.pow(2, retries) * 1000;
          console.log(`  Rate limited on fetch, retrying in ${wait / 1000}s (attempt ${retries}/4)...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          throw err;
        }
      }
    }

    if (!response) throw new Error('Search API rate limit exceeded after 4 retries');

    companies.push(...response.results);

    if (response.paging?.next?.after) {
      after = response.paging.next.after;
    } else {
      break;
    }
  }

  return companies;
}

async function batchUpdate(updates) {
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    const inputs = batch.map(u => ({
      id: u.id,
      properties: u.properties,
    }));

    let retries = 0;
    while (retries < 4) {
      try {
        await client.crm.companies.batchApi.update({ inputs });
        break;
      } catch (err) {
        if (err.code === 429 || (err.response && err.response.status === 429)) {
          retries++;
          const wait = Math.pow(2, retries) * 1000;
          console.log(`  Rate limited, retrying in ${wait / 1000}s (attempt ${retries}/4)...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          throw err;
        }
      }
    }

    console.log(`  Updated batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} companies)`);
  }
}

async function main() {
  console.log('=== TOOLBX ICP Scoring Engine ===\n');

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('ERROR: HUBSPOT_ACCESS_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('Fetching companies from HubSpot...');
  const companies = await fetchAllCompanies();
  console.log(`Fetched ${companies.length} companies\n`);

  const updates = [];
  const tierCounts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0, 'Disqualify': 0 };
  let changedCount = 0;

  for (const company of companies) {
    const props = company.properties;
    const computed = scoreCompany(props);

    tierCounts[computed.icp_tier]++;

    if (hasChanged(props, computed)) {
      changedCount++;
      updates.push({ id: company.id, properties: computed });
    }
  }

  console.log('Tier distribution (all companies):');
  for (const [tier, count] of Object.entries(tierCounts)) {
    const pct = ((count / companies.length) * 100).toFixed(1);
    console.log(`  ${tier}: ${count} (${pct}%)`);
  }
  console.log();

  if (updates.length === 0) {
    console.log('No score changes detected. All companies are up to date.');
    return;
  }

  console.log(`${changedCount} companies have changed scores. Updating...`);
  await batchUpdate(updates);

  console.log(`\nDone. ${changedCount} companies updated.`);
}

module.exports = { scoreCompany, scoreRevenue, scoreLocation, scoreAssociation, scoreERP, computeComposite, assignTier, hasChanged };

if (require.main === module) {
  main().catch(err => {
    console.error('Scoring engine failed:', err.message);
    if (err.response?.body) {
      console.error('HubSpot API error:', JSON.stringify(err.response.body, null, 2));
    }
    process.exit(1);
  });
}
