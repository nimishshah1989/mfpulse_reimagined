import { describe, it, expect } from '@jest/globals';
import { deriveDrillDownFunds, QUADRANT_COLORS, MORNINGSTAR_SECTORS, SORT_OPTIONS } from '../lib/sectors';

describe('sectors constants', () => {
  it('has 4 quadrant colors', () => {
    expect(Object.keys(QUADRANT_COLORS)).toEqual(['Leading', 'Improving', 'Weakening', 'Lagging']);
  });

  it('has 11 Morningstar sectors', () => {
    expect(MORNINGSTAR_SECTORS).toHaveLength(11);
    expect(MORNINGSTAR_SECTORS).toContain('Technology');
    expect(MORNINGSTAR_SECTORS).toContain('Financial Services');
  });

  it('has 5 sort options', () => {
    expect(SORT_OPTIONS).toHaveLength(5);
    expect(SORT_OPTIONS.map((s) => s.key)).toContain('exposure');
  });
});

describe('deriveDrillDownFunds', () => {
  const baseFunds = [
    { mstar_id: 'A', fund_name: 'Fund A', category_name: 'Large Cap', return_1y: 20, return_score: 80, alpha_score: 70, risk_score: 30 },
    { mstar_id: 'B', fund_name: 'Fund B', category_name: 'Technology Fund', return_1y: 15, return_score: 60, alpha_score: 50, risk_score: 40 },
    { mstar_id: 'C', fund_name: 'Fund C', category_name: 'Mid Cap', return_1y: 25, return_score: 90, alpha_score: 85, risk_score: 20 },
    { mstar_id: 'D', fund_name: 'Fund D', category_name: 'Small Cap', return_1y: 10, return_score: 40, alpha_score: 30, risk_score: 60 },
  ];

  const sector = { sector_name: 'Technology' };

  it('returns empty when sector is null', () => {
    const result = deriveDrillDownFunds({ sector: null, funds: baseFunds, sectorExposures: {}, exposureAvailable: true, sort: 'exposure', categoryFilter: 'all' });
    expect(result).toEqual([]);
  });

  it('returns empty when funds is empty', () => {
    const result = deriveDrillDownFunds({ sector, funds: [], sectorExposures: {}, exposureAvailable: true, sort: 'exposure', categoryFilter: 'all' });
    expect(result).toEqual([]);
  });

  it('filters by sector exposure >= 10%', () => {
    const exposures = {
      A: { Technology: 25 },
      B: { Technology: 92 },
      C: { Technology: 5 },
      D: { Technology: 15 },
    };
    const result = deriveDrillDownFunds({ sector, funds: baseFunds, sectorExposures: exposures, exposureAvailable: true, sort: 'exposure', categoryFilter: 'all' });
    expect(result).toHaveLength(3); // A(25), B(92), D(15) — C excluded (5%)
    expect(result.find((f) => f.mstar_id === 'C')).toBeUndefined();
  });

  it('sorts by exposure descending', () => {
    const exposures = {
      A: { Technology: 25 },
      B: { Technology: 92 },
      D: { Technology: 15 },
    };
    const result = deriveDrillDownFunds({ sector, funds: baseFunds, sectorExposures: exposures, exposureAvailable: true, sort: 'exposure', categoryFilter: 'all' });
    expect(result[0].mstar_id).toBe('B');
    expect(result[1].mstar_id).toBe('A');
  });

  it('sorts by return_1y descending', () => {
    const exposures = {
      A: { Technology: 25 },
      B: { Technology: 92 },
      D: { Technology: 15 },
    };
    const result = deriveDrillDownFunds({ sector, funds: baseFunds, sectorExposures: exposures, exposureAvailable: true, sort: 'return_1y', categoryFilter: 'all' });
    expect(result[0].mstar_id).toBe('A'); // return_1y = 20
  });

  it('uses category keyword fallback when exposure unavailable', () => {
    const result = deriveDrillDownFunds({ sector, funds: baseFunds, sectorExposures: {}, exposureAvailable: false, sort: 'return_1y', categoryFilter: 'all' });
    // "Technology" keyword matches "Technology Fund" category
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category_name).toContain('Technology');
    expect(result[0].sector_exposure).toBeNull();
  });

  it('applies category filter', () => {
    const exposures = {
      A: { Technology: 25 },
      B: { Technology: 92 },
      D: { Technology: 15 },
    };
    const result = deriveDrillDownFunds({ sector, funds: baseFunds, sectorExposures: exposures, exposureAvailable: true, sort: 'exposure', categoryFilter: 'Large Cap' });
    expect(result).toHaveLength(1);
    expect(result[0].mstar_id).toBe('A');
  });

  it('limits to 20 results', () => {
    const manyFunds = Array.from({ length: 30 }, (_, i) => ({
      mstar_id: `F${i}`, fund_name: `Fund ${i}`, category_name: 'Large Cap', return_1y: i, return_score: i * 3, alpha_score: i * 2, risk_score: 50,
    }));
    const exposures = Object.fromEntries(
      manyFunds.map((f) => [f.mstar_id, { Technology: 50 }])
    );
    const result = deriveDrillDownFunds({ sector, funds: manyFunds, sectorExposures: exposures, exposureAvailable: true, sort: 'exposure', categoryFilter: 'all' });
    expect(result).toHaveLength(20);
  });

  it('sorts by risk_score ascending (lower is better)', () => {
    const exposures = {
      A: { Technology: 25 },
      C: { Technology: 12 },
      D: { Technology: 15 },
    };
    const result = deriveDrillDownFunds({ sector, funds: baseFunds, sectorExposures: exposures, exposureAvailable: true, sort: 'risk_score', categoryFilter: 'all' });
    // risk_score: C=20, A=30, D=60 → ascending
    expect(result[0].mstar_id).toBe('C');
  });
});
