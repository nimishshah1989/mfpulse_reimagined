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
  apiFetch('/api/v1/marketpulse/regime');
export const fetchSectors = (period) =>
  apiFetch(`/api/v1/marketpulse/sectors?period=${period || '3M'}`);
export const fetchBreadth = (lookback) =>
  apiFetch(`/api/v1/marketpulse/breadth?lookback=${lookback || '1y'}`);
export const fetchSentiment = () =>
  apiFetch('/api/v1/marketpulse/sentiment');

// Simulation APIs
export const runSimulation = (params) =>
  apiFetch('/api/v1/simulation', {
    method: 'POST',
    body: JSON.stringify(params),
  });
export const compareModes = (params) =>
  apiFetch('/api/v1/simulation/compare', {
    method: 'POST',
    body: JSON.stringify(params),
  });
export const fetchDefaultRules = () =>
  apiFetch('/api/v1/simulation/rules/defaults');
