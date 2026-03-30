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
    <div className="hidden lg:block col-span-3 space-y-3">
      {/* Market Context */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
        <div className="flex items-center gap-1 mb-3">
          <p className="section-title">Market Context</p>
          <InfoIcon tip="Current market regime affects which funds perform well. In Risk-On regimes, aggressive funds outperform. In Risk-Off, defensive funds shine." />
        </div>
        {regime ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-600">Regime</span>
                <span className={`text-[11px] font-semibold ${regimeColor(regime.market_regime)}`}>
                  {regime.market_regime || 'Unknown'}
                </span>
              </div>
              {regime.trend && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Trend</span>
                  <span className="text-[11px] font-semibold text-slate-700">{regime.trend}</span>
                </div>
              )}
              {topCategories.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium mb-1.5">Top Categories (visible)</p>
                  {topCategories.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between py-0.5">
                      <span className="text-[10px] text-slate-600 truncate flex-1">{cat.name}</span>
                      <span className="text-[10px] font-semibold text-teal-600 tabular-nums ml-2">{cat.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={`mt-2 p-2 rounded-lg ${regimeBg(regime.market_regime)}`}>
              <p className={`text-[9px] leading-relaxed ${regimeTextColor(regime.market_regime)}`}>
                <strong>Implication:</strong> {regimeImplication(regime.market_regime)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-[10px] text-slate-400">Loading market data...</p>
        )}
      </div>

      {/* Top 5 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
        <p className="section-title mb-3">Top 5 -- Visible Funds</p>
        <div className="space-y-2">
          {top5.map((fund, i) => {
            const retVal = Number(fund[yKey]) || 0;
            const score = Number(fund[lensKey]) || 0;
            const aumCr = (Number(fund.aum) || 0) / 10000000;
            return (
              <button
                key={fund.mstar_id}
                type="button"
                onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                className="fund-row w-full flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-left"
              >
                <span className="text-[10px] text-slate-400 tabular-nums w-3">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-800 truncate">
                    {fund.fund_name || fund.legal_name}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {fund.category_name || fund.broad_category} &middot; {formatAUM(aumCr)}
                  </p>
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${retVal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPct(retVal)}
                </span>
              </button>
            );
          })}
          {top5.length === 0 && null}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
        <p className="section-title mb-3">Insights from Data</p>
        <div className="space-y-2.5">
          {insights.map((ins, i) => (
            <div key={i} className="flex gap-2">
              <span className={`${ins.iconColor} text-xs mt-0.5 flex-shrink-0`}>{ins.icon}</span>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                <strong>{ins.label}</strong>{ins.body}
              </p>
            </div>
          ))}
          {insights.length === 0 && null}
        </div>
      </div>

      {/* How to use */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
        <p className="text-[10px] font-semibold text-slate-500 mb-1.5">How to Use This Chart</p>
        <ul className="text-[9px] text-slate-500 space-y-1 leading-relaxed">
          <li><strong>Click</strong> any bubble to see fund details</li>
          <li><strong>Double-click</strong> to open full Fund 360 view</li>
          <li><strong>Scroll</strong> to zoom in/out on clusters</li>
          <li><strong>Drag</strong> to pan across the universe</li>
          <li><strong>Click a tier bar</strong> (left) to spotlight those funds</li>
        </ul>
      </div>
    </div>
  );
}
