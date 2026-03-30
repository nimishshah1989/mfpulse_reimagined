import { useState, useEffect, useCallback, useMemo } from 'react';
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

const EQUITY_BROADS = new Set(['Equity', 'Allocation']);
const MIN_AUM_CR = 1000; // Crores
const MIN_AUM_RAW = MIN_AUM_CR * 1e7; // Raw rupees

function FilterBar({ filters, onChange, totalCount, filteredCount }) {
  const toggles = [
    { key: 'regularOnly', label: 'Regular Plans', desc: 'Exclude Direct' },
    { key: 'equityOnly', label: 'Equity Only', desc: 'Exclude Debt/Liquid' },
    { key: 'minAum', label: `AUM > ${MIN_AUM_CR} Cr`, desc: 'Large funds only' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
      <span className="text-xs font-semibold text-slate-700 mr-1">Filters:</span>
      {toggles.map(({ key, label }) => {
        const active = filters[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...filters, [key]: !active })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              active
                ? 'bg-teal-50 text-teal-700 border-teal-300 shadow-sm'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
            }`}
          >
            {active ? '\u2713 ' : ''}{label}
          </button>
        );
      })}
      <span className="text-[11px] text-slate-400 ml-auto tabular-nums">
        {filteredCount != null && totalCount != null
          ? `${filteredCount.toLocaleString('en-IN')} of ${totalCount.toLocaleString('en-IN')} funds`
          : ''}
      </span>
    </div>
  );
}

function applyGlobalFilters(funds, filters) {
  if (!funds || funds.length === 0) return [];
  let result = funds;

  if (filters.regularOnly) {
    result = result.filter((f) => {
      if (f.purchase_mode) return f.purchase_mode === 'Regular';
      const name = (f.fund_name || '').toLowerCase();
      return !name.includes('direct') && !name.includes('dir ') && !name.includes('dir-');
    });
  }

  if (filters.equityOnly) {
    result = result.filter((f) => EQUITY_BROADS.has(f.broad_category));
  }

  if (filters.minAum) {
    result = result.filter((f) => f.aum != null && Number(f.aum) >= MIN_AUM_RAW);
  }

  // Exclude IDCW payout plans — they're dividend variants with missing returns
  result = result.filter((f) => !(f.fund_name || '').includes('IDCW'));

  // Exclude segregated portfolios
  result = result.filter((f) => !(f.fund_name || '').toLowerCase().includes('segregated'));

  return result;
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

  // Global filters — all ON by default
  const [filters, setFilters] = useState({
    regularOnly: true,
    equityOnly: true,
    minAum: true,
  });

  // Apply global filters to universe + inject derived alpha
  const filteredUniverse = useMemo(() => {
    if (!universe) return null;
    const filtered = applyGlobalFilters(universe, filters);

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
  }, [universe, filters]);

  // Also filter the matrix data
  const filteredMatrix = useMemo(() => {
    if (!matrixData || matrixData.length === 0) return [];
    return applyGlobalFilters(matrixData, filters);
  }, [matrixData, filters]);

  // When any global filter is active, force client-side archetype computation
  const isFiltered = filters.regularOnly || filters.equityOnly || filters.minAum;
  const effectiveArchetypes = isFiltered ? [] : archetypes;

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
      {/* Search Strip */}
      <DashboardSearchStrip universe={universe} />

      {/* Global Filters */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
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

      {/* Row 7: Top Funds + Category Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopFundsByLens universe={filteredUniverse} onFundClick={handleFundClick} loading={!filteredUniverse} />
        <CategoryHeatmap universe={filteredUniverse} loading={!filteredUniverse} />
      </div>

      {/* Row 8: Quadrant Alignment (moved DOWN) */}
      <QuadrantAlignment alignmentData={alignmentData} universe={filteredUniverse} onFundClick={handleFundClick} loading={loading} />
    </div>
  );
}
