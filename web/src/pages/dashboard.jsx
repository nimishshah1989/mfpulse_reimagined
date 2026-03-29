import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  fetchMarketRegime,
  fetchBreadth,
  fetchSentiment,
  fetchSectors,
  fetchNiftyData,
  fetchDataFreshness,
  fetchUniverseData,
  fetchMorningstarSectors,
  triggerNAVFetch,
  triggerLensCompute,
} from '../lib/api';
import { cachedFetch } from '../lib/cache';
import MorningBriefing from '../components/dashboard/MorningBriefing';
import SmartBuckets from '../components/dashboard/SmartBuckets';
import SectorSnapshot from '../components/dashboard/SectorSnapshot';
import TopFundsByLens from '../components/dashboard/TopFundsByLens';
import UniverseHealth from '../components/dashboard/UniverseHealth';
import DataStatus from '../components/dashboard/DataStatus';
import CategoryHeatmap from '../components/dashboard/CategoryHeatmap';

function toTitleCase(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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

  // Phase 1: MarketPulse + Morningstar data (graceful degradation)
  useEffect(() => {
    async function loadMarketPulse() {
      setMpStatus('loading');
      const results = await Promise.allSettled([
        fetchMarketRegime(),
        fetchBreadth('1y'),
        fetchSentiment(),
        fetchSectors('3M'),
        fetchNiftyData(),
        fetchMorningstarSectors(),
      ]);

      const allFailed = results.every((r) => r.status === 'rejected');
      if (allFailed) {
        setMpStatus('offline');
        return;
      }

      if (results[0].status === 'fulfilled') setRegime(results[0].value.data);
      if (results[1].status === 'fulfilled') setBreadth(results[1].value.data);
      if (results[2].status === 'fulfilled') setSentiment(results[2].value.data);
      if (results[5].status === 'fulfilled' && results[5].value.data?.length > 0) {
        setSectors(results[5].value.data);
      } else {
        setSectors([]);
      }
      if (results[4].status === 'fulfilled') setNifty(results[4].value.data);
      setMpStatus('ready');
    }
    loadMarketPulse();
  }, []);

  // Phase 2: Universe + freshness data
  useEffect(() => {
    cachedFetch('universe', fetchUniverseData, 600)
      .then((data) => setUniverse(data))
      .catch(() => setUniverse([]));

    fetchDataFreshness()
      .then((res) => setFreshness(res.data))
      .catch(() => {});
  }, []);

  // Derived sector lists for regime actions
  const { leadingSectors, weakeningSectors } = useMemo(() => {
    if (!sectors || sectors.length === 0) {
      return {
        leadingSectors: regime?.leading_sectors || [],
        weakeningSectors: regime?.lagging_sectors || [],
      };
    }
    const leading = sectors.filter((s) => toTitleCase(s.quadrant) === 'Leading');
    const weakening = sectors.filter((s) => toTitleCase(s.quadrant) === 'Weakening');
    return { leadingSectors: leading, weakeningSectors: weakening };
  }, [sectors, regime]);

  const handleFundClick = useCallback((mstarId) => {
    router.push(`/fund360?fund=${mstarId}`);
  }, [router]);

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

      {/* Section 1: Morning Briefing Hero */}
      <MorningBriefing
        regime={regime}
        breadth={breadth}
        sentiment={sentiment}
        nifty={nifty}
        universe={universe}
        loading={isLoading}
      />

      {/* Section 2: Smart Buckets */}
      <SmartBuckets />

      {/* Section 3: Two-column -- Sector Rotation | Top Funds by Lens */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in" style={{ animationDelay: '0.2s' }}>
        <div className="lg:col-span-5">
          <SectorSnapshot
            sectors={sectors}
            loading={isLoading}
          />
        </div>
        <div className="lg:col-span-7">
          <TopFundsByLens
            universe={universe}
            onFundClick={handleFundClick}
            loading={!universe}
          />
        </div>
      </div>

      {/* Section 4: Two-column -- Universe Health | Regime Actions + Data Freshness */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in" style={{ animationDelay: '0.3s' }}>
        <div className="lg:col-span-7">
          <UniverseHealth
            universe={universe}
            onNavigate={handleNavigate}
          />
        </div>
        <div className="lg:col-span-5">
          <DataStatus
            regime={regime}
            freshness={freshness}
            onRefreshNav={handleRefreshNav}
            onRecomputeLens={handleRecomputeLens}
            refreshing={refreshing}
            recomputing={recomputing}
            leadingSectors={leadingSectors}
            weakeningSectors={weakeningSectors}
          />
        </div>
      </div>

      {/* Section 5: Category Performance Heatmap */}
      <CategoryHeatmap
        universe={universe}
        loading={!universe}
      />
    </div>
  );
}
