import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { fetchUniverseData } from '../lib/api';
import { cachedFetch } from '../lib/cache';
import { formatCount } from '../lib/format';
import { LENS_OPTIONS, lensLabel, LENS_LABELS } from '../lib/lens';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import FilterSidebar, { AUM_RANGES } from '../components/universe/FilterSidebar';
import TierSummary from '../components/universe/TierSummary';
import IntelligencePanel from '../components/universe/IntelligencePanel';
import FundCard from '../components/universe/FundCard';

const BubbleScatter = dynamic(
  () => import('../components/universe/BubbleScatter'),
  {
    ssr: false,
    loading: () => (
      <SkeletonLoader variant="chart" className="flex-1 min-h-[500px]" />
    ),
  }
);

const DEFAULT_FILTERS = {
  purchaseMode: 'Regular',
  dividendType: 'Growth',
  broadCategories: [],
  categories: [],
  amcs: [],
  aumRange: 'All',
  lensFilters: {},
  period: '1Y',
};

const PERIOD_RETURN_KEY = {
  '1Y': 'return_1y',
  '3Y': 'return_3y',
  '5Y': 'return_5y',
};

export default function UniversePage() {
  // Raw data
  const [allFunds, setAllFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [xAxis, setXAxis] = useState('return_score');
  const [yAxis, setYAxis] = useState('risk_score');
  const [colorLens, setColorLens] = useState('alpha_score');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [selectedTier, setSelectedTier] = useState(null);

  // Panel state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [intelCollapsed, setIntelCollapsed] = useState(false);

  // FundCard popup
  const [selectedFund, setSelectedFund] = useState(null);
  const [fundCardPos, setFundCardPos] = useState({ x: 0, y: 0 });

  // Hover state (for tooltip)
  const [hoverFund, setHoverFund] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(600);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const funds = await cachedFetch('universe', fetchUniverseData, 600);
        setAllFunds(funds);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Measure chart container dimensions
  useEffect(() => {
    function measure() {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        setChartWidth(Math.max(400, Math.floor(rect.width)));
        setChartHeight(Math.max(400, Math.floor(rect.height)));
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading, sidebarCollapsed, intelCollapsed]);

  // Determine X-axis key based on period
  const effectiveXAxis = useMemo(() => {
    const returnKey = PERIOD_RETURN_KEY[filters.period];
    // If user has return_score selected and period changes, switch to return field
    if (xAxis === 'return_score' || PERIOD_RETURN_KEY[filters.period]) {
      // For the scatter, use the return field for the selected period
    }
    return xAxis;
  }, [xAxis, filters.period]);

  // X-axis options: lens scores + period returns
  const xAxisOptions = useMemo(() => {
    const returnKey = PERIOD_RETURN_KEY[filters.period] || 'return_1y';
    const returnLabel = `${filters.period || '1Y'} Return (%)`;
    return [
      { key: returnKey, label: returnLabel },
      ...LENS_OPTIONS,
    ];
  }, [filters.period]);

  // Apply all filters
  const filteredFunds = useMemo(() => {
    return allFunds.filter((fund) => {
      const {
        purchaseMode,
        dividendType,
        broadCategories,
        categories,
        amcs,
        aumRange,
        lensFilters,
      } = filters;

      // Purchase mode
      if (purchaseMode !== 'Both' && fund.purchase_mode !== purchaseMode) return false;

      // Dividend type
      if (dividendType !== 'Both' && fund.dividend_type !== dividendType) return false;

      // Broad categories (multi-select)
      if (broadCategories.length > 0 && !broadCategories.includes(fund.broad_category)) {
        return false;
      }

      // Categories (multi-select)
      if (categories.length > 0 && !categories.includes(fund.category_name)) return false;

      // AMCs (multi-select)
      if (amcs.length > 0 && !amcs.includes(fund.amc_name)) return false;

      // AUM range
      if (aumRange !== 'All') {
        const range = AUM_RANGES.find((r) => r.label === aumRange);
        if (range) {
          const aumCr = (Number(fund.aum) || 0) / 10000000;
          if (aumCr < range.min || aumCr >= range.max) return false;
        }
      }

      // Lens filters
      for (const [key, range] of Object.entries(lensFilters)) {
        if (!range) continue;
        const score = Number(fund[key]) || 0;
        if (score < range.min || score > range.max) return false;
      }

      return true;
    });
  }, [allFunds, filters]);

  // Tag each fund with tier label for BubbleScatter dimming
  const taggedFunds = useMemo(() => {
    const activeLens = colorLens || 'return_score';
    return filteredFunds.map((f) => ({
      ...f,
      _tierLabel: lensLabel(Number(f[activeLens]) || 0),
    }));
  }, [filteredFunds, colorLens]);

  const handleHover = useCallback((fund, x, y) => {
    setHoverFund(fund || null);
    setHoverPos({ x, y });
  }, []);

  const handleFundClick = useCallback((fund, x, y) => {
    setSelectedFund(fund || null);
    setFundCardPos({ x: x || 0, y: y || 0 });
  }, []);

  const handleFundDoubleClick = useCallback((fund) => {
    if (fund?.mstar_id) {
      window.location.href = `/fund360?fund=${fund.mstar_id}`;
    }
  }, []);

  const handleTierClick = useCallback((tierLabel) => {
    setSelectedTier(tierLabel);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedTier(null);
  }, []);

  const handleIntelFundClick = useCallback((fund) => {
    // Show FundCard at center of screen
    setSelectedFund(fund);
    setFundCardPos({ x: window.innerWidth / 2 - 144, y: window.innerHeight / 2 - 100 });
  }, []);

  // Close FundCard on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setSelectedFund(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col -m-6">
        <div className="flex flex-1">
          <div className="w-60 bg-white border-r border-slate-200 p-3 space-y-4">
            <SkeletonLoader variant="row" className="w-full h-8" />
            <SkeletonLoader variant="row" className="w-full h-6" />
            <SkeletonLoader variant="row" className="w-full h-6" />
            <SkeletonLoader variant="row" className="w-full h-6" />
            <SkeletonLoader variant="row" className="w-full h-24" />
          </div>
          <div className="flex-1 flex flex-col">
            <SkeletonLoader variant="row" className="w-full h-8" />
            <SkeletonLoader variant="chart" className="flex-1 min-h-[400px]" />
          </div>
          <div className="w-72 bg-white border-l border-slate-200 p-3 space-y-4">
            <SkeletonLoader variant="row" className="w-full h-16" />
            <SkeletonLoader variant="row" className="w-full h-32" />
            <SkeletonLoader variant="row" className="w-full h-24" />
          </div>
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
      {/* Top toolbar: axis controls + fund count */}
      <div className="bg-white border-b border-slate-200 px-4 py-1.5 flex items-center gap-3 flex-shrink-0">
        {/* X axis selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            X
          </label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:border-teal-400 focus:outline-none"
          >
            {xAxisOptions.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-300 text-xs">vs</span>

        {/* Y axis selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Y
          </label>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:border-teal-400 focus:outline-none"
          >
            {LENS_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 border-l border-slate-200" />

        {/* Color selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Color
          </label>
          <select
            value={colorLens}
            onChange={(e) => setColorLens(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:border-teal-400 focus:outline-none"
          >
            {LENS_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Spacer + counts */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-700 tabular-nums">
              {formatCount(taggedFunds.length)}
            </span>
            {' / '}
            <span className="font-mono text-slate-400 tabular-nums">
              {formatCount(allFunds.length)}
            </span>{' '}
            funds
          </span>
        </div>
      </div>

      {/* Tier summary bar */}
      <TierSummary
        funds={taggedFunds}
        colorLens={colorLens}
        onTierClick={handleTierClick}
        selectedTier={selectedTier}
      />

      {/* Main three-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Filter Sidebar */}
        <FilterSidebar
          filters={filters}
          onFiltersChange={setFilters}
          allFunds={allFunds}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Center: Scatter Chart */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
          <div ref={chartContainerRef} className="flex-1 min-h-0 relative">
            {taggedFunds.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={'\uD83D\uDD0D'}
                  message="No funds match your current filters"
                  action="Reset Filters"
                  onAction={handleResetFilters}
                />
              </div>
            ) : (
              <BubbleScatter
                data={taggedFunds}
                xAxis={xAxis}
                yAxis={yAxis}
                colorLens={colorLens}
                period={filters.period}
                onFundClick={handleFundClick}
                onFundDoubleClick={handleFundDoubleClick}
                onHover={handleHover}
                width={chartWidth}
                height={chartHeight}
                selectedTier={selectedTier}
              />
            )}
          </div>
        </div>

        {/* Right: Intelligence Panel */}
        <div className="hidden xl:flex">
          <IntelligencePanel
            funds={taggedFunds}
            allFundsCount={allFunds.length}
            colorLens={colorLens}
            xAxis={xAxis}
            yAxis={yAxis}
            onFundClick={handleIntelFundClick}
            collapsed={intelCollapsed}
            onToggleCollapse={() => setIntelCollapsed(!intelCollapsed)}
          />
        </div>
      </div>

      {/* FundCard popup */}
      {selectedFund && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setSelectedFund(null)}
          />
          <FundCard
            fund={selectedFund}
            x={fundCardPos.x}
            y={fundCardPos.y}
            onClose={() => setSelectedFund(null)}
          />
        </>
      )}

      {/* Hover tooltip (lightweight) */}
      {hoverFund && !selectedFund && (
        <div
          className="fixed z-30 bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none text-[11px] max-w-64"
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 260),
            top: Math.max(hoverPos.y - 40, 8),
          }}
        >
          <p className="font-medium truncate">{hoverFund.fund_name || hoverFund.legal_name}</p>
          <p className="text-slate-300 text-[10px] truncate">{hoverFund.amc_name}</p>
          <p className="text-slate-400 text-[9px] mt-0.5">Click for details</p>
        </div>
      )}
    </div>
  );
}
