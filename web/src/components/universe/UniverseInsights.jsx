import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { formatPct, formatAUM } from '../../lib/format';
import { scoreColor } from '../../lib/lens';

/**
 * Below-scatter insights: Category Leaderboard, Return Distribution, AMC Landscape.
 * Computed from the currently visible (filtered) fund universe.
 */
export default function UniverseInsights({ funds, onCategoryClick }) {
  const router = useRouter();

  // ── Category Performance Leaderboard ──
  const categoryData = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    const cats = {};
    funds.forEach((f) => {
      const cat = f.category_name;
      if (!cat) return;
      if (!cats[cat]) cats[cat] = { name: cat, funds: [], totalReturn: 0 };
      cats[cat].funds.push(f);
      cats[cat].totalReturn += Number(f.return_1y) || 0;
    });
    return Object.values(cats)
      .map((c) => {
        const avgRet = c.totalReturn / c.funds.length;
        const best = c.funds.reduce((b, f) =>
          (Number(f.return_1y) || 0) > (Number(b.return_1y) || 0) ? f : b
        , c.funds[0]);
        return {
          name: c.name,
          count: c.funds.length,
          avgReturn: avgRet,
          bestFund: best,
          bestReturn: Number(best.return_1y) || 0,
          avgAlpha: c.funds.reduce((s, f) => s + (Number(f.alpha_score) || 0), 0) / c.funds.length,
        };
      })
      .sort((a, b) => b.avgReturn - a.avgReturn)
      .slice(0, 10);
  }, [funds]);

  // ── Return Distribution Buckets ──
  const returnBuckets = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    const buckets = [
      { label: '< 0%', min: -Infinity, max: 0, count: 0, color: '#dc2626' },
      { label: '0-10%', min: 0, max: 10, count: 0, color: '#ef4444' },
      { label: '10-20%', min: 10, max: 20, count: 0, color: '#f59e0b' },
      { label: '20-30%', min: 20, max: 30, count: 0, color: '#10b981' },
      { label: '30-50%', min: 30, max: 50, count: 0, color: '#059669' },
      { label: '50%+', min: 50, max: Infinity, count: 0, color: '#047857' },
    ];
    funds.forEach((f) => {
      const ret = Number(f.return_1y) || 0;
      const bucket = buckets.find((b) => ret >= b.min && ret < b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  }, [funds]);

  const maxBucket = Math.max(...returnBuckets.map((b) => b.count), 1);

  // ── AMC Landscape ──
  const amcData = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    const amcs = {};
    funds.forEach((f) => {
      const amc = f.amc_name;
      if (!amc) return;
      if (!amcs[amc]) amcs[amc] = { name: amc, count: 0, totalReturn: 0, totalAum: 0 };
      amcs[amc].count++;
      amcs[amc].totalReturn += Number(f.return_1y) || 0;
      amcs[amc].totalAum += Number(f.aum) || 0;
    });
    return Object.values(amcs)
      .map((a) => ({
        ...a,
        avgReturn: a.totalReturn / a.count,
        totalAumCr: a.totalAum / 1e7,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [funds]);

  const maxAmcCount = Math.max(...amcData.map((a) => a.count), 1);

  // ── Additional data: Expense, Consistency, AUM leaders ──
  const expenseData = useMemo(() => {
    if (!funds?.length) return { avgExpense: 0, cheapest: null, expensive: 0 };
    const withExpense = funds.filter((f) => f.net_expense_ratio != null);
    if (!withExpense.length) return { avgExpense: 0, cheapest: null, expensive: 0 };
    const avg = withExpense.reduce((s, f) => s + Number(f.net_expense_ratio), 0) / withExpense.length;
    const sorted = [...withExpense].sort((a, b) => Number(a.net_expense_ratio) - Number(b.net_expense_ratio));
    return { avgExpense: avg, cheapest: sorted[0], expensive: withExpense.filter((f) => Number(f.net_expense_ratio) > 2).length };
  }, [funds]);

  const consistencyLeaders = useMemo(() => {
    if (!funds?.length) return [];
    return [...funds]
      .filter((f) => f.consistency_score != null && Number(f.consistency_score) >= 75)
      .sort((a, b) => Number(b.consistency_score) - Number(a.consistency_score))
      .slice(0, 5);
  }, [funds]);

  const aumLeaders = useMemo(() => {
    if (!funds?.length) return [];
    return [...funds]
      .filter((f) => f.aum != null)
      .sort((a, b) => Number(b.aum) - Number(a.aum))
      .slice(0, 5);
  }, [funds]);

  if (!funds || funds.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-in" style={{ animationDelay: '0.15s' }}>
      {/* ── Category Performance Leaderboard (compact) ── */}
      <div className="glass-card p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-2">Category Performance</p>
        <div className="space-y-1.5">
          {categoryData.slice(0, 5).map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => onCategoryClick?.(cat.name)}
              className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50/80 transition-colors text-left group"
            >
              <span className="text-[9px] text-slate-400 font-bold tabular-nums w-3">{i + 1}</span>
              <span className="text-[11px] font-medium text-slate-700 truncate flex-1 group-hover:text-teal-700">
                {cat.name}
              </span>
              <span className={`text-[11px] font-bold tabular-nums ${cat.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPct(cat.avgReturn)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Return Distribution (compact) ── */}
      <div className="glass-card p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-2">Return Distribution</p>
        <div className="space-y-1.5">
          {returnBuckets.map((bucket) => {
            const barW = Math.max((bucket.count / maxBucket) * 100, 2);
            return (
              <div key={bucket.label} className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-500 w-[38px] text-right">{bucket.label}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: bucket.color }} />
                </div>
                <span className="text-[9px] font-semibold tabular-nums w-5 text-right" style={{ color: bucket.color }}>{bucket.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AMC Landscape (compact) ── */}
      <div className="glass-card p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-2">Top AMCs</p>
        <div className="space-y-1.5">
          {amcData.slice(0, 5).map((amc) => (
            <div key={amc.name} className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-600 truncate flex-1">
                {amc.name.replace(/ Mutual Fund$/, '').replace(/ Asset Management.*$/, '')}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-teal-600">{amc.count}</span>
              <span className={`text-[10px] font-bold tabular-nums ${amc.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPct(amc.avgReturn)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Expense vs Performance ── */}
      <div className="glass-card p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-2">Expense vs Performance</p>
        <p className="text-[9px] text-slate-400 mb-2">Do cheap funds outperform expensive ones?</p>
        {(() => {
          const withExp = funds.filter((f) => f.net_expense_ratio != null && f.return_1y != null);
          if (withExp.length < 10) return <p className="text-[10px] text-slate-400">Insufficient data</p>;
          const sorted = [...withExp].sort((a, b) => Number(a.net_expense_ratio) - Number(b.net_expense_ratio));
          const cheapQuarter = sorted.slice(0, Math.floor(sorted.length / 4));
          const expensiveQuarter = sorted.slice(-Math.floor(sorted.length / 4));
          const cheapAvgRet = cheapQuarter.reduce((s, f) => s + Number(f.return_1y), 0) / cheapQuarter.length;
          const expAvgRet = expensiveQuarter.reduce((s, f) => s + Number(f.return_1y), 0) / expensiveQuarter.length;
          const cheapAvgExp = cheapQuarter.reduce((s, f) => s + Number(f.net_expense_ratio), 0) / cheapQuarter.length;
          const expAvgExp = expensiveQuarter.reduce((s, f) => s + Number(f.net_expense_ratio), 0) / expensiveQuarter.length;
          const cheapWins = cheapAvgRet > expAvgRet;
          return (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500">Cheapest 25% (avg {cheapAvgExp.toFixed(1)}%)</span>
                <span className={`text-[11px] font-bold tabular-nums ${cheapAvgRet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPct(cheapAvgRet)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500">Priciest 25% (avg {expAvgExp.toFixed(1)}%)</span>
                <span className={`text-[11px] font-bold tabular-nums ${expAvgRet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPct(expAvgRet)}</span>
              </div>
              <p className={`text-[9px] font-semibold mt-1 ${cheapWins ? 'text-teal-700' : 'text-amber-700'}`}>
                {cheapWins ? 'Cheap funds outperform — cost matters.' : 'Expensive funds outperform — active management adding value.'}
              </p>
            </div>
          );
        })()}
      </div>

      {/* ── Consistency Champions ── */}
      <div className="glass-card p-4 hover:border-teal-200 transition-colors">
        <p className="text-[11px] font-bold text-slate-700 mb-2">Consistency Champions</p>
        <p className="text-[9px] text-slate-400 mb-1.5">Score 75+ — most reliable performers</p>
        <div className="space-y-1.5">
          {consistencyLeaders.length > 0 ? consistencyLeaders.map((f) => (
            <div key={f.mstar_id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5" onClick={() => router.push(`/fund360?fund=${f.mstar_id}`)}>
              <span className="text-[10px] font-medium text-slate-700 truncate flex-1">{(f.fund_name || '').slice(0, 25)}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: scoreColor(Number(f.consistency_score)) }}>{Math.round(Number(f.consistency_score))}</span>
            </div>
          )) : <p className="text-[10px] text-slate-400">No funds with 75+ consistency in current filter</p>}
        </div>
      </div>

      {/* ── AUM Leaders ── */}
      <div className="glass-card p-4 hover:border-teal-200 transition-colors">
        <p className="text-[11px] font-bold text-slate-700 mb-2">AUM Leaders</p>
        <p className="text-[9px] text-slate-400 mb-1.5">Largest funds by assets under management</p>
        <div className="space-y-1.5">
          {aumLeaders.map((f) => (
            <div key={f.mstar_id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5" onClick={() => router.push(`/fund360?fund=${f.mstar_id}`)}>
              <span className="text-[10px] font-medium text-slate-700 truncate flex-1">{(f.fund_name || '').slice(0, 25)}</span>
              <span className="text-[10px] font-bold tabular-nums text-slate-600">{formatAUM(Number(f.aum) / 1e7)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
