const COMPATIBLE_ERPS = new Set([
  'Epicor BisTrack',
  'Epicor Eagle',
  'ECI Spruce',
  'DMSI Agility',
  'Sandbox',
  'Paladin',
  'Epicor Warehouse Management (WMS)',
  'GenetiQ',
  'Deacom',
  'ECI Deacom',
]);

const NAMED_ASSOCIATIONS = new Set([
  'LMC',
  'LBM Advantage',
  'Construction Suppliers Association (CSA)',
  'Do It Best',
  'Allied Building Stores',
  'NEMEON Inc.',
  'Castle Building Centres',
  'Sexton Group',
  'Timber Mart',
]);

const WEIGHTS = {
  revenue: 0.30,
  location: 0.30,
  association: 0.20,
  erp: 0.20,
};

const TIER_CUTOFFS = {
  tier1: 75,
  tier2: 55,
  tier3: 40,
};

const REVENUE_THRESHOLDS = {
  US: { floor: 20_000_000, ceiling: 1_000_000_000 },
  CA: { floor: 5_000_000, ceiling: 500_000_000 },
};

const REVENUE_SCORES = {
  belowFloor: 30,
  inBand: 100,
  aboveCeiling: 60,
  unknown: 50,
};

const LOCATION_SCORES = {
  single: 15,       // 1
  smallChain: 60,   // 2-5
  sweetSpot: 100,   // 6-50
  megaCap: 40,      // 51+
  unknown: 50,
};

const ERP_SCORES = {
  compatible: 100,
  unknown: 50,
  nonCompatible: 15,
};

const ASSOCIATION_SCORES = {
  member: 100,
  nonMember: 0,
};

const HUBSPOT_INPUT_PROPERTIES = [
  'annualrevenue',
  'country',
  'of_locations__c',
  'location_count',
  'industry_association',
  'erp_pos__c',
  'icp_score',
  'revenue_score',
  'location_score',
  'industry_association_score',
  'erp_score',
  'icp_tier',
  'is_icp',
];

module.exports = {
  COMPATIBLE_ERPS,
  NAMED_ASSOCIATIONS,
  WEIGHTS,
  TIER_CUTOFFS,
  REVENUE_THRESHOLDS,
  REVENUE_SCORES,
  LOCATION_SCORES,
  ERP_SCORES,
  ASSOCIATION_SCORES,
  HUBSPOT_INPUT_PROPERTIES,
};
