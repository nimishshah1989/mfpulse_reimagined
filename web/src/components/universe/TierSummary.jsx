import { useMemo } from 'react';
import { lensColor, lensLabel, LENS_LABELS } from '../../lib/lens';
import { formatPct, formatAUM, formatCount } from '../../lib/format';
import InfoIcon from '../shared/InfoIcon';

/**
 * Tier labels for the Alpha lens — these match the mockup exactly.
 * Other lenses use the generic lensLabel function.
 */
const ALPHA_TIERS = [
  { label: 'ALPHA_MACHINE', display: 'Alpha Machine', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
  { label: 'POSITIVE', display: 'Positive Alpha', color: '#0d9488', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
  { label: 'NEUTRAL', display: 'Neutral', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
  { label: 'NEGATIVE', display: 'Negative Alpha', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
];

const GENERIC_TIERS = [
  { scoreMin: 75, display: 'Leader', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
  { scoreMin: 55, display: 'Strong', color: '#0d9488', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
  { scoreMin: 35, display: 'Average', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
  { scoreMin: 0, display: 'Weak', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
];

function getClassKey(scoreKey) {
  const map = {
    alpha_score: 'alpha_class',
    return_score: 'return_class',
    risk_score: 'risk_class',
    consistency_score: 'consistency_class',
    efficiency_score: 'efficiency_class',
    resilience_score: 'resilience_class',
  };
  return map[scoreKey];
}

export default function TierSummary({
  funds,
  colorLens,
  onTierClick,
  selectedTier,
  stats,
  period,
}) {
  const lensKey = colorLens || 'alpha_score';
  const lensName = LENS_LABELS[lensKey] || 'Alpha';
  const classKey = getClassKey(lensKey);

  // Use class-based tiers for alpha, score-based for others
  const useClassTiers = lensKey === 'alpha_score' && classKey;

  const tierData = useMemo(() => {
    if (useClassTiers) {
      return ALPHA_TIERS.map((t) => {
        const count = funds.filter((f) => f[classKey] === t.label).length;
        return { ...t, count };
      });
    }
    return GENERIC_TIERS.map((t, i) => {
      const nextMin = i > 0 ? GENERIC_TIERS[i - 1].scoreMin : 101;
      const count = funds.filter((f) => {
        const s = Number(f[lensKey]) || 0;
        return s >= t.scoreMin && s < nextMin;
      }).length;
      return { ...t, count };
    });
  }, [funds, lensKey, classKey, useClassTiers]);

  const total = funds.length;
  const maxCount = Math.max(...tierData.map((t) => t.count), 1);

  // Find top insight
  const topTier = tierData[0];
  const bottomTier = tierData[tierData.length - 1];
  const topPct = total > 0 ? ((topTier.count / total) * 100).toFixed(0) : 0;
  const bottomPct = total > 0 ? ((bottomTier.count / total) * 100).toFixed(0) : 0;

  return (
    <div className="hidden lg:block col-span-2 space-y-3">
      {/* Summary stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="section-title mb-3">Visible Funds</p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-[10px] text-slate-400">Avg {period || '1Y'} Return</p>
              <InfoIcon tip="Mean 1-year return across all currently visible (filtered) funds. Higher than Nifty 50 (+14.2%) indicates fund universe outperformance." />
            </div>
            <p className={`text-lg font-bold tabular-nums ${
              Number(stats.avgReturn) >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {formatPct(stats.avgReturn)}
            </p>
            <p className="text-[9px] text-slate-400">vs Nifty 50: +14.2%</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-[10px] text-slate-400">Median Risk Score</p>
              <InfoIcon tip="Middle-point risk score (0-100 scale). Below 50 = lower risk than average Indian MF. The median tells you where 'typical' sits." />
            </div>
            <p className="text-lg font-bold text-slate-700 tabular-nums">{stats.medianRisk}</p>
            <p className="text-[9px] text-slate-400">Moderate range</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-[10px] text-slate-400">Top Performer</p>
            </div>
            <p className="text-xs font-semibold text-slate-700 leading-tight">{stats.topFundName}</p>
            <p className="text-[10px] font-bold text-emerald-600 tabular-nums">
              {formatPct(stats.topReturn)} {period || '1Y'}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-[10px] text-slate-400">Avg AUM</p>
              <InfoIcon tip="Average Assets Under Management. Larger AUM (>1000 Cr) generally means more liquid, lower impact cost, and more institutional ownership." />
            </div>
            <p className="text-base font-bold text-slate-700 tabular-nums">{stats.avgAum}</p>
          </div>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-1 mb-3">
          <p className="section-title">{lensName} Tiers</p>
          <InfoIcon tip={`Distribution based on selected Color axis (${lensName} Score). Click any tier to highlight those funds on the chart.`} />
        </div>
        <div className="space-y-2">
          {tierData.map((t) => {
            const pct = total > 0 ? Math.max((t.count / total) * 100, 1) : 0;
            const isSelected = selectedTier === t.display;
            return (
              <div key={t.display}>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-slate-600 font-medium">{t.display}</span>
                  <span className="font-semibold tabular-nums" style={{ color: t.color }}>
                    {t.count.toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onTierClick?.(isSelected ? null : t.display)}
                  className={`w-full h-4 bg-slate-100 rounded-full overflow-hidden cursor-pointer hover:ring-1 ${t.ringColor} ${
                    isSelected ? 'ring-2 ' + t.ringColor : ''
                  }`}
                >
                  <div
                    className={`tier-bar h-full ${t.barColor} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
          Only {topPct}% of funds are {topTier.display}. {bottomPct}% are {bottomTier.display} — avoid zone.
        </p>
      </div>

      {/* Reading the Chart */}
      <div className="bg-teal-50 rounded-xl border border-teal-100 p-3">
        <p className="text-[10px] font-semibold text-teal-700 mb-1">Reading the Chart</p>
        <p className="text-[9px] text-teal-600 leading-relaxed">
          <strong>Top-left = ideal</strong> (high return, low risk). Bubble size = AUM. Color intensity = {lensName} score. Look for large, dark-green bubbles in the top-left quadrant.
        </p>
      </div>
    </div>
  );
}
