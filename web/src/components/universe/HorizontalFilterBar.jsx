import { useMemo, useCallback } from 'react';
import { LENS_OPTIONS, LENS_LABELS } from '../../lib/lens';

const PLAN_TYPES = ['Direct', 'Regular'];
const GROWTH_TYPES = ['Growth'];

const AUM_RANGES = [
  { label: 'Any AUM', min: 0, max: Infinity },
  { label: '> 500 Cr', min: 500, max: Infinity },
  { label: '> 1,000 Cr', min: 1000, max: Infinity },
  { label: '> 5,000 Cr', min: 5000, max: Infinity },
];

const X_AXIS_OPTIONS = [
  { key: 'risk_score', label: 'Risk Score' },
  { key: 'return_score', label: 'Return Score' },
  { key: 'expense_ratio', label: 'Expense Ratio' },
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
  const {
    purchaseMode = 'Direct',
    categories = [],
    amcs = [],
    aumRange = 'Any AUM',
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 animate-in" style={{ animationDelay: '0.05s' }}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* X-Axis selector */}
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
          <span className="text-[9px] text-slate-400 uppercase font-semibold">X-Axis</span>
          <select
            value={xAxis}
            onChange={(e) => onXAxisChange(e.target.value)}
            className="text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
          >
            {X_AXIS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Y-Axis selector */}
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
          <span className="text-[9px] text-slate-400 uppercase font-semibold">Y-Axis</span>
          <select
            value={yAxis}
            onChange={(e) => onYAxisChange(e.target.value)}
            className="text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
          >
            {Y_AXIS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Color-by selector */}
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
          <span className="text-[9px] text-slate-400 uppercase font-semibold">Color</span>
          <select
            value={colorLens}
            onChange={(e) => onColorChange(e.target.value)}
            className="text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
          >
            {COLOR_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {PLAN_TYPES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ purchaseMode: m })}
              className={`filter-pill px-2.5 py-1 text-[10px] font-medium border rounded-full ${
                purchaseMode === m
                  ? 'active bg-teal-50 border-teal-500 text-teal-700'
                  : 'border-slate-200 text-slate-500'
              }`}
            >
              {m}
            </button>
          ))}
          {GROWTH_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className="filter-pill px-2.5 py-1 text-[10px] font-medium border border-slate-200 text-slate-500 rounded-full"
            >
              {t}
            </button>
          ))}

          <span className="text-slate-300">|</span>

          {/* Category dropdown */}
          <select
            value={categories.length === 1 ? categories[0] : ''}
            onChange={(e) => update({ categories: e.target.value ? [e.target.value] : [] })}
            className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
          >
            <option value="">All Categories</option>
            {categoryList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* AMC dropdown */}
          <select
            value={amcs.length === 1 ? amcs[0] : ''}
            onChange={(e) => update({ amcs: e.target.value ? [e.target.value] : [] })}
            className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
          >
            <option value="">All AMCs</option>
            {amcList.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* AUM range */}
          <select
            value={aumRange}
            onChange={(e) => update({ aumRange: e.target.value })}
            className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1"
          >
            {AUM_RANGES.map((r) => (
              <option key={r.label} value={r.label}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-teal-600 tabular-nums">{filteredCount.toLocaleString('en-IN')}</p>
          <p className="text-[9px] text-slate-400">of {totalCount.toLocaleString('en-IN')} shown</p>
        </div>
      </div>
    </div>
  );
}

export { AUM_RANGES, X_AXIS_OPTIONS, Y_AXIS_OPTIONS, COLOR_OPTIONS };
