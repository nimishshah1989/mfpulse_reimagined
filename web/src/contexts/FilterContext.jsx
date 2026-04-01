import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Universal Filter Context — global filter state that persists across all pages.
 *
 * Filters set on Overview (Dashboard) apply to: Fund Universe, Fund 360 listing, Sectors fund lists.
 * Fund 360 detail page does NOT show these filters (they apply in background).
 *
 * Usage:
 *   const { filters, setFilter, resetFilters, filterQueryString } = useFilters();
 */

const DEFAULT_FILTERS = {
  planType: 'regular',   // 'all' | 'regular' — platform shows Regular funds only
  fundType: 'all',       // 'all' | 'equity' | 'debt' | 'hybrid'
  minAum: null,          // null | 100 | 500 | 1000 | 2000 | 5000 (in crores)
};

const AUM_OPTIONS = [
  { label: 'All AUM', value: null },
  { label: '> 100 Cr', value: 100 },
  { label: '> 500 Cr', value: 500 },
  { label: '> 1,000 Cr', value: 1000 },
  { label: '> 2,000 Cr', value: 2000 },
  { label: '> 5,000 Cr', value: 5000 },
];

const PLAN_OPTIONS = [
  { label: 'All Plans', value: 'all' },
  { label: 'Regular', value: 'regular' },
];

const FUND_TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Equity', value: 'equity' },
  { label: 'Debt', value: 'debt' },
  { label: 'Hybrid', value: 'hybrid' },
];

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Build query string for API calls
  const filterQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.planType !== 'all') params.set('plan_type', filters.planType);
    if (filters.fundType !== 'all') params.set('fund_type', filters.fundType);
    if (filters.minAum != null) params.set('min_aum', String(filters.minAum));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [filters]);

  // Check if any filters are active
  const hasActiveFilters = filters.planType !== 'regular' || filters.fundType !== 'all' || filters.minAum != null;

  // Client-side filter function for universe data
  const applyFilters = useCallback((funds) => {
    // Always filter to Regular funds (platform-wide policy) + any other active filters
    return funds.filter((f) => {
      // Plan type filter — always enforce Regular
      if (filters.planType === 'regular' && f.purchase_mode !== 'Regular') return false;
      // Fund type filter — map user-facing labels to Morningstar broad_category values
      if (filters.fundType !== 'all') {
        const broad = (f.broad_category || '').toLowerCase();
        const typeMap = { equity: 'equity', debt: 'fixed income', hybrid: 'allocation' };
        const mapped = typeMap[filters.fundType] || filters.fundType;
        if (!broad.includes(mapped)) return false;
      }
      // AUM filter (AUM in raw rupees, minAum in crores)
      if (filters.minAum != null) {
        const aumCr = Number(f.aum || f.latest_aum || 0) / 10000000;
        if (aumCr < filters.minAum) return false;
      }
      return true;
    });
  }, [filters, hasActiveFilters]);

  return (
    <FilterContext.Provider value={{
      filters,
      setFilter,
      resetFilters,
      filterQueryString,
      applyFilters,
      hasActiveFilters,
      AUM_OPTIONS,
      PLAN_OPTIONS,
      FUND_TYPE_OPTIONS,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

const SAFE_DEFAULT = {
  filters: DEFAULT_FILTERS,
  setFilter: () => {},
  resetFilters: () => {},
  filterQueryString: () => '',
  applyFilters: (funds) => funds,
  hasActiveFilters: false,
  AUM_OPTIONS,
  PLAN_OPTIONS,
  FUND_TYPE_OPTIONS,
};

export function useFilters() {
  const ctx = useContext(FilterContext);
  // Return safe defaults during SSR/static prerender when provider is absent
  return ctx ?? SAFE_DEFAULT;
}

export default FilterContext;
