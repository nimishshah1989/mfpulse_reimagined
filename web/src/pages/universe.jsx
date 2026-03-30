import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { fetchUniverseData } from '../lib/api';
import { cachedFetch } from '../lib/cache';
import { formatPct, formatAUM } from '../lib/format';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import SmartPresets, { PRESETS } from '../components/universe/SmartPresets';
import HorizontalFilterBar, { AUM_RANGES } from '../components/universe/HorizontalFilterBar';
import TierSummary from '../components/universe/TierSummary';
import IntelligencePanel from '../components/universe/IntelligencePanel';
import FundCard from '../components/universe/FundCard';
import SmartBuckets from '../components/dashboard/SmartBuckets';
import { parseNLQuery, applyNLFilters } from '../lib/nl-search';

const BubbleScatter = dynamic(
  () => import('../components/universe/BubbleScatter'),
  {
    ssr: false,
    loading: () => (
      <SkeletonLoader variant="chart" className="w-full h-full" />
    ),
  }
);

const Heatmap = dynamic(
  () => import('../components/universe/Heatmap'),
  { ssr: false, loading: () => <SkeletonLoader variant="chart" className="w-full h-full" /> }
);

const Treemap = dynamic(
  () => import('../components/universe/Treemap'),
  { ssr: false, loading: () => <SkeletonLoader variant="chart" className="w-full h-full" /> }
);

const DEFAULT_FILTERS = {
  purchaseMode: 'Both',
  categories: [],
  amcs: [],
  aumRange: 'Any AUM',
};

/** Map tier display names to class values for filtering */
const TIER_CLASS_MAP = {
  'Alpha Machine': 'ALPHA_MACHINE',
  'Positive Alpha': 'POSITIVE',
  'Neutral': 'NEUTRAL',
  'Negative Alpha': 'NEGATIVE',
};

const EQUITY_BROADS = new Set(['Equity', 'Allocation']);
const MIN_AUM_CR = 1000;
const MIN_AUM_RAW = MIN_AUM_CR * 1e7;

const GLOBAL_TOGGLES = [
  { key: 'directOnly', label: 'Direct Plans' },
  { key: 'equityOnly', label: 'Equity Only' },
  { key: 'minAum', label: `AUM > ${MIN_AUM_CR} Cr` },
];

function applyGlobalFilters(funds, globalFilters) {
  if (!funds || funds.length === 0) return [];
  let result = funds;

  if (globalFilters.directOnly) {
    result = result.filter((f) => {
      if (f.purchase_mode) return f.purchase_mode === 'Direct';
      const name = (f.fund_name || '').toLowerCase();
      return name.includes('direct') || name.includes('dir ') || name.includes('dir-');
    });
  }

  if (globalFilters.equityOnly) {
    result = result.filter((f) => EQUITY_BROADS.has(f.broad_category));
  }

  if (globalFilters.minAum) {
    result = result.filter((f) => f.aum != null && Number(f.aum) >= MIN_AUM_RAW);
  }

  // Always exclude IDCW + segregated
  result = result.filter((f) => !(f.fund_name || '').includes('IDCW'));
  result = result.filter((f) => !(f.fund_name || '').toLowerCase().includes('segregated'));

  return result;
}

export default function UniversePage() {
  const router = useRouter();
  const [allFunds, setAllFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global filters — match dashboard defaults
  const [globalFilters, setGlobalFilters] = useState({
    directOnly: true,
    equityOnly: true,
    minAum: true,
  });

  const [xAxis, setXAxis] = useState('risk_score');
  const [yAxis, setYAxis] = useState('return_1y');
  const [colorLens, setColorLens] = useState('alpha_score');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [selectedTier, setSelectedTier] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [viewMode, setViewMode] = useState('scatter');

  const [selectedFund, setSelectedFund] = useState(null);
  const [fundCardPos, setFundCardPos] = useState({ x: 0, y: 0 });
  const [hoverFund, setHoverFund] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const [searchQuery, setSearchQuery] = useState('');
  const [nlFilters, setNLFilters] = useState(null);

  const chartContainerRef = useRef(null);
  const filterBarRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(560);
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

  // ResizeObserver for chart sizing
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setChartWidth(Math.max(400, Math.floor(width)));
        setChartHeight(Math.max(400, Math.floor(height)));
        setChartMeasured(true);
      }
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [loading]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    const parsed = parseNLQuery(query);
    setNLFilters(parsed);
  }, []);

  // Comprehensive URL param parsing for cross-page linking
  useEffect(() => {
    if (!router.isReady) return;
    const { q, return_class, category, alpha_class, consistency_class, view } = router.query;

    if (q && typeof q === 'string') {
      handleSearch(q);
      setSearchQuery(q);
    }
    if (view && ['scatter', 'heatmap', 'treemap'].includes(view)) {
      setViewMode(view);
    }
    if (category && typeof category === 'string') {
      setFilters((prev) => ({ ...prev, categories: [category] }));
    }
  }, [router.isReady, router.query.q, router.query.view, router.query.category, handleSearch]);

  // Apply preset filters
  const handlePresetClick = useCallback((presetId) => {
    if (presetId === activePreset) {
      setActivePreset(null);
      return;
    }
    setActivePreset(presetId);
    if (presetId === 'custom') {
      // Scroll filter bar into view and highlight it
      filterBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }, [activePreset]);

  // Pre-compute globally filtered funds (used by SmartPresets for accurate counts)
  const globallyFiltered = useMemo(
    () => applyGlobalFilters(allFunds, globalFilters),
    [allFunds, globalFilters]
  );

  // Apply all filters (including global + preset)
  const filteredFunds = useMemo(() => {
    // Step 1: Start from globally filtered set
    let result = globallyFiltered;

    // Step 2: Pre-filter — exclude very small/young funds
    const THREE_YEARS_MS = 3 * 365.25 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    result = result.filter((fund) => {
      const aumVal = Number(fund.aum) || 0;
      if (aumVal <= 0) return false;
      const aumCr = aumVal / 10000000;
      if (aumCr < 10) return false;
      if (fund.inception_date) {
        const age = now - new Date(fund.inception_date).getTime();
        if (age < THREE_YEARS_MS) return false;
      }
      return true;
    });

    // Standard filters
    result = result.filter((fund) => {
      const { purchaseMode, categories, amcs, aumRange } = filters;
      if (purchaseMode && purchaseMode !== 'Both' && fund.purchase_mode !== purchaseMode) return false;
      if (categories.length > 0 && !categories.includes(fund.category_name)) return false;
      if (amcs.length > 0 && !amcs.includes(fund.amc_name)) return false;
      if (aumRange && aumRange !== 'Any AUM') {
        const range = AUM_RANGES.find((r) => r.label === aumRange);
        if (range) {
          const aumCr = (Number(fund.aum) || 0) / 10000000;
          if (aumCr < range.min || aumCr >= range.max) return false;
        }
      }
      return true;
    });

    // Preset filter
    if (activePreset && activePreset !== 'custom') {
      const preset = PRESETS.find((p) => p.id === activePreset);
      if (preset) {
        result = result.filter(preset.filter);
      }
    }

    // NL search filter
    if (nlFilters) {
      result = applyNLFilters(result, nlFilters);
    }

    // URL-based tier class filters (e.g., ?return_class=LEADER&alpha_class=ALPHA_MACHINE,POSITIVE)
    if (router.isReady) {
      const { return_class, alpha_class, consistency_class, risk_class, efficiency_class, resilience_class } = router.query;
      const tierParams = [
        { key: 'return_class', value: return_class },
        { key: 'alpha_class', value: alpha_class },
        { key: 'consistency_class', value: consistency_class },
        { key: 'risk_class', value: risk_class },
        { key: 'efficiency_class', value: efficiency_class },
        { key: 'resilience_class', value: resilience_class },
      ];
      for (const { key, value } of tierParams) {
        if (value && typeof value === 'string') {
          const classes = value.split(',');
          result = result.filter((f) => classes.includes(f[key]));
        }
      }
    }

    return result;
  }, [globallyFiltered, filters, activePreset, nlFilters, router.isReady, router.query]);

  // Tag funds with tier display for selected tier highlighting
  const taggedFunds = useMemo(() => {
    const classKey = {
      alpha_score: 'alpha_class',
      return_score: 'return_class',
      risk_score: 'risk_class',
      consistency_score: 'consistency_class',
      efficiency_score: 'efficiency_class',
      resilience_score: 'resilience_class',
    }[colorLens] || 'alpha_class';

    const tierDisplayMap = {
      ALPHA_MACHINE: 'Alpha Machine',
      POSITIVE: 'Positive Alpha',
      NEUTRAL: 'Neutral',
      NEGATIVE: 'Negative Alpha',
      LEADER: 'Leader',
      STRONG: 'Strong',
      AVERAGE: 'Average',
      WEAK: 'Weak',
      LOW_RISK: 'Low Risk',
      MODERATE: 'Moderate',
      ELEVATED: 'Elevated',
      HIGH_RISK: 'High Risk',
      ROCK_SOLID: 'Rock Solid',
      CONSISTENT: 'Consistent',
      MIXED: 'Mixed',
      ERRATIC: 'Erratic',
      LEAN: 'Lean',
      FAIR: 'Fair',
      EXPENSIVE: 'Expensive',
      BLOATED: 'Bloated',
      FORTRESS: 'Fortress',
      STURDY: 'Sturdy',
      FRAGILE: 'Fragile',
      VULNERABLE: 'Vulnerable',
    };

    return filteredFunds.map((f) => ({
      ...f,
      _tierDisplay: tierDisplayMap[f[classKey]] || f[classKey] || '',
    }));
  }, [filteredFunds, colorLens]);

  // Stats for left sidebar
  const stats = useMemo(() => {
    if (taggedFunds.length === 0) {
      return { avgReturn: 0, medianRisk: '--', topFundName: '--', topReturn: 0, avgAum: '--' };
    }
    const returns = taggedFunds.map((f) => Number(f.return_1y) || 0).sort((a, b) => a - b);
    const risks = taggedFunds.map((f) => Number(f.risk_score) || 0).sort((a, b) => a - b);
    const aums = taggedFunds.map((f) => (Number(f.aum) || 0) / 10000000);
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const median = (arr) =>
      arr.length % 2 === 0
        ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
        : arr[Math.floor(arr.length / 2)];

    const topFund = taggedFunds.reduce((best, f) => {
      const r = Number(f.return_1y) || 0;
      return r > (Number(best.return_1y) || 0) ? f : best;
    }, taggedFunds[0]);

    const avgAumCr = avg(aums);

    return {
      avgReturn: avg(returns),
      medianRisk: Math.round(median(risks)),
      topFundName: topFund.fund_name || topFund.legal_name || '--',
      topReturn: Number(topFund.return_1y) || 0,
      avgAum: avgAumCr >= 1000
        ? `${(avgAumCr / 1000).toFixed(1)}K Cr`
        : `${Math.round(avgAumCr).toLocaleString('en-IN')} Cr`,
    };
  }, [taggedFunds]);

  const handleHover = useCallback((fund, x, y) => {
    setHoverFund(fund || null);
    setHoverPos({ x, y });
  }, []);

  const handleFundClick = useCallback((fund, x, y) => {
    setSelectedFund(fund || null);
    setFundCardPos({ x: x || 0, y: y || 0 });
  }, []);

  const handleFundDoubleClick = useCallback((fund) => {
    if (fund?.mstar_id) router.push(`/fund360?fund=${fund.mstar_id}`);
  }, [router]);

  const handleTierClick = useCallback((tierLabel) => setSelectedTier(tierLabel), []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedTier(null);
    setActivePreset(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setSelectedFund(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) return (
    <div className="max-w-[1400px] mx-auto px-1 space-y-4">
      <SkeletonLoader variant="row" className="w-full h-12" />
      <SkeletonLoader variant="row" className="w-full h-10" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-2 space-y-3">{[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-32 rounded-xl" />)}</div>
        <SkeletonLoader variant="chart" className="col-span-7 h-[560px] rounded-xl" />
        <div className="col-span-3 space-y-3">{[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-40 rounded-xl" />)}</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-[1400px] mx-auto px-1">
      <EmptyState message={`Failed to load fund data: ${error}`} action="Retry" onAction={() => window.location.reload()} />
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-1 space-y-4">
      {/* NL Search Bar */}
      <div className="animate-in">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder='Search: "high alpha small cap funds", "return > 20%", "technology sector"...'
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>
        {nlFilters && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-slate-400">Active filters:</span>
            {nlFilters.sectors.map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full">{s}</span>
            ))}
            {nlFilters.categories.map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{c}</span>
            ))}
            {nlFilters.numericFilters.map((nf, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                {nf.field} {nf.operator === 'gt' ? '>' : '<'} {nf.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Global Filters — matching dashboard */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-2.5 animate-in">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Filters</span>
        {GLOBAL_TOGGLES.map(({ key, label }) => {
          const active = globalFilters[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setGlobalFilters((prev) => ({ ...prev, [key]: !prev[key] }))}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-lg border transition-all ${
                active
                  ? 'bg-teal-50 text-teal-700 border-teal-300 shadow-sm'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
              }`}
            >
              {active ? '\u2713 ' : ''}{label}
            </button>
          );
        })}
        <span className="text-[10px] text-slate-400 ml-auto tabular-nums">
          {taggedFunds.length.toLocaleString('en-IN')} of {allFunds.length.toLocaleString('en-IN')} funds
        </span>
      </div>

      {/* Section 1: Smart Screener Presets */}
      <SmartPresets
        allFunds={globallyFiltered}
        activePreset={activePreset}
        onPresetClick={handlePresetClick}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Section 2: Filter Bar */}
      <div ref={filterBarRef} className={activePreset === 'custom' ? 'ring-2 ring-teal-400 rounded-xl transition-all' : 'transition-all'}>
      <HorizontalFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        allFunds={globallyFiltered}
        filteredCount={taggedFunds.length}
        totalCount={allFunds.length}
        xAxis={xAxis}
        yAxis={yAxis}
        colorLens={colorLens}
        onXAxisChange={setXAxis}
        onYAxisChange={setYAxis}
        onColorChange={setColorLens}
      />
      </div>

      {/* Fund Archetype Cards — Smart Buckets */}
      <SmartBuckets universe={globallyFiltered} />

      {/* Section 3: Main 3-Column Layout (2:7:3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-in" style={{ animationDelay: '0.1s' }}>
        {/* LEFT: Stats sidebar */}
        <TierSummary
          funds={taggedFunds}
          colorLens={colorLens}
          onTierClick={handleTierClick}
          selectedTier={selectedTier}
          stats={stats}
          period="1Y"
        />

        {/* CENTER: Visualization */}
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Fund Universe{viewMode !== 'scatter' ? ` \u2014 ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View` : ''}
            </p>
            <span className="text-xs font-bold text-teal-600 tabular-nums">
              {taggedFunds.length.toLocaleString('en-IN')} funds
            </span>
          </div>
          <div
            ref={chartContainerRef}
            className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden relative"
            style={{
              height: viewMode === 'heatmap' ? 'auto' : Math.min(560, typeof window !== 'undefined' ? window.innerHeight - 240 : 560),
              minHeight: viewMode === 'heatmap' ? 400 : undefined,
            }}
          >
            {taggedFunds.length === 0 ? (
              <div className="flex items-center justify-center h-full" style={{ minHeight: 300 }}>
                <EmptyState
                  icon={<svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
                  message="No funds match your current filters"
                  action="Reset Filters"
                  onAction={handleResetFilters}
                />
              </div>
            ) : viewMode === 'scatter' ? (
              !chartMeasured ? (
                <SkeletonLoader variant="chart" className="w-full h-full" />
              ) : (
                <BubbleScatter
                  data={taggedFunds}
                  xAxis={xAxis}
                  yAxis={yAxis}
                  colorLens={colorLens}
                  onFundClick={handleFundClick}
                  onFundDoubleClick={handleFundDoubleClick}
                  onHover={handleHover}
                  width={chartWidth}
                  height={chartHeight}
                  selectedTier={selectedTier}
                />
              )
            ) : viewMode === 'heatmap' ? (
              <div className="p-4 overflow-auto" style={{ maxHeight: 600 }}>
                <Heatmap
                  data={taggedFunds}
                  colorLens={colorLens}
                  onCellClick={(category) => {
                    setFilters((prev) => ({ ...prev, categories: [category] }));
                    setViewMode('scatter');
                  }}
                />
              </div>
            ) : viewMode === 'treemap' ? (
              <Treemap
                data={taggedFunds}
                colorLens={colorLens}
                onFundClick={(fund) => handleFundClick(fund, window.innerWidth / 2 - 144, window.innerHeight / 2 - 100)}
                onFundDoubleClick={handleFundDoubleClick}
                width={chartWidth || 800}
                height={Math.min(560, typeof window !== 'undefined' ? window.innerHeight - 240 : 560)}
              />
            ) : null}
          </div>
          {/* Chart Guide — scatter only */}
          {viewMode === 'scatter' && (
            <details className="mt-2 text-[10px] text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600 font-medium">Chart Guide</summary>
              <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                <li>Click a bubble to see fund details</li>
                <li>Double-click to open Fund 360 view</li>
                <li>Scroll to zoom in/out</li>
                <li>Drag to pan across the chart</li>
                <li>Click tier labels (left) to spotlight a group</li>
              </ul>
            </details>
          )}
        </div>

        {/* RIGHT: Intelligence Panel */}
        <IntelligencePanel
          funds={taggedFunds}
          allFundsCount={allFunds.length}
          colorLens={colorLens}
          yAxis={yAxis}
          onFundClick={(fund) => {
            setSelectedFund(fund);
            setFundCardPos({ x: window.innerWidth / 2 - 144, y: window.innerHeight / 2 - 100 });
          }}
        />
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
          className="fixed z-30 pointer-events-none"
          style={{
            left: Math.min(hoverPos.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280),
            top: Math.max(hoverPos.y - 40, 8),
          }}
        >
          <div className="bg-white/97 border border-slate-200 rounded-xl shadow-lg px-3 py-2.5 max-w-64">
            <p className="text-xs font-bold text-slate-800 truncate">
              {hoverFund.fund_name || hoverFund.legal_name}
            </p>
            <p className="text-[9px] text-slate-400 truncate">
              {hoverFund.category_name || hoverFund.broad_category} &middot; AUM {formatAUM((Number(hoverFund.aum) || 0) / 10000000)}
            </p>
            <div className="flex gap-3 mt-1.5 text-[10px]">
              <span>
                <span className="text-slate-400">1Y Return: </span>
                <span className={`font-bold tabular-nums ${(Number(hoverFund.return_1y) || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPct(hoverFund.return_1y)}
                </span>
              </span>
              <span>
                <span className="text-slate-400">Risk: </span>
                <span className="font-bold tabular-nums text-slate-700">{Math.round(Number(hoverFund.risk_score) || 0)}</span>
              </span>
              <span>
                <span className="text-slate-400">Alpha: </span>
                <span className="font-bold tabular-nums text-slate-700">{Math.round(Number(hoverFund.alpha_score) || 0)}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
