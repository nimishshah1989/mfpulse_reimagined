import { useMemo } from 'react';
import Pill from '../shared/Pill';
import { LENS_OPTIONS } from '../../lib/lens';
import { formatCount } from '../../lib/format';

const PURCHASE_MODES = ['Regular', 'Direct', 'Both'];
const DIVIDEND_TYPES = ['Growth', 'IDCW', 'Both'];
const PERIODS = ['6M', '1Y', '3Y', '5Y', '7Y', '10Y'];
const BROAD_CATEGORIES = ['', 'Equity', 'Debt', 'Hybrid', 'Solution Oriented', 'Other'];

/**
 * Horizontal filter bar for Universe Explorer.
 * Grouped controls: Fund Type, Filters (with active count badge), Period, Axes.
 */
export default function FilterBar({
  categories = [],
  amcs = [],
  filters,
  onFiltersChange,
  xAxis,
  yAxis,
  colorLens,
  onXAxisChange,
  onYAxisChange,
  onColorLensChange,
  filteredCount,
  totalCount,
}) {
  const {
    purchaseMode = 'Regular',
    dividendType = 'Growth',
    category = '',
    broadCategory = '',
    amc = '',
    period = '1Y',
  } = filters;

  function update(patch) {
    onFiltersChange({ ...filters, ...patch });
  }

  // Count active filters (excluding defaults)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (category) count += 1;
    if (broadCategory) count += 1;
    if (amc) count += 1;
    if (purchaseMode !== 'Regular') count += 1;
    if (dividendType !== 'Growth') count += 1;
    return count;
  }, [category, broadCategory, amc, purchaseMode, dividendType]);

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-3">
      {/* Fund Type group */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Fund Type</span>
        <div className="flex items-center gap-1">
          {PURCHASE_MODES.map((mode) => (
            <Pill
              key={mode}
              active={purchaseMode === mode}
              onClick={() => update({ purchaseMode: mode })}
            >
              {mode}
            </Pill>
          ))}
        </div>
        <div className="h-4 border-l border-slate-200 mx-0.5" />
        <div className="flex items-center gap-1">
          {DIVIDEND_TYPES.map((type) => (
            <Pill
              key={type}
              active={dividendType === type}
              onClick={() => update({ dividendType: type })}
            >
              {type}
            </Pill>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-6 border-l border-slate-200" />

      {/* Filters group with badge */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider relative">
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-4 bg-teal-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </span>

        {/* Broad Category / Sector */}
        <select
          value={broadCategory}
          onChange={(e) => update({ broadCategory: e.target.value })}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
        >
          <option value="">All Sectors</option>
          {BROAD_CATEGORIES.filter(Boolean).map((bc) => (
            <option key={bc} value={bc}>
              {bc}
            </option>
          ))}
        </select>

        {/* Category dropdown */}
        <select
          value={category}
          onChange={(e) => update({ category: e.target.value })}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 max-w-[160px]"
        >
          <option value="">All Categories</option>
          {(categories || []).map((cat) => {
            const name = typeof cat === 'string' ? cat : cat.category_name;
            return (
              <option key={name} value={name}>
                {name}
              </option>
            );
          })}
        </select>

        {/* AMC dropdown */}
        <select
          value={amc}
          onChange={(e) => update({ amc: e.target.value })}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 max-w-[140px]"
        >
          <option value="">All AMCs</option>
          {(amcs || []).map((a) => {
            const name = typeof a === 'string' ? a : a.amc_name;
            return (
              <option key={name} value={name}>
                {name}
              </option>
            );
          })}
        </select>
      </div>

      {/* Divider */}
      <div className="h-6 border-l border-slate-200" />

      {/* Temporal period toggle */}
      <div className="flex items-center gap-1">
        {PERIODS.map((p) => (
          <Pill
            key={p}
            active={period === p}
            onClick={() => update({ period: p })}
          >
            {p}
          </Pill>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 border-l border-slate-200" />

      {/* Axis controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-400">X:</label>
          <select
            value={xAxis}
            onChange={(e) => onXAxisChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
          >
            {LENS_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-400">Y:</label>
          <select
            value={yAxis}
            onChange={(e) => onYAxisChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
          >
            {LENS_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-400">Color:</label>
          <select
            value={colorLens}
            onChange={(e) => onColorLensChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
          >
            {LENS_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Spacer + count */}
      <div className="ml-auto text-xs text-slate-500">
        <span className="font-mono font-semibold text-slate-700">
          {formatCount(filteredCount)}
        </span>
        {' / '}
        <span className="font-mono text-slate-400">
          {formatCount(totalCount)}
        </span>{' '}
        funds
      </div>
    </div>
  );
}
