import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  fetchCategories,
  fetchAMCs,
  fetchUniverseData,
} from '../../lib/api';
import { cachedFetch } from '../../lib/cache';
import { formatPct, formatAUM, formatCount } from '../../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS, scoreColor } from '../../lib/lens';
import SkeletonLoader from '../shared/SkeletonLoader';
import EmptyState from '../shared/EmptyState';
import SmartBuckets from './SmartBuckets';
import FundCardGrid from './FundCardGrid';
import FundListView from './FundListView';

/* ---- Constants ---- */
const BROAD_CATEGORIES = ['All', 'Equity', 'Fixed Income', 'Allocation', 'Alternative Strategies'];
const PURCHASE_MODES = [
  { label: 'Both', value: 0 },
  { label: 'Direct', value: 2 },
  { label: 'Regular', value: 1 },
];
const SORT_OPTIONS = [
  { label: 'Top Funds (AUM + 3Y)', value: 'composite_desc' },
  { label: '1Y Return \u2193', value: 'return_1y_desc' },
  { label: '1Y Return \u2191', value: 'return_1y_asc' },
  { label: 'AUM \u2193', value: 'aum_desc' },
  { label: 'Fund Name A-Z', value: 'name_asc' },
  { label: 'Return Score \u2193', value: 'return_score_desc' },
  { label: 'Risk Score \u2193', value: 'risk_score_desc' },
  { label: 'Alpha Score \u2193', value: 'alpha_score_desc' },
  { label: 'Sharpe Ratio \u2193', value: 'sharpe_desc' },
  { label: 'Consistency \u2193', value: 'consistency_score_desc' },
];

const LENS_FILTER_CHIPS = [
  { key: 'return_class', label: 'Return: Leader', value: 'LEADER', color: '#059669' },
  { key: 'risk_class', label: 'Risk: Low Risk', value: 'LOW_RISK', color: '#0d9488' },
  { key: 'alpha_class', label: 'Alpha: Positive+', values: ['ALPHA_MACHINE', 'POSITIVE'], color: '#2563eb' },
  { key: 'consistency_class', label: 'Consistency: Consistent+', values: ['ROCK_SOLID', 'CONSISTENT'], color: '#4f46e5' },
  { key: 'efficiency_class', label: 'Efficiency: Lean', value: 'LEAN', color: '#d97706' },
  { key: 'resilience_class', label: 'Resilience: Fortress', value: 'FORTRESS', color: '#7c3aed' },
];

const RECENT_KEY = 'mfpulse_recently_viewed';

function getRecentlyViewed() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5);
  } catch { return []; }
}

function addRecentlyViewed(fund) {
  if (typeof window === 'undefined' || !fund) return;
  try {
    const recent = getRecentlyViewed().filter((r) => r.mstar_id !== fund.mstar_id);
    recent.unshift({
      mstar_id: fund.mstar_id,
      fund_name: fund.fund_name || fund.legal_name || fund.mstar_id,
      return_1y: fund.return_1y,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
  } catch { /* silent */ }
}

/**
 * FundSearch -- the Fund 360 explorer page.
 * Features: universe stats, smart buckets, lens filter chips, grid/list toggle,
 * recently viewed, NL search hints, enhanced sort options.
 */
export default function FundSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [amcs, setAmcs] = useState([]);
  const [selectedBroad, setSelectedBroad] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAmc, setSelectedAmc] = useState('');
  const [activeBucket, setActiveBucket] = useState(null);
  const [bucketFundIds, setBucketFundIds] = useState([]);
  const [universe, setUniverse] = useState([]);
  const [universeLoading, setUniverseLoading] = useState(true);
  const [purchaseMode, setPurchaseMode] = useState(2); // Default: Direct
  const [sortBy, setSortBy] = useState('composite_desc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [activeLensFilters, setActiveLensFilters] = useState(new Set());
  const [recentFunds, setRecentFunds] = useState([]);
  const searchRef = useRef(null);

  // Load data
  useEffect(() => {
    Promise.allSettled([fetchCategories(), fetchAMCs()]).then(([catRes, amcRes]) => {
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data || []);
      if (amcRes.status === 'fulfilled') setAmcs(amcRes.value.data || []);
    });
    setUniverseLoading(true);
    cachedFetch('universe', fetchUniverseData, 600)
      .then((data) => {
        setUniverse(data);
        setUniverseLoading(false);
      })
      .catch(() => setUniverseLoading(false));
    setRecentFunds(getRecentlyViewed());
  }, []);

  // Keyboard shortcut: Cmd+K focuses search
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clear bucket when manual filters change
  useEffect(() => {
    if (query.length >= 2 || selectedCategory || selectedAmc || selectedBroad !== 'All') {
      setActiveBucket(null);
      setBucketFundIds([]);
    }
  }, [query, selectedCategory, selectedAmc, selectedBroad, purchaseMode]);

  const handleBucketSelect = useCallback((bucketId, fundIds) => {
    setActiveBucket(bucketId);
    setBucketFundIds(fundIds || []);
    setQuery('');
    setSelectedCategory('');
    setSelectedAmc('');
    setSelectedBroad('All');
    setPurchaseMode(2);
    setActiveLensFilters(new Set());
  }, []);

  const handleFundSelect = useCallback((mstarId) => {
    const fund = universe.find((f) => f.mstar_id === mstarId);
    if (fund) addRecentlyViewed(fund);
    onSelect(mstarId);
  }, [universe, onSelect]);

  const toggleLensFilter = useCallback((chipIndex) => {
    setActiveLensFilters((prev) => {
      const next = new Set(prev);
      if (next.has(chipIndex)) next.delete(chipIndex);
      else next.add(chipIndex);
      return next;
    });
    setActiveBucket(null);
    setBucketFundIds([]);
  }, []);

  const filteredCategories = useMemo(() =>
    selectedBroad === 'All'
      ? categories
      : categories.filter((c) => c.broad_category === selectedBroad),
    [selectedBroad, categories],
  );

  // Sort function
  const sortFn = useCallback((a, b) => {
    switch (sortBy) {
      case 'composite_desc': {
        // Composite: AUM rank + 3Y return rank — shows top recognizable, high-performing funds
        const aumA = Number(a.aum) || 0, aumB = Number(b.aum) || 0;
        const retA = Number(a.return_3y) || Number(a.return_1y) || -999;
        const retB = Number(b.return_3y) || Number(b.return_1y) || -999;
        // Weighted: 40% AUM rank + 60% return rank (normalize to 0-1 scale)
        const maxAum = Math.max(aumA, aumB, 1);
        const scoreA = (aumA / maxAum) * 0.4 + (retA > 0 ? retA / 100 : 0) * 0.6;
        const scoreB = (aumB / maxAum) * 0.4 + (retB > 0 ? retB / 100 : 0) * 0.6;
        return scoreB - scoreA;
      }
      case 'return_1y_desc': return (Number(b.return_1y) || -999) - (Number(a.return_1y) || -999);
      case 'return_1y_asc': return (Number(a.return_1y) || -999) - (Number(b.return_1y) || -999);
      case 'aum_desc': return (Number(b.aum) || 0) - (Number(a.aum) || 0);
      case 'name_asc': return (a.fund_name || '').localeCompare(b.fund_name || '');
      case 'return_score_desc': return (Number(b.return_score) || 0) - (Number(a.return_score) || 0);
      case 'risk_score_desc': return (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0);
      case 'alpha_score_desc': return (Number(b.alpha_score) || 0) - (Number(a.alpha_score) || 0);
      case 'sharpe_desc': return (Number(b.sharpe_3y) || -999) - (Number(a.sharpe_3y) || -999);
      case 'consistency_score_desc': return (Number(b.consistency_score) || 0) - (Number(a.consistency_score) || 0);
      default: return 0;
    }
  }, [sortBy]);

  // Universe stats (computed from real data)
  const universeStats = useMemo(() => {
    if (!universe.length) return null;
    const directFunds = universe.filter((f) => f.purchase_mode === 'Direct');
    const withReturns = universe.filter((f) => f.return_1y != null);
    const avgReturn = withReturns.length
      ? withReturns.reduce((s, f) => s + Number(f.return_1y), 0) / withReturns.length
      : 0;
    const leaders = universe.filter((f) =>
      f.return_class === 'LEADER' && f.alpha_class !== 'NEGATIVE' && f.risk_class !== 'HIGH_RISK',
    ).length;
    const avoidZone = universe.filter((f) =>
      f.return_class === 'WEAK' && f.risk_class === 'HIGH_RISK',
    ).length;
    const totalAum = universe.reduce((s, f) => s + (Number(f.aum) || 0), 0);
    const totalAumCr = totalAum / 10000000;

    return {
      total: universe.length,
      direct: directFunds.length,
      avgReturn,
      leaders,
      avoidZone,
      totalAumLCr: totalAumCr >= 100000 ? `${(totalAumCr / 100000).toFixed(1)}L Cr` : `${Math.round(totalAumCr).toLocaleString('en-IN')} Cr`,
    };
  }, [universe]);

  // Filtered + sorted funds
  const { displayFunds, displayLabel } = useMemo(() => {
    let filtered;
    let label;

    if (activeBucket && bucketFundIds.length > 0) {
      const idSet = new Set(bucketFundIds);
      filtered = universe.filter((f) => idSet.has(f.mstar_id));
      label = `${filtered.length} funds in bucket`;
    } else {
      filtered = [...universe];

      // Purchase mode
      if (purchaseMode > 0) {
        const modeStr = purchaseMode === 1 ? 'Regular' : 'Direct';
        filtered = filtered.filter((f) => f.purchase_mode === modeStr);
      }

      // Broad category
      if (selectedBroad !== 'All') {
        filtered = filtered.filter((f) => f.broad_category === selectedBroad);
      }

      // Category
      if (selectedCategory) {
        filtered = filtered.filter((f) => f.category_name === selectedCategory);
      }

      // AMC
      if (selectedAmc) {
        filtered = filtered.filter((f) => f.amc_name === selectedAmc);
      }

      // Text search
      if (query.length >= 2) {
        const q = query.toLowerCase();
        filtered = filtered.filter((f) =>
          (f.fund_name || '').toLowerCase().includes(q) ||
          (f.amc_name || '').toLowerCase().includes(q) ||
          (f.mstar_id || '').toLowerCase().includes(q) ||
          (f.category_name || '').toLowerCase().includes(q),
        );
      }

      // Lens filters
      if (activeLensFilters.size > 0) {
        for (const chipIdx of activeLensFilters) {
          const chip = LENS_FILTER_CHIPS[chipIdx];
          if (chip.values) {
            filtered = filtered.filter((f) => chip.values.includes(f[chip.key]));
          } else {
            filtered = filtered.filter((f) => f[chip.key] === chip.value);
          }
        }
      }

      const totalMatches = filtered.length;
      label = totalMatches > 200
        ? `Showing 200 of ${totalMatches.toLocaleString('en-IN')} funds`
        : `${totalMatches.toLocaleString('en-IN')} funds`;
    }

    const sorted = filtered.sort(sortFn).slice(0, 200);
    return { displayFunds: sorted, displayLabel: label };
  }, [universe, activeBucket, bucketFundIds, purchaseMode, selectedBroad, selectedCategory, selectedAmc, query, activeLensFilters, sortFn]);

  const hasActiveFilters = selectedCategory || selectedAmc || selectedBroad !== 'All' || query || activeBucket || purchaseMode !== 0 || sortBy !== 'composite_desc' || activeLensFilters.size > 0;

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setSelectedBroad('All');
    setSelectedCategory('');
    setSelectedAmc('');
    setActiveBucket(null);
    setBucketFundIds([]);
    setPurchaseMode(0);
    setSortBy('return_1y_desc');
    setActiveLensFilters(new Set());
  }, []);

  return (
    <div className="space-y-5">
      {/* Header + freshness badges */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Fund 360{'\u00B0'}</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Explore, filter, and deep-dive into any Indian mutual fund
          </p>
        </div>
        {universeStats && (
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
              Scores updated
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {universeStats.total.toLocaleString('en-IN')} funds
            </span>
          </div>
        )}
      </div>

      {/* Universe Stats Bar */}
      {universeStats && (
        <div className="flex gap-5 px-5 py-3.5 bg-white rounded-xl border border-slate-200">
          <div className="text-center flex-1">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Total Funds</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-slate-800 mt-0.5">{universeStats.total.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Direct Plans</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-teal-600 mt-0.5">{universeStats.direct.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Avg 1Y Return</p>
            <p className={`text-lg font-extrabold font-mono tabular-nums mt-0.5 ${universeStats.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatPct(universeStats.avgReturn)}
            </p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Leaders</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-emerald-600 mt-0.5">{universeStats.leaders}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Avoid Zone</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-red-600 mt-0.5">{universeStats.avoidZone}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Total AUM</p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-slate-800 mt-0.5">{universeStats.totalAumLCr}</p>
          </div>
        </div>
      )}

      {/* Smart Buckets */}
      <div>
        <p className="section-title mb-2.5">Smart Buckets</p>
        <SmartBuckets
          activeBucket={activeBucket}
          onSelect={handleBucketSelect}
          universe={universe.length > 0 ? universe : undefined}
          purchaseMode={purchaseMode}
        />
      </div>

      {/* Search bar with NL hints + shortcut */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search "large cap direct funds with high alpha" or fund name, AMC, ISIN...'
          className="w-full pl-11 pr-16 py-3.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300 bg-white transition-all"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-medium">
          {'\u2318'}K
        </span>
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Type */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-0.5">Type</span>
            {BROAD_CATEGORIES.map((bc) => (
              <button
                key={bc}
                type="button"
                onClick={() => { setSelectedBroad(bc); setSelectedCategory(''); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  selectedBroad === bc
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {bc}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Plan */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-0.5">Plan</span>
            {PURCHASE_MODES.map((pm) => (
              <button
                key={pm.value}
                type="button"
                onClick={() => setPurchaseMode(pm.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  purchaseMode === pm.value
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Category dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-w-[170px] appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20d%3D%22M3%205l3%203%203-3%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center] pr-7"
          >
            <option value="">All Categories ({filteredCategories.length})</option>
            {filteredCategories.map((c) => (
              <option key={c.category_name} value={c.category_name}>
                {c.category_name} ({c.fund_count})
              </option>
            ))}
          </select>

          {/* AMC dropdown */}
          <select
            value={selectedAmc}
            onChange={(e) => setSelectedAmc(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-w-[170px] appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20d%3D%22M3%205l3%203%203-3%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center] pr-7"
          >
            <option value="">All AMCs ({amcs.length})</option>
            {amcs.map((a) => (
              <option key={a.amc_name} value={a.amc_name}>
                {a.amc_name} ({a.fund_count})
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-slate-200" />

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mr-0.5">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-w-[140px] appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20d%3D%22M3%205l3%203%203-3%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center] pr-7"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                viewMode === 'grid' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title="Grid view"
            >
              {'\u25A6'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 text-[11px] font-medium border-l border-slate-200 transition-all ${
                viewMode === 'list' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title="List view"
            >
              {'\u2630'}
            </button>
          </div>

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] text-red-600 font-semibold hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
            >
              Clear all {'\u2715'}
            </button>
          )}
        </div>

        {/* Lens filter chips (second row) */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Lens Filter</span>
            {LENS_FILTER_CHIPS.map((chip, idx) => {
              const isActive = activeLensFilters.has(idx);
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => toggleLensFilter(idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                    isActive
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chip.color }} />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recently Viewed */}
      {recentFunds.length > 0 && !activeBucket && query.length < 2 && (
        <div>
          <p className="section-title mb-2">Recently Viewed</p>
          <div className="flex gap-2 flex-wrap">
            {recentFunds.map((r) => {
              const ret = r.return_1y != null ? Number(r.return_1y) : null;
              return (
                <button
                  key={r.mstar_id}
                  type="button"
                  onClick={() => onSelect(r.mstar_id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] hover:border-teal-300 hover:bg-teal-50 transition-all"
                >
                  <span className="font-bold text-teal-600">{'\u21A9'}</span>
                  <span className="text-slate-700 font-medium">{r.fund_name}</span>
                  {ret != null && (
                    <span className={`font-mono tabular-nums font-semibold ${ret >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPct(ret)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-500 font-semibold">
          Showing <span className="font-mono tabular-nums text-slate-800">{displayFunds.length}</span> funds
          {activeBucket && <span className="text-slate-400 ml-2">{'\u00B7'} {activeBucket} bucket</span>}
          {purchaseMode === 2 && <span className="text-slate-400 ml-2">{'\u00B7'} Direct plans</span>}
          <span className="text-slate-400 ml-2">{'\u00B7'} Sorted by {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}</span>
        </p>
      </div>

      {/* Fund results */}
      {universeLoading && displayFunds.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : displayFunds.length === 0 ? (
        <EmptyState message="No funds match your filters. Try adjusting your search criteria." />
      ) : viewMode === 'grid' ? (
        <FundCardGrid funds={displayFunds} onSelect={handleFundSelect} />
      ) : (
        <FundListView funds={displayFunds} onSelect={handleFundSelect} />
      )}
    </div>
  );
}
