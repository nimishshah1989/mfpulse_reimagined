import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  fetchFundDetail,
  fetchFundLensScores,
  fetchNAVHistory,
  fetchHoldings,
  fetchSectorExposure,
  fetchLensHistory,
  fetchPeers,
  fetchFundRisk,
  fetchFunds,
  fetchCategories,
  fetchAMCs,
} from '../lib/api';
import { formatPct, formatAUM } from '../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../lib/lens';
import Badge from '../components/shared/Badge';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import dynamic from 'next/dynamic';
const RadarChart = dynamic(() => import('../components/fund360/RadarChart'), { ssr: false });
import PerformanceChart from '../components/fund360/PerformanceChart';
import ReturnsTable from '../components/fund360/ReturnsTable';
import HoldingsTable from '../components/fund360/HoldingsTable';
import SectorDonut from '../components/fund360/SectorDonut';
import RiskStatsGrid from '../components/fund360/RiskStatsGrid';
import LensHistory from '../components/fund360/LensHistory';
import PeerTable from '../components/fund360/PeerTable';
import CompareMode from '../components/fund360/CompareMode';

const BROAD_CATEGORIES = ['All', 'Equity', 'Fixed Income', 'Allocation', 'Alternative Strategies'];

function FundSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [categories, setCategories] = useState([]);
  const [amcs, setAmcs] = useState([]);
  const [selectedBroad, setSelectedBroad] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAmc, setSelectedAmc] = useState('');

  // Top funds for browsing when no search query
  const [topFunds, setTopFunds] = useState([]);
  const [topLoading, setTopLoading] = useState(true);

  // Load filter options + top funds on mount
  useEffect(() => {
    Promise.allSettled([fetchCategories(), fetchAMCs()]).then(([catRes, amcRes]) => {
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data || []);
      if (amcRes.status === 'fulfilled') setAmcs(amcRes.value.data || []);
    });
    fetchFunds({ limit: 20, sort: 'return_1y', order: 'desc' })
      .then((res) => setTopFunds(res.data || []))
      .catch(() => {})
      .finally(() => setTopLoading(false));
  }, []);

  // Filtered categories based on broad category selection
  const filteredCategories = selectedBroad === 'All'
    ? categories
    : categories.filter((c) => c.broad_category === selectedBroad);

  // Search with filters
  useEffect(() => {
    const params = { limit: 20 };
    if (query.length >= 2) params.search = query;
    if (selectedCategory) params.category = selectedCategory;
    if (selectedAmc) params.amc = selectedAmc;
    if (selectedBroad !== 'All') params.broad_category = selectedBroad;

    // Only search if there's a query or filter active
    const hasFilter = query.length >= 2 || selectedCategory || selectedAmc || selectedBroad !== 'All';
    if (!hasFilter) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchFunds(params);
        setResults(res.data || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selectedCategory, selectedAmc, selectedBroad]);

  const displayFunds = results.length > 0 ? results : (!query && !selectedCategory && !selectedAmc && selectedBroad === 'All') ? topFunds : results;
  const showingTop = displayFunds === topFunds && topFunds.length > 0;

  return (
    <div className="space-y-6 -m-6">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-800">Fund 360°</h2>
        <p className="text-sm text-slate-500 mt-1">Search, filter, and explore any mutual fund in depth</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by fund name, AMC, or ISIN..."
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white shadow-sm"
          />
          {loading && <div className="absolute right-3 top-3.5 text-xs text-slate-400">Searching...</div>}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-3">
          {/* Broad category pills */}
          <div className="flex gap-1.5">
            {BROAD_CATEGORIES.map((bc) => (
              <button
                key={bc}
                type="button"
                onClick={() => { setSelectedBroad(bc); setSelectedCategory(''); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedBroad === bc
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {bc}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[180px]"
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
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[180px]"
          >
            <option value="">All AMCs ({amcs.length})</option>
            {amcs.map((a) => (
              <option key={a.amc_name} value={a.amc_name}>
                {a.amc_name} ({a.fund_count})
              </option>
            ))}
          </select>

          {/* Clear filters */}
          {(selectedCategory || selectedAmc || selectedBroad !== 'All' || query) && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSelectedBroad('All'); setSelectedCategory(''); setSelectedAmc(''); }}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Results heading */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {showingTop ? 'Top performers by 1Y return' : `${displayFunds.length} funds found`}
          </p>
        </div>

        {/* Fund list */}
        {topLoading && displayFunds.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLoader key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : displayFunds.length === 0 ? (
          <EmptyState message="No funds match your filters. Try adjusting your search criteria." />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {displayFunds.map((f) => (
              <button
                key={f.mstar_id}
                type="button"
                onClick={() => onSelect(f.mstar_id)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{f.fund_name || f.legal_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.amc_name} · {f.category_name}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {f.return_1y != null && (
                    <div className="text-right">
                      <div className={`text-sm font-mono tabular-nums font-medium ${Number(f.return_1y) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatPct(f.return_1y)}
                      </div>
                      <div className="text-[10px] text-slate-400">1Y</div>
                    </div>
                  )}
                  {f.return_class && (
                    <Badge variant="tier">{f.return_class}</Badge>
                  )}
                  <span className="text-slate-400 text-sm">&#8250;</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Fund360Page() {
  const router = useRouter();
  const [mstarId, setMstarId] = useState(null);

  // Primary data
  const [fundDetail, setFundDetail] = useState(null);
  const [lensScores, setLensScores] = useState(null);
  const [navData, setNavData] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [sectors, setSectors] = useState([]);

  // Secondary data
  const [lensHistory, setLensHistory] = useState(null);
  const [peers, setPeers] = useState(null);
  const [riskStats, setRiskStats] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  // Read fund from URL query param
  useEffect(() => {
    if (router.isReady) {
      setMstarId(router.query.fund || null);
    }
  }, [router.isReady, router.query.fund]);

  // Primary data fetch
  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    async function loadPrimary() {
      setLoading(true);
      setError(null);
      try {
        const [detailRaw, lens, nav, hold, sect] = await Promise.all([
          fetchFundDetail(mstarId).then((r) => r.data),
          fetchFundLensScores(mstarId).then((r) => r.data),
          fetchNAVHistory(mstarId, '1y').then((r) => r.data || []),
          fetchHoldings(mstarId, 10).then((r) => r.data || []),
          fetchSectorExposure(mstarId).then((r) => r.data || []),
        ]);
        if (cancelled) return;
        // API returns { fund: {...}, returns: {...}, risk_stats: {...}, ranks: {...} }
        // Flatten into a single object for easy access by child components
        const fund = detailRaw?.fund ?? detailRaw ?? {};
        const detail = {
          ...fund,
          returns: detailRaw?.returns ?? null,
          risk_stats: detailRaw?.risk_stats ?? null,
          ranks: detailRaw?.ranks ?? null,
          indian_risk_level: detailRaw?.indian_risk_level ?? null,
          primary_benchmark: detailRaw?.primary_benchmark ?? null,
          investment_strategy: detailRaw?.investment_strategy ?? null,
          managers: detailRaw?.managers ?? null,
        };
        setFundDetail(detail);
        setLensScores(lens);
        setNavData(nav);
        setHoldings(hold);
        setSectors(sect);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPrimary();
    return () => { cancelled = true; };
  }, [mstarId]);

  // Secondary data fetch (non-blocking)
  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    async function loadSecondary() {
      const [lhRes, pRes, rRes] = await Promise.allSettled([
        fetchLensHistory(mstarId),
        fetchPeers(mstarId),
        fetchFundRisk(mstarId),
      ]);
      if (cancelled) return;
      if (lhRes.status === 'fulfilled') setLensHistory(lhRes.value.data || []);
      if (pRes.status === 'fulfilled') {
        const peerData = pRes.value.data;
        // API returns { peers: [...], fund_mstar_id, ... } — extract the array
        setPeers(Array.isArray(peerData) ? peerData : peerData?.peers || []);
      }
      if (rRes.status === 'fulfilled') {
        const riskData = rRes.value.data;
        // API may return array (history) or single object — normalize to single
        setRiskStats(Array.isArray(riskData) ? riskData[0] || null : riskData || null);
      }
    }
    loadSecondary();
    return () => { cancelled = true; };
  }, [mstarId]);

  const handleFundSearch = useCallback((id) => {
    router.push(`/fund360?fund=${id}`);
  }, [router]);

  // No fund selected - show search
  if (!mstarId) {
    return <FundSearch onSelect={handleFundSearch} />;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader variant="row" className="w-96 h-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonLoader variant="chart" className="h-80" />
          <SkeletonLoader variant="chart" className="h-80" />
        </div>
        <SkeletonLoader variant="card" className="h-40" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={'\u26A0\uFE0F'}
        message={`Failed to load fund: ${error}`}
        action="Back to Universe"
        onAction={() => router.push('/')}
      />
    );
  }

  if (!fundDetail) return null;

  const radarFunds = lensScores
    ? [{ label: fundDetail.fund_name || fundDetail.legal_name, scores: lensScores }]
    : [];

  return (
    <div className="space-y-6 -m-6">
      {/* Fund Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-xs text-teal-600 hover:underline mb-1"
            >
              {'\u2190'} Back to Universe
            </button>
            <h2 className="text-lg font-semibold text-slate-800">
              {fundDetail.fund_name || fundDetail.legal_name}
            </h2>
            <p className="text-sm text-slate-500">{fundDetail.amc_name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="category">{fundDetail.category_name}</Badge>
              {fundDetail.aum != null && (
                <span className="text-xs font-mono text-slate-500">AUM: {formatAUM(fundDetail.aum)}</span>
              )}
              {fundDetail.inception_date && (
                <span className="text-xs text-slate-400">Since {fundDetail.inception_date}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50"
            >
              Compare
            </button>
            <button
              type="button"
              onClick={() => router.push(`/simulation?fund=${mstarId}`)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
            >
              Simulate {'\u2192'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/strategy?add=${mstarId}`)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Add to Strategy
            </button>
          </div>
        </div>

        {/* Lens badges + headline */}
        {lensScores && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {LENS_OPTIONS.map((lens) => {
                const classKey = LENS_CLASS_KEYS[lens.key];
                const tier = lensScores[classKey];
                return tier ? (
                  <Badge key={lens.key} variant="tier">{tier}</Badge>
                ) : null;
              })}
            </div>
            {lensScores.headline_tag && (
              <p className="text-xs italic text-slate-600 mt-2">
                {'\u201C'}{lensScores.headline_tag}{'\u201D'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="px-6 space-y-6">
        {/* Row 1: Radar + Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Six-Lens Radar</h3>
            {radarFunds.length > 0 ? (
              <RadarChart funds={radarFunds} size={300} />
            ) : (
              <SkeletonLoader variant="chart" className="h-72" />
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">NAV Performance</h3>
            <PerformanceChart mstarId={mstarId} initialData={navData} />
          </div>
        </div>

        {/* Row 2: Returns */}
        <ReturnsTable
          fundReturns={fundDetail.returns || fundDetail}
          categoryReturns={fundDetail.category_returns || null}
        />

        {/* Row 3: Holdings + Sectors */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <HoldingsTable holdings={holdings} />
          <SectorDonut sectors={sectors} />
        </div>

        {/* Row 4: Risk Stats */}
        <RiskStatsGrid riskStats={riskStats || fundDetail.risk_stats || fundDetail} />

        {/* Row 5: Lens History */}
        <LensHistory history={lensHistory} />

        {/* Row 6: Peers */}
        <PeerTable peers={peers} currentMstarId={mstarId} />
      </div>

      {/* Compare Mode Panel */}
      {compareOpen && lensScores && (
        <CompareMode
          primaryFund={fundDetail}
          primaryScores={lensScores}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
