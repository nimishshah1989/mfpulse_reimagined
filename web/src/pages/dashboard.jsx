import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  fetchMarketRegime,
  fetchBreadth,
  fetchSentiment,
  fetchSectors,
  fetchLensDistribution,
  fetchDataFreshness,
  triggerNAVFetch,
  triggerLensCompute,
} from '../lib/api';
import MarketPosture from '../components/dashboard/MarketPosture';
import SmartBuckets from '../components/dashboard/SmartBuckets';
import MetricCards from '../components/dashboard/MetricCards';
import SectorMoves from '../components/dashboard/SectorMoves';
import StrategyAlerts from '../components/dashboard/StrategyAlerts';
import TopFundsByLens from '../components/dashboard/TopFundsByLens';
import DataStatus from '../components/dashboard/DataStatus';
import UniverseHealth from '../components/dashboard/UniverseHealth';

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
  const [mpStatus, setMpStatus] = useState('loading');

  // Universe state
  const [lensDistribution, setLensDistribution] = useState(null);
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
      setMpStatus('ready');
    }
    loadMarketPulse();
  }, []);

  // Phase 2: Universe data (non-blocking)
  useEffect(() => {
    Promise.allSettled([
      fetchLensDistribution({}),
      fetchDataFreshness(),
    ]).then((results) => {
      if (results[0].status === 'fulfilled') setLensDistribution(results[0].value.data);
      if (results[1].status === 'fulfilled') setFreshness(results[1].value.data);
    });
  }, []);

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
      const [distRes, freshRes] = await Promise.all([
        fetchLensDistribution({}),
        fetchDataFreshness(),
      ]);
      setLensDistribution(distRes.data);
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
            MarketPulse is offline. Dashboard shows cached data where available.
            Market signals, sector moves, and strategy alerts may be limited.
          </p>
        </div>
      )}

      {/* Row 1: Morning Briefing (full width) */}
      <MarketPosture
        regime={regime}
        breadth={breadth}
        sentiment={sentiment}
        loading={isLoading}
      />

      {/* Row 2: Smart Buckets (scrollable horizontal) */}
      <div>
        <SectionHeader
          title="Smart Buckets"
          subtitle="Functional fund categories based on lens classifications"
        />
        <SmartBuckets />
      </div>

      {/* Row 3: Metric Cards (4 across) */}
      <MetricCards
        breadth={breadth}
        sentiment={sentiment}
        sectors={sectors}
        loading={isLoading}
      />

      {/* Row 4: 2-col: Sector Moves + Strategy Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Sector Moves" subtitle="Notable quadrant transitions" />
          <SectorMoves
            sectors={sectors}
            onNavigate={handleNavigate}
            loading={isLoading}
          />
        </div>
        <div>
          <SectionHeader title="Strategy Alerts" subtitle="Signal conditions across your strategies" />
          <StrategyAlerts breadth={breadth} sentiment={sentiment} />
        </div>
      </div>

      {/* Row 5: Top Funds by Lens */}
      <div>
        <SectionHeader title="Top Funds by Lens" subtitle="Highest scoring funds across all six lenses" />
        <TopFundsByLens
          fundsByLens={lensDistribution?.top_funds}
          onFundClick={handleFundClick}
          loading={!lensDistribution}
        />
      </div>

      {/* Row 6: Universe Health + Data Freshness */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <SectionHeader title="Universe Health" subtitle="Lens score distributions across all funds" />
          <UniverseHealth
            lensDistribution={lensDistribution}
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
