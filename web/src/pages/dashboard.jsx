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
import { deriveActionCards, getMarketSummary } from '../lib/signals';
import SignalActionCards from '../components/dashboard/SignalActionCards';
import TopFundsByLens from '../components/dashboard/TopFundsByLens';
import UniverseHealth from '../components/dashboard/UniverseHealth';
import DataStatus from '../components/dashboard/DataStatus';
import StatCard from '../components/shared/StatCard';
import Badge from '../components/shared/Badge';

const REGIME_COLORS = {
  Bullish: 'emerald',
  Neutral: 'slate',
  Bearish: 'red',
  Cautious: 'amber',
};

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

  const marketSummary = useMemo(
    () => getMarketSummary(regime, breadth, sentiment),
    [regime, breadth, sentiment]
  );

  const actionCards = useMemo(
    () => deriveActionCards({ regime, breadth, sentiment, sectors, topFundsByLens: null }),
    [regime, breadth, sentiment, sectors]
  );

  const handleNavigate = useCallback((route) => {
    router.push(route);
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

  return (
    <div className="space-y-6 -m-6">
      {/* Header KPI row */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Regime:</span>
            <Badge variant={REGIME_COLORS[marketSummary.regimeLabel] || 'slate'}>
              {marketSummary.regimeLabel}
            </Badge>
          </div>
          {marketSummary.breadthPct != null && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Breadth:</span>
              <span className={`text-sm font-mono tabular-nums font-medium ${
                marketSummary.breadthPct > 55 ? 'text-emerald-600' : marketSummary.breadthPct < 40 ? 'text-red-600' : 'text-slate-900'
              }`}>
                {Math.round(marketSummary.breadthPct)}%
              </span>
            </div>
          )}
          {marketSummary.sentimentScore != null && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Sentiment:</span>
              <span className={`text-sm font-mono tabular-nums font-medium ${
                marketSummary.sentimentScore < 30 ? 'text-red-600' : marketSummary.sentimentScore > 75 ? 'text-amber-600' : 'text-slate-900'
              }`}>
                {Math.round(marketSummary.sentimentScore)}/100
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Signal action cards + Data status */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Action Signals</h2>
            <SignalActionCards
              status={mpStatus}
              actionCards={actionCards}
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

        {/* Universe health */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Universe Health — Lens Distributions</h2>
          <UniverseHealth
            lensDistribution={lensDistribution}
            onNavigate={handleNavigate}
          />
        </div>
      </div>
    </div>
  );
}
