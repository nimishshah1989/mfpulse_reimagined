import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { getMarketSummary } from '../lib/signals';
import MarketPosture from '../components/dashboard/MarketPosture';
import MetricCards from '../components/dashboard/MetricCards';
import SectorMoves from '../components/dashboard/SectorMoves';
import StrategyAlerts from '../components/dashboard/StrategyAlerts';
import TopFundsByLens from '../components/dashboard/TopFundsByLens';
import DataStatus from '../components/dashboard/DataStatus';
import UniverseHealth from '../components/dashboard/UniverseHealth';

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
      // Silent fail — DataStatus shows stale indicator
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">
            MarketPulse is offline. Dashboard shows cached data where available.
            Market signals, sector moves, and strategy alerts may be limited.
          </p>
        </div>
      )}

      {/* Morning briefing: Market Posture */}
      <MarketPosture
        regime={regime}
        breadth={breadth}
        sentiment={sentiment}
        loading={isLoading}
      />

      {/* Key metric cards */}
      <MetricCards
        breadth={breadth}
        sentiment={sentiment}
        sectors={sectors}
        loading={isLoading}
      />

      {/* 2-col: Sector Moves + Strategy Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Sector Moves</h2>
          <SectorMoves
            sectors={sectors}
            onNavigate={handleNavigate}
            loading={isLoading}
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Strategy Alerts</h2>
          <StrategyAlerts breadth={breadth} sentiment={sentiment} />
        </div>
      </div>

      {/* Top Funds by Lens */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Top Funds</h2>
        <TopFundsByLens
          fundsByLens={lensDistribution?.top_funds}
          onFundClick={handleFundClick}
          loading={!lensDistribution}
        />
      </div>

      {/* Universe Health + Data Status */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Universe Health — Lens Distributions</h2>
          <UniverseHealth
            lensDistribution={lensDistribution}
            onNavigate={handleNavigate}
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Data Freshness</h2>
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
