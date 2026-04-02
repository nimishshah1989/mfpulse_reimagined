import { useMemo } from 'react';
import { LENS_LABELS } from '../../lib/lens';
import { formatPct, formatAUM, formatCount } from '../../lib/format';
import InfoIcon from '../shared/InfoIcon';

/** Lens-specific tier definitions — class-based for accurate filtering */
const LENS_TIERS = {
  alpha_score: [
    { label: 'ALPHA_MACHINE', display: 'Alpha Machine', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
    { label: 'POSITIVE', display: 'Positive Alpha', color: '#10b981', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
    { label: 'NEUTRAL', display: 'Neutral', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
    { label: 'NEGATIVE', display: 'Negative Alpha', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
  ],
  return_score: [
    { label: 'LEADER', display: 'Leader', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
    { label: 'STRONG', display: 'Strong', color: '#10b981', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
    { label: 'AVERAGE', display: 'Average', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
    { label: 'WEAK', display: 'Weak', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
  ],
  risk_score: [
    { label: 'LOW_RISK', display: 'Low Risk', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
    { label: 'MODERATE', display: 'Moderate', color: '#10b981', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
    { label: 'ELEVATED', display: 'Elevated', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
    { label: 'HIGH_RISK', display: 'High Risk', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
  ],
  consistency_score: [
    { label: 'ROCK_SOLID', display: 'Rock Solid', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
    { label: 'CONSISTENT', display: 'Consistent', color: '#10b981', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
    { label: 'MIXED', display: 'Mixed', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
    { label: 'ERRATIC', display: 'Erratic', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
  ],
  efficiency_score: [
    { label: 'LEAN', display: 'Lean', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
    { label: 'FAIR', display: 'Fair', color: '#10b981', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
    { label: 'EXPENSIVE', display: 'Expensive', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
    { label: 'BLOATED', display: 'Bloated', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
  ],
  resilience_score: [
    { label: 'FORTRESS', display: 'Fortress', color: '#059669', barColor: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
    { label: 'STURDY', display: 'Sturdy', color: '#10b981', barColor: 'bg-teal-400', ringColor: 'ring-teal-400' },
    { label: 'FRAGILE', display: 'Fragile', color: '#d97706', barColor: 'bg-amber-400', ringColor: 'ring-amber-400' },
    { label: 'VULNERABLE', display: 'Vulnerable', color: '#ef4444', barColor: 'bg-red-400', ringColor: 'ring-red-400' },
  ],
};

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
  const tiers = LENS_TIERS[lensKey] || LENS_TIERS.alpha_score;

  const tierData = useMemo(() => {
    return tiers.map((t) => {
      const count = classKey
        ? funds.filter((f) => f[classKey] === t.label).length
        : 0;
      return { ...t, count };
    });
  }, [funds, classKey, tiers]);

  const total = funds.length;
  const maxCount = Math.max(...tierData.map((t) => t.count), 1);

  // Find top insight
  const topTier = tierData[0];
  const bottomTier = tierData[tierData.length - 1];
  const topPct = total > 0 ? ((topTier.count / total) * 100).toFixed(0) : 0;
  const bottomPct = total > 0 ? ((bottomTier.count / total) * 100).toFixed(0) : 0;

  return (
    <div className="hidden lg:block col-span-3 space-y-4">
      {/* Summary stats */}
      <div className="glass-card p-5">
        <p className="section-title mb-3">Visible Funds</p>
        <div className="space-y-3.5">
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs text-slate-500">Avg {period || '1Y'} Return</p>
              <InfoIcon tip="Mean 1-year return across all currently visible (filtered) funds. Higher than Nifty 50 (+14.2%) indicates fund universe outperformance." />
            </div>
            <p className={`text-xl font-bold tabular-nums ${
              Number(stats.avgReturn) >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {formatPct(stats.avgReturn)}
            </p>
            <p className="text-[11px] text-slate-400">vs Nifty 50: +14.2%</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs text-slate-500">Median Risk Score</p>
              <InfoIcon tip="Middle-point risk score (0-100 scale). Below 50 = lower risk than average Indian MF." />
            </div>
            <p className="text-xl font-bold text-slate-700 tabular-nums">{stats.medianRisk}</p>
            <p className="text-[11px] text-slate-400">Moderate range</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs text-slate-500">Top Performer</p>
            </div>
            <p className="text-[13px] font-semibold text-slate-700 leading-tight">{stats.topFundName}</p>
            <p className="text-xs font-bold text-emerald-600 tabular-nums">
              {formatPct(stats.topReturn)} {period || '1Y'}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs text-slate-500">Avg AUM</p>
              <InfoIcon tip="Average Assets Under Management. Larger AUM (>1000 Cr) generally means more liquid, lower impact cost." />
            </div>
            <p className="text-lg font-bold text-slate-700 tabular-nums">{stats.avgAum}</p>
          </div>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-1 mb-3">
          <p className="section-title">{lensName} Tiers</p>
          <InfoIcon tip={`Distribution based on selected Color axis (${lensName} Score). Click any tier to highlight those funds on the chart.`} />
        </div>
        <div className="space-y-2.5">
          {tierData.map((t) => {
            const pct = total > 0 ? Math.max((t.count / total) * 100, 1) : 0;
            const isSelected = selectedTier === t.display;
            return (
              <div key={t.display}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">{t.display}</span>
                  <span className="font-bold tabular-nums" style={{ color: t.color }}>
                    {formatCount(t.count)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onTierClick?.(isSelected ? null : t.display)}
                  className={`w-full h-5 bg-slate-100 rounded-full overflow-hidden cursor-pointer hover:ring-1 ${t.ringColor} ${
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
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          Only {topPct}% are {topTier.display}. {bottomPct}% are {bottomTier.display} — avoid zone.
        </p>
      </div>

    </div>
  );
}
