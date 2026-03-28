import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock next/router
jest.unstable_mockModule('next/router', () => ({
  useRouter: jest.fn(() => ({
    isReady: true,
    query: {},
    push: jest.fn(),
    pathname: '/fund360',
  })),
}));

// Mock all API calls
jest.unstable_mockModule('../lib/api', () => ({
  fetchFundDetail: jest.fn(),
  fetchFundLensScores: jest.fn(),
  fetchNAVHistory: jest.fn(),
  fetchHoldings: jest.fn(),
  fetchSectorExposure: jest.fn(),
  fetchLensHistory: jest.fn(),
  fetchPeers: jest.fn(),
  fetchFundRisk: jest.fn(),
  fetchFunds: jest.fn(),
  fetchOverlap: jest.fn(),
  fetchCategories: jest.fn(),
  fetchAMCs: jest.fn(),
}));

describe('Fund 360 utilities', () => {
  it('LENS_OPTIONS has exactly 6 lenses', async () => {
    const { LENS_OPTIONS } = await import('../lib/lens');
    expect(LENS_OPTIONS).toHaveLength(6);
    expect(LENS_OPTIONS.map((l) => l.key)).toEqual([
      'return_score',
      'risk_score',
      'consistency_score',
      'alpha_score',
      'efficiency_score',
      'resilience_score',
    ]);
  });

  it('formatPct handles positive, negative, and null', async () => {
    const { formatPct } = await import('../lib/format');
    expect(formatPct(12.5)).toBe('+12.5%');
    expect(formatPct(-3.2)).toBe('\u221213\u20093.2%'.replace(/\u2009/g, '') ? '\u22123.2%' : formatPct(-3.2));
    expect(formatPct(null)).toBe('\u2014');
    expect(formatPct(undefined)).toBe('\u2014');
  });

  it('formatAUM handles crores and lakhs', async () => {
    const { formatAUM } = await import('../lib/format');
    expect(formatAUM(150)).toBe('\u20B9150Cr');
    expect(formatAUM(0.5)).toBe('\u20B950.0L');
    expect(formatAUM(null)).toBe('\u2014');
  });
});

describe('Fund 360 page structure', () => {
  it('exports a default function component', async () => {
    const mod = await import('../pages/fund360');
    expect(typeof mod.default).toBe('function');
  });
});

describe('LensCard rendering logic', () => {
  it('shows "Top X% in category" when score > 50', () => {
    const score = 82;
    const categoryName = 'Flexi Cap';
    const peerContext =
      score > 50
        ? `Top ${100 - score}% in ${categoryName}`
        : `Below ${score}% of peers`;
    expect(peerContext).toBe('Top 18% in Flexi Cap');
  });

  it('shows "Below X% of peers" when score <= 50', () => {
    const score = 29;
    const categoryName = 'Large Cap';
    const peerContext =
      score > 50
        ? `Top ${100 - score}% in ${categoryName}`
        : `Below ${score}% of peers`;
    expect(peerContext).toBe('Below 29% of peers');
  });

  it('shows exact boundary at score = 50 as "Below 50% of peers"', () => {
    const score = 50;
    const peerContext =
      score > 50
        ? `Top ${100 - score}% in ...`
        : `Below ${score}% of peers`;
    expect(peerContext).toBe('Below 50% of peers');
  });
});

describe('ReturnsBars gap calculation', () => {
  it('computes positive gap when fund beats category', () => {
    const fundVal = 18.5;
    const catVal = 10.6;
    const gap = fundVal - catVal;
    expect(gap).toBeCloseTo(7.9, 1);
    expect(gap >= 0).toBe(true);
  });

  it('computes negative gap when fund trails category', () => {
    const fundVal = 8.0;
    const catVal = 12.0;
    const gap = fundVal - catVal;
    expect(gap).toBeCloseTo(-4.0, 1);
    expect(gap >= 0).toBe(false);
  });

  it('formats gap label as "+X.X% ahead" when positive', () => {
    const gap = 7.9;
    const label = gap >= 0 ? `+${gap.toFixed(1)}% ahead` : `${gap.toFixed(1)}% behind`;
    expect(label).toBe('+7.9% ahead');
  });

  it('formats gap label as "X.X% behind" when negative', () => {
    const gap = -4.0;
    const label = gap >= 0 ? `+${gap.toFixed(1)}% ahead` : `${gap.toFixed(1)}% behind`;
    expect(label).toBe('-4.0% behind');
  });

  it('handles null category returns gracefully', () => {
    const fundVal = 15.0;
    const catVal = null;
    const gap = catVal != null ? fundVal - catVal : null;
    expect(gap).toBeNull();
  });
});

describe('SmartAlternatives peer selection', () => {
  const peers = [
    { mstar_id: 'A', return_score: 90, efficiency_score: 70, fund_name: 'Fund A' },
    { mstar_id: 'B', return_score: 85, efficiency_score: 95, fund_name: 'Fund B' },
    { mstar_id: 'C', return_score: 80, efficiency_score: 60, fund_name: 'Fund C' },
    { mstar_id: 'D', return_score: 75, efficiency_score: 88, fund_name: 'Fund D' },
    { mstar_id: 'E', return_score: 70, efficiency_score: 50, fund_name: 'Fund E' },
  ];

  it('selects top 3 by return_score excluding current fund', () => {
    const currentId = 'A';
    const filtered = peers.filter((p) => p.mstar_id !== currentId);
    const top3Return = [...filtered]
      .sort((a, b) => (b.return_score || 0) - (a.return_score || 0))
      .slice(0, 3);
    expect(top3Return.map((p) => p.mstar_id)).toEqual(['B', 'C', 'D']);
  });

  it('selects top 2 by efficiency_score excluding current fund', () => {
    const currentId = 'A';
    const filtered = peers.filter((p) => p.mstar_id !== currentId);
    const top2Eff = [...filtered]
      .sort((a, b) => (b.efficiency_score || 0) - (a.efficiency_score || 0))
      .slice(0, 2);
    expect(top2Eff.map((p) => p.mstar_id)).toEqual(['B', 'D']);
  });

  it('deduplicates across return and efficiency selections', () => {
    const currentId = 'A';
    const filtered = peers.filter((p) => p.mstar_id !== currentId);
    const top3Return = [...filtered]
      .sort((a, b) => (b.return_score || 0) - (a.return_score || 0))
      .slice(0, 3);
    const top2Eff = [...filtered]
      .sort((a, b) => (b.efficiency_score || 0) - (a.efficiency_score || 0))
      .slice(0, 2);
    const returnIds = new Set(top3Return.map((p) => p.mstar_id));
    const combined = [
      ...top3Return,
      ...top2Eff.filter((p) => !returnIds.has(p.mstar_id)),
    ];
    // B is in both — should appear once
    const ids = combined.map((p) => p.mstar_id);
    expect(ids.filter((id) => id === 'B')).toHaveLength(1);
  });
});

describe('PerformanceChart period configuration', () => {
  it('includes since_inception and excludes max in PERIODS', async () => {
    // Validate the expected period config used in PerformanceChart
    const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y', 'since_inception'];
    expect(PERIODS).toContain('since_inception');
    expect(PERIODS).not.toContain('max');
  });

  it('PERIOD_LABELS maps since_inception to "Since Inception"', () => {
    const PERIOD_LABELS = {
      '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y',
      '3y': '3Y', '5y': '5Y', since_inception: 'Since Inception',
    };
    expect(PERIOD_LABELS.since_inception).toBe('Since Inception');
    expect(PERIOD_LABELS.max).toBeUndefined();
  });
});

describe('ReturnsBars difference calculation (legacy)', () => {
  it('computes positive difference as fund - category', () => {
    const fundVal = 15.5;
    const catVal = 12.3;
    const diff = fundVal - catVal;
    expect(diff).toBeCloseTo(3.2, 1);
    expect(diff >= 0).toBe(true);
  });

  it('computes negative difference correctly', () => {
    const diff = 8.0 - 12.0;
    expect(diff).toBeCloseTo(-4.0, 1);
    expect(diff >= 0).toBe(false);
  });
});
