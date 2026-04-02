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
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchMorningstarSectors,
  fetchFundExposureMatrix,
  fetchSectorHistory,
  fetchBreadth,
  fetchSentiment,
  fetchMarketRegime,
  fetchFunds,
} from '../lib/api';
import { formatCount } from '../lib/format';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import dynamic from 'next/dynamic';

const CompassChart = dynamic(
  () => import('../components/sectors/CompassChart'),
  { ssr: false }
);

import MarketContextPanel from '../components/sectors/MarketContextPanel';
import SectorScoreCards from '../components/sectors/SectorScoreCards';
import MoneyFlowChart from '../components/sectors/MoneyFlowChart';
import RotationHeatmap from '../components/sectors/RotationHeatmap';
import FundExposureMatrix from '../components/sectors/FundExposureMatrix';
import SectorDeepDive from '../components/sectors/SectorDeepDive';
import InfoBulb from '../components/shared/InfoBulb';

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
  // drill-down state removed — SectorDeepDive manages its own state

  const drillRef = useRef(null);
  const [compassWidth, setCompassWidth] = useState(0);
  const observerRef = useRef(null);

  // Callback ref — attaches ResizeObserver when element appears in DOM
  const compassRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      const obs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setCompassWidth(Math.max(400, entry.contentRect.width));
        }
      });
      obs.observe(node);
      observerRef.current = obs;
    }
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

    // Sector data is the core — MarketPulse data is supplementary.
    // Never let MP failures block the page.
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
          total_aum_exposed: h.total_aum_exposed,
          weighted_return: h.weighted_return,
          momentum_3m: h.momentum_3m,
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
    }
    // Sector data alone is enough for the page to be useful
    anySuccess = true;

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
          Sector intelligence from 11 Morningstar sectors across {formatCount(funds.length)}+ funds
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
              <p className="text-[11px] text-slate-500 mt-0.5">
                X-axis: RS Score (relative strength). Y-axis: Momentum (score change).
                Dotted trail lines show movement from previous months — follow the trail to see direction of rotation.
              </p>
            </div>
          </div>

          {compassWidth > 48 ? (
            <>
              <CompassChart
                sectors={sectorData}
                selectedSector={selectedSector}
                onSectorClick={handleSectorClick}
                width={compassWidth - 48}
                height={480}
              />
              <p className="text-[10px] text-slate-400 leading-relaxed mt-2 px-1">
                <strong>How to read:</strong> Each bubble is a Morningstar sector. X-axis = Relative Strength (RS) score (0-100, where 50 = market average).
                Y-axis = RS Momentum (positive = improving, negative = deteriorating). <strong>Leading</strong> (top-right) = strong and getting stronger.
                <strong>Improving</strong> (top-left) = weak but recovering. <strong>Weakening</strong> (bottom-right) = strong but fading.
                <strong>Lagging</strong> (bottom-left) = weak and declining. Bubble size = number of funds in that sector. Dashed trails show 3-month movement history.
                Click a sector for deep-dive analysis.
              </p>
            </>
          ) : (
            <div className="h-[480px] flex items-center justify-center text-sm text-slate-400">
              Measuring layout...
            </div>
          )}

          <InfoBulb title="Sector Rotation Compass" items={[
            { icon: '🧭', label: 'Axes', text: 'X-axis = RS Score (Relative Strength, 0-100). Measures this sector\'s AUM-weighted return vs all 11 sectors. Y-axis = RS Momentum (score change vs last month). Higher = strengthening.' },
            { icon: '📐', label: 'Quadrants', text: 'Top-right (Leading) = strong + gaining → overweight. Top-left (Improving) = weak but gaining → early entry. Bottom-right (Weakening) = strong but fading → reduce. Bottom-left (Lagging) = weak + fading → avoid.' },
            { icon: '- - -', label: 'Dotted lines', text: 'The dashed lines are QUADRANT DIVIDERS at RS=50 (vertical) and Momentum=0 (horizontal). They split the chart into 4 zones. RS>50 means outperforming the average sector.' },
            { icon: '···', label: 'Trail dots', text: 'Small dots connected by dashed lines behind each bubble show the sector\'s HISTORICAL PATH through the compass over previous months. This reveals the direction of travel — e.g., a sector moving from bottom-left to top-left is improving.' },
            { icon: '⭕', label: 'Bubble size', text: 'Proportional to the number of funds with exposure to that sector. Larger = more widely held.' },
            { icon: '👆', label: 'Click', text: 'Click any sector bubble to open its full deep-dive section below with fund analysis, recommendations, and market context.' },
          ]} />
        </div>
      )}

      {/* 4. Two-column: Sector Money Flow + Weight Distribution */}
      {sectorData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MoneyFlowChart
            sectorData={sectorData}
            onSectorClick={handleSectorClick}
          />
          {/* Sector Weight Distribution — replaces duplicate risk-return scatter */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 h-full flex flex-col">
            <p className="section-title mb-1">Sector Weight Distribution</p>
            <p className="text-[11px] text-slate-500 mb-3">Where is the money concentrated? Larger = more AUM exposed.</p>
            <div className="space-y-2 flex-1">
              {[...sectorData].sort((a, b) => (b.avg_weight_pct || 0) - (a.avg_weight_pct || 0)).map((s) => {
                const wt = Number(s.avg_weight_pct) || 0;
                const maxWt = Math.max(...sectorData.map((ss) => Number(ss.avg_weight_pct) || 0), 1);
                const barW = (wt / maxWt) * 100;
                const retVal = Number(s.weighted_return) || 0;
                return (
                  <button
                    key={s.sector_name}
                    type="button"
                    onClick={() => handleSectorClick(s.sector_name)}
                    className="w-full flex items-center gap-2 hover:bg-teal-50/50 rounded px-1 py-1 transition-colors text-left"
                  >
                    <span className="text-[10px] font-medium text-slate-700 w-[100px] truncate">{s.sector_name}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${barW}%` }} />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-slate-600 w-[40px] text-right">{wt.toFixed(1)}%</span>
                    <span className={`text-[10px] font-bold tabular-nums w-[45px] text-right ${retVal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {retVal >= 0 ? '+' : ''}{retVal.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Rotation Heatmap + Fund Exposure Matrix — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RotationHeatmap
          sectorData={sectorData}
          online={mpOnline}
          onSectorClick={handleHeatmapSectorClick}
        />
        <FundExposureMatrix
          funds={funds}
          sectorData={sectorData}
          sectorExposures={sectorExposures}
          online={mpOnline}
        />
      </div>

      {/* 6. Sector Deep-Dive — shown when a sector is selected */}
      {selectedSector && (
        <SectorDeepDive
          ref={drillRef}
          sector={selectedSector}
          sectorData={sectorData}
          funds={funds}
          sectorExposures={sectorExposures}
          exposureAvailable={exposureAvailable}
          fundsLoading={fundsLoading}
          breadthData={breadthData}
          sentimentData={sentimentData}
          regimeData={regimeData}
          onClose={clearSelection}
          onSectorClick={handleSectorClick}
        />
      )}
    </div>
  );
}
