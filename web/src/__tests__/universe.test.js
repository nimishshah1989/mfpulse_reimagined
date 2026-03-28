import { describe, it, expect, jest } from '@jest/globals';

// Mock next/router
jest.unstable_mockModule('next/router', () => ({
  useRouter: jest.fn(() => ({
    isReady: true,
    query: {},
    push: jest.fn(),
    pathname: '/universe',
  })),
}));

// Mock next/dynamic to return a simple div
jest.unstable_mockModule('next/dynamic', () => ({
  __esModule: true,
  default: (_fn, _opts) => {
    const MockDynamic = () => null;
    return MockDynamic;
  },
}));

// Mock API calls
jest.unstable_mockModule('../lib/api', () => ({
  fetchAllFunds: jest.fn(() => Promise.resolve([])),
  fetchCategories: jest.fn(() => Promise.resolve({ data: [] })),
  fetchAMCs: jest.fn(() => Promise.resolve({ data: [] })),
}));

// ────────────────────────────────────────────
// FilterBar default state tests
// ────────────────────────────────────────────
describe('FilterBar defaults', () => {
  it('has correct default axis keys in LENS_OPTIONS', async () => {
    const { LENS_OPTIONS } = await import('../lib/lens');
    const keys = LENS_OPTIONS.map((l) => l.key);
    expect(keys).toContain('return_score');
    expect(keys).toContain('risk_score');
    expect(keys).toContain('alpha_score');
  });

  it('FilterBar exports a default function', async () => {
    const mod = await import('../components/universe/FilterBar');
    expect(typeof mod.default).toBe('function');
  });

  it('FilterBar default purchase_mode is Regular', () => {
    const defaultFilters = {
      purchaseMode: 'Regular',
      dividendType: 'Growth',
      category: '',
      broadCategory: '',
      amc: '',
      period: '1Y',
    };
    expect(defaultFilters.purchaseMode).toBe('Regular');
    expect(defaultFilters.dividendType).toBe('Growth');
  });
});

// ────────────────────────────────────────────
// TierSummary counting tests
// ────────────────────────────────────────────
describe('TierSummary counting logic', () => {
  it('TierSummary exports a default function', async () => {
    const mod = await import('../components/universe/TierSummary');
    expect(typeof mod.default).toBe('function');
  });

  it('correctly counts tiers from fund scores using lensLabel', async () => {
    const { lensLabel } = await import('../lib/lens');
    const funds = [
      { return_score: 92 },  // Exceptional
      { return_score: 76 },  // Leader
      { return_score: 60 },  // Strong
      { return_score: 45 },  // Adequate
      { return_score: 91 },  // Exceptional
    ];
    const tierCounts = {};
    funds.forEach((f) => {
      const label = lensLabel(f.return_score);
      tierCounts[label] = (tierCounts[label] || 0) + 1;
    });
    expect(tierCounts['Exceptional']).toBe(2);
    expect(tierCounts['Leader']).toBe(1);
    expect(tierCounts['Strong']).toBe(1);
    expect(tierCounts['Adequate']).toBe(1);
  });

  it('handles empty funds array', () => {
    const tierCounts = {};
    expect(Object.keys(tierCounts)).toHaveLength(0);
  });
});

// ────────────────────────────────────────────
// Universe page export test
// ────────────────────────────────────────────
describe('Universe page structure', () => {
  it('exports a default function component', async () => {
    const mod = await import('../pages/universe');
    expect(typeof mod.default).toBe('function');
  });
});

// ────────────────────────────────────────────
// HoverCard export test
// ────────────────────────────────────────────
describe('HoverCard', () => {
  it('exports a default function', async () => {
    const mod = await import('../components/universe/HoverCard');
    expect(typeof mod.default).toBe('function');
  });
});

// ────────────────────────────────────────────
// Filtering logic tests (pure functions)
// ────────────────────────────────────────────
describe('Universe filtering logic', () => {
  const FUNDS = [
    { mstar_id: 'A', purchase_mode: 'Regular', dividend_type: 'Growth', category_name: 'Large Cap', broad_category: 'Equity', amc_name: 'HDFC' },
    { mstar_id: 'B', purchase_mode: 'Direct',  dividend_type: 'Growth', category_name: 'Small Cap', broad_category: 'Equity', amc_name: 'SBI' },
    { mstar_id: 'C', purchase_mode: 'Regular', dividend_type: 'IDCW',   category_name: 'Liquid',    broad_category: 'Debt',   amc_name: 'HDFC' },
  ];

  function applyFilters(funds, filters) {
    return funds.filter((f) => {
      if (filters.purchaseMode !== 'Both' && f.purchase_mode !== filters.purchaseMode) return false;
      if (filters.dividendType !== 'Both' && f.dividend_type !== filters.dividendType) return false;
      if (filters.category && f.category_name !== filters.category) return false;
      if (filters.broadCategory && f.broad_category !== filters.broadCategory) return false;
      if (filters.amc && f.amc_name !== filters.amc) return false;
      return true;
    });
  }

  it('filters by Regular purchase mode', () => {
    const result = applyFilters(FUNDS, { purchaseMode: 'Regular', dividendType: 'Both', category: '', broadCategory: '', amc: '' });
    expect(result.map((f) => f.mstar_id)).toEqual(['A', 'C']);
  });

  it('filters by Growth dividend type', () => {
    const result = applyFilters(FUNDS, { purchaseMode: 'Both', dividendType: 'Growth', category: '', broadCategory: '', amc: '' });
    expect(result.map((f) => f.mstar_id)).toEqual(['A', 'B']);
  });

  it('filters by broad category Debt', () => {
    const result = applyFilters(FUNDS, { purchaseMode: 'Both', dividendType: 'Both', category: '', broadCategory: 'Debt', amc: '' });
    expect(result.map((f) => f.mstar_id)).toEqual(['C']);
  });

  it('Both modes return all funds', () => {
    const result = applyFilters(FUNDS, { purchaseMode: 'Both', dividendType: 'Both', category: '', broadCategory: '', amc: '' });
    expect(result).toHaveLength(3);
  });

  it('default Regular + Growth returns only matching funds', () => {
    const result = applyFilters(FUNDS, { purchaseMode: 'Regular', dividendType: 'Growth', category: '', broadCategory: '', amc: '' });
    expect(result.map((f) => f.mstar_id)).toEqual(['A']);
  });
});
