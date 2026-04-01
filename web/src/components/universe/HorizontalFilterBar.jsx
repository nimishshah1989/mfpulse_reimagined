import { useState, useMemo } from 'react';

const AUM_RANGES = [
  { label: 'Any AUM', min: 0, max: Infinity },
  { label: '> 500 Cr', min: 500, max: Infinity },
  { label: '> 1,000 Cr', min: 1000, max: Infinity },
  { label: '> 5,000 Cr', min: 5000, max: Infinity },
];

const X_AXIS_OPTIONS = [
  { key: 'risk_score', label: 'Risk Score' },
  { key: 'return_score', label: 'Return Score' },
  { key: 'net_expense_ratio', label: 'Expense Ratio' },
  { key: 'std_dev_3y', label: 'Std Dev (3Y)' },
  { key: 'max_drawdown_3y', label: 'Max Drawdown' },
];

const Y_AXIS_OPTIONS = [
  { key: 'return_1y', label: '1Y Return' },
  { key: 'return_3y', label: '3Y CAGR' },
  { key: 'return_5y', label: '5Y CAGR' },
  { key: 'return_score', label: 'Return Score' },
];

const COLOR_OPTIONS = [
  { key: 'alpha_score', label: 'Alpha Score' },
  { key: 'return_score', label: 'Return Score' },
  { key: 'consistency_score', label: 'Consistency' },
  { key: 'efficiency_score', label: 'Efficiency' },
  { key: 'resilience_score', label: 'Resilience' },
];

function FilterSelect({ label, value, onChange, children, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {label && <span className="text-[11px] text-slate-400 uppercase font-bold">{label}</span>}
      <select
        value={value}
        onChange={onChange}
        className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 min-w-0"
      >
        {children}
      </select>
    </div>
  );
}

export default function HorizontalFilterBar({
  filters,
  onFiltersChange,
  allFunds,
  filteredCount,
  totalCount,
  xAxis,
  yAxis,
  colorLens,
  onXAxisChange,
  onYAxisChange,
  onColorChange,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    categories = [],
    amcs = [],
    aumRange = 'Any AUM',
  } = filters;

  function update(patch) {
    onFiltersChange({ ...filters, ...patch });
  }

  const activeFilterCount = (categories.length > 0 ? 1 : 0)
    + (amcs.length > 0 ? 1 : 0)
    + (aumRange !== 'Any AUM' ? 1 : 0);

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

  /* Axis selectors — shared between desktop and mobile */
  const axisSelectors = (
    <>
      <FilterSelect label="X" value={xAxis} onChange={(e) => onXAxisChange(e.target.value)} className="border-r border-slate-200 pr-3">
        {X_AXIS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </FilterSelect>
      <FilterSelect label="Y" value={yAxis} onChange={(e) => onYAxisChange(e.target.value)} className="border-r border-slate-200 pr-3">
        {Y_AXIS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </FilterSelect>
      <FilterSelect label="Color" value={colorLens} onChange={(e) => onColorChange(e.target.value)} className="border-r border-slate-200 pr-3">
        {COLOR_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </FilterSelect>
    </>
  );

  /* Data filter dropdowns */
  const dataFilters = (
    <>
      <select
        value={categories.length === 1 ? categories[0] : ''}
        onChange={(e) => update({ categories: e.target.value ? [e.target.value] : [] })}
        className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
      >
        <option value="">All Categories</option>
        {categoryList.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={amcs.length === 1 ? amcs[0] : ''}
        onChange={(e) => update({ amcs: e.target.value ? [e.target.value] : [] })}
        className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
      >
        <option value="">All AMCs</option>
        {amcList.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <select
        value={aumRange}
        onChange={(e) => update({ aumRange: e.target.value })}
        className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
      >
        {AUM_RANGES.map((r) => <option key={r.label} value={r.label}>{r.label}</option>)}
      </select>
    </>
  );

  return (
    <div className="glass-card px-5 py-3.5 animate-in" style={{ animationDelay: '0.05s' }}>
      {/* Desktop layout */}
      <div className="hidden md:flex items-center gap-3 flex-wrap">
        {axisSelectors}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {dataFilters}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-teal-600 tabular-nums">{filteredCount.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-400">of {totalCount.toLocaleString('en-IN')} shown</p>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-teal-600 tabular-nums">{filteredCount.toLocaleString('en-IN')}</p>
              <p className="text-[9px] text-slate-400">of {totalCount.toLocaleString('en-IN')}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors ${
                mobileOpen
                  ? 'bg-teal-50 border-teal-300 text-teal-700'
                  : 'border-slate-200 text-slate-500 hover:border-teal-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Expanded mobile filters */}
        {mobileOpen && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {axisSelectors}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {dataFilters}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { AUM_RANGES, X_AXIS_OPTIONS, Y_AXIS_OPTIONS, COLOR_OPTIONS };
