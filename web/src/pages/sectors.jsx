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
import CompassChart from '../components/sectors/CompassChart';
import MarketContext from '../components/sectors/MarketContext';
import FundDrillDown from '../components/sectors/FundDrillDown';
import RotationTimeline from '../components/sectors/RotationTimeline';

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
  const [drillDownSort, setDrillDownSort] = useState('exposure');
  const [drillDownCategory, setDrillDownCategory] = useState('all');
  const [exposureLoading, setExposureLoading] = useState(false);

  // Compass sizing
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
      setSectorData(sectorsRes.value.data || []);
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

  // Sector click → lazy load exposures
  const handleSectorClick = useCallback(async (sector) => {
    setSelectedSector(sector);

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
          // Cache the probed results
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

  if (mpLoading && fundsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-6">
          <SkeletonLoader variant="chart" className="flex-1 h-[420px]" />
          <SkeletonLoader variant="card" className="w-[260px] h-[420px]" />
        </div>
        <SkeletonLoader variant="card" className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 -m-6">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <p className="text-sm text-slate-500">
          Which sectors are winning and which funds capture them
        </p>
      </div>

      <div className="px-6 space-y-6">
        {/* Compass + Market Context */}
        <div className="flex gap-6">
          <div ref={compassRef} className="flex-1 min-w-0">
            {!mpOnline ? (
              <EmptyState
                icon={'\uD83D\uDCE1'}
                message="MarketPulse offline — sector data unavailable"
                action="Retry"
                onAction={() => loadMarketPulse(period)}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Sector Compass</h3>
                <CompassChart
                  sectors={sectorData}
                  selectedSector={selectedSector}
                  onSectorClick={handleSectorClick}
                  width={compassWidth - 42}
                  height={420}
                />
              </div>
            )}
          </div>

          <div className="w-[260px] flex-shrink-0">
            <MarketContext
              regime={regimeData}
              sentiment={sentimentData}
              breadth={breadthData}
              sectorData={sectorData}
              online={mpOnline}
              period={period}
              onPeriodChange={handlePeriodChange}
            />
          </div>
        </div>

        {/* Fund Drill-Down */}
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
        />

        {/* Rotation Timeline */}
        <RotationTimeline
          currentSectorData={sectorData}
          online={mpOnline}
        />
      </div>
    </div>
  );
}
