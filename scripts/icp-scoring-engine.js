// icp-scoring-engine.js - v3.4
// Nightly full-book reconciliation + shared scoring logic used by the webhook.
// Run via GitHub Actions (see .github/workflows/icp-scoring.yml).
// Env: HUBSPOT_ACCESS_TOKEN (GitHub secret)

const hubspot = require('@hubspot/api-client');
const config  = require('./icp-scoring-config');

const client     = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
const BATCH_SIZE = 100;

// Gate helpers

function isCanada(country) {
  if (!country) return false;
  const c = country.trim().toLowerCase();
  return c === 'canada' || c === 'ca';
}

function geoGate(country) {
  if (!country) return 'Fail';
  return config.VALID_COUNTRIES.has(country.trim().toLowerCase()) ? 'Pass' : 'Fail';
}

function verticalGate(vertical) {
  if (!vertical || vertical.trim() === '') return 'Fail';
  return vertical.split(';').map(v => v.trim()).some(v => config.VALID_VERTICALS.has(v))
    ? 'Pass' : 'Fail';
}

// Sub-scorers

function scoreRevenue(annualRevenue, country) {
  if (annualRevenue == null || annualRevenue === '') return config.REVENUE_SCORES.unknown;
  const rev = Number(annualRevenue);
  if (isNaN(rev) || rev <= 0) return config.REVENUE_SCORES.unknown;
  const t = isCanada(country) ? config.REVENUE_THRESHOLDS.CA : config.REVENUE_THRESHOLDS.US;
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

function scoreAssociation(association) {
  if (!association || association.trim() === '') return config.ASSOCIATION_SCORES.nonMember;
  return config.ASSOCIATION_SCORES.member;
}

function scoreERP(erp) {
  if (!erp || erp.trim() === '') return config.ERP_SCORES.unknown;
  return config.COMPATIBLE_ERPS.has(erp.trim()) ? config.ERP_SCORES.compatible : config.ERP_SCORES.nonCompatible;
}

function erpClass(erp) {
  if (!erp || erp.trim() === '') return 'Unknown';
  return config.COMPATIBLE_ERPS.has(erp.trim()) ? 'Compatible' : 'Non-Compatible';
}

function computeComposite(revScore, locScore, assocScore, erpScore) {
  return Math.round(
    config.WEIGHTS.revenue * revScore + config.WEIGHTS.location * locScore +
    config.WEIGHTS.association * assocScore + config.WEIGHTS.erp * erpScore,
  );
}

function assignCompositeTier(composite) {
  if (composite >= config.TIER_CUTOFFS.tier1) return 'Tier 1';
  if (composite >= config.TIER_CUTOFFS.tier2) return 'Tier 2';
  if (composite >= config.TIER_CUTOFFS.tier3) return 'Tier 3';
  return 'Disqualify - Composite';
}

// Master scorer

function scoreCompany(properties) {
  const now  = new Date().toISOString();
  const geo  = geoGate(properties.country);
  const vert = verticalGate(properties.vertical);

  if (geo === 'Fail') {
    return {
      icp_geo_gate: 'Fail', icp_vertical_gate: vert,
      icp_score_revenue: '', icp_score_locations: '', icp_score_association: '',
      icp_score_erp: '', icp_score_composite: '',
      icp_erp_class: erpClass(properties.erp_pos__c),
      icp_tier: 'Disqualify - Geo Gate', icp_last_scored_at: now,
    };
  }
  if (vert === 'Fail') {
    return {
      icp_geo_gate: 'Pass', icp_vertical_gate: 'Fail',
      icp_score_revenue: '', icp_score_locations: '', icp_score_association: '',
      icp_score_erp: '', icp_score_composite: '',
      icp_erp_class: erpClass(properties.erp_pos__c),
      icp_tier: 'Disqualify - Vertical Gate', icp_last_scored_at: now,
    };
  }

  const revScore   = scoreRevenue(properties.annualrevenue, properties.country);
  const locScore   = scoreLocation(properties.of_locations__c);
  const assocScore = scoreAssociation(properties.industry_association);
  const erpScore   = scoreERP(properties.erp_pos__c);
  const composite  = computeComposite(revScore, locScore, assocScore, erpScore);

  return {
    icp_geo_gate: 'Pass', icp_vertical_gate: 'Pass',
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

function hasChanged(current, computed) {
  const fields = [
    'icp_score_composite','icp_score_revenue','icp_score_locations',
    'icp_score_association','icp_score_erp','icp_erp_class',
    'icp_tier','icp_geo_gate','icp_vertical_gate',
  ];
  return fields.some(f => String(current[f] ?? '') !== String(computed[f] ?? ''));
}

// HubSpot API helpers

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
        console.log('  Rate limited (' + label + '), retry ' + retries + '/4 in ' + (wait/1000) + 's...');
        await new Promise(r => setTimeout(r, wait));
      } else { throw err; }
    }
  }
}

async function fetchAllCompanies() {
  const companies = [];
  let after = undefined;
  while (true) {
    const response = await withRetry(
      () => client.crm.companies.searchApi.doSearch({
        filterGroups: [], properties: config.HUBSPOT_INPUT_PROPERTIES,
        limit: BATCH_SIZE, after,
        sorts: [{ propertyName: 'hs_object_id', direction: 'ASCENDING' }],
      }), 'company search',
    );
    companies.push(...response.results);
    if (response.paging?.next?.after) { after = response.paging.next.after; } else { break; }
  }
  return companies;
}

async function fetchCompaniesByIds(ids) {
  const response = await withRetry(
    () => client.crm.companies.batchApi.read({ inputs: ids.map(id => ({ id })), properties: config.HUBSPOT_INPUT_PROPERTIES }),
    'batch read',
  );
  return response.results;
}

async function batchUpdate(updates) {
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await withRetry(() => client.crm.companies.batchApi.update({ inputs: batch.map(u => ({ id: u.id, properties: u.properties })) }), 'batch update');
    console.log('  Batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ': ' + batch.length + ' companies updated');
  }
}

// Main

async function main() {
  console.log('=== TOOLBX ICP Scoring Engine v3.4 ===');
  console.log('Started: ' + new Date().toISOString() + '\n');
  if (!process.env.HUBSPOT_ACCESS_TOKEN) { console.error('ERROR: HUBSPOT_ACCESS_TOKEN not set'); process.exit(1); }

  const startedAt = Date.now();
  console.log('Fetching all companies from HubSpot...');
  const companies = await fetchAllCompanies();
  console.log('Fetched ' + companies.length + ' companies\n');

  const updates = [];
  const tierCounts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0, 'Disqualify - Composite': 0, 'Disqualify - Geo Gate': 0, 'Disqualify - Vertical Gate': 0 };

  for (const company of companies) {
    const computed = scoreCompany(company.properties);
    tierCounts[computed.icp_tier] = (tierCounts[computed.icp_tier] ?? 0) + 1;
    if (hasChanged(company.properties, computed)) { updates.push({ id: company.id, properties: computed }); }
  }

  console.log('Tier distribution:');
  for (const [tier, count] of Object.entries(tierCounts)) {
    console.log('  ' + tier + ': ' + count + ' (' + ((count / companies.length) * 100).toFixed(1) + '%)');
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\nScoring complete in ' + elapsed + 's. ' + updates.length + ' companies need updating.');
  if (updates.length > 0) { console.log('\nPushing updates...'); await batchUpdate(updates); }

  console.log('\n--- RUN SUMMARY (JSON) ---');
  console.log(JSON.stringify({ run_at: new Date().toISOString(), total: companies.length, changed: updates.length, tiers: tierCounts, elapsed_s: Number(elapsed) }, null, 2));
}

module.exports = { scoreCompany, hasChanged, fetchCompaniesByIds, batchUpdate, geoGate, verticalGate, scoreRevenue, scoreLocation, scoreAssociation, scoreERP, erpClass, computeComposite, assignCompositeTier };

if (require.main === module) {
  main().catch(err => {
    console.error('\nFATAL:', err.message);
    if (err.response?.body) console.error('HubSpot error:', JSON.stringify(err.response.body, null, 2));
    process.exit(1);
  });
}
