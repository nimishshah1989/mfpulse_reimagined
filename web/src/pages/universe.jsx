import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { fetchAllFunds, fetchCategories, fetchAMCs } from '../lib/api';
import { formatCount } from '../lib/format';
import FilterPanel from '../components/universe/FilterPanel';
import BubbleScatter from '../components/universe/BubbleScatter';
import Treemap from '../components/universe/Treemap';
import Heatmap from '../components/universe/Heatmap';
import FundDetailPanel from '../components/universe/FundDetailPanel';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import { LENS_OPTIONS } from '../lib/lens';

const DEFAULT_THRESHOLDS = Object.fromEntries(
  LENS_OPTIONS.map((l) => [l.key, 0])
);

export default function UniversePage() {
  const router = useRouter();
  // Raw data
  const [allFunds, setAllFunds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [amcs, setAmcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [mode, setMode] = useState('scatter');
  const [xAxis, setXAxis] = useState('return_score');
  const [yAxis, setYAxis] = useState('risk_score');
  const [colorLens, setColorLens] = useState('return_score');
  const [selectedFund, setSelectedFund] = useState(null);
  const [filters, setFilters] = useState({
    lensThresholds: { ...DEFAULT_THRESHOLDS },
    selectedCategories: new Set(),
    selectedAmcs: new Set(),
  });

  const contentRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [funds, cats, amcList] = await Promise.all([
          fetchAllFunds(),
          fetchCategories().then((r) => r.data || []),
          fetchAMCs().then((r) => r.data || []),
        ]);

        setAllFunds(funds);
        setCategories(cats);
        setAmcs(amcList);

        // Initialize filters with all categories and AMCs selected
        setFilters((prev) => ({
          ...prev,
          selectedCategories: new Set(cats.map((c) => c.category_name)),
          selectedAmcs: new Set(amcList.map((a) => a.amc_name)),
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Measure chart width
  useEffect(() => {
    function measure() {
      if (contentRef.current) {
        // Full width minus filter panel (280px) minus padding
        setChartWidth(Math.max(400, contentRef.current.offsetWidth - 16));
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Apply filters
  const filteredFunds = useMemo(() => {
    return allFunds.filter((fund) => {
      // Category filter
      if (
        filters.selectedCategories.size > 0 &&
        !filters.selectedCategories.has(fund.category_name)
      ) {
        return false;
      }

      // AMC filter
      if (
        filters.selectedAmcs.size > 0 &&
        fund.amc_name &&
        !filters.selectedAmcs.has(fund.amc_name)
      ) {
        return false;
      }

      // Lens threshold filters
      for (const lens of LENS_OPTIONS) {
        const threshold = filters.lensThresholds[lens.key] || 0;
        if (threshold > 0) {
          const score = Number(fund[lens.key]) || 0;
          if (score < threshold) return false;
        }
      }

      return true;
    });
  }, [allFunds, filters]);

  const handleFundClick = useCallback((fund) => {
    setSelectedFund(fund);
  }, []);

  const handleCellClick = useCallback(
    (category, quintile) => {
      // Switch to scatter mode with matching category + lens range
      setMode('scatter');
      setFilters((prev) => ({
        ...prev,
        selectedCategories: new Set([category]),
        lensThresholds: {
          ...DEFAULT_THRESHOLDS,
          [colorLens]: quintile.min,
        },
      }));
    },
    [colorLens]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader variant="row" className="w-64" />
        <div className="flex gap-4">
          <SkeletonLoader variant="card" className="w-[280px] h-[600px]" />
          <SkeletonLoader variant="chart" className="flex-1" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={'\u26A0\uFE0F'}
        message={`Failed to load fund data: ${error}`}
        action="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Page subtitle */}
      <div className="px-6 py-3 bg-white border-b border-slate-200">
        <p className="text-sm text-slate-500">
          Explore{' '}
          <span className="font-mono font-semibold text-slate-700">
            {formatCount(allFunds.length)}
          </span>{' '}
          mutual funds across 6 intelligence lenses
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Filter panel */}
        <FilterPanel
          categories={categories}
          amcs={amcs}
          filters={filters}
          onFiltersChange={setFilters}
          xAxis={xAxis}
          yAxis={yAxis}
          onXAxisChange={setXAxis}
          onYAxisChange={setYAxis}
          mode={mode}
          filteredCount={filteredFunds.length}
          totalCount={allFunds.length}
        />

        {/* Visualization area */}
        <div ref={contentRef} className="flex-1 overflow-auto p-4 min-w-0">
          {/* Mode tabs + lens selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              {[
                { key: 'scatter', label: 'Scatter' },
                { key: 'treemap', label: 'Treemap' },
                { key: 'heatmap', label: 'Heatmap' },
              ].map((m) => (
                <Pill
                  key={m.key}
                  active={mode === m.key}
                  onClick={() => setMode(m.key)}
                >
                  {m.label}
                </Pill>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Color/lens selector for treemap + heatmap */}
              {(mode === 'treemap' || mode === 'heatmap') && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {mode === 'treemap' ? 'Color by' : 'Analyze'}:
                  </span>
                  <select
                    value={colorLens}
                    onChange={(e) => setColorLens(e.target.value)}
                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
                  >
                    {LENS_OPTIONS.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <span className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {formatCount(filteredFunds.length)}
                </span>{' '}
                of{' '}
                <span className="font-mono text-slate-500">
                  {formatCount(allFunds.length)}
                </span>
              </span>
            </div>
          </div>

          {/* Visualization */}
          {filteredFunds.length === 0 ? (
            <EmptyState
              icon={'\uD83D\uDD0D'}
              message="No funds match your current filters"
              action="Reset Filters"
              onAction={() =>
                setFilters({
                  lensThresholds: { ...DEFAULT_THRESHOLDS },
                  selectedCategories: new Set(
                    categories.map((c) => c.category_name)
                  ),
                  selectedAmcs: new Set(amcs.map((a) => a.amc_name)),
                })
              }
            />
          ) : (
            <>
              {mode === 'scatter' && (
                <BubbleScatter
                  data={filteredFunds}
                  xAxis={xAxis}
                  yAxis={yAxis}
                  onFundClick={handleFundClick}
                  width={chartWidth}
                  height={600}
                />
              )}

              {mode === 'treemap' && (
                <Treemap
                  data={filteredFunds}
                  colorLens={colorLens}
                  onFundClick={handleFundClick}
                  width={chartWidth}
                  height={500}
                />
              )}

              {mode === 'heatmap' && (
                <Heatmap
                  data={filteredFunds}
                  colorLens={colorLens}
                  onCellClick={handleCellClick}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Fund detail panel */}
      {selectedFund && (
        <FundDetailPanel
          fund={selectedFund}
          onClose={() => setSelectedFund(null)}
          onDeepDive={() => {
            router.push(`/fund360?fund=${selectedFund.mstar_id}`);
          }}
          onSimulate={() => {
            router.push(`/simulation?fund=${selectedFund.mstar_id}`);
          }}
        />
      )}
    </div>
  );
}
