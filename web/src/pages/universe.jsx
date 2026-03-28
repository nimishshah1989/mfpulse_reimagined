import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { fetchUniverseData } from '../lib/api';
import { cachedFetch } from '../lib/cache';
import { formatCount, formatPct, formatAUM } from '../lib/format';
import { LENS_OPTIONS, lensLabel, LENS_LABELS } from '../lib/lens';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import HorizontalFilterBar, { AUM_RANGES } from '../components/universe/HorizontalFilterBar';
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

/* ── Float Stats Card ─────────────────────────────────────── */
function StatCard({ label, value, sub, trend }) {
  return (
    <div className="bg-gradient-to-br from-white to-slate-50/80 border-[0.5px] border-slate-200/40 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03),0_8px_32px_rgba(0,0,0,0.04)] px-3 py-2.5 hover:-translate-y-0.5 transition-all duration-[400ms]">
      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="font-mono text-lg font-bold tabular-nums text-slate-800 mt-0.5 leading-tight">{value}</p>
      {sub && (
        <p className={`text-[10px] mt-0.5 ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function UniversePage() {
  const [allFunds, setAllFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [xAxis, setXAxis] = useState('return_score');
  const [yAxis, setYAxis] = useState('risk_score');
  const [colorLens, setColorLens] = useState('alpha_score');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [selectedTier, setSelectedTier] = useState(null);

  const [intelCollapsed, setIntelCollapsed] = useState(false);

  const [selectedFund, setSelectedFund] = useState(null);
  const [fundCardPos, setFundCardPos] = useState({ x: 0, y: 0 });
  const [hoverFund, setHoverFund] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(600);
  const [chartMeasured, setChartMeasured] = useState(false);

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

  useEffect(() => {
    function measure() {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        setChartWidth(Math.max(400, Math.floor(rect.width)));
        setChartHeight(Math.max(400, Math.floor(rect.height)));
        setChartMeasured(true);
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading, intelCollapsed]);

  const effectiveXAxis = useMemo(() => xAxis, [xAxis]);

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
      const { purchaseMode, dividendType, broadCategories, categories, amcs, aumRange, lensFilters } = filters;
      if (purchaseMode !== 'Both' && fund.purchase_mode !== purchaseMode) return false;
      if (dividendType !== 'Both' && fund.dividend_type !== dividendType) return false;
      if (broadCategories.length > 0 && !broadCategories.includes(fund.broad_category)) return false;
      if (categories.length > 0 && !categories.includes(fund.category_name)) return false;
      if (amcs.length > 0 && !amcs.includes(fund.amc_name)) return false;
      if (aumRange !== 'All') {
        const range = AUM_RANGES.find((r) => r.label === aumRange);
        if (range) {
          const aumCr = (Number(fund.aum) || 0) / 10000000;
          if (aumCr < range.min || aumCr >= range.max) return false;
        }
      }
      for (const [key, range] of Object.entries(lensFilters)) {
        if (!range) continue;
        const score = Number(fund[key]) || 0;
        if (score < range.min || score > range.max) return false;
      }
      return true;
    });
  }, [allFunds, filters]);

  const taggedFunds = useMemo(() => {
    const activeLens = colorLens || 'return_score';
    return filteredFunds.map((f) => ({
      ...f,
      _tierLabel: lensLabel(Number(f[activeLens]) || 0),
    }));
  }, [filteredFunds, colorLens]);

  // Stats for the left column
  const stats = useMemo(() => {
    if (taggedFunds.length === 0) return { avgReturn: '--', medianRisk: '--', topFund: '--', avgAum: '--' };
    const retKey = PERIOD_RETURN_KEY[filters.period] || 'return_1y';
    const returns = taggedFunds.map((f) => Number(f[retKey]) || 0).sort((a, b) => a - b);
    const risks = taggedFunds.map((f) => Number(f.risk_score) || 0).sort((a, b) => a - b);
    const aums = taggedFunds.map((f) => (Number(f.aum) || 0) / 10000000);
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const median = (arr) => arr.length % 2 === 0 ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2 : arr[Math.floor(arr.length / 2)];
    const topIdx = returns.length - 1;
    const topReturn = returns[topIdx];
    const avgAumCr = avg(aums);
    return {
      avgReturn: `${avg(returns).toFixed(1)}%`,
      medianRisk: Math.round(median(risks)),
      topReturn: `${topReturn.toFixed(1)}%`,
      avgAum: avgAumCr >= 1000 ? `${(avgAumCr / 1000).toFixed(1)}K Cr` : `${Math.round(avgAumCr)} Cr`,
    };
  }, [taggedFunds, filters.period]);

  const handleHover = useCallback((fund, x, y) => {
    setHoverFund(fund || null);
    setHoverPos({ x, y });
  }, []);

  const handleFundClick = useCallback((fund, x, y) => {
    setSelectedFund(fund || null);
    setFundCardPos({ x: x || 0, y: y || 0 });
  }, []);

  const handleFundDoubleClick = useCallback((fund) => {
    if (fund?.mstar_id) window.location.href = `/fund360?fund=${fund.mstar_id}`;
  }, []);

  const handleTierClick = useCallback((tierLabel) => setSelectedTier(tierLabel), []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedTier(null);
  }, []);

  const handleIntelFundClick = useCallback((fund) => {
    setSelectedFund(fund);
    setFundCardPos({ x: window.innerWidth / 2 - 144, y: window.innerHeight / 2 - 100 });
  }, []);

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
        <div className="px-3 py-2 space-y-2">
          <SkeletonLoader variant="row" className="w-full h-8" />
          <SkeletonLoader variant="row" className="w-full h-6" />
        </div>
        <div className="flex flex-1">
          <div className="w-36 p-2 space-y-2">
            {[1, 2, 3, 4].map((i) => <SkeletonLoader key={i} className="h-16 rounded-2xl" />)}
          </div>
          <SkeletonLoader variant="chart" className="flex-1 min-h-[400px]" />
          <div className="w-72 p-2 space-y-3">
            <SkeletonLoader className="h-16 rounded-xl" />
            <SkeletonLoader className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
        message={`Failed to load fund data: ${error}`}
        action="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Row 1: Horizontal Filter Bar */}
      <div className="bg-gradient-to-br from-white to-slate-50/50 border-b-[0.5px] border-slate-200/40 px-3 py-2 flex-shrink-0">
        <HorizontalFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          allFunds={allFunds}
          filteredCount={taggedFunds.length}
          totalCount={allFunds.length}
        />
      </div>

      {/* Row 2: Axis controls toolbar */}
      <div className="bg-white/80 backdrop-blur-sm border-b-[0.5px] border-slate-200/30 px-3 py-1 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">X</label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value)}
            className="text-[11px] border-[0.5px] border-slate-200/60 rounded-full px-2.5 py-0.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400/50"
          >
            {xAxisOptions.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>
        <span className="text-slate-300 text-[10px]">vs</span>
        <div className="flex items-center gap-1.5">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Y</label>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value)}
            className="text-[11px] border-[0.5px] border-slate-200/60 rounded-full px-2.5 py-0.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400/50"
          >
            {LENS_OPTIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>
        <div className="w-px h-3.5 bg-slate-200/50" />
        <div className="flex items-center gap-1.5">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Color</label>
          <select
            value={colorLens}
            onChange={(e) => setColorLens(e.target.value)}
            className="text-[11px] border-[0.5px] border-slate-200/60 rounded-full px-2.5 py-0.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400/50"
          >
            {LENS_OPTIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Row 3: Tier summary */}
      <TierSummary
        funds={taggedFunds}
        colorLens={colorLens}
        onTierClick={handleTierClick}
        selectedTier={selectedTier}
      />

      {/* Main: StatsColumn | Chart | IntelPanel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Stats Column */}
        <div className="w-36 flex-shrink-0 p-2 space-y-2 overflow-y-auto hidden lg:flex flex-col">
          <StatCard
            label={`Avg ${filters.period} Return`}
            value={stats.avgReturn}
            sub={`${taggedFunds.length} funds`}
          />
          <StatCard
            label="Median Risk"
            value={stats.medianRisk}
            sub="Score 0-100"
          />
          <StatCard
            label={`Top ${filters.period}`}
            value={stats.topReturn}
            sub="Best performer"
            trend="up"
          />
          <StatCard
            label="Avg AUM"
            value={stats.avgAum}
            sub="Per fund"
          />
        </div>

        {/* Center: Scatter Chart */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-50/50">
          <div ref={chartContainerRef} className="flex-1 min-h-0 max-h-[700px] relative">
            {taggedFunds.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={<svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
                  message="No funds match your current filters"
                  action="Reset Filters"
                  onAction={handleResetFilters}
                />
              </div>
            ) : !chartMeasured ? (
              <SkeletonLoader variant="chart" className="flex-1 min-h-[400px]" />
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
          <div className="fixed inset-0 z-40" onClick={() => setSelectedFund(null)} />
          <FundCard
            fund={selectedFund}
            x={fundCardPos.x}
            y={fundCardPos.y}
            onClose={() => setSelectedFund(null)}
          />
        </>
      )}

      {/* Hover tooltip */}
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
