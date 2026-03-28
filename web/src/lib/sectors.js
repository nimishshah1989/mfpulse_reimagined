export const QUADRANT_COLORS = {
  Leading: { bg: 'rgba(5,150,105,0.06)', circle: '#059669', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  Improving: { bg: 'rgba(20,184,166,0.06)', circle: '#0d9488', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700' },
  Weakening: { bg: 'rgba(245,158,11,0.06)', circle: '#d97706', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  Lagging: { bg: 'rgba(220,38,38,0.06)', circle: '#dc2626', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
};

export const MORNINGSTAR_SECTORS = [
  'Financial Services', 'Technology', 'Healthcare', 'Consumer Defensive',
  'Consumer Cyclical', 'Industrials', 'Energy', 'Basic Materials',
  'Communication Services', 'Real Estate', 'Utilities',
];

export const SORT_OPTIONS = [
  { key: 'composite', label: 'Composite' },
  { key: 'exposure', label: 'Exposure %' },
  { key: 'return_1y', label: '1Y Return' },
  { key: 'return_score', label: 'Return Score' },
  { key: 'alpha_score', label: 'Alpha Score' },
  { key: 'risk_score', label: 'Risk Score' },
];

const SORT_FNS = {
  composite: (a, b) => {
    const avgA = ((Number(a.return_score) || 0) + (Number(a.risk_score) || 0) + (Number(a.consistency_score) || 0) + (Number(a.alpha_score) || 0) + (Number(a.efficiency_score) || 0) + (Number(a.resilience_score) || 0)) / 6;
    const avgB = ((Number(b.return_score) || 0) + (Number(b.risk_score) || 0) + (Number(b.consistency_score) || 0) + (Number(b.alpha_score) || 0) + (Number(b.efficiency_score) || 0) + (Number(b.resilience_score) || 0)) / 6;
    return ((b.sector_exposure ?? 0) * avgB) - ((a.sector_exposure ?? 0) * avgA);
  },
  exposure: (a, b) => (b.sector_exposure ?? 0) - (a.sector_exposure ?? 0),
  return_1y: (a, b) => (Number(b.return_1y) || 0) - (Number(a.return_1y) || 0),
  return_score: (a, b) => (Number(b.return_score) || 0) - (Number(a.return_score) || 0),
  alpha_score: (a, b) => (Number(b.alpha_score) || 0) - (Number(a.alpha_score) || 0),
  risk_score: (a, b) => (Number(a.risk_score) || 0) - (Number(b.risk_score) || 0),
};

/**
 * Derive ranked fund list for a sector drill-down.
 */
export function deriveDrillDownFunds({
  sector,
  funds,
  sectorExposures,
  exposureAvailable,
  sort,
  categoryFilter,
}) {
  if (!sector || !funds.length) return [];

  let list;
  if (exposureAvailable) {
    list = funds
      .map((f) => {
        const exposureMap = sectorExposures[f.mstar_id] || {};
        const exposure = exposureMap[sector.sector_name] ?? null;
        return { ...f, sector_exposure: exposure };
      })
      .filter((f) => f.sector_exposure !== null && f.sector_exposure >= 10);
  } else {
    // Category keyword fallback
    const keyword = sector.sector_name.split(' ')[0].toLowerCase();
    list = funds
      .filter((f) => f.category_name?.toLowerCase().includes(keyword))
      .map((f) => ({ ...f, sector_exposure: null }));
  }

  // Apply category filter
  if (categoryFilter && categoryFilter !== 'all') {
    list = list.filter((f) => f.category_name?.includes(categoryFilter));
  }

  // Sort and limit
  return [...list].sort(SORT_FNS[sort] || SORT_FNS.exposure).slice(0, 20);
}
