import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LENS_LABELS } from '../../lib/lens';
import { formatPct, formatAUM } from '../../lib/format';
import { fetchMarketRegime } from '../../lib/api';
import { cachedFetch } from '../../lib/cache';
import InfoIcon from '../shared/InfoIcon';

function regimeColor(regime) {
  if (!regime) return 'text-slate-500';
  const r = regime.toLowerCase();
  if (r.includes('risk-on') || r.includes('bull')) return 'text-emerald-600';
  if (r.includes('risk-off') || r.includes('bear')) return 'text-red-600';
  return 'text-amber-600';
}

function regimeBg(regime) {
  if (!regime) return 'bg-slate-50';
  const r = regime.toLowerCase();
  if (r.includes('risk-on') || r.includes('bull')) return 'bg-emerald-50';
  if (r.includes('risk-off') || r.includes('bear')) return 'bg-red-50';
  return 'bg-amber-50';
}

function regimeTextColor(regime) {
  if (!regime) return 'text-slate-700';
  const r = regime.toLowerCase();
  if (r.includes('risk-on') || r.includes('bull')) return 'text-emerald-700';
  if (r.includes('risk-off') || r.includes('bear')) return 'text-red-700';
  return 'text-amber-700';
}

function regimeImplication(regime) {
  if (!regime) return 'Regime data unavailable.';
  const r = regime.toLowerCase();
  if (r.includes('risk-on') || r.includes('bull')) {
    return 'Risk-On favours equity-heavy, high-beta funds. Small & mid caps tend to outperform in this regime.';
  }
  if (r.includes('risk-off') || r.includes('bear')) {
    return 'Risk-Off favours defensive, low-beta funds. Large caps and debt funds tend to preserve capital better.';
  }
  return 'Neutral regime — diversified allocation across cap sizes tends to work best.';
}

export default function IntelligencePanel({
  funds,
  allFundsCount,
  colorLens,
  yAxis,
  onFundClick,
}) {
  const router = useRouter();
  const lensKey = colorLens || 'alpha_score';
  const lensName = LENS_LABELS[lensKey] || 'Alpha';
  const [regime, setRegime] = useState(null);

  useEffect(() => {
    cachedFetch('market_regime', fetchMarketRegime, 600)
      .then((res) => setRegime(res?.data || null))
      .catch(() => setRegime(null));
  }, []);

  // Compute top categories from visible funds
  const topCategories = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    const catCounts = {};
    funds.forEach((f) => {
      const cat = f.category_name || f.broad_category;
      if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    return Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count, pct: ((count / funds.length) * 100).toFixed(0) }));
  }, [funds]);

  // Top 5 funds by the y-axis metric
  const top5 = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    const yKey = yAxis || 'return_1y';
    return [...funds]
      .sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0))
      .slice(0, 5);
  }, [funds, yAxis]);

  // Generate insights from data
  const insights = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    const results = [];

    // Small cap dominance
    const smallMid = funds.filter(
      (f) => (f.broad_category || '').toLowerCase().includes('small') ||
        (f.broad_category || '').toLowerCase().includes('mid')
    );
    const topReturns = [...funds]
      .sort((a, b) => (Number(b.return_1y) || 0) - (Number(a.return_1y) || 0))
      .slice(0, 10);
    const smInTop10 = topReturns.filter(
      (f) => (f.broad_category || '').toLowerCase().includes('small') ||
        (f.broad_category || '').toLowerCase().includes('mid')
    ).length;
    if (smInTop10 >= 5) {
      results.push({
        icon: '\u25B2',
        iconColor: 'text-emerald-500',
        label: `Small Caps dominate`,
        body: ` the top-right: ${smInTop10} of top 10 returns are small/mid cap. Higher risk, but rewarded in current regime.`,
      });
    }

    // Category average beat rate
    const avgReturn = funds.reduce((s, f) => s + (Number(f.return_1y) || 0), 0) / funds.length;
    const beatCount = funds.filter((f) => (Number(f.return_1y) || 0) > avgReturn).length;
    const beatPct = ((beatCount / funds.length) * 100).toFixed(0);
    results.push({
      icon: '\u25CF',
      iconColor: 'text-sky-500',
      label: `${beatPct}% of funds beat`,
      body: ` the visible average return. Index funds cluster tightly near the center \u2014 low cost, predictable.`,
    });

    // Avoid zone count
    const avoidCount = funds.filter(
      (f) => f.return_class === 'WEAK' && f.alpha_class === 'NEGATIVE'
    ).length;
    if (avoidCount > 0) {
      results.push({
        icon: '\u25BC',
        iconColor: 'text-red-400',
        label: `${avoidCount} funds in Avoid Zone`,
        body: ` (bottom-right): high risk, negative alpha. Most are high-expense regular plans with poor manager skill.`,
      });
    }

    // Turnaround signal
    const turnaround = funds.filter((f) => {
      const r1y = Number(f.return_1y) || 0;
      const r3y = Number(f.return_3y) || 0;
      return r1y > r3y + 5;
    }).length;
    if (turnaround > 0) {
      results.push({
        icon: '\u21BB',
        iconColor: 'text-amber-500',
        label: `Turnaround signal:`,
        body: ` ${turnaround} funds improved from Weak to Average on 3M return basis. Watch for lens reclassification.`,
      });
    }

    return results.slice(0, 4);
  }, [funds]);

  const yKey = yAxis || 'return_1y';
  const yLabel = yKey.includes('return_1y') ? '1Y' : yKey.includes('return_3y') ? '3Y' : yKey.includes('return_5y') ? '5Y' : '';

  return (
    <div className="hidden lg:block col-span-3 space-y-4">
      {/* Top 5 */}
      <div className="glass-card p-5">
        <p className="section-title mb-3">Top 5 -- Visible Funds</p>
        <div className="space-y-2">
          {top5.map((fund, i) => {
            const retVal = Number(fund[yKey]) || 0;
            const aumCr = (Number(fund.aum) || 0) / 10000000;
            return (
              <button
                key={fund.mstar_id}
                type="button"
                onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                className="fund-row w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-left"
              >
                <span className="text-xs text-slate-400 font-bold tabular-nums w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-800 truncate">
                    {fund.fund_name || fund.legal_name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {fund.category_name || fund.broad_category} &middot; {formatAUM(aumCr)}
                  </p>
                </div>
                <span className={`text-xs font-bold tabular-nums ${retVal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPct(retVal)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="glass-card p-5">
        <p className="section-title mb-3">Insights from Data</p>
        <div className="space-y-3">
          {insights.map((ins, i) => (
            <div key={i} className="flex gap-2.5">
              <span className={`${ins.iconColor} text-sm mt-0.5 flex-shrink-0`}>{ins.icon}</span>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>{ins.label}</strong>{ins.body}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
