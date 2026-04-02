import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useFilters } from '../contexts/FilterContext';
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
import { formatCount } from '../lib/format';
import MarketPulseStrip from '../components/dashboard/MarketPulseStrip';
import SectorRotation from '../components/dashboard/SectorRotation';
import FundExposureBridge from '../components/dashboard/FundExposureBridge';
import QuadrantAlignment from '../components/dashboard/QuadrantAlignment';
import UniverseSnapshotStrip from '../components/dashboard/UniverseSnapshotStrip';
import SmartBuckets from '../components/dashboard/SmartBuckets';
import TopFundsByLens from '../components/dashboard/TopFundsByLens';
import CategoryHeatmap from '../components/dashboard/CategoryHeatmap';
import LensFingerprint from '../components/dashboard/LensFingerprint';
import MetricCards from '../components/dashboard/MetricCards';

function UniversalFilterBar({ totalCount, filteredCount }) {
  const { filters, setFilter, resetFilters, hasActiveFilters, BROAD_CATEGORY_OPTIONS, AUM_OPTIONS, AGE_OPTIONS } = useFilters();

  return (
    <div className="flex flex-wrap items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-4 py-3">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Global Filters</span>
      <span className="text-[9px] text-slate-400 italic">(applies across all pages)</span>
      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Broad Category pills */}
      {BROAD_CATEGORY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setFilter('broadCategory', opt.value)}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
            filters.broadCategory === opt.value
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
          }`}
        >
          {opt.label}
        </button>
      ))}

      <div className="w-px h-5 bg-slate-200" />

      {/* AUM dropdown */}
      <select
        value={filters.minAum ?? ''}
        onChange={(e) => setFilter('minAum', e.target.value ? Number(e.target.value) : null)}
        className="px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 rounded-lg bg-white"
      >
        {AUM_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
        ))}
      </select>

      <div className="w-px h-5 bg-slate-200" />

      {/* Age dropdown */}
      <select
        value={filters.minAge ?? ''}
        onChange={(e) => setFilter('minAge', e.target.value ? Number(e.target.value) : null)}
        className="px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 rounded-lg bg-white"
      >
        {AGE_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
        ))}
      </select>

      {hasActiveFilters && (
        <button type="button" onClick={resetFilters} className="text-[10px] text-red-500 font-semibold hover:bg-red-50 px-2 py-1 rounded">
          Clear All
        </button>
      )}

      <span className="text-[11px] text-slate-500 ml-auto tabular-nums">
        {filteredCount != null && totalCount != null
          ? `${formatCount(filteredCount)} funds`
          : ''}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [nifty, setNifty] = useState(null);
  const [allIndices, setAllIndices] = useState(null);
  const [regime, setRegime] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [sentimentRaw, setSentimentRaw] = useState(null);
  const [breadthData, setBreadthData] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [alignmentData, setAlignmentData] = useState([]);
  const [universe, setUniverse] = useState(null);
  const [archetypes, setArchetypes] = useState([]);

  const { applyFilters } = useFilters();

  // Apply universal filters to universe + inject derived alpha
  const filteredUniverse = useMemo(() => {
    if (!universe) return null;
    const filtered = applyFilters(universe);

    // Compute category average return_1y for derived alpha
    const catReturns = {};
    filtered.forEach((f) => {
      const cat = f.category_name;
      if (!cat || f.return_1y == null) return;
      if (!catReturns[cat]) catReturns[cat] = { sum: 0, count: 0 };
      catReturns[cat].sum += Number(f.return_1y);
      catReturns[cat].count += 1;
    });
    const catAvg = {};
    Object.entries(catReturns).forEach(([cat, { sum, count }]) => {
      catAvg[cat] = sum / count;
    });

    return filtered.map((f) => {
      if (f.return_1y != null && f.category_name && catAvg[f.category_name] != null) {
        const derivedAlpha = Number(f.return_1y) - catAvg[f.category_name];
        return { ...f, derived_alpha: derivedAlpha, cat_avg_return_1y: catAvg[f.category_name] };
      }
      return f;
    });
  }, [universe, applyFilters]);

  // Also filter the matrix data
  const filteredMatrix = useMemo(() => {
    if (!matrixData || matrixData.length === 0) return [];
    return applyFilters(matrixData);
  }, [matrixData, applyFilters]);

  // Always compute archetypes from filtered universe — pre-computed counts include all 13K funds
  const effectiveArchetypes = [];

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const results = await Promise.allSettled([
        fetchNiftyData(),                                    // 0: nifty
        fetchMarketRegime(),                                 // 1: regime
        fetchSentiment(),                                    // 2: sentiment
        fetchMorningstarSectors(),                           // 3: sectors
        fetchFundExposureMatrix(20),                         // 4: matrixData (fetch more, filter client-side)
        fetchCategoryAlignment(),                            // 5: alignmentData
        cachedFetch('universe', fetchUniverseData, 600),     // 6: universe
        fetchFundArchetypes(),                               // 7: archetypes
      ]);

      if (results[0].status === 'fulfilled') {
        setNifty(results[0].value.data);
        setAllIndices(results[0].value.data?.all_indices || null);
      }
      if (results[1].status === 'fulfilled') setRegime(results[1].value.data);
      if (results[2].status === 'fulfilled') {
        const raw = results[2].value.data;
        setSentimentRaw(raw);
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
      {/* Universal Filters — applies across all pages */}
      <UniversalFilterBar
        totalCount={universe?.length}
        filteredCount={filteredUniverse?.length}
      />

      {/* Row 1: Market Pulse Strip */}
      <MarketPulseStrip nifty={nifty} regime={regime} sentiment={sentiment} sentimentRaw={sentimentRaw} breadth={breadthData} allIndices={allIndices} loading={loading} />

      {/* Row 2: Sector Rotation + Category Bubble */}
      <SectorRotation sectors={sectors} universe={filteredUniverse} loading={loading} onFundClick={handleFundClick} />

      {/* Row 3: Sector-Fund Bridge */}
      <FundExposureBridge matrixData={filteredMatrix} sectors={sectors} universe={filteredUniverse} loading={loading} onFundClick={handleFundClick} />

      {/* Row 4: Fund Archetypes & Lens Fingerprints (moved UP) */}
      <LensFingerprint universe={filteredUniverse} archetypes={effectiveArchetypes} loading={!filteredUniverse} onFundClick={handleFundClick} />

      {/* Row 5: Universe Snapshot Strip */}
      <UniverseSnapshotStrip universe={filteredUniverse} loading={loading} />

      {/* Row 6: Smart Buckets */}
      <SmartBuckets universe={filteredUniverse} />

      {/* Row 7: Top Funds + Category Heatmap + Expense Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopFundsByLens universe={filteredUniverse} onFundClick={handleFundClick} loading={!filteredUniverse} />
        <div className="space-y-4">
          <CategoryHeatmap universe={filteredUniverse} loading={!filteredUniverse} />
          <MetricCards universe={filteredUniverse} />
        </div>
      </div>

      {/* Row 8: Quadrant Alignment (moved DOWN) */}
      <QuadrantAlignment alignmentData={alignmentData} universe={filteredUniverse} onFundClick={handleFundClick} loading={loading} />
    </div>
  );
}
