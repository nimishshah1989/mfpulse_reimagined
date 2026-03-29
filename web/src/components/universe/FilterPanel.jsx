import { useState, useMemo } from 'react';
import Pill from '../shared/Pill';
import { formatCount } from '../../lib/format';
import { LENS_OPTIONS } from '../../lib/lens';

const PRESETS = [
  {
    label: 'Elite Funds',
    filters: {
      return_score: 70,
      risk_score: 70,
      consistency_score: 70,
      alpha_score: 70,
      efficiency_score: 70,
      resilience_score: 70,
    },
  },
  {
    label: 'Large Cap Quality',
    filters: { return_score: 60, consistency_score: 60 },
    categories: ['Large Cap'],
  },
  {
    label: 'High Alpha Small',
    filters: { alpha_score: 75 },
    categories: ['Small Cap'],
  },
  {
    label: 'Defensive',
    filters: { risk_score: 70, resilience_score: 70 },
  },
];

export default function FilterPanel({
  categories,
  amcs,
  filters,
  onFiltersChange,
  xAxis,
  yAxis,
  onXAxisChange,
  onYAxisChange,
  mode,
  filteredCount,
  totalCount,
}) {
  const [amcSearch, setAmcSearch] = useState('');
  const [amcOpen, setAmcOpen] = useState(false);

  // Group categories by broad_category
  const categoryGroups = useMemo(() => {
    const groups = {};
    (categories || []).forEach((cat) => {
      const broad = cat.broad_category || 'Other';
      if (!groups[broad]) groups[broad] = [];
      groups[broad].push(cat);
    });
    return groups;
  }, [categories]);

  const filteredAmcs = useMemo(() => {
    if (!amcSearch) return amcs || [];
    const search = amcSearch.toLowerCase();
    return (amcs || []).filter((a) =>
      a.amc_name.toLowerCase().includes(search)
    );
  }, [amcs, amcSearch]);

  const handleLensSlider = (key, value) => {
    onFiltersChange({ ...filters, lensThresholds: { ...filters.lensThresholds, [key]: value } });
  };

  const handleCategoryToggle = (catName) => {
    const current = new Set(filters.selectedCategories);
    if (current.has(catName)) current.delete(catName);
    else current.add(catName);
    onFiltersChange({ ...filters, selectedCategories: current });
  };

  const handleSelectAllCategories = () => {
    const all = new Set((categories || []).map((c) => c.category_name));
    onFiltersChange({ ...filters, selectedCategories: all });
  };

  const handleClearCategories = () => {
    onFiltersChange({ ...filters, selectedCategories: new Set() });
  };

  const handleAmcToggle = (amcName) => {
    const current = new Set(filters.selectedAmcs);
    if (current.has(amcName)) current.delete(amcName);
    else current.add(amcName);
    onFiltersChange({ ...filters, selectedAmcs: current });
  };

  const handlePreset = (preset) => {
    const newThresholds = {};
    LENS_OPTIONS.forEach((l) => {
      newThresholds[l.key] = preset.filters[l.key] || 0;
    });
    const newCategories = preset.categories
      ? new Set(preset.categories)
      : new Set((categories || []).map((c) => c.category_name));
    onFiltersChange({
      ...filters,
      lensThresholds: newThresholds,
      selectedCategories: newCategories,
    });
  };

  const handleReset = () => {
    const newThresholds = {};
    LENS_OPTIONS.forEach((l) => {
      newThresholds[l.key] = 0;
    });
    onFiltersChange({
      lensThresholds: newThresholds,
      selectedCategories: new Set((categories || []).map((c) => c.category_name)),
      selectedAmcs: new Set((amcs || []).map((a) => a.amc_name)),
    });
  };

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto h-full">
      <div className="p-4 space-y-5">
        {/* Fund count */}
        <div className="text-xs text-slate-500">
          Showing{' '}
          <span className="font-mono font-semibold text-slate-700">
            {formatCount(filteredCount)}
          </span>{' '}
          of{' '}
          <span className="font-mono font-semibold text-slate-700">
            {formatCount(totalCount)}
          </span>{' '}
          funds
        </div>

        {/* Axis selectors — scatter mode only */}
        {mode === 'scatter' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Axes
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">X-Axis</label>
                <select
                  value={xAxis}
                  onChange={(e) => onXAxisChange(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700"
                >
                  {LENS_OPTIONS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Y-Axis</label>
                <select
                  value={yAxis}
                  onChange={(e) => onYAxisChange(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700"
                >
                  {LENS_OPTIONS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Category checkboxes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Categories
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleSelectAllCategories}
                className="text-[10px] text-teal-600 hover:underline"
              >
                All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearCategories}
                className="text-[10px] text-teal-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {Object.entries(categoryGroups).map(([broad, cats]) => (
              <div key={broad}>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {broad}
                </div>
                {cats.map((cat) => (
                  <label
                    key={cat.category_name}
                    className="flex items-center gap-1.5 py-0.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.selectedCategories.has(cat.category_name)}
                      onChange={() => handleCategoryToggle(cat.category_name)}
                      className="w-3 h-3 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-xs text-slate-600 truncate">
                      {cat.category_name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono ml-auto flex-shrink-0">
                      {cat.fund_count}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* AMC multi-select */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            AMCs
          </label>
          <div className="relative">
            <input
              type="text"
              value={amcSearch}
              onChange={(e) => {
                setAmcSearch(e.target.value);
                setAmcOpen(true);
              }}
              onFocus={() => setAmcOpen(true)}
              placeholder="Search AMCs..."
              className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 placeholder-slate-400"
            />
            {amcOpen && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {filteredAmcs.map((amc) => (
                  <label
                    key={amc.amc_name}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.selectedAmcs.has(amc.amc_name)}
                      onChange={() => handleAmcToggle(amc.amc_name)}
                      className="w-3 h-3 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-xs text-slate-600 truncate">
                      {amc.amc_name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono ml-auto flex-shrink-0">
                      {amc.fund_count}
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setAmcOpen(false)}
                  className="w-full text-[10px] text-slate-400 py-1 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lens score sliders */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Lens Scores
          </label>
          {LENS_OPTIONS.map((lens) => {
            const val = filters.lensThresholds[lens.key] || 0;
            return (
              <div key={lens.key} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{lens.label}</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {'\u2265'} {val}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) =>
                    handleLensSlider(lens.key, parseInt(e.target.value, 10))
                  }
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                />
              </div>
            );
          })}
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Quick Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <Pill
                key={preset.label}
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Pill>
            ))}
            <Pill onClick={handleReset}>Reset All</Pill>
          </div>
        </div>
      </div>
    </div>
  );
}
