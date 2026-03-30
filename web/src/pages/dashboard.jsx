import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  fetchMarketRegime,
  fetchSentiment,
  fetchNiftyData,
  fetchUniverseData,
  fetchMorningstarSectors,
  fetchFundExposureMatrix,
  fetchCategoryAlignment,
  fetchFundArchetypes,
} from '../lib/api';
import { cachedFetch } from '../lib/cache';
import DashboardSearchStrip from '../components/dashboard/DashboardSearchStrip';
import MarketPulseStrip from '../components/dashboard/MarketPulseStrip';
import SectorRotation from '../components/dashboard/SectorRotation';
import FundExposureBridge from '../components/dashboard/FundExposureBridge';
import QuadrantAlignment from '../components/dashboard/QuadrantAlignment';
import UniverseSnapshotStrip from '../components/dashboard/UniverseSnapshotStrip';
import SmartBuckets from '../components/dashboard/SmartBuckets';
import TopFundsByLens from '../components/dashboard/TopFundsByLens';
import CategoryHeatmap from '../components/dashboard/CategoryHeatmap';
import LensFingerprint from '../components/dashboard/LensFingerprint';

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [nifty, setNifty] = useState(null);
  const [regime, setRegime] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [breadthData, setBreadthData] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [alignmentData, setAlignmentData] = useState([]);
  const [universe, setUniverse] = useState(null);
  const [archetypes, setArchetypes] = useState([]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const results = await Promise.allSettled([
        fetchNiftyData(),                                    // 0: nifty
        fetchMarketRegime(),                                 // 1: regime
        fetchSentiment(),                                    // 2: sentiment
        fetchMorningstarSectors(),                           // 3: sectors
        fetchFundExposureMatrix(5),                          // 4: matrixData
        fetchCategoryAlignment(),                            // 5: alignmentData
        cachedFetch('universe', fetchUniverseData, 600),     // 6: universe
        fetchFundArchetypes(),                               // 7: archetypes
      ]);

      if (results[0].status === 'fulfilled') setNifty(results[0].value.data);
      if (results[1].status === 'fulfilled') setRegime(results[1].value.data);
      if (results[2].status === 'fulfilled') {
        const raw = results[2].value.data;
        const ls = raw?.layer_scores || {};
        const layers = Object.entries(ls).map(([name, score]) => ({ name, score }));
        setSentiment({ composite_score: raw?.composite_score, zone: raw?.zone, layers });
        const metrics = raw?.short_term_trend?.metrics || [];
        const broad = raw?.broad_trend?.metrics || [];
        const allMetrics = [...metrics, ...broad];
        const breadth = {};
        allMetrics.forEach((m) => { breadth[m.key] = m.pct; });
        setBreadthData({
          above_10ema: breadth.above_10ema,
          above_21ema: breadth.above_21ema,
          above_50ema: breadth.above_50ema,
          above_200ema: breadth.above_200ema,
          highs_52w: breadth.hit_52w_high,
          lows_52w: breadth.hit_52w_low,
          macd_bull_pct: breadth.macd_bull_cross,
          rsi_above_50_pct: breadth.rsi_above_50,
        });
      }
      if (results[3].status === 'fulfilled') setSectors(results[3].value.data || []);
      if (results[4].status === 'fulfilled') setMatrixData(results[4].value.data || []);
      if (results[5].status === 'fulfilled') setAlignmentData(results[5].value.data || []);
      if (results[6].status === 'fulfilled') setUniverse(results[6].value || []);
      if (results[7].status === 'fulfilled') setArchetypes(results[7].value.data || []);
      setLoading(false);
    }
    loadAll();
  }, []);

  const handleFundClick = useCallback((mstarId) => {
    router.push(`/fund360?fund=${mstarId}`);
  }, [router]);

  return (
    <div className="space-y-5 w-full">
      {/* Search Strip */}
      <DashboardSearchStrip universe={universe} />

      {/* Row 1: Market Pulse Strip */}
      <MarketPulseStrip nifty={nifty} regime={regime} sentiment={sentiment} breadth={breadthData} loading={loading} />

      {/* Row 2: Sector Rotation */}
      <SectorRotation sectors={sectors} loading={loading} />

      {/* Row 3: Sector-Fund Bridge */}
      <FundExposureBridge matrixData={matrixData} sectors={sectors} universe={universe} loading={loading} />

      {/* Row 3b: Quadrant Alignment */}
      <QuadrantAlignment alignmentData={alignmentData} universe={universe} onFundClick={handleFundClick} loading={loading} />

      {/* Row 4: Universe Snapshot Strip */}
      <UniverseSnapshotStrip universe={universe} loading={loading} />

      {/* Row 5: Smart Buckets */}
      <SmartBuckets />

      {/* Row 6: Top Funds + Category Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopFundsByLens universe={universe} onFundClick={handleFundClick} loading={!universe} />
        <CategoryHeatmap universe={universe} loading={!universe} />
      </div>

      {/* Row 7: Lens Fingerprints */}
      <LensFingerprint universe={universe} archetypes={archetypes} loading={!universe} />
    </div>
  );
}
