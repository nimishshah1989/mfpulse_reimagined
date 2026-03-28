import { useMemo, useCallback } from 'react';
import { LENS_OPTIONS } from '../../lib/lens';

const PURCHASE_MODES = ['Regular', 'Direct', 'Both'];
const DIVIDEND_TYPES = ['Growth', 'IDCW', 'Both'];

const AUM_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: '<100Cr', min: 0, max: 100 },
  { label: '100-500Cr', min: 100, max: 500 },
  { label: '500-2KCr', min: 500, max: 2000 },
  { label: '>2KCr', min: 2000, max: Infinity },
];

function FloatPill({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-300 ${
        active
          ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-[0_2px_8px_rgba(13,148,136,0.25)]'
          : 'bg-slate-100/70 text-slate-500 hover:bg-slate-200/80 hover:text-slate-600 backdrop-blur-sm'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function FloatSelect({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`px-3 py-1 rounded-full text-[11px] border-[0.5px] border-slate-200/60 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400/50 transition-all duration-200 appearance-none cursor-pointer hover:border-slate-300 ${className}`}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '22px' }}
    >
      {children}
    </select>
  );
}

/**
 * HorizontalFilterBar — compact filter row replacing the left sidebar.
 * Float design: rounded pills, gradient active states, subtle backdrop-blur.
 */
export default function HorizontalFilterBar({
  filters,
  onFiltersChange,
  allFunds,
  filteredCount,
  totalCount,
}) {
  const {
    purchaseMode = 'Regular',
    dividendType = 'Growth',
    categories = [],
    amcs = [],
    aumRange = 'All',
    period = '1Y',
  } = filters;

  function update(patch) {
    onFiltersChange({ ...filters, ...patch });
  }

  const { categoryList, amcList } = useMemo(() => {
    const cats = new Set();
    const amcSet = new Set();
    (allFunds || []).forEach((f) => {
      if (f.category_name) cats.add(f.category_name);
      if (f.amc_name) amcSet.add(f.amc_name);
    });
    return {
      categoryList: [...cats].sort(),
      amcList: [...amcSet].sort(),
    };
  }, [allFunds]);

  const hasActiveFilters = purchaseMode !== 'Regular' || dividendType !== 'Growth' ||
    categories.length > 0 || amcs.length > 0 || aumRange !== 'All';

  const clearAll = useCallback(() => {
    onFiltersChange({
      ...filters,
      purchaseMode: 'Regular',
      dividendType: 'Growth',
      broadCategories: [],
      categories: [],
      amcs: [],
      aumRange: 'All',
      lensFilters: {},
    });
  }, [onFiltersChange, filters]);

  return (
    <div className="space-y-1.5 flex-shrink-0">
      {/* Row 1: Filters */}
      <div className="flex items-center gap-1.5 flex-wrap px-1">
        {/* Purchase mode */}
        <div className="flex gap-0.5">
          {PURCHASE_MODES.map((m) => (
            <FloatPill key={m} active={purchaseMode === m} onClick={() => update({ purchaseMode: m })}>
              {m}
            </FloatPill>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-200/50" />

        {/* Dividend type */}
        <div className="flex gap-0.5">
          {DIVIDEND_TYPES.map((t) => (
            <FloatPill key={t} active={dividendType === t} onClick={() => update({ dividendType: t })}>
              {t}
            </FloatPill>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-200/50" />

        {/* Category dropdown */}
        <FloatSelect
          value={categories.length === 1 ? categories[0] : ''}
          onChange={(e) => update({ categories: e.target.value ? [e.target.value] : [] })}
        >
          <option value="">All Categories</option>
          {categoryList.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </FloatSelect>

        {/* AMC dropdown */}
        <FloatSelect
          value={amcs.length === 1 ? amcs[0] : ''}
          onChange={(e) => update({ amcs: e.target.value ? [e.target.value] : [] })}
        >
          <option value="">All AMCs</option>
          {amcList.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </FloatSelect>

        <div className="w-px h-4 bg-slate-200/50" />

        {/* AUM range */}
        <div className="flex gap-0.5">
          {AUM_RANGES.map((r) => (
            <FloatPill
              key={r.label}
              active={aumRange === r.label}
              onClick={() => update({ aumRange: r.label })}
              className="text-[10px] px-2.5"
            >
              {r.label}
            </FloatPill>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-200/50" />

        {/* Period */}
        <div className="flex gap-0.5">
          {['1Y', '3Y', '5Y'].map((p) => (
            <FloatPill key={p} active={period === p} onClick={() => update({ period: p })} className="text-[10px] px-2.5">
              {p}
            </FloatPill>
          ))}
        </div>

        {/* Clear + Count */}
        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition-colors"
            >
              Clear
            </button>
          )}
          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            <span className="font-semibold text-slate-700">{filteredCount.toLocaleString('en-IN')}</span>
            {' / '}
            <span>{totalCount.toLocaleString('en-IN')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export { AUM_RANGES };
