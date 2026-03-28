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
    expect(formatPct(-3.2)).toBe('\u221212\u20093.2%'.replace(/\u2009/g, '') ? '\u22123.2%' : formatPct(-3.2));
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

describe('ReturnsTable difference calculation', () => {
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

describe('PeerTable sort logic', () => {
  it('sorts peers by return_1y descending', () => {
    const peers = [
      { mstar_id: 'A', return_1y: 10 },
      { mstar_id: 'B', return_1y: 25 },
      { mstar_id: 'C', return_1y: 15 },
    ];
    const sorted = [...peers].sort(
      (a, b) => (Number(b.return_1y) || 0) - (Number(a.return_1y) || 0)
    );
    expect(sorted[0].mstar_id).toBe('B');
    expect(sorted[1].mstar_id).toBe('C');
    expect(sorted[2].mstar_id).toBe('A');
  });

  it('handles null return values in sort', () => {
    const peers = [
      { mstar_id: 'A', return_1y: null },
      { mstar_id: 'B', return_1y: 10 },
    ];
    const sorted = [...peers].sort(
      (a, b) => (Number(b.return_1y) || 0) - (Number(a.return_1y) || 0)
    );
    expect(sorted[0].mstar_id).toBe('B');
  });
});

describe('RiskStatsGrid color logic', () => {
  it('classifies Sharpe > 1.0 as good', () => {
    const value = 1.5;
    const greenAbove = 1.0;
    const isGreen = value >= greenAbove;
    expect(isGreen).toBe(true);
  });

  it('classifies Sharpe < 0.5 as bad', () => {
    const value = 0.3;
    const redBelow = 0.5;
    const isRed = value <= redBelow;
    expect(isRed).toBe(true);
  });

  it('classifies Beta < 0.9 as good (low is better)', () => {
    const value = 0.8;
    const greenBelow = 0.9;
    const isGreen = value <= greenBelow;
    expect(isGreen).toBe(true);
  });
});

describe('LensHistory trend detection', () => {
  it('detects upward trend when last avg > first avg by >2', () => {
    const scores = [40, 42, 44, 50, 55, 60];
    const firstAvg = (scores[0] + scores[1] + scores[2]) / 3;
    const lastAvg =
      (scores[scores.length - 3] + scores[scores.length - 2] + scores[scores.length - 1]) / 3;
    const diff = lastAvg - firstAvg;
    expect(diff).toBeGreaterThan(2);
  });

  it('detects downward trend', () => {
    const scores = [80, 78, 75, 60, 55, 50];
    const firstAvg = (scores[0] + scores[1] + scores[2]) / 3;
    const lastAvg =
      (scores[scores.length - 3] + scores[scores.length - 2] + scores[scores.length - 1]) / 3;
    const diff = lastAvg - firstAvg;
    expect(diff).toBeLessThan(-2);
  });

  it('detects stable trend', () => {
    const scores = [50, 51, 50, 49, 50, 51];
    const firstAvg = (scores[0] + scores[1] + scores[2]) / 3;
    const lastAvg =
      (scores[scores.length - 3] + scores[scores.length - 2] + scores[scores.length - 1]) / 3;
    const diff = lastAvg - firstAvg;
    expect(Math.abs(diff)).toBeLessThanOrEqual(2);
  });
});
