/**
 * SectorDeepDive v2 — Dense sector intelligence landing section.
 *
 * 42+ data points across 8 sections:
 * 1. Header + Stats Ribbon (9 metrics)
 * 2. Positioning Panel: Quadrant Intelligence + Market Health Gauges
 * 3. Category Tailwind/Headwind Map
 * 4. Fund 2×2 Scatter (risk vs return, lens color, AUM sized)
 * 5. Top Funds Table (paginated, filterable, all 6 lenses)
 * 6. AMC Concentration
 * 7. Recommendations + Action CTAs
 * 8. InfoBulb on every section
 */
import { forwardRef, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
} from 'recharts';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct, formatAUMRaw, formatCount, formatScore } from '../../lib/format';
import { fetchSectorDrillDown, fetchCategoryAlignment } from '../../lib/api';
import InfoBulb from '../shared/InfoBulb';

const PAGE_SIZE = 15;

const QUADRANT_ACTIONS = {
  Leading: { action: 'OVERWEIGHT', icon: '↑', desc: 'Strong RS + rising momentum — increase allocation', short: 'Add' },
  Improving: { action: 'ACCUMULATE', icon: '↗', desc: 'Low RS but gaining fast — early entry window', short: 'Enter' },
  Weakening: { action: 'REDUCE', icon: '↘', desc: 'High RS but losing steam — take profits, trim', short: 'Trim' },
  Lagging: { action: 'AVOID', icon: '↓', desc: 'Low RS + falling further — wait for turnaround', short: 'Wait' },
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
  const [categoryAlignment, setCategoryAlignment] = useState([]);

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
        const [drillRes, alignRes] = await Promise.allSettled([
          fetchSectorDrillDown(sector.sector_name, 3, 200),
          fetchCategoryAlignment(),
        ]);
        if (cancelled) return;
        if (drillRes.status === 'fulfilled') {
          setDrillFunds(drillRes.value.data || []);
        }
        if (alignRes.status === 'fulfilled') {
          setCategoryAlignment(alignRes.value.data || []);
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

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats = {};
    drillFunds.forEach((f) => {
      const cat = f.category_name || 'Other';
      cats[cat] = (cats[cat] || 0) + 1;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [drillFunds]);

  // Scatter data
  const scatterData = useMemo(() => {
    return drillFunds.map((f) => ({
      x: Number(f.risk_score) || 50,
      y: Number(f.return_1y) || 0,
      z: Math.max(8, Math.sqrt((f.aum || 0) / 1e9) * 3),
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

  // Category alignment for THIS sector
  const sectorCategoryAlignment = useMemo(() => {
    if (!categoryAlignment.length) return [];
    // Filter categories that have significant exposure to sectors in the same quadrant
    return categoryAlignment
      .filter((c) => c.fund_count >= 3)
      .sort((a, b) => b.tailwind_pct - a.tailwind_pct)
      .slice(0, 12);
  }, [categoryAlignment]);

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
                  <span className="text-[10px] font-bold text-slate-400">
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
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                regimeLabel === 'BULL' ? 'bg-emerald-100 text-emerald-700'
                : regimeLabel === 'BEAR' ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
              }`}>
                {regimeLabel} Market
              </span>
            )}
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${colors.badge}`}>
              {q}
            </span>
            <span
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: `${colors.circle}15`, color: colors.circle }}
            >
              {actionInfo.icon} {actionInfo.action}
            </span>
          </div>
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
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Quadrant Intelligence</p>

            {/* RS Trend with momentum overlay */}
            {trendData.length > 1 && (
              <div>
                <p className="text-[9px] text-slate-400 mb-1">RS Score Trend</p>
                <div style={{ height: 90 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        formatter={(v, name) => [`${Number(v).toFixed(1)}`, name === 'score' ? 'RS Score' : 'Momentum']}
                      />
                      <Line type="monotone" dataKey="score" stroke={colors.circle} strokeWidth={2.5}
                        dot={{ r: 4, fill: colors.circle, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <ContextRow label="Quadrant" value={`${q} — ${actionInfo.desc}`} color={colors.circle} />
              {trajectory && (
                <ContextRow label="Shift" value={`${trajectory.from} → ${trajectory.to}`} color={colors.circle} />
              )}
              {peerSectors.length > 0 && (
                <ContextRow label={`Also ${q}`} value={peerSectors.map((s) => s.sector_name).join(', ')} />
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
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Market Health Context</p>

            {/* Sentiment Layer Bars */}
            {Object.keys(layerScores).length > 0 && (
              <div>
                <p className="text-[9px] text-slate-400 mb-2">Sentiment Layers (0-100)</p>
                <div className="space-y-1.5">
                  {Object.entries(layerScores).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500 w-20 flex-shrink-0 capitalize">
                        {key.replace('_', ' ')}
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
                      <span className="text-[9px] font-bold tabular-nums w-8 text-right" style={{ color: scoreColor(val) }}>
                        {Math.round(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Broad Trend Metrics */}
            {broadTrend.length > 0 && (
              <div>
                <p className="text-[9px] text-slate-400 mb-1.5">Market Breadth (% of 531 stocks)</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {broadTrend.slice(0, 6).map((m) => (
                    <div key={m.key} className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 truncate">{m.label?.replace(/\(.*\)/, '').trim()}</span>
                      <span className={`text-[9px] font-bold tabular-nums ${m.pct >= 50 ? 'text-emerald-600' : m.pct >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
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
                  <div key={e.key} className="flex-1 bg-white rounded p-2">
                    <p className="text-[9px] text-slate-400">{e.label?.replace(/\(.*\)/, '').trim()}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: e.key.includes('overbought') ? '#dc2626' : '#059669' }}>
                      {e.count} <span className="text-[9px] text-slate-400">({e.pct?.toFixed(1)}%)</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Breadth EMA21 */}
            {ema21.zone && (
              <div className="flex items-center gap-2 p-2 bg-white rounded">
                <span className="text-[9px] text-slate-400">Breadth Zone:</span>
                <span className={`text-[10px] font-bold ${
                  ema21.zone === 'Healthy' || ema21.zone === 'Recovery' ? 'text-emerald-600'
                  : ema21.zone === 'Deterioration' ? 'text-red-500' : 'text-amber-600'
                }`}>
                  {ema21.zone}
                </span>
                <span className="text-[9px] text-slate-400">
                  ({ema21.count}/{ema21.total} above EMA21)
                </span>
              </div>
            )}

            <InfoBulb title="Market Health" items={[
              { icon: '🌡️', label: 'Sentiment Layers', text: 'Five independent measures: extremes (RSI), momentum (ROC), short-term (weekly), advance-decline, broad trend (monthly EMAs). Higher = more bullish.' },
              { icon: '📶', label: 'Breadth', text: 'What % of stocks are above key moving averages. >50% = healthy market, <25% = weak/bearish breadth.' },
              { icon: '⚠️', label: 'Extremes', text: 'Overbought (RSI>70) = potential pullback. Oversold (RSI<30) = potential bounce. Useful for timing sector entry/exit.' },
            ]} />
          </div>
        </div>

        {/* ══ SECTION 3: Category Tailwind/Headwind Map ══ */}
        {sectorCategoryAlignment.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold text-slate-800">Category Exposure to Sector Rotation</p>
                <p className="text-[10px] text-slate-400">
                  Which fund categories ride the tailwind (Leading + Improving) vs face headwind (Weakening + Lagging)
                </p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {sectorCategoryAlignment.map((cat) => (
                <div key={cat.category_name} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 w-40 flex-shrink-0 truncate" title={cat.category_name}>
                    {cat.category_name}
                  </span>
                  <div className="flex-1 h-5 flex rounded overflow-hidden">
                    {cat.leading_pct > 0 && (
                      <div style={{ width: `${cat.leading_pct}%` }} className="bg-emerald-500/70" title={`Leading ${cat.leading_pct.toFixed(0)}%`} />
                    )}
                    {cat.improving_pct > 0 && (
                      <div style={{ width: `${cat.improving_pct}%` }} className="bg-teal-400/70" title={`Improving ${cat.improving_pct.toFixed(0)}%`} />
                    )}
                    {cat.weakening_pct > 0 && (
                      <div style={{ width: `${cat.weakening_pct}%` }} className="bg-amber-400/70" title={`Weakening ${cat.weakening_pct.toFixed(0)}%`} />
                    )}
                    {cat.lagging_pct > 0 && (
                      <div style={{ width: `${cat.lagging_pct}%` }} className="bg-red-400/70" title={`Lagging ${cat.lagging_pct.toFixed(0)}%`} />
                    )}
                  </div>
                  <span className="text-[9px] font-bold tabular-nums w-12 text-right">
                    <span className="text-emerald-600">{cat.tailwind_pct.toFixed(0)}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-red-500">{cat.headwind_pct.toFixed(0)}</span>
                  </span>
                  <span className="text-[9px] text-slate-400 w-6 text-right">{cat.fund_count}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-2 text-[9px]">
              {[
                { label: 'Leading', color: 'bg-emerald-500/70' },
                { label: 'Improving', color: 'bg-teal-400/70' },
                { label: 'Weakening', color: 'bg-amber-400/70' },
                { label: 'Lagging', color: 'bg-red-400/70' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={`w-3 h-2 rounded ${color}`} />
                  <span className="text-slate-500">{label}</span>
                </span>
              ))}
            </div>
            <InfoBulb title="Category Alignment" items={[
              { icon: '🎯', label: 'Tailwind', text: 'Green portion = % of category\'s sector allocation in Leading+Improving quadrants. Higher = favorable positioning.' },
              { icon: '🌊', label: 'Headwind', text: 'Red/amber = % in Weakening+Lagging quadrants. If your category has high headwind, consider reducing sector-heavy funds.' },
              { icon: '📐', label: 'Reading', text: 'Format: tailwind/headwind ratio, then fund count. "92/8 120" = 92% tailwind, 8% headwind, across 120 funds.' },
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
                <p className="text-xs font-bold text-slate-800">Fund Risk vs Return — {sector.sector_name}</p>
                <p className="text-[10px] text-slate-400">
                  Top-left = sweet spot (high return, low risk). Bubble size = AUM. Color = return score tier.
                </p>
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-slate-50" style={{ height: 380 }}>
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none z-0">
                <div className="flex items-start justify-start p-2">
                  <span className="text-[9px] font-bold text-emerald-400/60 uppercase">Sweet Spot</span>
                </div>
                <div className="flex items-start justify-end p-2">
                  <span className="text-[9px] font-bold text-amber-400/50 uppercase">High Risk/Return</span>
                </div>
                <div className="flex items-end justify-start p-2">
                  <span className="text-[9px] font-bold text-sky-400/50 uppercase">Conservative</span>
                </div>
                <div className="flex items-end justify-end p-2">
                  <span className="text-[9px] font-bold text-red-400/50 uppercase">Avoid</span>
                </div>
              </div>
              <div className="relative z-10 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="x" name="Risk Score"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: 'Risk Score (Higher = Lower Risk) →', position: 'bottom', style: { fontSize: 10, fontWeight: 600, fill: '#64748b' } }}
                    />
                    <YAxis type="number" dataKey="y" name="1Y Return"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: '↑ 1Y Return %', angle: -90, position: 'insideLeft', style: { fontSize: 10, fontWeight: 600, fill: '#64748b' } }}
                    />
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
              <p className="text-xs font-bold text-slate-800">
                All Funds ({filteredFunds.length})
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {PRESET_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setPresetFilter(f.key)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
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
              <span className="text-[10px] text-slate-400">Sort:</span>
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
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
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
                      <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
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
                            <td className="py-2 pr-2 text-slate-400 font-mono text-[10px]">{page * PAGE_SIZE + i + 1}</td>
                            <td className="py-2 pr-2 font-semibold text-slate-800 max-w-[200px] truncate" title={fund.fund_name}>
                              {fund.fund_name}
                            </td>
                            <td className="py-2 pr-2 text-slate-500 max-w-[120px] truncate text-[10px]">{fund.category_name || '—'}</td>
                            <td className="py-2 pr-2 text-right font-bold tabular-nums" style={{ color: colors.circle }}>
                              {fund.sector_exposure_pct != null ? `${Number(fund.sector_exposure_pct).toFixed(0)}%` : '—'}
                            </td>
                            <td className={`py-2 pr-2 text-right font-bold tabular-nums ${ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {fund.return_1y != null ? formatPct(ret1y) : '—'}
                            </td>
                            <td className={`py-2 pr-2 text-right tabular-nums ${!isNaN(ret3y) && ret3y >= 0 ? 'text-emerald-600' : !isNaN(ret3y) ? 'text-red-500' : 'text-slate-400'}`}>
                              {!isNaN(ret3y) ? formatPct(ret3y) : '—'}
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums text-slate-600 text-[10px]">
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
                    <span className="text-[10px] text-slate-400">
                      Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredFunds.length)} of {filteredFunds.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="px-2.5 py-1 text-[10px] font-medium rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
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
                            className={`w-7 h-7 text-[10px] font-medium rounded ${
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
                        className="px-2.5 py-1 text-[10px] font-medium rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
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
              <p className="text-xs font-bold text-slate-800 mb-2">AMC Concentration — {sector.sector_name}</p>
              <p className="text-[10px] text-slate-400 mb-3">Which AMCs dominate this sector by AUM</p>
              <div className="space-y-1.5">
                {amcBreakdown.map((amc, i) => {
                  const maxAum = amcBreakdown[0]?.aum || 1;
                  const pct = (amc.aum / maxAum) * 100;
                  return (
                    <div key={amc.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-4">{i + 1}</span>
                      <span className="text-[10px] text-slate-700 w-40 truncate" title={amc.name}>
                        {amc.name?.replace(/ (Asset Management|Mutual Fund|AMC|Ltd|Private|India|Investment|Management|Company).*/i, '')}
                      </span>
                      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: colors.circle, opacity: 0.7 }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums text-slate-600 w-16 text-right">
                        {formatAUMRaw(amc.aum)}
                      </span>
                      <span className="text-[9px] text-slate-400 w-10 text-right">{amc.count} funds</span>
                    </div>
                  );
                })}
              </div>
              <InfoBulb title="AMC Concentration" items={[
                { icon: '🏢', label: 'Why it matters', text: 'If 2-3 AMCs dominate a sector, your diversification may be illusory — you\'re depending on the same research teams and stock picks.' },
                { icon: '📊', label: 'Reading', text: 'Bar length = AUM proportion vs largest AMC. Higher concentration = less actual diversification within this sector.' },
              ]} />
            </div>

            {/* Category Breakdown chips */}
            <div>
              <p className="text-xs font-bold text-slate-800 mb-2">Category Breakdown</p>
              <p className="text-[10px] text-slate-400 mb-3">Fund types investing in {sector.sector_name}</p>
              <div className="flex flex-wrap gap-2">
                {categoryBreakdown.map(([cat, count]) => (
                  <span
                    key={cat}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {cat} <span className="font-bold text-slate-900">{count}</span>
                  </span>
                ))}
              </div>
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
      <p className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`font-bold tabular-nums mt-1 ${large ? 'text-xl' : 'text-sm'}`} style={{ color }}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-[8px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ContextRow({ label, value, color }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-slate-400 w-20 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-[11px] font-medium leading-snug" style={{ color: color || '#334155' }}>
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
        <span className={`inline-block w-7 h-5 rounded text-[9px] font-bold leading-5 tabular-nums ${scoreBg(n)}`}>
          {n}
        </span>
      ) : (
        <span className="text-[9px] text-slate-300">—</span>
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
        <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
        <p className="text-[11px] font-bold text-slate-800 truncate">{fund.fund_name}</p>
        <p className="text-[9px] text-slate-500 mt-0.5">{fund.category_name}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className={`text-[11px] font-bold tabular-nums ${ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatPct(ret1y)}
          </span>
          {fund.sector_exposure_pct != null && (
            <span className="text-[9px] text-slate-400">{Number(fund.sector_exposure_pct).toFixed(0)}% exp</span>
          )}
          {fund.aum && (
            <span className="text-[9px] text-slate-400">{formatAUMRaw(fund.aum)}</span>
          )}
          <span className="text-[9px] font-medium" style={{ color: scoreColor(avgLens) }}>
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
      <p className="text-slate-500 text-[10px]">{d.category}</p>
      <div className="mt-1 space-y-0.5 tabular-nums">
        <p>1Y Return: <span className={`font-bold ${d.y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatPct(d.y)}</span></p>
        <p>Risk Score: {d.x?.toFixed(0)}</p>
        <p>Sector Exp: <span className="font-bold">{d.exposure?.toFixed(0)}%</span></p>
        <p>Return Score: <span className="font-bold" style={{ color: scoreColor(d.returnScore) }}>{d.returnScore != null ? Math.round(d.returnScore) : '—'}</span></p>
      </div>
    </div>
  );
}
