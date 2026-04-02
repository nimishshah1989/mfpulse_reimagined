/**
 * SectorDeepDive v2 — Dense sector intelligence landing section.
 *
 * 42+ data points across 8 sections:
 * 1. Header + Stats Ribbon (9 metrics)
 * 2. Positioning Panel: Quadrant Intelligence + Market Health Gauges
 * 3. Sector Fund Breakdown (category distribution)
 * 4. Fund 2×2 Scatter (risk vs return, lens color, AUM sized)
 * 5. Top Funds Table (paginated, filterable, all 6 lenses)
 * 6. AMC Concentration
 * 7. Recommendations + Action CTAs
 * 8. InfoBulb on every section
 */
import { forwardRef, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct, formatAUMRaw, formatCount, formatScore } from '../../lib/format';
import { fetchSectorDrillDown } from '../../lib/api';
import InfoBulb from '../shared/InfoBulb';

const PAGE_SIZE = 15;

const QUADRANT_ACTIONS = {
  Leading: { action: 'OVERWEIGHT', icon: '↑', desc: 'Strong RS + rising momentum — increase allocation', short: 'Add' },
  Improving: { action: 'ACCUMULATE', icon: '↗', desc: 'Low RS but gaining fast — early entry window', short: 'Enter' },
  Weakening: { action: 'REDUCE', icon: '↘', desc: 'High RS but losing steam — take profits, trim', short: 'Trim' },
  Lagging: { action: 'AVOID', icon: '↓', desc: 'Low RS + falling further — wait for turnaround', short: 'Wait' },
};

const QUADRANT_MEANING = {
  Leading: 'High relative strength AND gaining momentum. This sector is outperforming and accelerating.',
  Improving: 'Currently underperforming BUT momentum is turning positive. Early entry opportunity.',
  Weakening: 'Currently outperforming BUT momentum is fading. Consider reducing exposure.',
  Lagging: 'Low relative strength AND losing further ground. Stay underweight until reversal.',
};

const REGIME_MEANING = {
  BULL: 'Broad market trend is upward. Most sectors benefit from risk-on positioning.',
  BEAR: 'Broad market is in a downtrend. Defensives and cash preservation take priority.',
  NEUTRAL: 'Market lacks clear direction. Stock selection and sector rotation matter more than overall exposure.',
};

const BREADTH_ZONE_MEANING = {
  Healthy: 'Most stocks are above their 21-day EMA — broad participation in the rally.',
  Recovery: 'Breadth is improving after a weak period — market recovering from recent weakness.',
  Deterioration: 'Fewer stocks above their EMA — selective market, only a few leaders holding up.',
  Oversold: 'Very few stocks above EMA — potential bounce territory but macro risk elevated.',
  Overbought: 'Almost all stocks above EMA — rally may be extended, proceed cautiously.',
};

const ACTION_MEANING = {
  OVERWEIGHT: 'Increase sector allocation above benchmark weight.',
  ACCUMULATE: 'Start or grow positions on dips — wait for strength confirmation.',
  REDUCE: 'Trim positions gradually — lock in gains before momentum deteriorates.',
  AVOID: 'Do not add new exposure. Exit on rallies if already holding.',
};

const LENS_NAMES = ['return', 'risk', 'alpha', 'consistency', 'efficiency', 'resilience'];

function scoreColor(v) {
  if (v == null) return '#94a3b8';
  if (v >= 80) return '#059669';
  if (v >= 60) return '#10b981';
  if (v >= 40) return '#f59e0b';
  if (v >= 20) return '#ef4444';
  return '#dc2626';
}

function scoreBg(v) {
  if (v == null) return 'bg-slate-100 text-slate-400';
  if (v >= 70) return 'bg-emerald-100 text-emerald-700';
  if (v >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

const PRESET_FILTERS = [
  { key: 'all', label: 'All Funds' },
  { key: 'high_alpha', label: 'High Alpha (70+)' },
  { key: 'low_risk', label: 'Low Risk (70+)' },
  { key: 'max_exposure', label: 'Max Exposure' },
  { key: 'best_overall', label: 'Best Overall' },
  { key: 'large_aum', label: 'Large AUM' },
];

/* ── Tooltip component ── */
function Tooltip2({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

const SectorDeepDive = forwardRef(function SectorDeepDive({
  sector,
  sectorData,
  funds,
  sectorExposures,
  exposureAvailable,
  fundsLoading,
  breadthData,
  sentimentData,
  regimeData,
  onClose,
  onSectorClick,
}, ref) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState('composite');
  const [page, setPage] = useState(0);
  const [presetFilter, setPresetFilter] = useState('all');
  const [drillFunds, setDrillFunds] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const q = sector.quadrant || 'Lagging';
  const colors = QUADRANT_COLORS[q] || QUADRANT_COLORS.Lagging;
  const actionInfo = QUADRANT_ACTIONS[q] || QUADRANT_ACTIONS.Lagging;
  const mom1m = sector.rs_momentum ?? sector.momentum_1m ?? 0;
  const mom3m = sector.momentum_3m ?? 0;
  const wRet = sector.weighted_return ?? 0;
  const aum = sector.total_aum_exposed ?? 0;
  const avgWt = sector.avg_weight_pct ?? 0;

  // Fetch real drill-down data from backend (all 6 lenses, AUM, returns)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDrillLoading(true);
      try {
        const drillRes = await fetchSectorDrillDown(sector.sector_name, 3, 200);
        if (!cancelled) {
          setDrillFunds(drillRes.data || []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setDrillLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sector.sector_name]);

  // Reset page on filter/sort change
  useEffect(() => { setPage(0); }, [presetFilter, sortKey]);

  // Apply preset filter
  const filteredFunds = useMemo(() => {
    let list = [...drillFunds];
    switch (presetFilter) {
      case 'high_alpha':
        list = list.filter((f) => (f.alpha_score ?? 0) >= 70);
        break;
      case 'low_risk':
        list = list.filter((f) => (f.risk_score ?? 0) >= 70);
        break;
      case 'max_exposure':
        list.sort((a, b) => (b.sector_exposure_pct ?? 0) - (a.sector_exposure_pct ?? 0));
        return list;
      case 'best_overall': {
        list.sort((a, b) => {
          const avgA = LENS_NAMES.reduce((s, l) => s + (Number(a[`${l}_score`]) || 0), 0) / 6;
          const avgB = LENS_NAMES.reduce((s, l) => s + (Number(b[`${l}_score`]) || 0), 0) / 6;
          return avgB - avgA;
        });
        return list;
      }
      case 'large_aum':
        list.sort((a, b) => (b.aum ?? 0) - (a.aum ?? 0));
        return list;
      default:
        break;
    }
    // Default sort
    switch (sortKey) {
      case 'return_1y': list.sort((a, b) => (Number(b.return_1y) || 0) - (Number(a.return_1y) || 0)); break;
      case 'exposure': list.sort((a, b) => (b.sector_exposure_pct ?? 0) - (a.sector_exposure_pct ?? 0)); break;
      case 'risk_score': list.sort((a, b) => (Number(a.risk_score) || 0) - (Number(b.risk_score) || 0)); break;
      case 'alpha_score': list.sort((a, b) => (Number(b.alpha_score) || 0) - (Number(a.alpha_score) || 0)); break;
      default: {
        list.sort((a, b) => {
          const avgA = LENS_NAMES.reduce((s, l) => s + (Number(a[`${l}_score`]) || 0), 0) / 6;
          const avgB = LENS_NAMES.reduce((s, l) => s + (Number(b[`${l}_score`]) || 0), 0) / 6;
          return ((b.sector_exposure_pct ?? 0) * avgB) - ((a.sector_exposure_pct ?? 0) * avgA);
        });
      }
    }
    return list;
  }, [drillFunds, presetFilter, sortKey]);

  const totalPages = Math.ceil(filteredFunds.length / PAGE_SIZE);
  const pageFunds = filteredFunds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Top funds
  const top5 = useMemo(() => {
    const sorted = [...drillFunds].sort((a, b) => {
      const avgA = LENS_NAMES.reduce((s, l) => s + (Number(a[`${l}_score`]) || 0), 0) / 6;
      const avgB = LENS_NAMES.reduce((s, l) => s + (Number(b[`${l}_score`]) || 0), 0) / 6;
      return avgB - avgA;
    });
    return sorted.slice(0, 5);
  }, [drillFunds]);

  const worstFund = useMemo(() => {
    const sorted = [...drillFunds].sort((a, b) => (Number(a.return_1y) || 0) - (Number(b.return_1y) || 0));
    return sorted[0] || null;
  }, [drillFunds]);

  // AMC concentration
  const amcBreakdown = useMemo(() => {
    const amcs = {};
    drillFunds.forEach((f) => {
      const amc = f.amc_name || 'Unknown';
      if (!amcs[amc]) amcs[amc] = { count: 0, aum: 0 };
      amcs[amc].count += 1;
      amcs[amc].aum += f.aum || 0;
    });
    return Object.entries(amcs)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.aum - a.aum)
      .slice(0, 8);
  }, [drillFunds]);

  // Category breakdown — fund count + avg exposure per category
  const categoryBreakdown = useMemo(() => {
    const cats = {};
    drillFunds.forEach((f) => {
      const cat = f.category_name || 'Other';
      if (!cats[cat]) cats[cat] = { count: 0, totalExp: 0 };
      cats[cat].count += 1;
      cats[cat].totalExp += f.sector_exposure_pct || 0;
    });
    return Object.entries(cats)
      .map(([name, d]) => ({ name, count: d.count, avgExp: d.count > 0 ? d.totalExp / d.count : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [drillFunds]);

  // Scatter data
  const scatterData = useMemo(() => {
    return drillFunds.map((f) => ({
      x: Number(f.risk_score) || 50,
      y: Number(f.return_1y) || 0,
      z: f.aum || 0,
      name: f.fund_name,
      category: f.category_name,
      mstar_id: f.mstar_id,
      returnScore: f.return_score,
      exposure: f.sector_exposure_pct,
    }));
  }, [drillFunds]);

  // RS trend sparkline
  const trendData = useMemo(() => {
    const data = [];
    if (sector.history?.length) {
      sector.history.forEach((h, i) => {
        data.push({
          month: i,
          score: h.rs_score,
          momentum: h.rs_momentum,
          label: h.snapshot_date ? h.snapshot_date.slice(5, 7) + '/' + h.snapshot_date.slice(2, 4) : `M-${sector.history.length - i}`,
        });
      });
    }
    data.push({ month: data.length, score: sector.rs_score, momentum: mom1m, label: 'Now' });
    return data;
  }, [sector, mom1m]);

  // Quadrant trajectory
  const trajectory = useMemo(() => {
    if (!sector.history?.length) return null;
    const prev = sector.history[sector.history.length - 1]?.quadrant;
    if (!prev || prev === sector.quadrant) return null;
    return { from: prev, to: sector.quadrant };
  }, [sector]);

  // Peer sectors in same quadrant
  const peerSectors = useMemo(() => {
    return (sectorData || []).filter(
      (s) => s.quadrant === sector.quadrant && s.sector_name !== sector.sector_name
    );
  }, [sectorData, sector]);

  // Sentiment data extraction
  const sentimentScore = sentimentData?.composite_score ?? null;
  const sentimentZone = sentimentData?.zone ?? null;
  const layerScores = sentimentData?.layer_scores ?? {};
  const broadTrend = sentimentData?.broad_trend?.metrics ?? [];
  const momentumMetrics = sentimentData?.momentum?.metrics ?? [];
  const extremes = sentimentData?.extremes?.metrics ?? [];

  // Breadth data
  const breadthIndicators = breadthData?.indicators ?? {};
  const ema21 = breadthIndicators?.ema21?.current ?? {};

  // Regime
  const regimeLabel = regimeData?.market_regime || null;
  const leadingSectors = regimeData?.leading_sectors ?? [];

  // Sector rank among all 11
  const sectorRank = useMemo(() => {
    if (!sectorData?.length) return null;
    const sorted = [...sectorData].sort((a, b) => (b.rs_score || 0) - (a.rs_score || 0));
    const idx = sorted.findIndex((s) => s.sector_name === sector.sector_name);
    return idx >= 0 ? idx + 1 : null;
  }, [sectorData, sector]);

  if (!sector) return null;

  return (
    <div ref={ref} className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
      {/* ══ HEADER ══ */}
      <div className="px-6 py-4 border-b border-slate-100" style={{ backgroundColor: colors.bg }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
            >
              <span>←</span> All Sectors
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{sector.sector_name}</h2>
                {sectorRank && (
                  <span className="text-xs font-bold text-slate-400">
                    #{sectorRank} of 11
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {drillFunds.length} funds with ≥3% exposure · Data as of {sector.snapshot_date || 'latest'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {regimeLabel && (
              <div className="flex flex-col items-end gap-0.5">
                <Tooltip2 text={REGIME_MEANING[regimeLabel] || 'Current broad market trend.'}>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-help ${
                    regimeLabel === 'BULL' ? 'bg-emerald-100 text-emerald-700'
                    : regimeLabel === 'BEAR' ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {regimeLabel} Market ⓘ
                  </span>
                </Tooltip2>
              </div>
            )}
            <div className="flex flex-col items-end gap-0.5">
              <Tooltip2 text={QUADRANT_MEANING[q] || actionInfo.desc}>
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold cursor-help ${colors.badge}`}>
                  {q} ⓘ
                </span>
              </Tooltip2>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Tooltip2 text={ACTION_MEANING[actionInfo.action] || actionInfo.desc}>
                <span
                  className="px-3 py-1.5 rounded-lg text-sm font-bold cursor-help"
                  style={{ backgroundColor: `${colors.circle}15`, color: colors.circle }}
                >
                  {actionInfo.icon} {actionInfo.action} ⓘ
                </span>
              </Tooltip2>
            </div>
          </div>
        </div>

        {/* Tag explanation row */}
        <div className="mt-3 flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white/60 rounded-lg px-3 py-1.5">
            <span className="text-[11px] font-semibold text-slate-600">{q}:</span>
            <span className="text-[11px] text-slate-500">{actionInfo.desc}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/60 rounded-lg px-3 py-1.5">
            <span className="text-[11px] font-semibold text-slate-600">What to do:</span>
            <span className="text-[11px] text-slate-500">{ACTION_MEANING[actionInfo.action]}</span>
          </div>
          {regimeLabel && (
            <div className="flex items-center gap-1.5 bg-white/60 rounded-lg px-3 py-1.5">
              <span className="text-[11px] font-semibold text-slate-600">{regimeLabel} Market:</span>
              <span className="text-[11px] text-slate-500">{REGIME_MEANING[regimeLabel]}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ══ SECTION 1: Stats Ribbon ══ */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="RS Score" value={Math.round(sector.rs_score)} color={colors.circle} large />
          <StatCard
            label="Momentum 1M"
            value={`${mom1m > 0 ? '+' : ''}${Number(mom1m).toFixed(1)}`}
            color={mom1m >= 0 ? '#059669' : '#dc2626'}
            large
          />
          <StatCard
            label="Momentum 3M"
            value={`${mom3m > 0 ? '+' : ''}${Number(mom3m).toFixed(1)}`}
            color={mom3m >= 0 ? '#059669' : '#dc2626'}
          />
          <StatCard
            label="Weighted 1Y Ret"
            value={formatPct(wRet)}
            color={wRet >= 0 ? '#059669' : '#dc2626'}
          />
          <StatCard label="AUM Deployed" value={formatAUMRaw(aum)} color="#334155" />
          <StatCard label="Fund Count" value={formatCount(sector.fund_count)} color="#334155" />
          <StatCard label="Avg Portfolio Wt" value={`${Number(avgWt).toFixed(1)}%`} color="#334155" />
          {sentimentScore != null && (
            <StatCard
              label="Mkt Sentiment"
              value={Math.round(sentimentScore)}
              color={sentimentScore >= 60 ? '#059669' : sentimentScore >= 40 ? '#d97706' : '#dc2626'}
              sub={sentimentZone || ''}
            />
          )}
        </div>

        <InfoBulb title="Stats Ribbon" items={[
          { icon: '📊', label: 'RS Score', text: 'Relative Strength 0-100. Measures this sector\'s AUM-weighted return vs all 11 sectors. >50 = outperforming, <50 = underperforming.' },
          { icon: '📈', label: 'Momentum', text: '1M = RS score change vs last month. 3M = vs 3 months ago. Positive = strengthening, negative = weakening.' },
          { icon: '💰', label: 'AUM Deployed', text: 'Total rupees deployed across all funds in this sector (fund AUM × sector exposure %).' },
          { icon: '⚖️', label: 'Avg Portfolio Wt', text: 'Average allocation to this sector across all funds that hold it.' },
        ]} />

        {/* ══ SECTION 2: Two-column — Quadrant Intelligence + Market Health ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Quadrant Intelligence */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Quadrant Intelligence</p>

            {/* Quadrant Journey — horizontal step showing quadrant at each snapshot */}
            {trendData.length > 1 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Quadrant Journey</p>
                <div className="flex items-center gap-1">
                  {trendData.map((d, i) => {
                    const qd = d.score >= 50
                      ? (d.momentum >= 0 ? 'Leading' : 'Weakening')
                      : (d.momentum >= 0 ? 'Improving' : 'Lagging');
                    const qColors = QUADRANT_COLORS[qd] || QUADRANT_COLORS.Lagging;
                    const isNow = i === trendData.length - 1;
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <div className={`flex flex-col items-center ${isNow ? 'relative' : ''}`}>
                          <span className="text-[10px] text-slate-400 mb-0.5">{d.label}</span>
                          <div
                            className={`rounded-md px-2 py-1.5 text-center ${isNow ? 'ring-2 ring-offset-1' : ''}`}
                            style={{
                              backgroundColor: `${qColors.circle}20`,
                              color: qColors.circle,
                              ...(isNow ? { ringColor: qColors.circle } : {}),
                            }}
                          >
                            <span className="text-xs font-bold block">{Math.round(d.score)}</span>
                            <span className="text-[9px] font-medium">{qd.slice(0, 3).toUpperCase()}</span>
                          </div>
                        </div>
                        {i < trendData.length - 1 && (
                          <span className="text-slate-300 text-xs mt-3">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <ContextRow label="Quadrant" value={`${q} — ${actionInfo.desc}`} color={colors.circle} />
              {trajectory && (
                <ContextRow label="Shift" value={`${trajectory.from} → ${trajectory.to}`} color={colors.circle} />
              )}
              {peerSectors.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-slate-400 w-20 flex-shrink-0 pt-0.5">Also {q}</span>
                  <span className="text-xs font-medium leading-snug text-slate-700 flex flex-wrap gap-1">
                    {peerSectors.map((s) => (
                      <button
                        key={s.sector_name}
                        onClick={() => onSectorClick && onSectorClick(s)}
                        className="underline decoration-dotted hover:text-teal-600 transition-colors"
                      >
                        {s.sector_name}
                      </button>
                    ))}
                  </span>
                </div>
              )}
              {sectorRank && (
                <ContextRow label="RS Rank" value={`#${sectorRank} of 11 sectors`} />
              )}
            </div>

            <InfoBulb title="Quadrant" items={[
              { icon: '🧭', label: 'Quadrants', text: 'Leading = strong + gaining. Improving = weak but gaining. Weakening = strong but fading. Lagging = weak + fading.' },
              { icon: '🔄', label: 'Trajectory', text: 'Shows quadrant shift from last snapshot. A shift from Lagging→Improving is an early buy signal.' },
            ]} />
          </div>

          {/* Right: Market Health Gauges */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Market Health Context</p>

            {/* Sentiment Layer Bars */}
            {Object.keys(layerScores).length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Sentiment Layers (0-100)</p>
                <div className="space-y-1.5">
                  {Object.entries(layerScores).map(([key, val]) => (
                    <Tooltip2 key={key} text={`${key.replace(/_/g, ' ')} score: ${Math.round(val)}/100. Higher = more bullish signal from this category of indicators.`}>
                      <div className="flex items-center gap-2 cursor-help">
                        <span className="text-xs text-slate-500 w-24 flex-shrink-0 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, val))}%`,
                              backgroundColor: scoreColor(val),
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color: scoreColor(val) }}>
                          {Math.round(val)}
                        </span>
                      </div>
                    </Tooltip2>
                  ))}
                </div>
              </div>
            )}

            {/* Broad Trend Metrics */}
            {broadTrend.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Market Breadth — Nifty 500 stocks</p>
                <div className="space-y-1.5">
                  {broadTrend.slice(0, 6).map((m) => (
                    <div key={m.key} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-36 flex-shrink-0">{m.label?.replace(/\(.*\)/, '').trim()}</span>
                      <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(2, m.pct || 0))}%`,
                            backgroundColor: m.pct >= 50 ? '#059669' : m.pct >= 25 ? '#d97706' : '#dc2626',
                          }}
                        />
                      </div>
                      <span className={`text-xs font-bold tabular-nums w-10 text-right ${m.pct >= 50 ? 'text-emerald-600' : m.pct >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                        {m.pct?.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extremes row */}
            {extremes.length > 0 && (
              <div className="flex gap-3">
                {extremes.slice(0, 2).map((e) => (
                  <Tooltip2 key={e.key} text={
                    e.key.includes('overbought')
                      ? `${e.count} of ${e.total} Nifty 500 stocks have very high momentum (potential pullback risk). Lower is safer.`
                      : `${e.count} of ${e.total} Nifty 500 stocks have very low momentum (potential bounce candidates). Higher = more oversold.`
                  }>
                    <div className="flex-1 bg-white rounded p-2.5 cursor-help">
                      <p className="text-xs text-slate-400 mb-1">{e.key.includes('overbought') ? 'Overbought Stocks' : 'Oversold Stocks'}</p>
                      <p className="text-base font-bold tabular-nums" style={{ color: e.key.includes('overbought') ? '#dc2626' : '#059669' }}>
                        {e.count} <span className="text-xs font-normal text-slate-400 ml-1">of {e.total} ({e.pct?.toFixed(1)}%)</span>
                      </p>
                    </div>
                  </Tooltip2>
                ))}
              </div>
            )}

            {/* Breadth EMA21 */}
            {ema21.zone && (
              <Tooltip2 text={BREADTH_ZONE_MEANING[ema21.zone] || `${ema21.count} of ${ema21.total} stocks are above their 21-day EMA.`}>
                <div className="flex items-center gap-3 p-2.5 bg-white rounded cursor-help">
                  <span className="text-xs text-slate-400">Breadth Zone:</span>
                  <span className={`text-sm font-bold ${
                    ema21.zone === 'Healthy' || ema21.zone === 'Recovery' ? 'text-emerald-600'
                    : ema21.zone === 'Deterioration' ? 'text-red-500' : 'text-amber-600'
                  }`}>
                    {ema21.zone}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">
                    {ema21.count} of {ema21.total} stocks above 21-day avg
                  </span>
                </div>
              </Tooltip2>
            )}

            <InfoBulb title="Market Health" items={[
              { icon: '🌡️', label: 'Sentiment Layers', text: 'Five independent measures of Nifty 500 health: extremes, momentum, short-term trend, advance/decline breadth, and broad trend. 0-100 each. Higher = more bullish.' },
              { icon: '📶', label: 'Breadth', text: 'What % of Nifty 500 stocks are above key moving averages. >50% = healthy bull market, <25% = weak/bearish. This is overall market health, not sector-specific.' },
              { icon: '⚠️', label: 'Overbought/Oversold', text: 'Counts of Nifty 500 stocks with extreme momentum. Many overbought = market may pull back. Many oversold = potential bounce. Useful for timing sector entry/exit.' },
            ]} />
          </div>
        </div>

        {/* ══ SECTION 3: Sector Fund Breakdown ══ */}
        {categoryBreakdown.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Sector Fund Breakdown</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Which fund categories invest in {sector.sector_name} — fund count and average sector exposure
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {categoryBreakdown.map(({ name, count, avgExp }) => {
                const maxCount = categoryBreakdown[0]?.count || 1;
                const barPct = (count / maxCount) * 100;
                return (
                  <div key={name} className="flex items-center gap-3">
                    <button
                      className="text-xs text-slate-700 w-44 flex-shrink-0 truncate text-left hover:text-teal-600 hover:underline transition-colors"
                      title={name}
                      onClick={() => router.push(`/universe?category=${encodeURIComponent(name)}`)}
                    >
                      {name}
                    </button>
                    <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all flex items-center pl-2"
                        style={{ width: `${Math.max(barPct, 4)}%`, backgroundColor: `${colors.circle}cc` }}
                      >
                        {barPct > 20 && (
                          <span className="text-[10px] font-bold text-white">{formatCount(count)} funds</span>
                        )}
                      </div>
                    </div>
                    {barPct <= 20 && (
                      <span className="text-xs font-bold text-slate-600 w-12 flex-shrink-0">{formatCount(count)} funds</span>
                    )}
                    {barPct > 20 && <span className="w-12 flex-shrink-0" />}
                    <span className="text-xs text-slate-400 w-20 text-right flex-shrink-0">
                      avg <span className="font-semibold text-slate-600">{avgExp.toFixed(1)}%</span> exp
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Click a category name to explore those funds in the Universe page.
            </p>
            <InfoBulb title="Sector Fund Breakdown" items={[
              { icon: '📂', label: 'What this shows', text: 'How many funds in each SEBI category invest in this sector. Bar length = relative fund count.' },
              { icon: '📐', label: 'Avg Exposure', text: 'Average allocation to this sector within that category. Higher = more concentrated sector bet across those funds.' },
              { icon: '👆', label: 'Click to explore', text: 'Click any category name to open Universe filtered to that category.' },
            ]} />
          </div>
        )}

        {/* ══ SECTION 4: Recommendations Row ══ */}
        {top5.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Best Fund */}
            {top5[0] && (
              <RecoCard
                icon="★" iconColor="#059669" label="Best Fund (Composite)"
                fund={top5[0]} colors={colors} sectorName={sector.sector_name}
                onClick={() => router.push(`/fund360?fund=${top5[0].mstar_id}`)}
              />
            )}
            {/* Runner-up */}
            {top5[1] && (
              <RecoCard
                icon="▲" iconColor="#0d9488" label="Runner-up"
                fund={top5[1]} colors={colors} sectorName={sector.sector_name}
                onClick={() => router.push(`/fund360?fund=${top5[1].mstar_id}`)}
              />
            )}
            {/* Avoid */}
            {worstFund && worstFund.mstar_id !== top5[0]?.mstar_id && (
              <RecoCard
                icon="✗" iconColor="#dc2626" label="Avoid (Worst 1Y)"
                fund={worstFund} colors={{ circle: '#dc2626' }} sectorName={sector.sector_name}
                onClick={() => router.push(`/fund360?fund=${worstFund.mstar_id}`)}
              />
            )}
          </div>
        )}

        {/* ══ SECTION 5: Fund 2×2 Scatter ══ */}
        {scatterData.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-slate-800">Fund Risk vs Return — {sector.sector_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Top-left = sweet spot (high return, low risk). Bubble size = AUM. Color = return score tier.
                </p>
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-slate-50" style={{ height: 380 }}>
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none z-0">
                <div className="flex items-start justify-start p-2">
                  <span className="text-[10px] font-bold text-emerald-400/60 uppercase">Sweet Spot</span>
                </div>
                <div className="flex items-start justify-end p-2">
                  <span className="text-[10px] font-bold text-amber-400/50 uppercase">High Risk/Return</span>
                </div>
                <div className="flex items-end justify-start p-2">
                  <span className="text-[10px] font-bold text-sky-400/50 uppercase">Conservative</span>
                </div>
                <div className="flex items-end justify-end p-2">
                  <span className="text-[10px] font-bold text-red-400/50 uppercase">Avoid</span>
                </div>
              </div>
              <div className="relative z-10 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="x" name="Risk Score"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      label={{ value: 'Risk Score (Higher = Lower Risk) →', position: 'bottom', style: { fontSize: 11, fontWeight: 600, fill: '#64748b' } }}
                    />
                    <YAxis type="number" dataKey="y" name="Fund 1Y Return"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      label={{ value: '\u2191 Fund 1Y Return %', angle: -90, position: 'insideLeft', style: { fontSize: 11, fontWeight: 600, fill: '#64748b' } }}
                    />
                    <ZAxis type="number" dataKey="z" range={[40, 400]} name="AUM" />
                    <Tooltip content={<FundScatterTooltip />} />
                    <Scatter data={scatterData} cursor="pointer"
                      onClick={(d) => d?.mstar_id && router.push(`/fund360?fund=${d.mstar_id}`)}>
                      {scatterData.map((d, i) => (
                        <Cell key={i} fill={scoreColor(d.returnScore)} fillOpacity={0.65} stroke={scoreColor(d.returnScore)} strokeWidth={1.5} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
            <InfoBulb title="Risk vs Return Scatter" items={[
              { icon: '🎯', label: 'Sweet Spot', text: 'Top-left quadrant = high return + low risk. These are the most efficient funds in this sector.' },
              { icon: '🔵', label: 'Bubble Size', text: 'Proportional to fund AUM. Larger bubbles = bigger funds with more institutional confidence.' },
              { icon: '🎨', label: 'Color', text: 'Green = high return score (70+), amber = moderate (40-69), red = low (<40). Based on 6-lens percentile ranking.' },
              { icon: '👆', label: 'Interaction', text: 'Click any bubble to open its Fund 360 deep-dive page.' },
            ]} />
          </div>
        )}

        {/* ══ SECTION 6: Fund Table (paginated + filterable) ══ */}
        {(drillFunds.length > 0 || drillLoading) && (
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-sm font-bold text-slate-800">
                All Funds ({filteredFunds.length})
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {PRESET_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setPresetFilter(f.key)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      presetFilter === f.key
                        ? 'bg-teal-100 text-teal-700 border border-teal-200'
                        : 'text-slate-500 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort row */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400">Sort:</span>
              {[
                { key: 'composite', label: 'Best Overall' },
                { key: 'return_1y', label: '1Y Return' },
                { key: 'exposure', label: 'Exposure %' },
                { key: 'alpha_score', label: 'Alpha' },
                { key: 'risk_score', label: 'Lowest Risk' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    sortKey === opt.key
                      ? 'bg-slate-200 text-slate-800'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {drillLoading ? (
              <div className="h-40 flex items-center justify-center text-sm text-slate-400">Loading funds...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="text-left pb-2 pr-2 font-semibold w-8">#</th>
                        <th className="text-left pb-2 pr-2 font-semibold">Fund</th>
                        <th className="text-left pb-2 pr-2 font-semibold">Category</th>
                        <th className="text-right pb-2 pr-2 font-semibold">Exp%</th>
                        <th className="text-right pb-2 pr-2 font-semibold">1Y Ret</th>
                        <th className="text-right pb-2 pr-2 font-semibold">3Y Ret</th>
                        <th className="text-right pb-2 pr-2 font-semibold">AUM</th>
                        <th className="text-center pb-2 px-1 font-semibold">Ret</th>
                        <th className="text-center pb-2 px-1 font-semibold">Risk</th>
                        <th className="text-center pb-2 px-1 font-semibold">Alpha</th>
                        <th className="text-center pb-2 px-1 font-semibold">Cons</th>
                        <th className="text-center pb-2 px-1 font-semibold">Eff</th>
                        <th className="text-center pb-2 px-1 font-semibold">Resil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pageFunds.map((fund, i) => {
                        const ret1y = Number(fund.return_1y) || 0;
                        const ret3y = Number(fund.return_3y);
                        return (
                          <tr
                            key={fund.mstar_id}
                            className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                          >
                            <td className="py-2 pr-2 text-slate-400 font-mono text-xs">{page * PAGE_SIZE + i + 1}</td>
                            <td className="py-2 pr-2 font-semibold text-slate-800 max-w-[200px] truncate" title={fund.fund_name}>
                              {fund.fund_name}
                            </td>
                            <td className="py-2 pr-2 text-slate-500 max-w-[120px] truncate text-xs">{fund.category_name || '—'}</td>
                            <td className="py-2 pr-2 text-right font-bold tabular-nums" style={{ color: colors.circle }}>
                              {fund.sector_exposure_pct != null ? `${Number(fund.sector_exposure_pct).toFixed(0)}%` : '—'}
                            </td>
                            <td className={`py-2 pr-2 text-right font-bold tabular-nums ${ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {fund.return_1y != null ? formatPct(ret1y) : '—'}
                            </td>
                            <td className={`py-2 pr-2 text-right tabular-nums ${!isNaN(ret3y) && ret3y >= 0 ? 'text-emerald-600' : !isNaN(ret3y) ? 'text-red-500' : 'text-slate-400'}`}>
                              {!isNaN(ret3y) ? formatPct(ret3y) : '—'}
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums text-slate-600 text-xs">
                              {fund.aum ? formatAUMRaw(fund.aum) : '—'}
                            </td>
                            <LensCell val={fund.return_score} />
                            <LensCell val={fund.risk_score} />
                            <LensCell val={fund.alpha_score} />
                            <LensCell val={fund.consistency_score} />
                            <LensCell val={fund.efficiency_score} />
                            <LensCell val={fund.resilience_score} />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                      Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredFunds.length)} of {filteredFunds.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
                      >
                        ← Prev
                      </button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        const p = totalPages <= 7 ? i : (page <= 3 ? i : page >= totalPages - 4 ? totalPages - 7 + i : page - 3 + i);
                        if (p < 0 || p >= totalPages) return null;
                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-7 h-7 text-xs font-medium rounded ${
                              p === page ? 'bg-teal-600 text-white' : 'border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {p + 1}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <InfoBulb title="Fund Table" items={[
              { icon: '📋', label: '6 Lenses', text: 'Each fund has 6 independent scores (0-100 percentile within its category): Return, Risk, Alpha, Consistency, Efficiency, Resilience. Green ≥70, Amber ≥40, Red <40.' },
              { icon: '🔍', label: 'Filters', text: '"High Alpha" shows funds with alpha score ≥70. "Low Risk" = risk score ≥70 (lower std dev). "Best Overall" ranks by average of all 6 lenses.' },
              { icon: '📊', label: 'Exposure%', text: 'What percentage of the fund\'s portfolio is allocated to this specific sector. Higher = more concentrated bet.' },
              { icon: '👆', label: 'Click', text: 'Click any row to open the fund\'s full 360-degree deep-dive page.' },
            ]} />
          </div>
        )}

        {/* ══ SECTION 7: AMC Concentration ══ */}
        {amcBreakdown.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800 mb-1">AMC Concentration — {sector.sector_name}</p>
              <p className="text-xs text-slate-400 mb-3">Which AMCs dominate this sector by AUM</p>
              <div className="space-y-1.5">
                {amcBreakdown.map((amc, i) => {
                  const maxAum = amcBreakdown[0]?.aum || 1;
                  const pct = (amc.aum / maxAum) * 100;
                  const shortName = amc.name?.replace(/ (Asset Management|Mutual Fund|AMC|Ltd|Private|India|Investment|Management|Company).*/i, '');
                  return (
                    <div key={amc.name} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono w-4">{i + 1}</span>
                      <Tooltip2 text={`${amc.name} — ${amc.count} fund${amc.count !== 1 ? 's' : ''} in ${sector.sector_name}. Total AUM: ${formatAUMRaw(amc.aum)}.`}>
                        <span className="text-xs text-slate-700 w-40 truncate cursor-help hover:text-teal-700 transition-colors" title={amc.name}>
                          {shortName}
                        </span>
                      </Tooltip2>
                      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: colors.circle, opacity: 0.7 }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-slate-600 w-16 text-right">
                        {formatAUMRaw(amc.aum)}
                      </span>
                      <span className="text-xs text-slate-400 w-12 text-right">{amc.count} funds</span>
                    </div>
                  );
                })}
              </div>
              <InfoBulb title="AMC Concentration" items={[
                { icon: '🏢', label: 'Why it matters', text: 'If 2-3 AMCs dominate a sector, your diversification may be illusory — you\'re depending on the same research teams and stock picks.' },
                { icon: '📊', label: 'Reading', text: 'Bar length = AUM proportion vs largest AMC. Hover on AMC name to see full details.' },
              ]} />
            </div>

            {/* Category Breakdown chips */}
            <div>
              <p className="text-sm font-bold text-slate-800 mb-1">Category Breakdown</p>
              <p className="text-xs text-slate-400 mb-3">Fund types investing in {sector.sector_name}</p>
              <div className="flex flex-wrap gap-2">
                {categoryBreakdown.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => router.push(`/universe?category=${encodeURIComponent(name)}`)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-colors"
                  >
                    {name} <span className="font-bold text-slate-900">{formatCount(count)}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Click to explore funds in Universe</p>
            </div>
          </div>
        )}

        {/* ══ SECTION 8: Action CTAs ══ */}
        <div className="flex gap-3 pt-3 border-t border-slate-100">
          {top5[0] && (
            <button
              onClick={() => router.push(`/fund360?fund=${top5[0].mstar_id}`)}
              className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.circle }}
            >
              View Best Fund → {top5[0].fund_name?.split(' ').slice(0, 3).join(' ')}
            </button>
          )}
          <button
            onClick={() => router.push(`/universe?q=${encodeURIComponent(sector.sector_name)}`)}
            className="flex-1 py-2.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-200"
          >
            Explore in Universe
          </button>
        </div>
      </div>
    </div>
  );
});

export default SectorDeepDive;

/* ── Sub-components ── */

function StatCard({ label, value, color, large = false, sub }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`font-bold tabular-nums mt-1 ${large ? 'text-2xl' : 'text-base'}`} style={{ color }}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ContextRow({ label, value, color }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-slate-400 w-20 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium leading-snug" style={{ color: color || '#334155' }}>
        {value}
      </span>
    </div>
  );
}

function LensCell({ val }) {
  const n = val != null ? Math.round(Number(val)) : null;
  return (
    <td className="py-2 text-center">
      {n != null ? (
        <span className={`inline-block w-8 h-5 rounded text-[10px] font-bold leading-5 tabular-nums ${scoreBg(n)}`}>
          {n}
        </span>
      ) : (
        <span className="text-xs text-slate-300">—</span>
      )}
    </td>
  );
}

function RecoCard({ icon, iconColor, label, fund, colors, sectorName, onClick }) {
  const ret1y = Number(fund.return_1y) || 0;
  const avgLens = LENS_NAMES.reduce((s, l) => s + (Number(fund[`${l}_score`]) || 0), 0) / 6;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg hover:bg-white border border-slate-100 hover:border-slate-200 transition-all text-left w-full"
    >
      <span className="text-xl flex-shrink-0 mt-0.5" style={{ color: iconColor }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{fund.fund_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{fund.category_name}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className={`text-sm font-bold tabular-nums ${ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatPct(ret1y)}
          </span>
          {fund.sector_exposure_pct != null && (
            <span className="text-xs text-slate-400">{Number(fund.sector_exposure_pct).toFixed(0)}% exp</span>
          )}
          {fund.aum && (
            <span className="text-xs text-slate-400">{formatAUMRaw(fund.aum)}</span>
          )}
          <span className="text-xs font-medium" style={{ color: scoreColor(avgLens) }}>
            Avg {Math.round(avgLens)}
          </span>
        </div>
      </div>
    </button>
  );
}

function FundScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-xs">
      <p className="font-bold text-slate-800">{d.name}</p>
      <p className="text-slate-500 text-xs">{d.category}</p>
      <div className="mt-1 space-y-0.5 tabular-nums">
        <p>1Y Return: <span className={`font-bold ${d.y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatPct(d.y)}</span></p>
        <p>Risk Score: {d.x?.toFixed(0)}</p>
        <p>Sector Exp: <span className="font-bold">{d.exposure?.toFixed(0)}%</span></p>
        <p>Return Score: <span className="font-bold" style={{ color: scoreColor(d.returnScore) }}>{d.returnScore != null ? Math.round(d.returnScore) : '—'}</span></p>
      </div>
    </div>
  );
}
