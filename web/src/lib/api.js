const BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error?.message || err.error || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch all funds with pagination (API max 500 per page).
 * Returns flat array of all fund records with enriched lens scores.
 */
export async function fetchAllFunds(params = {}) {
  const pageSize = 500;
  let offset = 0;
  let allFunds = [];
  let hasMore = true;

  while (hasMore) {
    const qs = new URLSearchParams({
      ...params,
      limit: String(pageSize),
      offset: String(offset),
    });
    const res = await apiFetch(`/api/v1/funds?${qs}`);
    const funds = res.data || [];
    allFunds = allFunds.concat(funds);
    hasMore = funds.length === pageSize;
    offset += pageSize;
  }

  return allFunds;
}

/**
 * Fetch all funds via the bulk universe endpoint (single query).
 * Returns flat array with fund data + lens scores + classifications.
 */
export async function fetchUniverseData() {
  const res = await apiFetch('/api/v1/funds/universe');
  return res.data || [];
}

// Fund APIs
export const fetchFunds = (params) =>
  apiFetch(`/api/v1/funds?${new URLSearchParams(params)}`);
export const fetchFundDetail = (mstarId) =>
  apiFetch(`/api/v1/funds/${mstarId}`);
export const fetchCategories = () =>
  apiFetch('/api/v1/funds/categories');
export const fetchAMCs = () =>
  apiFetch('/api/v1/funds/amcs');
export const fetchNAVHistory = (mstarId, period) =>
  apiFetch(`/api/v1/funds/${mstarId}/nav?period=${period}`);

// Lens APIs
export const fetchLensScores = (params) =>
  apiFetch(`/api/v1/lens/scores?${new URLSearchParams(params)}`);
export const fetchFundLensScores = (mstarId) =>
  apiFetch(`/api/v1/lens/scores/${mstarId}`);
export const fetchLensDistribution = (params) =>
  apiFetch(`/api/v1/lens/distribution?${new URLSearchParams(params)}`);

// Holdings APIs
export const fetchHoldings = (mstarId, top) =>
  apiFetch(`/api/v1/funds/${mstarId}/holdings?top=${top || ''}`);
export const fetchSectorExposure = (mstarId) =>
  apiFetch(`/api/v1/funds/${mstarId}/sectors`);
export const fetchOverlap = (mstarIds) =>
  apiFetch('/api/v1/holdings/overlap', {
    method: 'POST',
    body: JSON.stringify({ mstar_ids: mstarIds }),
  });

// MarketPulse APIs
export const fetchMarketRegime = () =>
  apiFetch('/api/v1/market/regime');
export const fetchSectors = (period) =>
  apiFetch(`/api/v1/market/sectors?period=${period || '3M'}`);
export const fetchBreadth = (lookback) =>
  apiFetch(`/api/v1/market/breadth?lookback=${lookback || '1y'}`);
export const fetchSentiment = () =>
  apiFetch('/api/v1/market/sentiment');

// Simulation APIs
export const runSimulation = (params) =>
  apiFetch('/api/v1/simulate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
export const compareModes = (params) =>
  apiFetch('/api/v1/simulate/compare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
export const fetchDefaultRules = () =>
  apiFetch('/api/v1/simulate/rules/defaults');
export const validateRules = (rules) =>
  apiFetch('/api/v1/simulate/validate-rules', {
    method: 'POST',
    body: JSON.stringify({ rules }),
  });

// Lens history + Peers + Risk
export const fetchLensHistory = (mstarId) =>
  apiFetch(`/api/v1/lens/scores/${mstarId}/history`);
export const fetchPeers = (mstarId) =>
  apiFetch(`/api/v1/funds/${mstarId}/peers`);
export const fetchFundRisk = (mstarId) =>
  apiFetch(`/api/v1/funds/${mstarId}/risk`);

// Strategy APIs
export const createStrategy = (data) =>
  apiFetch('/api/v1/strategies', { method: 'POST', body: JSON.stringify(data) });
export const fetchStrategies = () =>
  apiFetch('/api/v1/strategies');
export const fetchStrategy = (id) =>
  apiFetch(`/api/v1/strategies/${id}`);
export const updateStrategy = (id, data) =>
  apiFetch(`/api/v1/strategies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const backtestStrategy = (id) =>
  apiFetch(`/api/v1/strategies/${id}/backtest`, { method: 'POST' });
export const fetchBacktests = (id) =>
  apiFetch(`/api/v1/strategies/${id}/backtests`);

// Override APIs
export const createOverride = (data) =>
  apiFetch('/api/v1/overrides', { method: 'POST', body: JSON.stringify(data) });
export const fetchOverrides = () =>
  apiFetch('/api/v1/overrides');
export const deleteOverride = (id) =>
  apiFetch(`/api/v1/overrides/${id}`, { method: 'DELETE' });

// Fund detail extensions
export const fetchAssetAllocation = (mstarId) =>
  apiFetch(`/api/v1/funds/${mstarId}/asset-allocation`);
export const fetchNarrative = (mstarId) =>
  apiFetch(`/api/v1/funds/${mstarId}/narrative`);
export const fetchNiftyData = () =>
  apiFetch('/api/v1/market/nifty');

// Claude AI APIs
export const fetchMorningBriefing = () =>
  apiFetch('/api/v1/claude/briefing');
export const fetchStrategyInsights = (data) =>
  apiFetch('/api/v1/claude/strategy-insights', { method: 'POST', body: JSON.stringify(data) });
export const fetchSimulationExplainer = (data) =>
  apiFetch('/api/v1/claude/simulation-explainer', { method: 'POST', body: JSON.stringify(data) });
export const fetchSectorPlaybook = () =>
  apiFetch('/api/v1/claude/sector-playbook');
export const fetchRegimeActions = () =>
  apiFetch('/api/v1/claude/regime-actions');
export const fetchFundVerdict = (mstarId) =>
  apiFetch(`/api/v1/claude/fund-verdict/${mstarId}`);
export const parseStrategyQuery = (query) =>
  apiFetch('/api/v1/claude/parse-query', { method: 'POST', body: JSON.stringify({ query }) });
export const fetchClaudeUsage = () =>
  apiFetch('/api/v1/claude/usage');

// Ingestion triggers
export const fetchDataFreshness = () =>
  apiFetch('/api/v1/ingestion/data-freshness');
export const triggerNAVFetch = () =>
  apiFetch('/api/v1/ingestion/fetch/nav', { method: 'POST' });
export const triggerLensCompute = () =>
  apiFetch('/api/v1/lens/compute', { method: 'POST' });
