import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Universal Filter Context — global filter state that persists across all pages.
 *
 * Three simple filters:
 * 1. Broad Category: all | equity | debt | hybrid
 * 2. Min AUM: minimum AUM in crores
 * 3. Min Age: minimum fund age in years
 *
 * Server enforces Regular-only and excludes IDCW/segregated — no client filters needed.
 */

const INITIAL_FILTERS = {
  broadCategory: 'all',  // 'all' | 'equity' | 'debt' | 'hybrid'
  minAum: null,           // null | 100 | 500 | 1000 | 2000 | 5000
  minAge: null,           // null | 1 | 3 | 5
};

const BROAD_CATEGORY_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Equity', value: 'equity' },
  { label: 'Debt', value: 'debt' },
  { label: 'Hybrid', value: 'hybrid' },
];

const AUM_OPTIONS = [
  { label: 'All AUM', value: null },
  { label: '> 100 Cr', value: 100 },
  { label: '> 500 Cr', value: 500 },
  { label: '> 1,000 Cr', value: 1000 },
  { label: '> 2,000 Cr', value: 2000 },
  { label: '> 5,000 Cr', value: 5000 },
];

const AGE_OPTIONS = [
  { label: 'All', value: null },
  { label: '> 1 Year', value: 1 },
  { label: '> 3 Years', value: 3 },
  { label: '> 5 Years', value: 5 },
];

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  // Build query string for API calls
  const filterQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.broadCategory !== 'all') {
      const categoryMap = { equity: 'Equity', debt: 'Fixed Income', hybrid: 'Allocation' };
      params.set('broad_category', categoryMap[filters.broadCategory] || filters.broadCategory);
    }
    if (filters.minAum != null) params.set('min_aum', String(filters.minAum));
    if (filters.minAge != null) params.set('min_age_years', String(filters.minAge));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [filters]);

  // Check if any filters are active
  const hasActiveFilters = filters.broadCategory !== 'all' || filters.minAum != null || filters.minAge != null;

  // Client-side filter function for universe data
  const applyFilters = useCallback((funds) => {
    return funds.filter((f) => {
      // Broad category filter
      if (filters.broadCategory !== 'all') {
        const broad = (f.broad_category || '').toLowerCase();
        const typeMap = { equity: 'equity', debt: 'fixed income', hybrid: 'allocation' };
        const mapped = typeMap[filters.broadCategory] || filters.broadCategory;
        if (!broad.includes(mapped)) return false;
      }
      // AUM filter (AUM in raw rupees, minAum in crores)
      if (filters.minAum != null) {
        const aumCr = Number(f.aum || f.latest_aum || 0) / 10000000;
        if (aumCr < filters.minAum) return false;
      }
      // Age filter
      if (filters.minAge != null && f.inception_date) {
        const inceptionDate = new Date(f.inception_date);
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - filters.minAge);
        if (inceptionDate > cutoff) return false;
      }
      return true;
    });
  }, [filters]);

  return (
    <FilterContext.Provider value={{
      filters,
      setFilter,
      resetFilters,
      filterQueryString,
      applyFilters,
      hasActiveFilters,
      BROAD_CATEGORY_OPTIONS,
      AUM_OPTIONS,
      AGE_OPTIONS,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

const SAFE_DEFAULT = {
  filters: INITIAL_FILTERS,
  setFilter: () => {},
  resetFilters: () => {},
  filterQueryString: () => '',
  applyFilters: (funds) => funds,
  hasActiveFilters: false,
  BROAD_CATEGORY_OPTIONS,
  AUM_OPTIONS,
  AGE_OPTIONS,
};

export function useFilters() {
  const ctx = useContext(FilterContext);
  // Return safe defaults during SSR/static prerender when provider is absent
  return ctx ?? SAFE_DEFAULT;
}

export default FilterContext;
