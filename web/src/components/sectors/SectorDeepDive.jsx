/**
 * SectorDeepDive — Full sector intelligence landing section.
 *
 * Shown when user clicks a sector. Dense, actionable, answers:
 * 1. What is this sector's current position? (stats ribbon + RS trend)
 * 2. What's the market context? (regime, breadth, trajectory)
 * 3. Which funds are best here? (top funds + recommendations)
 * 4. How do funds compare? (2×2 scatter + sortable table)
 * 5. What categories are exposed? (category breakdown)
 */
import { forwardRef, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { QUADRANT_COLORS, deriveDrillDownFunds } from '../../lib/sectors';
import { formatPct, formatAUMRaw, formatCount } from '../../lib/format';

const QUADRANT_ACTIONS = {
  Leading: { action: 'OVERWEIGHT', icon: '↑', desc: 'Strong RS + rising momentum — increase allocation' },
  Improving: { action: 'ACCUMULATE', icon: '↗', desc: 'Low RS but gaining fast — early entry window' },
  Weakening: { action: 'REDUCE', icon: '↘', desc: 'High RS but losing steam — take profits, trim' },
  Lagging: { action: 'AVOID', icon: '↓', desc: 'Low RS + falling further — wait for turnaround' },
};

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
  const [showAllFunds, setShowAllFunds] = useState(false);

  const q = sector.quadrant || 'Lagging';
  const colors = QUADRANT_COLORS[q] || QUADRANT_COLORS.Lagging;
  const actionInfo = QUADRANT_ACTIONS[q] || QUADRANT_ACTIONS.Lagging;
  const mom = sector.rs_momentum ?? sector.momentum_1m ?? 0;
  const wRet = sector.weighted_return ?? 0;
  const aum = sector.total_aum_exposed ?? 0;

  // All funds with exposure to this sector
  const allFunds = useMemo(() => {
    return deriveDrillDownFunds({
      sector, funds, sectorExposures, exposureAvailable,
      sort: sortKey, categoryFilter: 'all',
    });
  }, [sector, funds, sectorExposures, exposureAvailable, sortKey]);

  // Top 5 by composite score
  const top5 = useMemo(() => {
    return deriveDrillDownFunds({
      sector, funds, sectorExposures, exposureAvailable,
      sort: 'composite', categoryFilter: 'all',
    }).slice(0, 5);
  }, [sector, funds, sectorExposures, exposureAvailable]);

  // Best & worst fund
  const bestFund = top5[0] || null;
  const worstFund = useMemo(() => {
    const byReturn = [...allFunds].sort((a, b) => (Number(a.return_1y) || 0) - (Number(b.return_1y) || 0));
    return byReturn[0] || null;
  }, [allFunds]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats = {};
    allFunds.forEach((f) => {
      const cat = f.category_name || 'Other';
      cats[cat] = (cats[cat] || 0) + 1;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [allFunds]);

  // Scatter data for 2×2
  const scatterData = useMemo(() => {
    return allFunds.map((f) => ({
      x: Number(f.risk_score) || 50,
      y: Number(f.return_1y) || 0,
      z: sectorExposures?.[f.mstar_id]?.[sector?.sector_name] || 10,
      name: f.fund_name,
      category: f.category_name,
      mstar_id: f.mstar_id,
    }));
  }, [allFunds, sectorExposures, sector]);

  // RS trend sparkline
  const trendData = useMemo(() => {
    const data = [];
    if (sector.history?.length) {
      sector.history.forEach((h, i) => {
        data.push({ month: i, score: h.rs_score, label: `M-${sector.history.length - i}` });
      });
    }
    data.push({ month: data.length, score: sector.rs_score, label: 'Now' });
    return data;
  }, [sector]);

  // Quadrant trajectory from history
  const trajectory = useMemo(() => {
    if (!sector.history?.length) return null;
    const hist = sector.history.map((h) => h.quadrant);
    const current = sector.quadrant;
    const prev = hist[hist.length - 1];
    if (!prev || prev === current) return null;
    return { from: prev, to: current };
  }, [sector]);

  // Sentiment
  const sentimentScore = sentimentData?.composite_score ?? sentimentData?.score ?? null;
  const regimeLabel = regimeData?.market_regime || regimeData?.regime_label || null;

  // Peer sectors in same quadrant
  const peerSectors = useMemo(() => {
    return (sectorData || []).filter(
      (s) => s.quadrant === sector.quadrant && s.sector_name !== sector.sector_name
    );
  }, [sectorData, sector]);

  if (!sector) return null;

  const displayFunds = showAllFunds ? allFunds : allFunds.slice(0, 10);

  return (
    <div ref={ref} className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
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
              <h2 className="text-lg font-bold text-slate-900">{sector.sector_name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sector Deep-Dive — {allFunds.length} funds with &ge;10% exposure
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${colors.badge}`}
            >
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
        {/* Stats Ribbon */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard label="RS Score" value={Math.round(sector.rs_score)} color={colors.circle} large />
          <StatCard
            label="Momentum (1M)"
            value={`${mom > 0 ? '+' : ''}${Number(mom).toFixed(1)}`}
            color={mom >= 0 ? '#059669' : '#dc2626'}
            large
          />
          <StatCard
            label="Weighted Return"
            value={formatPct(wRet)}
            color={wRet >= 0 ? '#059669' : '#dc2626'}
          />
          <StatCard label="AUM Exposed" value={formatAUMRaw(aum)} color="#334155" />
          <StatCard label="Fund Count" value={formatCount(sector.fund_count)} color="#334155" />
        </div>

        {/* RS Trend */}
        {trendData.length > 1 && (
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">RS Score Trend (6M)</p>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={colors.circle}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: colors.circle, stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Two-column: Context + Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Market Context for this sector */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Sector Context</p>
            <div className="space-y-2">
              {regimeLabel && (
                <ContextRow label="Market Regime" value={regimeLabel} />
              )}
              {sentimentScore != null && (
                <ContextRow
                  label="Sentiment"
                  value={`${Math.round(sentimentScore)} — ${sentimentScore >= 70 ? 'Greedy' : sentimentScore >= 40 ? 'Neutral' : 'Fearful'}`}
                  color={sentimentScore >= 70 ? '#059669' : sentimentScore >= 40 ? '#d97706' : '#dc2626'}
                />
              )}
              {trajectory && (
                <ContextRow
                  label="Quadrant Shift"
                  value={`${trajectory.from} → ${trajectory.to}`}
                  color={colors.circle}
                />
              )}
              <ContextRow label="Action Signal" value={actionInfo.desc} />
              {peerSectors.length > 0 && (
                <ContextRow
                  label={`Also ${q}`}
                  value={peerSectors.map((s) => s.sector_name).join(', ')}
                />
              )}
            </div>
          </div>

          {/* Right: Recommendations */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Recommendations</p>
            <div className="space-y-2.5">
              {bestFund && (
                <RecoRow
                  icon="★"
                  iconColor="#059669"
                  label="Best Fund"
                  fund={bestFund}
                  sectorExposures={sectorExposures}
                  sector={sector}
                  onClick={() => router.push(`/fund360?fund=${bestFund.mstar_id}`)}
                />
              )}
              {top5[1] && (
                <RecoRow
                  icon="▲"
                  iconColor="#0d9488"
                  label="Runner-up"
                  fund={top5[1]}
                  sectorExposures={sectorExposures}
                  sector={sector}
                  onClick={() => router.push(`/fund360?fund=${top5[1].mstar_id}`)}
                />
              )}
              {worstFund && worstFund.mstar_id !== bestFund?.mstar_id && (
                <RecoRow
                  icon="✗"
                  iconColor="#dc2626"
                  label="Avoid"
                  fund={worstFund}
                  sectorExposures={sectorExposures}
                  sector={sector}
                  onClick={() => router.push(`/fund360?fund=${worstFund.mstar_id}`)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
              Category Breakdown — {allFunds.length} funds across {categoryBreakdown.length} categories
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryBreakdown.slice(0, 12).map(([cat, count]) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {cat} <span className="font-bold text-slate-900">{count}</span>
                </span>
              ))}
              {categoryBreakdown.length > 12 && (
                <span className="px-2 py-1 text-[11px] text-slate-400">
                  +{categoryBreakdown.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fund 2×2 Scatter */}
        {scatterData.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-bold text-slate-800">Fund Risk vs Return</p>
                <p className="text-[10px] text-slate-400">
                  Top-left = best (high return, low risk). Bubble size = sector exposure %. Click for Fund 360.
                </p>
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-slate-50" style={{ height: 420 }}>
              {/* Quadrant background labels */}
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
                    <XAxis
                      type="number" dataKey="x" name="Risk (Std Dev)"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: 'Risk (Std Dev %) — Lower is Better →', position: 'bottom', style: { fontSize: 10, fontWeight: 600, fill: '#64748b' } }}
                    />
                    <YAxis
                      type="number" dataKey="y" name="1Y Return"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: '↑ 1Y Return %', angle: -90, position: 'insideLeft', style: { fontSize: 10, fontWeight: 600, fill: '#64748b' } }}
                    />
                    <Tooltip content={<FundScatterTooltip />} />
                    <Scatter
                      data={scatterData}
                      fill={colors.circle}
                      fillOpacity={0.6}
                      stroke={colors.circle}
                      strokeWidth={1.5}
                      onClick={(d) => d?.mstar_id && router.push(`/fund360?fund=${d.mstar_id}`)}
                      cursor="pointer"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Full Fund Table */}
        {allFunds.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-800">
                All Funds ({allFunds.length})
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Sort:</span>
                {[
                  { key: 'composite', label: 'Best Overall' },
                  { key: 'return_1y', label: '1Y Return' },
                  { key: 'exposure', label: 'Exposure %' },
                  { key: 'risk_score', label: 'Lowest Risk' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortKey(opt.key)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      sortKey === opt.key
                        ? 'bg-teal-100 text-teal-700 border border-teal-200'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="text-left pb-2 pr-3 font-semibold">#</th>
                    <th className="text-left pb-2 pr-3 font-semibold">Fund</th>
                    <th className="text-left pb-2 pr-3 font-semibold">Category</th>
                    <th className="text-right pb-2 pr-3 font-semibold">1Y Return</th>
                    <th className="text-right pb-2 pr-3 font-semibold">Std Dev</th>
                    <th className="text-right pb-2 pr-3 font-semibold">Exposure</th>
                    <th className="text-right pb-2 font-semibold">Return Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayFunds.map((fund, i) => {
                    const ret1y = Number(fund.return_1y) || 0;
                    const exp = sectorExposures?.[fund.mstar_id]?.[sector.sector_name];
                    return (
                      <tr
                        key={fund.mstar_id}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                      >
                        <td className="py-2 pr-3 text-slate-400 font-mono">{i + 1}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-800 max-w-[250px] truncate">
                          {fund.fund_name}
                        </td>
                        <td className="py-2 pr-3 text-slate-500 max-w-[140px] truncate">
                          {fund.category_name || '—'}
                        </td>
                        <td className={`py-2 pr-3 text-right font-bold tabular-nums ${ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatPct(ret1y)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600">
                          {fund.risk_score != null ? `${Number(fund.risk_score).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 pr-3 text-right font-bold tabular-nums" style={{ color: colors.circle }}>
                          {exp != null ? `${Math.round(exp)}%` : '—'}
                        </td>
                        <td className="py-2 text-right">
                          {fund.return_score != null ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              Number(fund.return_score) >= 70 ? 'bg-emerald-100 text-emerald-700'
                              : Number(fund.return_score) >= 40 ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                              {Math.round(Number(fund.return_score))}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {allFunds.length > 10 && !showAllFunds && (
              <button
                onClick={() => setShowAllFunds(true)}
                className="mt-3 w-full py-2 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-200"
              >
                Show all {allFunds.length} funds
              </button>
            )}
          </div>
        )}

        {/* Action CTAs */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          {bestFund && (
            <button
              onClick={() => router.push(`/fund360?fund=${bestFund.mstar_id}`)}
              className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg transition-colors"
              style={{ backgroundColor: colors.circle }}
            >
              View Best Fund → {bestFund.fund_name?.split(' ').slice(0, 3).join(' ')}
            </button>
          )}
          <button
            onClick={() => router.push('/simulation')}
            className="flex-1 py-2.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-200"
          >
            Simulate Sector Rotation
          </button>
        </div>
      </div>
    </div>
  );
});

export default SectorDeepDive;

/* ── Sub-components ── */

function StatCard({ label, value, color, large = false }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p
        className={`font-bold tabular-nums mt-1 ${large ? 'text-xl' : 'text-sm'}`}
        style={{ color }}
      >
        {value ?? '—'}
      </p>
    </div>
  );
}

function ContextRow({ label, value, color }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-slate-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span
        className="text-[11px] font-medium leading-snug"
        style={{ color: color || '#334155' }}
      >
        {value}
      </span>
    </div>
  );
}

function RecoRow({ icon, iconColor, label, fund, sectorExposures, sector, onClick }) {
  const exp = sectorExposures?.[fund.mstar_id]?.[sector.sector_name];
  const ret1y = Number(fund.return_1y) || 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-left hover:bg-white/60 rounded-lg p-1.5 -m-1.5 transition-colors"
    >
      <span className="text-base flex-shrink-0" style={{ color: iconColor }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-[11px] font-semibold text-slate-800 truncate">{fund.fund_name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-[11px] font-bold tabular-nums ${ret1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {formatPct(ret1y)}
        </p>
        {exp != null && (
          <p className="text-[9px] text-slate-400">{Math.round(exp)}% exp</p>
        )}
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
        <p>Std Dev: {d.x?.toFixed(1)}%</p>
        <p>Sector Exp: <span className="font-bold">{Math.round(d.z)}%</span></p>
      </div>
    </div>
  );
}
