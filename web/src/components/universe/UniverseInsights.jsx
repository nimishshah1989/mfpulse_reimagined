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

  if (!funds || funds.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-in" style={{ animationDelay: '0.15s' }}>
      {/* ── Category Performance Leaderboard ── */}
      <div className="glass-card p-5">
        <p className="text-[13px] font-bold text-slate-700 mb-4">Category Performance</p>
        <div className="space-y-2.5">
          {categoryData.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => onCategoryClick?.(cat.name)}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50/80 transition-colors text-left group"
            >
              <span className="text-xs text-slate-400 font-bold tabular-nums w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-700 truncate group-hover:text-teal-700 transition-colors">
                  {cat.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {cat.count} funds &middot; Best: {formatPct(cat.bestReturn)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold tabular-nums ${cat.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPct(cat.avgReturn)}
                </p>
                <p className="text-[11px] text-slate-400">avg 1Y</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Return Distribution ── */}
      <div className="glass-card p-5">
        <p className="text-[13px] font-bold text-slate-700 mb-1">Return Distribution</p>
        <p className="text-[11px] text-slate-400 mb-4">1Y return buckets across {funds.length} visible funds</p>
        <div className="space-y-3">
          {returnBuckets.map((bucket) => {
            const pct = ((bucket.count / funds.length) * 100).toFixed(0);
            const barW = Math.max((bucket.count / maxBucket) * 100, 2);
            return (
              <div key={bucket.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-600">{bucket.label}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: bucket.color }}>
                    {bucket.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${barW}%`, backgroundColor: bucket.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
          {(() => {
            const positive = funds.filter((f) => (Number(f.return_1y) || 0) > 0).length;
            const pct = ((positive / funds.length) * 100).toFixed(0);
            return `${pct}% of funds delivered positive 1Y returns. The median sits in the ${
              returnBuckets.find((b, i) => {
                const cumul = returnBuckets.slice(0, i + 1).reduce((s, bb) => s + bb.count, 0);
                return cumul >= funds.length / 2;
              })?.label || '10-20%'
            } range.`;
          })()}
        </p>
      </div>

      {/* ── AMC Landscape ── */}
      <div className="glass-card p-5">
        <p className="text-[13px] font-bold text-slate-700 mb-1">AMC Landscape</p>
        <p className="text-[11px] text-slate-400 mb-4">Top fund houses by number of visible funds</p>
        <div className="space-y-2.5">
          {amcData.map((amc) => {
            const barW = Math.max((amc.count / maxAmcCount) * 100, 4);
            return (
              <div key={amc.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600 truncate flex-1 mr-2">
                    {amc.name.replace(/ Mutual Fund$/, '').replace(/ Asset Management.*$/, '')}
                  </span>
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${amc.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPct(amc.avgReturn)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all duration-700"
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-teal-600 tabular-nums w-6 text-right">{amc.count}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
          Top 3 AMCs manage {amcData.slice(0, 3).reduce((s, a) => s + a.count, 0)} of {funds.length} visible funds
          ({((amcData.slice(0, 3).reduce((s, a) => s + a.count, 0) / funds.length) * 100).toFixed(0)}% concentration).
        </p>
      </div>
    </div>
  );
}
