import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  fetchMarketRegime,
  fetchBreadth,
  fetchSentiment,
  fetchSectors,
  fetchNiftyData,
  fetchLensDistribution,
  fetchDataFreshness,
  fetchUniverseData,
  triggerNAVFetch,
  triggerLensCompute,
} from '../lib/api';
import { cachedFetch } from '../lib/cache';
import MorningBriefing from '../components/dashboard/MorningBriefing';
import SmartBuckets from '../components/dashboard/SmartBuckets';
import MetricCards from '../components/dashboard/MetricCards';
import SectorSnapshot from '../components/dashboard/SectorSnapshot';
import TopFundsByLens from '../components/dashboard/TopFundsByLens';
import UniverseHealth from '../components/dashboard/UniverseHealth';
import DataStatus from '../components/dashboard/DataStatus';

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  // MarketPulse state
  const [regime, setRegime] = useState(null);
  const [breadth, setBreadth] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [nifty, setNifty] = useState(null);
  const [mpStatus, setMpStatus] = useState('loading');

  // Universe state
  const [universe, setUniverse] = useState(null);
  const [freshness, setFreshness] = useState(null);

  // Actions
  const [refreshing, setRefreshing] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  // Phase 1: MarketPulse data (graceful degradation)
  useEffect(() => {
    async function loadMarketPulse() {
      setMpStatus('loading');
      const results = await Promise.allSettled([
        fetchMarketRegime(),
        fetchBreadth('1y'),
        fetchSentiment(),
        fetchSectors('3M'),
        fetchNiftyData(),
      ]);

      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        setMpStatus('offline');
        return;
      }

      if (results[0].status === 'fulfilled') setRegime(results[0].value.data);
      if (results[1].status === 'fulfilled') setBreadth(results[1].value.data);
      if (results[2].status === 'fulfilled') setSentiment(results[2].value.data);
      if (results[3].status === 'fulfilled') setSectors(results[3].value.data || []);
      if (results[4].status === 'fulfilled') setNifty(results[4].value.data);
      setMpStatus('ready');
    }
    loadMarketPulse();
  }, []);

  // Phase 2: Universe + freshness data (non-blocking)
  useEffect(() => {
    cachedFetch('universe', fetchUniverseData, 600)
      .then((data) => setUniverse(data))
      .catch(() => setUniverse([]));

    fetchDataFreshness()
      .then((res) => setFreshness(res.data))
      .catch(() => {});
  }, []);

  // Derived universe stats for metric cards
  const universeStats = useMemo(() => {
    if (!universe) return null;
    const total = universe.length;
    const scored = universe.filter((f) => f.return_score != null).length;
    return { total, scored };
  }, [universe]);

  const handleNavigate = useCallback((route) => {
    router.push(route);
  }, [router]);

  const handleFundClick = useCallback((mstarId) => {
    router.push(`/fund360?fund=${mstarId}`);
  }, [router]);

  const handleRefreshNav = useCallback(async () => {
    setRefreshing(true);
    try {
      await triggerNAVFetch();
      const res = await fetchDataFreshness();
      setFreshness(res.data);
    } catch {
      // Silent fail -- DataStatus shows stale indicator
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleRecomputeLens = useCallback(async () => {
    setRecomputing(true);
    try {
      await triggerLensCompute();
      const freshRes = await fetchDataFreshness();
      setFreshness(freshRes.data);
    } catch {
      // Silent fail
    } finally {
      setRecomputing(false);
    }
  }, []);

  const isLoading = mpStatus === 'loading';
  const isOffline = mpStatus === 'offline';

  return (
    <div className="space-y-6">
      {/* MarketPulse offline banner */}
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700">
            MarketPulse is offline. Market signals and sector data are unavailable.
          </p>
        </div>
      )}

      {/* Row 1: Morning Briefing Hero */}
      <MorningBriefing
        regime={regime}
        breadth={breadth}
        sentiment={sentiment}
        nifty={nifty}
        loading={isLoading}
      />

      {/* Row 2: Smart Buckets */}
      <div>
        <SectionHeader
          title="Smart Buckets"
          subtitle="Functional fund categories based on lens classifications"
        />
        <SmartBuckets />
      </div>

      {/* Row 3: Metric Cards (4 across) */}
      <MetricCards
        nifty={nifty}
        sentiment={sentiment}
        breadth={breadth}
        universeStats={universeStats}
        loading={isLoading && !universe}
      />

      {/* Row 4: 2-col: Sector Intelligence + Top Funds by Lens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Sector Intelligence" subtitle="Top sectors by relative strength" />
          <SectorSnapshot
            sectors={sectors}
            loading={isLoading}
          />
        </div>
        <div>
          <SectionHeader title="Top Funds by Lens" subtitle="Highest scoring funds across lenses" />
          <TopFundsByLens
            universe={universe}
            onFundClick={handleFundClick}
            loading={!universe}
          />
        </div>
      </div>

      {/* Row 5: Universe Health + Data Freshness */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <SectionHeader title="Universe Health" subtitle="Lens classification distributions across all funds" />
          <UniverseHealth
            universe={universe}
            onNavigate={handleNavigate}
          />
        </div>
        <div>
          <SectionHeader title="Data Freshness" subtitle="Ingestion status and actions" />
          <DataStatus
            freshness={freshness}
            onRefreshNav={handleRefreshNav}
            onRecomputeLens={handleRecomputeLens}
            refreshing={refreshing}
            recomputing={recomputing}
          />
        </div>
      </div>
    </div>
  );
}
