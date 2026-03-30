/**
 * Sectors Page — Complete sector intelligence story.
 *
 * Flow:
 * 1. Market Context (regime, sentiment, breadth, rotation signal)
 * 2. Sector Score Cards (11 sectors at a glance — RS, momentum, action, AUM)
 * 3. Sector Compass (quadrant rotation chart — click to drill)
 * 4. Sector Risk-Return Map (aggregate scatter — RS vs weighted return)
 * 5. Money Flow Direction (inflow/outflow bars)
 * 6. Rotation Heatmap (quadrant history over months)
 * 7. Fund Exposure Matrix (which funds → which sectors)
 * 8. Fund Drill-Down (opens when sector clicked — risk vs return scatter + fund list)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  fetchMorningstarSectors,
  fetchFundExposureMatrix,
  fetchSectorHistory,
  fetchBreadth,
  fetchSentiment,
  fetchMarketRegime,
  fetchFunds,
} from '../lib/api';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import dynamic from 'next/dynamic';

const CompassChart = dynamic(
  () => import('../components/sectors/CompassChart'),
  { ssr: false }
);

import MarketContextPanel from '../components/sectors/MarketContextPanel';
import SectorScoreCards from '../components/sectors/SectorScoreCards';
import SectorRiskReturn from '../components/sectors/SectorRiskReturn';
import MoneyFlowChart from '../components/sectors/MoneyFlowChart';
import RotationHeatmap from '../components/sectors/RotationHeatmap';
import FundExposureMatrix from '../components/sectors/FundExposureMatrix';
import FundDrillDown from '../components/sectors/FundDrillDown';

function buildRotationNarrative(sectors) {
  if (!sectors || sectors.length === 0) return null;

  const grouped = { Leading: [], Improving: [], Weakening: [], Lagging: [] };
  sectors.forEach((s) => {
    const q = s.quadrant || '';
    if (grouped[q]) grouped[q].push(s.sector_name);
  });

  const parts = [];
  if (grouped.Leading.length > 0) {
    parts.push(`**${grouped.Leading.join(' & ')}** in Leading quadrant — consider overweight positions.`);
  }
  if (grouped.Improving.length > 0) {
    parts.push(`**${grouped.Improving.join(' & ')}** improving — early accumulation window.`);
  }
  if (grouped.Weakening.length > 0) {
    parts.push(`**${grouped.Weakening.join(' & ')}** losing momentum — reduce exposure.`);
  }
  if (grouped.Lagging.length > 0) {
    parts.push(`**${grouped.Lagging.join(' & ')}** lagging — avoid or monitor for turnaround.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

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

  const [selectedSector, setSelectedSector] = useState(null);
  const [drillDownSort, setDrillDownSort] = useState('composite');
  const [drillDownCategory, setDrillDownCategory] = useState('all');
  const [drillDownPurchaseMode, setDrillDownPurchaseMode] = useState('Regular');

  const compassRef = useRef(null);
  const drillRef = useRef(null);
  const [compassWidth, setCompassWidth] = useState(0);

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

  const loadData = useCallback(async () => {
    setMpLoading(true);
    const [mstarRes, historyRes, breadthRes, sentimentRes, regimeRes] =
      await Promise.allSettled([
        fetchMorningstarSectors(),
        fetchSectorHistory(6),
        fetchBreadth('1y'),
        fetchSentiment(),
        fetchMarketRegime(),
      ]);

    const toTitleCase = (str) =>
      str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;

    let anySuccess = false;

    // Build history map
    const historyMap = {};
    if (historyRes.status === 'fulfilled' && historyRes.value.data?.length > 0) {
      for (const h of historyRes.value.data) {
        const name = h.sector_name;
        if (!historyMap[name]) historyMap[name] = [];
        historyMap[name].push({
          quadrant: toTitleCase(h.quadrant),
          rs_score: h.rs_score,
          rs_momentum: h.momentum_1m,
          snapshot_date: h.snapshot_date,
        });
      }
      for (const name of Object.keys(historyMap)) {
        historyMap[name].sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date));
      }
    }

    // Morningstar sectors — no Nifty fallback
    if (mstarRes.status === 'fulfilled' && mstarRes.value.data?.length > 0) {
      const raw = mstarRes.value.data;
      const normalized = (Array.isArray(raw) ? raw : []).map((s) => {
        const name = s.sector_name || s.display_name || s.name || 'Unknown';
        return {
          ...s,
          sector_name: name,
          quadrant: toTitleCase(s.quadrant),
          rs_momentum: s.momentum_1m ?? 0,
          history: historyMap[name] || [],
        };
      });
      setSectorData(normalized);
      anySuccess = true;
    } else {
      setSectorData([]);
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
        const [fundsRes, matrixRes] = await Promise.allSettled([
          fetchFunds({ limit: 500 }),
          fetchFundExposureMatrix(20),
        ]);
        const fundsList = fundsRes.status === 'fulfilled' ? (fundsRes.value.data || []) : [];
        let matrixFundsList = [];
        if (matrixRes.status === 'fulfilled' && matrixRes.value.data) {
          const matrix = matrixRes.value.data;
          const list = Array.isArray(matrix) ? matrix : matrix.funds || [];
          const expMap = {};
          list.forEach((f) => {
            if (!f.mstar_id) return;
            expMap[f.mstar_id] = typeof f.sectors === 'object' && !Array.isArray(f.sectors)
              ? f.sectors
              : {};
          });
          setSectorExposures(expMap);
          setExposureAvailable(true);
          matrixFundsList = list;
        }
        const fundsById = {};
        fundsList.forEach((f) => { if (f.mstar_id) fundsById[f.mstar_id] = f; });
        matrixFundsList.forEach((f) => {
          if (f.mstar_id && !fundsById[f.mstar_id]) {
            fundsById[f.mstar_id] = f;
          }
        });
        setFunds(Object.values(fundsById));
      } catch {
        setFunds([]);
      } finally {
        setFundsLoading(false);
      }
    }
    loadFunds();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSectorClick = useCallback((sector) => {
    setSelectedSector(sector);
    // Scroll to drill-down section
    setTimeout(() => {
      drillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSector(null);
  }, []);

  const rotationNarrative = useMemo(
    () => buildRotationNarrative(sectorData),
    [sectorData]
  );

  const handleHeatmapSectorClick = useCallback(
    (sectorName) => {
      const found = sectorData.find((s) => s.sector_name === sectorName);
      if (found) handleSectorClick(found);
    },
    [sectorData, handleSectorClick]
  );

  if (mpLoading && fundsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader key={i} variant="card" className="h-24" />
          ))}
        </div>
        <SkeletonLoader variant="chart" className="h-48" />
        <SkeletonLoader variant="chart" className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page intro */}
      <div>
        <p className="text-sm text-slate-500">
          Sector intelligence from 11 Morningstar sectors across {funds.length.toLocaleString('en-IN')}+ funds
        </p>
      </div>

      {/* MarketPulse offline banner */}
      {!mpOnline && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-700">
            MarketPulse offline — sector data may be stale
          </p>
          <button
            onClick={loadData}
            className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Market Context */}
      <MarketContextPanel
        regime={regimeData}
        sentiment={sentimentData}
        breadth={breadthData}
        sectorData={sectorData}
        online={mpOnline}
        onRetry={loadData}
      />

      {/* 2. Sector Score Cards — the "so what" for each sector */}
      {sectorData.length > 0 && (
        <SectorScoreCards
          sectors={sectorData}
          onSectorClick={handleSectorClick}
        />
      )}

      {sectorData.length === 0 && !mpLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">
            Sector rotation data computing... Check back after the next sector computation run.
          </p>
        </div>
      )}

      {/* 3. Sector Compass — rotation quadrant chart */}
      {sectorData.length > 0 && (
        <div ref={compassRef} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="section-title">Sector Rotation Compass</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click any sector bubble to explore the funds within it
              </p>
            </div>
          </div>

          {compassWidth > 48 ? (
            <CompassChart
              sectors={sectorData}
              selectedSector={selectedSector}
              onSectorClick={handleSectorClick}
              width={compassWidth - 48}
              height={480}
            />
          ) : (
            <div className="h-[480px] flex items-center justify-center text-sm text-slate-400">
              Measuring layout...
            </div>
          )}

          {/* Rotation narrative */}
          {rotationNarrative && (
            <div className="mt-4 p-3 rounded-lg bg-teal-50 border border-teal-100">
              <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider mb-1">
                Rotation Playbook
              </p>
              <p className="text-xs text-teal-800 leading-relaxed">
                {rotationNarrative.replace(/\*\*/g, '')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. Two-column: Risk-Return Map + Money Flow */}
      {sectorData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectorRiskReturn
            sectors={sectorData}
            onSectorClick={handleSectorClick}
          />
          <MoneyFlowChart
            sectorData={sectorData}
            onSectorClick={handleSectorClick}
          />
        </div>
      )}

      {/* 5. Rotation Heatmap */}
      <RotationHeatmap
        sectorData={sectorData}
        online={mpOnline}
        onSectorClick={handleHeatmapSectorClick}
      />

      {/* 6. Fund Exposure Matrix */}
      <FundExposureMatrix
        funds={funds}
        sectorData={sectorData}
        sectorExposures={sectorExposures}
        online={mpOnline}
      />

      {/* 7. Fund Drill-Down — shown when a sector is selected */}
      {selectedSector && (
        <div ref={drillRef} className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={clearSelection}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <span>&larr;</span> All Sectors
              </button>
              <div>
                <p className="section-title">
                  {selectedSector.sector_name} — Fund Explorer
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Risk vs Return · Bubble size = sector exposure % · Click any fund for 360 view
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">
                {selectedSector.sector_name}
              </span>
              <span className="text-[10px] text-emerald-600">
                {selectedSector.quadrant}
              </span>
            </div>
          </div>

          <FundDrillDown
            sector={selectedSector}
            funds={funds}
            sectorExposures={sectorExposures}
            exposureAvailable={exposureAvailable}
            loading={fundsLoading}
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
  );
}
