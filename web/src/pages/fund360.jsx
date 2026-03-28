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
} from '../lib/api';
import { formatPct, formatAUM } from '../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../lib/lens';
import Badge from '../components/shared/Badge';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import RadarChart from '../components/fund360/RadarChart';
import PerformanceChart from '../components/fund360/PerformanceChart';
import ReturnsTable from '../components/fund360/ReturnsTable';
import HoldingsTable from '../components/fund360/HoldingsTable';
import SectorDonut from '../components/fund360/SectorDonut';
import RiskStatsGrid from '../components/fund360/RiskStatsGrid';
import LensHistory from '../components/fund360/LensHistory';
import PeerTable from '../components/fund360/PeerTable';
import CompareMode from '../components/fund360/CompareMode';

function FundSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchFunds({ search: query, limit: 10 });
        setResults(res.data || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Fund 360°</h2>
      <p className="text-sm text-slate-500 mb-6">Search for a fund to explore</p>
      <div className="relative w-full max-w-md">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by fund name, AMC, or ISIN..."
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {loading && <div className="absolute right-3 top-3.5 text-xs text-slate-400">Searching...</div>}
        {results.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
            {results.map((f) => (
              <button
                key={f.mstar_id}
                type="button"
                onClick={() => onSelect(f.mstar_id)}
                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0"
              >
                <div className="text-sm font-medium text-slate-800 truncate">{f.fund_name || f.legal_name}</div>
                <div className="text-xs text-slate-500">{f.amc_name} · {f.category_name}</div>
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
        const [detail, lens, nav, hold, sect] = await Promise.all([
          fetchFundDetail(mstarId).then((r) => r.data),
          fetchFundLensScores(mstarId).then((r) => r.data),
          fetchNAVHistory(mstarId, '1y').then((r) => r.data || []),
          fetchHoldings(mstarId, 10).then((r) => r.data || []),
          fetchSectorExposure(mstarId).then((r) => r.data || []),
        ]);
        if (cancelled) return;
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
      if (pRes.status === 'fulfilled') setPeers(pRes.value.data || []);
      if (rRes.status === 'fulfilled') setRiskStats(rRes.value.data || null);
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
          fundReturns={fundDetail}
          categoryReturns={fundDetail.category_returns || null}
        />

        {/* Row 3: Holdings + Sectors */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <HoldingsTable holdings={holdings} />
          <SectorDonut sectors={sectors} />
        </div>

        {/* Row 4: Risk Stats */}
        <RiskStatsGrid riskStats={riskStats || fundDetail} />

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
