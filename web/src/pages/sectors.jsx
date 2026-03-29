import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchSectors,
  fetchBreadth,
  fetchSentiment,
  fetchMarketRegime,
  fetchFunds,
  fetchSectorExposure,
  fetchMorningstarSectors,
} from '../lib/api';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import Pill from '../components/shared/Pill';
import dynamic from 'next/dynamic';
const CompassChart = dynamic(
  () => import('../components/sectors/CompassChart'),
  { ssr: false }
);
import MarketContextPanel from '../components/sectors/MarketContextPanel';
import FundDrillDown from '../components/sectors/FundDrillDown';
import RotationHeatmap from '../components/sectors/RotationHeatmap';
import FundExposureMatrix from '../components/sectors/FundExposureMatrix';

const PERIODS = ['1M', '3M', '6M', '1Y'];

export default function SectorsPage() {
  const [sectorData, setSectorData] = useState([]);
  const [breadthData, setBreadthData] = useState(null);
  const [sentimentData, setSentimentData] = useState(null);
  const [regimeData, setRegimeData] = useState(null);
  const [mpOnline, setMpOnline] = useState(true);
  const [mpLoading, setMpLoading] = useState(true);

  const [funds, setFunds] = useState([]);
  const [sectorExposures, setSectorExposures] = useState({});
  const [exposureAvailable, setExposureAvailable] = useState(null);
  const [fundsLoading, setFundsLoading] = useState(true);

  const [period, setPeriod] = useState('3M');
  const [view, setView] = useState('compass');
  const [selectedSector, setSelectedSector] = useState(null);
  const [drillDownSort, setDrillDownSort] = useState('composite');
  const [drillDownCategory, setDrillDownCategory] = useState('all');
  const [drillDownPurchaseMode, setDrillDownPurchaseMode] = useState('Regular');
  const [exposureLoading, setExposureLoading] = useState(false);

  const compassRef = useRef(null);
  const [compassWidth, setCompassWidth] = useState(600);

  useEffect(() => {
    if (!compassRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCompassWidth(Math.max(400, entry.contentRect.width));
      }
    });
    observer.observe(compassRef.current);
    return () => observer.disconnect();
  }, []);

  const loadMarketPulse = useCallback(async (p) => {
    setMpLoading(true);
    const [mstarRes, sectorsRes, breadthRes, sentimentRes, regimeRes] =
      await Promise.allSettled([
        fetchMorningstarSectors(),
        fetchSectors(p),
        fetchBreadth('1y'),
        fetchSentiment(),
        fetchMarketRegime(),
      ]);

    const toTitleCase = (str) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;

    let anySuccess = false;

    // Prefer Morningstar sectors, fallback to MarketPulse
    if (mstarRes.status === 'fulfilled' && mstarRes.value.data?.length > 0) {
      const raw = mstarRes.value.data;
      const normalized = (Array.isArray(raw) ? raw : []).map((s) => ({
        ...s,
        sector_name: s.sector_name || s.display_name || s.name || 'Unknown',
        quadrant: toTitleCase(s.quadrant),
      }));
      setSectorData(normalized);
      anySuccess = true;
    } else if (sectorsRes.status === 'fulfilled') {
      const raw = sectorsRes.value.data || [];
      const normalized = (Array.isArray(raw) ? raw : []).map((s) => ({
        ...s,
        sector_name: s.sector_name || s.display_name || s.name || 'Unknown',
        quadrant: toTitleCase(s.quadrant),
      }));
      setSectorData(normalized);
      anySuccess = true;
    }
    if (breadthRes.status === 'fulfilled') {
      setBreadthData(breadthRes.value.data || null);
      anySuccess = true;
    }
    if (sentimentRes.status === 'fulfilled') {
      setSentimentData(sentimentRes.value.data || null);
      anySuccess = true;
    }
    if (regimeRes.status === 'fulfilled') {
      setRegimeData(regimeRes.value.data || null);
      anySuccess = true;
    }
    setMpOnline(anySuccess);
    setMpLoading(false);
  }, []);

  useEffect(() => {
    async function loadFunds() {
      try {
        const res = await fetchFunds({ limit: 500 });
        setFunds(res.data || []);
      } catch {
        setFunds([]);
      } finally {
        setFundsLoading(false);
      }
    }
    loadFunds();
  }, []);

  useEffect(() => {
    loadMarketPulse(period);
  }, [period, loadMarketPulse]);

  const handlePeriodChange = useCallback((p) => {
    setPeriod(p);
    setSelectedSector(null);
    setView('compass');
  }, []);

  const showFundQuadrant = useCallback(
    async (sector) => {
      setSelectedSector(sector);
      setView('drilldown');

      if (exposureAvailable === null && funds.length > 0) {
        setExposureLoading(true);
        try {
          const sample = funds.slice(0, 5);
          const results = await Promise.allSettled(
            sample.map((f) => fetchSectorExposure(f.mstar_id))
          );
          const hasData = results.some(
            (r) =>
              r.status === 'fulfilled' &&
              r.value.data &&
              r.value.data.length > 0
          );
          setExposureAvailable(hasData);
          if (hasData) {
            const newExposures = { ...sectorExposures };
            results.forEach((r, i) => {
              if (r.status === 'fulfilled' && r.value.data) {
                const map = {};
                r.value.data.forEach((s) => {
                  map[s.sector_name] = s.allocation_pct;
                });
                newExposures[sample[i].mstar_id] = map;
              }
            });
            setSectorExposures(newExposures);
          }
        } catch {
          setExposureAvailable(false);
        } finally {
          setExposureLoading(false);
        }
      }
    },
    [exposureAvailable, funds, sectorExposures]
  );

  const showCompass = useCallback(() => {
    setView('compass');
    setSelectedSector(null);
  }, []);

  const handleHeatmapSectorClick = useCallback(
    (sectorName) => {
      const found = sectorData.find((s) => s.sector_name === sectorName);
      if (found) showFundQuadrant(found);
    },
    [sectorData, showFundQuadrant]
  );

  if (mpLoading && fundsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader key={i} variant="card" className="h-24" />
          ))}
        </div>
        <SkeletonLoader variant="chart" className="h-[520px]" />
        <SkeletonLoader variant="card" className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period pills */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">
          Which sectors are winning and which funds capture them
        </p>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Pill
              key={p}
              active={period === p}
              onClick={() => handlePeriodChange(p)}
            >
              {p}
            </Pill>
          ))}
        </div>
      </div>

      {/* MarketPulse offline banner -- keep flat */}
      {!mpOnline && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-700">
            MarketPulse offline — sector compass data unavailable
          </p>
          <button
            onClick={() => loadMarketPulse(period)}
            className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Market Context Bar */}
        <MarketContextPanel
          regime={regimeData}
          sentiment={sentimentData}
          breadth={breadthData}
          sectorData={sectorData}
          online={mpOnline}
          onRetry={() => loadMarketPulse(period)}
        />

        {/* Main card: Compass or Fund Drill-Down */}
        <div ref={compassRef} className="w-full animate-in">
          {!mpOnline ? (
            <EmptyState
              icon={
                <svg
                  className="w-5 h-5 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
                  />
                </svg>
              }
              message="MarketPulse offline — sector data unavailable"
              action="Retry"
              onAction={() => loadMarketPulse(period)}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              {/* Shared header bar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {view === 'drilldown' && (
                    <button
                      onClick={showCompass}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <span>&larr;</span> All Sectors
                    </button>
                  )}
                  <div>
                    <p className="section-title">
                      {view === 'compass'
                        ? 'Sector Rotation Compass'
                        : `${selectedSector?.sector_name} — Fund Explorer`}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {view === 'compass'
                        ? 'Click any sector bubble to drill into fund-level view'
                        : 'Risk vs Return · Bubble size = sector exposure % · Click any fund for 360 view'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {view === 'drilldown' && selectedSector && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">
                        {selectedSector.sector_name}
                      </span>
                      <span className="text-[10px] text-emerald-600">
                        {selectedSector.quadrant}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePeriodChange(p)}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                          period === p
                            ? 'bg-white shadow-sm text-teal-700 font-semibold'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* VIEW 1: Compass */}
              {view === 'compass' && (
                <div className="view-fade">
                  <CompassChart
                    sectors={sectorData}
                    selectedSector={selectedSector}
                    onSectorClick={showFundQuadrant}
                    width={compassWidth - 48}
                    height={520}
                  />
                </div>
              )}

              {/* VIEW 2: Fund Drill-Down */}
              {view === 'drilldown' && selectedSector && (
                <div className="view-fade">
                  <FundDrillDown
                    sector={selectedSector}
                    funds={funds}
                    sectorExposures={sectorExposures}
                    exposureAvailable={exposureAvailable}
                    loading={exposureLoading || fundsLoading}
                    sort={drillDownSort}
                    onSortChange={setDrillDownSort}
                    categoryFilter={drillDownCategory}
                    onCategoryFilterChange={setDrillDownCategory}
                    purchaseMode={drillDownPurchaseMode}
                    onPurchaseModeChange={setDrillDownPurchaseMode}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rotation Heatmap */}
        <RotationHeatmap
          sectorData={sectorData}
          online={mpOnline}
          onSectorClick={handleHeatmapSectorClick}
        />

        {/* Fund Exposure Matrix */}
        <FundExposureMatrix
          funds={funds}
          sectorData={sectorData}
          sectorExposures={sectorExposures}
          online={mpOnline}
        />
      </div>
    </div>
  );
}
