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
