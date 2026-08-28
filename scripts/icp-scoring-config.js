// icp-scoring-config.js - v3.5
// Single source of truth for all scoring constants.
// Imported by icp-scoring-engine.js (nightly) and kept in sync with api/icp-webhook.js (real-time).
// v3.5: Removed vertical gate — no longer a hard disqualifier or tracked property.

const COMPATIBLE_ERPS = new Set([
  'Epicor BisTrack',
  'Epicor Eagle',
  'ECI Spruce',
  'DMSI Agility',
  'Sandbox',
  'Paladin',
  'GenetiQ',
  'Deacom',
  'Sage 100',
]);

const VALID_COUNTRIES = new Set([
  'united states',
  'canada',
  'ca',
]);

const WEIGHTS = {
  revenue:     0.30,
  location:    0.30,
  association: 0.20,
  erp:         0.20,
};

const TIER_CUTOFFS = {
  tier1: 75,
  tier2: 55,
  tier3: 40,
};

const REVENUE_THRESHOLDS = {
  US: { floor:  20000000, ceiling: 1000000000 },
  CA: { floor:   5000000, ceiling:  500000000 },
};

const REVENUE_SCORES = {
  unknown:      50,
  belowFloor:   30,
  inBand:      100,
  aboveCeiling: 60,
};

const LOCATION_SCORES = {
  unknown:    50,
  single:     15,
  smallChain: 60,
  sweetSpot: 100,
  megaCap:    40,
};

const ASSOCIATION_SCORES = {
  member:    100,
  nonMember:   0,
};

const ERP_SCORES = {
  compatible:    100,
  nonCompatible:  15,
  unknown:        50,
};

const HUBSPOT_INPUT_PROPERTIES = [
  'annualrevenue',
  'country',
  'of_locations__c',
  'industry_association',
  'erp_pos__c',
  'icp_score_composite',
  'icp_score_revenue',
  'icp_score_locations',
  'icp_score_association',
  'icp_score_erp',
  'icp_erp_class',
  'icp_tier',
  'icp_geo_gate',
];

module.exports = {
  COMPATIBLE_ERPS,
  VALID_COUNTRIES,
  WEIGHTS,
  TIER_CUTOFFS,
  REVENUE_THRESHOLDS,
  REVENUE_SCORES,
  LOCATION_SCORES,
  ASSOCIATION_SCORES,
  ERP_SCORES,
  HUBSPOT_INPUT_PROPERTIES,
};
