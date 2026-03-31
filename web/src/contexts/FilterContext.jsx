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
  planType: 'all',       // 'all' | 'regular' | 'direct'
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
  { label: 'Direct', value: 'direct' },
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
  const hasActiveFilters = filters.planType !== 'all' || filters.fundType !== 'all' || filters.minAum != null;

  // Client-side filter function for universe data
  const applyFilters = useCallback((funds) => {
    if (!hasActiveFilters) return funds;
    return funds.filter((f) => {
      // Plan type filter
      if (filters.planType === 'direct' && f.purchase_mode !== 'Direct') return false;
      if (filters.planType === 'regular' && f.purchase_mode !== 'Regular') return false;
      // Fund type filter
      if (filters.fundType !== 'all') {
        const broad = (f.broad_category || '').toLowerCase();
        if (!broad.includes(filters.fundType)) return false;
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

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used within FilterProvider');
  return ctx;
}

export default FilterContext;
