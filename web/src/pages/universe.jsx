import { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { fetchUniverseData, searchFundsNL } from '../lib/api';
import { cachedFetch } from '../lib/cache';
import { formatPct, formatAUM } from '../lib/format';
import { useFilters } from '../contexts/FilterContext';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import SmartPresets, { PRESETS } from '../components/universe/SmartPresets';
import HorizontalFilterBar, { AUM_RANGES } from '../components/universe/HorizontalFilterBar';
import TierSummary from '../components/universe/TierSummary';
import IntelligencePanel from '../components/universe/IntelligencePanel';
import FundCard from '../components/universe/FundCard';
import UniverseInsights from '../components/universe/UniverseInsights';
import FilterBreadcrumbs from '../components/universe/FilterBreadcrumbs';
import ScreenerTable from '../components/universe/ScreenerTable';

const AnalyticsPanel = dynamic(
  () => import('../components/universe/AnalyticsPanel'),
  { ssr: false, loading: () => <SkeletonLoader variant="chart" className="w-full h-64" /> }
);
import { parseNLQuery, applyNLFilters } from '../lib/nl-search';

const ComparePanel = dynamic(
  () => import('../components/universe/ComparePanel'),
  { ssr: false, loading: () => <SkeletonLoader variant="chart" className="w-full h-64" /> }
);

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
  categories: [],
  amcs: [],
  aumRange: 'Any AUM',
};

/** Section tabs — no "tab" word, colored accent bands */
const SECTIONS = [
  { key: 'explorer', label: 'Explorer', band: '#0f766e', bg: '#e6f5f3' },
  { key: 'screener', label: 'Screener', band: '#1e40af', bg: '#eff6ff' },
  { key: 'analytics', label: 'Analytics', band: '#0369a1', bg: '#f0f9ff' },
  { key: 'compare', label: 'Compare', band: '#475569', bg: '#f8fafc' },
];

export default function UniversePage() {
  const router = useRouter();
  const [allFunds, setAllFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active section with transition for smooth tab switching
  const [activeSection, setActiveSection] = useState('explorer');
  const [isPending, startTransition] = useTransition();

  // Use FilterContext for global filters
  const { applyFilters: applyContextFilters } = useFilters();

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
  const [nlMatchedIds, setNLMatchedIds] = useState(null);
  const nlDebounceRef = useRef(null);

  // Compare: selected fund IDs
  const [compareFunds, setCompareFunds] = useState([]);

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
  }, [loading, activeSection]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);

    // Always set client-side parsed filters for badge display
    const parsed = parseNLQuery(query);
    setNLFilters(parsed);

    // Clear any pending debounce
    if (nlDebounceRef.current) clearTimeout(nlDebounceRef.current);

    if (!query || query.trim().length < 2) {
      setNLMatchedIds(null);
      return;
    }

    // Debounce 300ms then call backend NL search
    nlDebounceRef.current = setTimeout(async () => {
      try {
        const res = await searchFundsNL(query.trim());
        if (res?.data?.funds) {
          const ids = new Set(res.data.funds.map((f) => f.mstar_id));
          setNLMatchedIds(ids);
        } else {
          setNLMatchedIds(null);
        }
      } catch {
        // Backend failed — fall back to client-side NL filtering
        setNLMatchedIds(null);
      }
    }, 300);
  }, []);

  // Comprehensive URL param parsing for cross-page linking
  useEffect(() => {
    if (!router.isReady) return;
    const { q, return_class, category, alpha_class, consistency_class, view, section } = router.query;

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
    if (section && SECTIONS.some((s) => s.key === section)) {
      setActiveSection(section);
    }
  }, [router.isReady, router.query.q, router.query.view, router.query.category, router.query.section, handleSearch]);

  // Apply preset filters
  const handlePresetClick = useCallback((presetId) => {
    if (presetId === activePreset) {
      setActivePreset(null);
      return;
    }
    setActivePreset(presetId);
    if (presetId === 'custom') {
      filterBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }, [activePreset]);

  // Pre-compute globally filtered funds via FilterContext
  const globallyFiltered = useMemo(
    () => applyContextFilters(allFunds),
    [allFunds, applyContextFilters]
  );

  // Apply all filters
  const filteredFunds = useMemo(() => {
    let result = globallyFiltered;

    // Pre-filter — exclude very small/young funds
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

    // Standard filters (page-specific: AMC, Category, AUM range)
    result = result.filter((fund) => {
      const { categories, amcs, aumRange } = filters;
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

    // NL search filter — prefer backend matched IDs, fall back to client-side
    if (nlMatchedIds && nlMatchedIds.size > 0) {
      result = result.filter((f) => nlMatchedIds.has(f.mstar_id));
    } else if (nlFilters && !nlMatchedIds) {
      result = applyNLFilters(result, nlFilters);
    }

    // URL-based tier class filters
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
  }, [globallyFiltered, filters, activePreset, nlFilters, nlMatchedIds, router.isReady, router.query]);

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
    setSearchQuery('');
    setNLFilters(null);
    setNLMatchedIds(null);
  }, []);

  // Compare handlers
  const handleToggleCompare = useCallback((mstarId) => {
    setCompareFunds((prev) => {
      if (prev.includes(mstarId)) return prev.filter((id) => id !== mstarId);
      if (prev.length >= 5) return prev;
      return [...prev, mstarId];
    });
  }, []);

  const handleRemoveCompare = useCallback((mstarId) => {
    setCompareFunds((prev) => prev.filter((id) => id !== mstarId));
  }, []);

  const handleAddCompare = useCallback((mstarId) => {
    setCompareFunds((prev) => {
      if (prev.includes(mstarId) || prev.length >= 5) return prev;
      return [...prev, mstarId];
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setSelectedFund(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-switch to compare when 2+ funds selected from screener
  useEffect(() => {
    if (compareFunds.length >= 2 && activeSection === 'screener') {
      // Don't auto-switch, just show the hint in screener
    }
  }, [compareFunds.length, activeSection]);

  if (loading) return (
    <div className="max-w-[1440px] mx-auto space-y-5">
      <SkeletonLoader variant="row" className="w-full h-12" />
      <SkeletonLoader variant="row" className="w-full h-10" />
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-3 space-y-4">{[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-32 rounded-xl" />)}</div>
        <SkeletonLoader variant="chart" className="col-span-6 h-[560px] rounded-xl" />
        <div className="col-span-3 space-y-4">{[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-40 rounded-xl" />)}</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-[1440px] mx-auto">
      <EmptyState message={`Failed to load fund data: ${error}`} action="Retry" onAction={() => window.location.reload()} />
    </div>
  );

  const currentSection = SECTIONS.find((s) => s.key === activeSection) || SECTIONS[0];

  return (
    <div className="max-w-[1440px] mx-auto space-y-5">
      {/* NL Search Bar */}
      <div className="animate-in">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder='Search: "high alpha small cap funds", "return > 20%", "technology sector"...'
            className="w-full px-5 py-3 text-sm glass-card focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg"
            >
              ×
            </button>
          )}
        </div>
        {nlFilters && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-xs text-slate-400">Active filters:</span>
            {nlFilters.sectors.map((s) => (
              <span key={s} className="text-xs px-2.5 py-0.5 bg-teal-50 text-teal-700 rounded-full font-medium">{s}</span>
            ))}
            {nlFilters.categories.map((c) => (
              <span key={c} className="text-xs px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{c}</span>
            ))}
            {nlFilters.numericFilters.map((nf, i) => (
              <span key={i} className="text-xs px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                {nf.field} {nf.operator === 'gt' ? '>' : '<'} {nf.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Fund count — global filters controlled from Dashboard FilterContext */}
      <div className="flex items-center justify-between glass-card px-5 py-3 animate-in">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fund Universe</span>
        <span className="text-xs text-slate-400 tabular-nums font-medium">
          {taggedFunds.length.toLocaleString('en-IN')} of {allFunds.length.toLocaleString('en-IN')} funds
        </span>
      </div>

      {/* Filter Breadcrumbs */}
      <FilterBreadcrumbs
        filters={filters}
        globalFilters={{}}
        activePreset={activePreset}
        selectedTier={selectedTier}
        searchQuery={searchQuery}
        onRemoveCategory={(cat) =>
          setFilters((prev) => ({
            ...prev,
            categories: prev.categories.filter((c) => c !== cat),
          }))
        }
        onRemoveAmc={(amc) =>
          setFilters((prev) => ({
            ...prev,
            amcs: prev.amcs.filter((a) => a !== amc),
          }))
        }
        onRemovePreset={() => setActivePreset(null)}
        onRemoveTier={() => setSelectedTier(null)}
        onRemoveSearch={() => { setSearchQuery(''); setNLFilters(null); setNLMatchedIds(null); }}
        onClearAll={handleResetFilters}
      />

      {/* Section Navigation */}
      <div className="flex gap-0 border-b-2 border-slate-200 animate-in">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => startTransition(() => setActiveSection(s.key))}
            className={`px-7 py-3.5 text-[13px] font-semibold tracking-wide transition-all border-b-[2.5px] -mb-[2px] ${
              activeSection === s.key
                ? 'border-current'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            style={activeSection === s.key ? { color: s.band } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section Band Header */}
      <div
        className={`px-5 py-3.5 rounded-r-xl flex items-center justify-between animate-in transition-opacity ${isPending ? 'opacity-60' : ''}`}
        style={{
          borderLeft: `4px solid ${currentSection.band}`,
          background: currentSection.bg,
        }}
      >
        <h2 className="text-[15px] font-extrabold text-slate-900 tracking-tight">
          {currentSection.label}
        </h2>
        <p className="text-xs text-slate-500">
          {activeSection === 'explorer' && 'Visual discovery — scatter, heatmap, treemap'}
          {activeSection === 'screener' && 'Sortable table with risk metrics, quartile ranks, lens scores'}
          {activeSection === 'analytics' && 'Aggregated views across filtered universe'}
          {activeSection === 'compare' && 'Head-to-head fund analysis — select from screener'}
        </p>
      </div>

      {/* ═══════════════════════════════════════
           EXPLORER SECTION
           ═══════════════════════════════════════ */}
      {activeSection === 'explorer' && (
        <>
          {/* Smart Screener Presets */}
          <SmartPresets
            allFunds={globallyFiltered}
            activePreset={activePreset}
            onPresetClick={handlePresetClick}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* Filter Bar */}
          <div ref={filterBarRef} className={activePreset === 'custom' ? 'ring-2 ring-teal-400 rounded-2xl transition-all' : 'transition-all'}>
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

          {/* Main 3-Column Layout (3:6:3) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in" style={{ animationDelay: '0.1s' }}>
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
            <div className="col-span-12 lg:col-span-6">
              <div className="flex items-center justify-between mb-3">
                <p className="section-title">
                  Fund Universe{viewMode !== 'scatter' ? ` \u2014 ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View` : ''}
                </p>
                <span className="text-sm font-bold text-teal-600 tabular-nums">
                  {taggedFunds.length.toLocaleString('en-IN')} funds
                </span>
              </div>
              <div
                ref={chartContainerRef}
                className="glass-card overflow-hidden relative"
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
              {viewMode === 'scatter' && (
                <details className="mt-3 glass-card px-4 py-2.5 text-xs text-slate-500" open>
                  <summary className="cursor-pointer hover:text-slate-600 font-medium">How to read this chart</summary>
                  <ul className="mt-1.5 space-y-1 pl-4 list-disc text-[11px]">
                    <li><strong>X-axis:</strong> Risk Score (0-100, selected above). Higher = riskier.</li>
                    <li><strong>Y-axis:</strong> 1Y Return %. Higher = better performance.</li>
                    <li><strong>Bubble size:</strong> AUM — bigger circles = larger funds.</li>
                    <li><strong>Bubble color:</strong> Lens score (selected as Color above). Green = high, Red = low.</li>
                    <li>Top-left = sweet spot (high return, low risk). Bottom-right = avoid (low return, high risk).</li>
                    <li>Click bubble for details. Double-click for Fund 360. Scroll to zoom. Drag to pan.</li>
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

          {/* Below-scatter: Universe Insights */}
          <UniverseInsights
            funds={taggedFunds}
            onCategoryClick={(cat) => {
              setFilters((prev) => ({ ...prev, categories: [cat] }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      {/* ═══════════════════════════════════════
           SCREENER SECTION
           ═══════════════════════════════════════ */}
      {activeSection === 'screener' && (
        <ScreenerTable
          funds={taggedFunds}
          selectedFunds={compareFunds}
          onToggleFund={handleToggleCompare}
          onFundClick={handleFundClick}
        />
      )}

      {/* ═══════════════════════════════════════
           ANALYTICS SECTION
           ═══════════════════════════════════════ */}
      {activeSection === 'analytics' && (
        <AnalyticsPanel funds={taggedFunds} />
      )}

      {/* ═══════════════════════════════════════
           COMPARE SECTION
           ═══════════════════════════════════════ */}
      {activeSection === 'compare' && (
        <ComparePanel
          funds={taggedFunds}
          selectedFundIds={compareFunds}
          onRemoveFund={handleRemoveCompare}
          onAddFund={handleAddCompare}
          allFunds={taggedFunds}
        />
      )}

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
          <div className="glass-card px-3.5 py-3 max-w-72 shadow-xl">
            <p className="text-sm font-bold text-slate-800 truncate">
              {hoverFund.fund_name || hoverFund.legal_name}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {hoverFund.category_name || hoverFund.broad_category} &middot; AUM {formatAUM((Number(hoverFund.aum) || 0) / 10000000)}
            </p>
            <div className="flex gap-3 mt-2 text-xs">
              <span>
                <span className="text-slate-400">1Y: </span>
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
