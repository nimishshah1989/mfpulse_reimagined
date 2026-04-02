import { useState, useMemo, useCallback } from 'react';
import Pill from '../shared/Pill';
import { LENS_OPTIONS } from '../../lib/lens';
import { formatCount } from '../../lib/format';

const BROAD_CATEGORIES = ['Equity', 'Debt', 'Hybrid', 'Solution Oriented', 'Other'];

const AUM_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: '<100Cr', min: 0, max: 100 },
  { label: '100-500Cr', min: 100, max: 500 },
  { label: '500-2KCr', min: 500, max: 2000 },
  { label: '>2KCr', min: 2000, max: Infinity },
];

const TIER_BUTTONS = [
  { label: 'Leader', min: 75, max: 100 },
  { label: 'Strong', min: 60, max: 75 },
  { label: 'Average', min: 30, max: 60 },
  { label: 'Weak', min: 0, max: 30 },
];

const PRESETS = [
  {
    id: 'large-cap-leaders',
    label: 'Large Cap Leaders',
    description: 'Equity large caps with top return scores',
    filters: {
      broadCategories: ['Equity'],
      lensFilters: { return_score: { min: 75, max: 100 } },
    },
  },
  {
    id: 'low-cost-alpha',
    label: 'Low-Cost Alpha',
    description: 'Efficient funds generating alpha',
    filters: {
      lensFilters: {
        efficiency_score: { min: 70, max: 100 },
        alpha_score: { min: 60, max: 100 },
      },
    },
  },
  {
    id: 'fortress-funds',
    label: 'Fortress Funds',
    description: 'Low risk, consistent performers',
    filters: {
      lensFilters: {
        risk_score: { min: 70, max: 100 },
        consistency_score: { min: 70, max: 100 },
      },
    },
  },
  {
    id: 'high-growth',
    label: 'High Growth',
    description: 'Top return scores (80+)',
    filters: {
      lensFilters: { return_score: { min: 80, max: 100 } },
    },
  },
];

function SearchableMultiSelect({ label, options, selected, onChange, countMap }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 50);
    const lower = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower)).slice(0, 50);
  }, [options, search]);

  const toggle = useCallback(
    (item) => {
      if (selected.includes(item)) {
        onChange(selected.filter((s) => s !== item));
      } else {
        onChange([...selected, item]);
      }
    },
    [selected, onChange]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors"
      >
        <span className="text-slate-600 truncate">
          {selected.length === 0 ? `All ${label}` : `${selected.length} selected`}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-hidden">
          <div className="p-1.5 border-b border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-teal-400"
            />
          </div>
          <div className="overflow-y-auto max-h-44 p-1">
            {filtered.map((item) => {
              const isChecked = selected.includes(item);
              const count = countMap?.[item] || 0;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggle(item)}
                  className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded-md transition-colors ${
                    isChecked
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                      isChecked
                        ? 'bg-teal-600 border-teal-600'
                        : 'border-slate-300'
                    }`}
                  >
                    {isChecked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate flex-1 text-left">{item}</span>
                  {count > 0 && (
                    <span className="font-mono text-[10px] text-slate-400">{formatCount(count)}</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-[10px] text-slate-400 text-center py-2">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LensRangeFilter({ lensKey, label, value, onChange }) {
  const isActive = value && (value.min > 0 || value.max < 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        {isActive && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[9px] text-slate-400 hover:text-red-500"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {TIER_BUTTONS.map((tier) => {
          const isSelected =
            value && value.min <= tier.min && value.max >= tier.max;
          const partialMatch =
            value &&
            value.min < tier.max &&
            value.max > tier.min;
          return (
            <button
              key={tier.label}
              type="button"
              onClick={() => {
                if (isSelected || partialMatch) {
                  onChange(null);
                } else {
                  onChange({ min: tier.min, max: tier.max });
                }
              }}
              className={`flex-1 px-1 py-0.5 text-[9px] font-medium rounded-md border transition-all ${
                isSelected
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : partialMatch
                  ? 'border-teal-200 bg-teal-25 text-teal-600'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {tier.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FilterSidebar({
  filters,
  onFiltersChange,
  allFunds,
  collapsed,
  onToggleCollapse,
}) {
  const [expandedLens, setExpandedLens] = useState(false);

  const {
    purchaseMode = 'Regular',
    dividendType = 'Growth',
    broadCategories = [],
    categories = [],
    amcs = [],
    aumRange = 'All',
    lensFilters = {},
    period = '1Y',
  } = filters;

  function update(patch) {
    onFiltersChange({ ...filters, ...patch });
  }

  // Derive unique category & AMC lists with counts from allFunds
  const { categoryList, categoryCountMap, amcList, amcCountMap } = useMemo(() => {
    const catCounts = {};
    const amcCounts = {};
    (allFunds || []).forEach((f) => {
      if (f.category_name) {
        catCounts[f.category_name] = (catCounts[f.category_name] || 0) + 1;
      }
      if (f.amc_name) {
        amcCounts[f.amc_name] = (amcCounts[f.amc_name] || 0) + 1;
      }
    });
    return {
      categoryList: Object.keys(catCounts).sort(),
      categoryCountMap: catCounts,
      amcList: Object.keys(amcCounts).sort(),
      amcCountMap: amcCounts,
    };
  }, [allFunds]);

  // Count active filters
  const activeCount = useMemo(() => {
    let count = 0;
    if (broadCategories.length > 0) count += 1;
    if (categories.length > 0) count += 1;
    if (amcs.length > 0) count += 1;
    if (aumRange !== 'All') count += 1;
    const activeLenses = Object.values(lensFilters).filter(Boolean).length;
    count += activeLenses;
    return count;
  }, [broadCategories, categories, amcs, aumRange, lensFilters]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips = [];
    broadCategories.forEach((bc) => {
      chips.push({
        key: `bc-${bc}`,
        label: bc,
        clear: () => update({ broadCategories: broadCategories.filter((b) => b !== bc) }),
      });
    });
    if (categories.length > 0) {
      chips.push({
        key: 'cats',
        label: `${categories.length} categories`,
        clear: () => update({ categories: [] }),
      });
    }
    if (amcs.length > 0) {
      chips.push({
        key: 'amcs',
        label: `${amcs.length} AMCs`,
        clear: () => update({ amcs: [] }),
      });
    }
    if (aumRange !== 'All') {
      chips.push({ key: 'aum', label: `AUM: ${aumRange}`, clear: () => update({ aumRange: 'All' }) });
    }
    Object.entries(lensFilters).forEach(([key, val]) => {
      if (val) {
        const lens = LENS_OPTIONS.find((l) => l.key === key);
        chips.push({
          key: `lens-${key}`,
          label: `${lens?.label || key}: ${val.min}-${val.max}`,
          clear: () => {
            const next = { ...lensFilters };
            delete next[key];
            update({ lensFilters: next });
          },
        });
      }
    });
    return chips;
  }, [filters]);

  const clearAll = useCallback(() => {
    onFiltersChange({
      broadCategories: [],
      categories: [],
      amcs: [],
      aumRange: 'All',
      lensFilters: {},
      period: filters.period || '1Y',
    });
  }, [onFiltersChange, filters.period]);

  const applyPreset = useCallback(
    (preset) => {
      const base = {
        broadCategories: [],
        categories: [],
        amcs: [],
        aumRange: 'All',
        lensFilters: {},
        period: filters.period || '1Y',
      };
      onFiltersChange({
        ...base,
        ...preset.filters,
      });
    },
    [onFiltersChange, filters.period]
  );

  // Collapsed icon bar
  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
          title="Expand filters"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {activeCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
        <div className="flex-1" />
        <div
          className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center"
          title="Filters"
        >
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[9px] font-bold">
              {activeCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
          title="Collapse sidebar"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
          <div className="flex flex-wrap gap-1">
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-medium"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.clear}
                  className="text-teal-400 hover:text-teal-600"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="mt-1.5 text-[10px] text-red-500 hover:text-red-600 font-medium"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {/* Period Selection */}
        <section>
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Period
          </h4>
          <div className="flex gap-1">
            {['1Y', '3Y', '5Y'].map((p) => (
              <Pill key={p} active={period === p} onClick={() => update({ period: p })}>
                {p}
              </Pill>
            ))}
          </div>
        </section>

        {/* AUM Filter */}
        <section>
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            AUM Range
          </h4>
          <div className="flex flex-wrap gap-1">
            {AUM_RANGES.map((range) => (
              <Pill
                key={range.label}
                active={aumRange === range.label}
                onClick={() => update({ aumRange: range.label })}
                className="text-[10px] px-2 py-1"
              >
                {range.label}
              </Pill>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section>
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Categories
          </h4>
          <div className="space-y-2">
            {/* Broad category chips */}
            <div className="flex flex-wrap gap-1">
              {BROAD_CATEGORIES.map((bc) => {
                const isActive = broadCategories.includes(bc);
                return (
                  <button
                    key={bc}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        update({ broadCategories: broadCategories.filter((b) => b !== bc) });
                      } else {
                        update({ broadCategories: [...broadCategories, bc] });
                      }
                    }}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-all ${
                      isActive
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {bc}
                  </button>
                );
              })}
            </div>

            {/* Searchable category dropdown */}
            <SearchableMultiSelect
              label="Categories"
              options={categoryList}
              selected={categories}
              onChange={(val) => update({ categories: val })}
              countMap={categoryCountMap}
            />

            {/* Searchable AMC dropdown */}
            <SearchableMultiSelect
              label="AMCs"
              options={amcList}
              selected={amcs}
              onChange={(val) => update({ amcs: val })}
              countMap={amcCountMap}
            />
          </div>
        </section>

        {/* Lens Filters */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Lens Filters
            </h4>
            <button
              type="button"
              onClick={() => setExpandedLens(!expandedLens)}
              className="text-[10px] text-teal-600 hover:text-teal-700 font-medium"
            >
              {expandedLens ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <div className={`space-y-2 ${!expandedLens ? 'max-h-0 overflow-hidden' : ''}`}>
            {LENS_OPTIONS.map((lens) => (
              <LensRangeFilter
                key={lens.key}
                lensKey={lens.key}
                label={lens.label}
                value={lensFilters[lens.key]}
                onChange={(val) => {
                  const next = { ...lensFilters };
                  if (val) {
                    next[lens.key] = val;
                  } else {
                    delete next[lens.key];
                  }
                  update({ lensFilters: next });
                }}
              />
            ))}
          </div>
          {/* Show summary of active lens filters when collapsed */}
          {!expandedLens && Object.keys(lensFilters).filter((k) => lensFilters[k]).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(lensFilters)
                .filter(([, v]) => v)
                .map(([key, val]) => {
                  const lens = LENS_OPTIONS.find((l) => l.key === key);
                  return (
                    <span
                      key={key}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-teal-50 text-teal-600"
                    >
                      {lens?.label}: {val.min}-{val.max}
                    </span>
                  );
                })}
            </div>
          )}
        </section>

        {/* Quick Presets */}
        <section>
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Quick Presets
          </h4>
          <div className="space-y-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="w-full text-left px-2.5 py-2 rounded-lg border border-teal-200 hover:border-teal-400 hover:bg-teal-50 transition-all group"
              >
                <p className="text-[11px] font-semibold text-teal-700 group-hover:text-teal-800">
                  {preset.label}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export { AUM_RANGES };
