import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchSectors,
  fetchBreadth,
  fetchSentiment,
  fetchMarketRegime,
  fetchFunds,
  fetchSectorExposure,
} from '../lib/api';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import Pill from '../components/shared/Pill';
import dynamic from 'next/dynamic';
const CompassChart = dynamic(() => import('../components/sectors/CompassChart'), { ssr: false });
import MarketContextPanel from '../components/sectors/MarketContextPanel';
import FundDrillDown from '../components/sectors/FundDrillDown';
import RotationHeatmap from '../components/sectors/RotationHeatmap';

const PERIODS = ['1M', '3M', '6M', '1Y'];

export default function SectorsPage() {
  // MarketPulse data
  const [sectorData, setSectorData] = useState([]);
  const [breadthData, setBreadthData] = useState(null);
  const [sentimentData, setSentimentData] = useState(null);
  const [regimeData, setRegimeData] = useState(null);
  const [mpOnline, setMpOnline] = useState(true);
  const [mpLoading, setMpLoading] = useState(true);

  // Fund data
  const [funds, setFunds] = useState([]);
  const [sectorExposures, setSectorExposures] = useState({});
  const [exposureAvailable, setExposureAvailable] = useState(null);
  const [fundsLoading, setFundsLoading] = useState(true);

  // UI state
  const [period, setPeriod] = useState('3M');
  const [selectedSector, setSelectedSector] = useState(null);
  const [drillDownSort, setDrillDownSort] = useState('composite');
  const [drillDownCategory, setDrillDownCategory] = useState('all');
  const [drillDownPurchaseMode, setDrillDownPurchaseMode] = useState('Regular');
  const [exposureLoading, setExposureLoading] = useState(false);

  // Compass sizing
  const compassRef = useRef(null);
  const drillDownRef = useRef(null);
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

  // Load MarketPulse data
  const loadMarketPulse = useCallback(async (p) => {
    setMpLoading(true);
    const [sectorsRes, breadthRes, sentimentRes, regimeRes] = await Promise.allSettled([
      fetchSectors(p),
      fetchBreadth('1y'),
      fetchSentiment(),
      fetchMarketRegime(),
    ]);

    let anySuccess = false;
    if (sectorsRes.status === 'fulfilled') {
      const raw = sectorsRes.value.data || [];
      // Normalize: MarketPulse uses display_name + uppercase quadrants
      const toTitleCase = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;
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

  // Load funds
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

  // Initial MarketPulse load
  useEffect(() => {
    loadMarketPulse(period);
  }, [period, loadMarketPulse]);

  // Period change clears selection
  const handlePeriodChange = useCallback((p) => {
    setPeriod(p);
    setSelectedSector(null);
  }, []);

  // Sector click from compass or heatmap
  const handleSectorClick = useCallback(async (sector) => {
    setSelectedSector(sector);

    // Scroll drill-down into view after state update
    setTimeout(() => {
      drillDownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // First time: probe if exposure data exists
    if (exposureAvailable === null && funds.length > 0) {
      setExposureLoading(true);
      try {
        const sample = funds.slice(0, 5);
        const results = await Promise.allSettled(
          sample.map((f) => fetchSectorExposure(f.mstar_id))
        );
        const hasData = results.some(
          (r) => r.status === 'fulfilled' && r.value.data && r.value.data.length > 0
        );
        setExposureAvailable(hasData);

        if (hasData) {
          const newExposures = { ...sectorExposures };
          results.forEach((r, i) => {
            if (r.status === 'fulfilled' && r.value.data) {
              const map = {};
              r.value.data.forEach((s) => { map[s.sector_name] = s.allocation_pct; });
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
  }, [exposureAvailable, funds, sectorExposures]);

  // Heatmap sector click — find the sector object by name
  const handleHeatmapSectorClick = useCallback((sectorName) => {
    const found = sectorData.find((s) => s.sector_name === sectorName);
    if (found) {
      handleSectorClick(found);
    }
  }, [sectorData, handleSectorClick]);

  if (mpLoading && fundsLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader variant="chart" className="h-[480px]" />
        <div className="grid grid-cols-4 gap-4">
          <SkeletonLoader variant="card" className="h-32" />
          <SkeletonLoader variant="card" className="h-32" />
          <SkeletonLoader variant="card" className="h-32" />
          <SkeletonLoader variant="card" className="h-32" />
        </div>
        <SkeletonLoader variant="card" className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 -m-6">
      {/* Header with period pills */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Which sectors are winning and which funds capture them
        </p>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Pill key={p} active={period === p} onClick={() => handlePeriodChange(p)}>
              {p}
            </Pill>
          ))}
        </div>
      </div>

      {/* MarketPulse offline banner */}
      {!mpOnline && (
        <div className="mx-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
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

      <div className="px-6 space-y-6">
        {/* Compass chart — FULL WIDTH */}
        <div ref={compassRef} className="w-full">
          {!mpOnline ? (
            <EmptyState
              icon={<svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>}
              message="MarketPulse offline — sector data unavailable"
              action="Retry"
              onAction={() => loadMarketPulse(period)}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Sector Compass</h3>
                {selectedSector && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Selected:</span>
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                      {selectedSector.sector_name}
                    </span>
                    <button
                      onClick={() => setSelectedSector(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <CompassChart
                sectors={sectorData}
                selectedSector={selectedSector}
                onSectorClick={handleSectorClick}
                width={compassWidth - 42}
                height={480}
              />
            </div>
          )}
        </div>

        {/* Market Context Panel — horizontal row below compass */}
        <MarketContextPanel
          regime={regimeData}
          sentiment={sentimentData}
          breadth={breadthData}
          sectorData={sectorData}
          online={mpOnline}
        />

        {/* Fund Drill-Down */}
        <div ref={drillDownRef}>
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

        {/* Rotation Heatmap */}
        <RotationHeatmap
          sectorData={sectorData}
          online={mpOnline}
          onSectorClick={handleHeatmapSectorClick}
        />
      </div>
    </div>
  );
}
