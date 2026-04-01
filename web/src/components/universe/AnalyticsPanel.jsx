/**
 * AnalyticsPanel — 6 narrative cards, each telling a story with expandable fund lists.
 * Cards: Return Distribution, AMC Landscape, Quartile Movers, Risk-Efficiency Map,
 *        Cap & Style Positioning, Valuation Pulse.
 */
import { useState, useMemo } from 'react';
import { formatPct, formatAUM } from '../../lib/format';
import { scoreColor } from '../../lib/lens';
import FundListPanel from '../shared/FundListPanel';

/* ── Shared helpers ─────────────────────── */

function returnColorClass(val) {
  const n = Number(val) || 0;
  if (n >= 20) return 'text-emerald-700';
  if (n >= 10) return 'text-teal-600';
  if (n >= 0) return 'text-amber-600';
  return 'text-rose-600';
}

function PeriodToggle({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {['1y', '3y', '5y'].map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition-all ${
            value === p
              ? 'bg-teal-50 text-teal-700 border-teal-300'
              : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
          }`}
        >
          {p.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ExpandButton({ expanded, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors mt-3"
    >
      <svg
        className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      {label}
    </button>
  );
}

function QDot({ q }) {
  if (q == null) return <span className="text-slate-300 text-[10px]">--</span>;
  const bg = { 1: '#047857', 2: '#0d9488', 3: '#d97706', 4: '#be123c' };
  return (
    <span
      className="inline-flex items-center justify-center w-[20px] h-[20px] rounded text-[10px] font-extrabold text-white"
      style={{ background: bg[q] || '#94a3b8' }}
    >
      {q}
    </span>
  );
}

/* ── Card 1: Return Distribution ─────────── */

function ReturnDistributionCard({ funds }) {
  const [period, setPeriod] = useState('1y');
  const [expandedBucket, setExpandedBucket] = useState(null);

  const returnKey = { '1y': 'return_1y', '3y': 'return_3y', '5y': 'return_5y' }[period];

  const buckets = useMemo(() => {
    const ranges = [
      { label: '> 30%', min: 30, max: Infinity, color: '#047857' },
      { label: '20-30%', min: 20, max: 30, color: '#0d9488' },
      { label: '10-20%', min: 10, max: 20, color: '#0f766e' },
      { label: '0-10%', min: 0, max: 10, color: '#d97706' },
      { label: '< 0%', min: -Infinity, max: 0, color: '#be123c' },
    ];

    return ranges.map((r) => {
      const matched = funds.filter((f) => {
        const v = Number(f[returnKey]);
        if (isNaN(v)) return false;
        return v >= r.min && v < r.max;
      });
      return { ...r, funds: matched, count: matched.length };
    });
  }, [funds, returnKey]);

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const total = funds.length;

  // Commentary
  const topBucket = buckets.reduce((a, b) => (a.count > b.count ? a : b), buckets[0]);
  const negBucket = buckets.find((b) => b.label === '< 0%');
  const highBucket = buckets.find((b) => b.label === '> 30%');

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="section-title">Return Distribution</p>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>
      <p className="text-[11px] text-slate-400 mb-4">Where do most funds cluster by {period.toUpperCase()} returns?</p>

      {/* Horizontal bar chart */}
      <div className="space-y-2">
        {buckets.map((b) => {
          const pct = total > 0 ? ((b.count / total) * 100).toFixed(0) : 0;
          const barWidth = (b.count / maxCount) * 100;
          const isExpanded = expandedBucket === b.label;
          return (
            <div key={b.label}>
              <button
                type="button"
                onClick={() => setExpandedBucket(isExpanded ? null : b.label)}
                className="w-full text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 w-[50px] text-right shrink-0">{b.label}</span>
                  <div className="flex-1 h-[22px] bg-white rounded-md overflow-hidden border border-slate-100">
                    <div
                      className="h-full rounded-md flex items-center px-2 transition-all group-hover:opacity-80"
                      style={{ width: `${Math.max(barWidth, 2)}%`, background: b.color }}
                    >
                      {barWidth > 15 && (
                        <span className="text-[9px] font-bold text-white">{b.count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 w-[35px] text-right tabular-nums">{pct}%</span>
                  <svg
                    className={`w-3 h-3 text-slate-300 group-hover:text-teal-500 transition-all ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              {isExpanded && b.funds.length > 0 && (
                <div className="mt-2 ml-[52px] border-l-2 border-slate-100 pl-3">
                  <FundListPanel
                    funds={b.funds}
                    sortKey={returnKey}
                    returnPeriod={period}
                    maxItems={10}
                    showRank={true}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Commentary */}
      <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
        {topBucket.count > 0 && `Most funds (${topBucket.count}) cluster in the ${topBucket.label} band. `}
        {highBucket && highBucket.count > 0 && `${highBucket.count} funds beat 30% — click to see them. `}
        {negBucket && negBucket.count > 0 && `${negBucket.count} funds are in the red.`}
      </p>
    </div>
  );
}

/* ── Card 2: AMC Landscape ────────────────── */

function AMCLandscapeCard({ funds }) {
  const [expandedAMC, setExpandedAMC] = useState(null);

  const amcData = useMemo(() => {
    const map = {};
    funds.forEach((f) => {
      const amc = f.amc_name;
      if (!amc) return;
      if (!map[amc]) map[amc] = { funds: [], totalAum: 0, returns: [] };
      map[amc].funds.push(f);
      map[amc].totalAum += (Number(f.aum) || 0) / 1e7;
      const r = Number(f.return_1y);
      if (!isNaN(r)) map[amc].returns.push(r);
    });

    return Object.entries(map)
      .map(([amc, data]) => ({
        amc,
        count: data.funds.length,
        totalAum: data.totalAum,
        avgReturn: data.returns.length > 0 ? data.returns.reduce((s, v) => s + v, 0) / data.returns.length : 0,
        funds: data.funds,
      }))
      .sort((a, b) => b.totalAum - a.totalAum)
      .slice(0, 10);
  }, [funds]);

  const maxAum = Math.max(...amcData.map((a) => a.totalAum), 1);

  // Commentary
  const topAmc = amcData[0];
  const bestReturn = [...amcData].sort((a, b) => b.avgReturn - a.avgReturn)[0];

  return (
    <div className="glass-card p-5">
      <p className="section-title mb-1">AMC Landscape</p>
      <p className="text-[11px] text-slate-400 mb-4">Which AMCs dominate this space? Who delivers the best returns?</p>

      <div className="space-y-1.5">
        {amcData.map((a) => {
          const barWidth = (a.totalAum / maxAum) * 100;
          const isExpanded = expandedAMC === a.amc;
          return (
            <div key={a.amc}>
              <button
                type="button"
                onClick={() => setExpandedAMC(isExpanded ? null : a.amc)}
                className="w-full text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-600 w-[100px] text-right shrink-0 truncate" title={a.amc}>
                    {a.amc.replace(/ Mutual Fund| Asset Management.*| AMC.*/i, '').slice(0, 14)}
                  </span>
                  <div className="flex-1 h-[20px] bg-white rounded-md overflow-hidden border border-slate-100">
                    <div
                      className="h-full rounded-md transition-all group-hover:opacity-80"
                      style={{ width: `${Math.max(barWidth, 3)}%`, background: '#0f766e' }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 w-[50px] text-right tabular-nums shrink-0">
                    {formatAUM(a.totalAum)}
                  </span>
                  <span className={`text-[10px] font-bold tabular-nums w-[40px] text-right shrink-0 ${returnColorClass(a.avgReturn)}`}>
                    {formatPct(a.avgReturn)}
                  </span>
                  <span className="text-[9px] text-slate-400 w-[25px] text-right shrink-0">{a.count}</span>
                  <svg
                    className={`w-3 h-3 text-slate-300 group-hover:text-teal-500 transition-all ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              {isExpanded && (
                <div className="mt-2 ml-[104px] border-l-2 border-slate-100 pl-3">
                  <FundListPanel
                    funds={a.funds}
                    sortKey="return_1y"
                    returnPeriod="1y"
                    maxItems={10}
                    showRank={true}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
        {topAmc && `${topAmc.amc.replace(/ Mutual Fund.*/, '')} leads with ${formatAUM(topAmc.totalAum)} AUM across ${topAmc.count} funds. `}
        {bestReturn && bestReturn.amc !== topAmc?.amc && `Best avg returns from ${bestReturn.amc.replace(/ Mutual Fund.*/, '')} at ${formatPct(bestReturn.avgReturn)}.`}
      </p>
    </div>
  );
}

/* ── Card 3: Quartile Movers ──────────────── */

function QuartileMoversCard({ funds }) {
  const [expandedType, setExpandedType] = useState(null);

  const { consistent, deteriorating, improving } = useMemo(() => {
    const withQuartiles = funds.filter((f) => f.quartile_1y != null && f.quartile_3y != null);

    const consistent = withQuartiles.filter((f) => {
      const q1y = Number(f.quartile_1y);
      const q3y = Number(f.quartile_3y);
      return q1y <= 2 && q3y <= 2;
    }).sort((a, b) => (Number(a.quartile_1y) || 5) - (Number(b.quartile_1y) || 5));

    const deteriorating = withQuartiles.filter((f) => {
      const q1m = Number(f.quartile_1m) || Number(f.quartile_3m) || 3;
      const q3y = Number(f.quartile_3y) || 3;
      return q1m >= 3 && q3y <= 2;
    }).sort((a, b) => (Number(b.quartile_1m) || 0) - (Number(a.quartile_1m) || 0));

    const improving = withQuartiles.filter((f) => {
      const q1m = Number(f.quartile_1m) || Number(f.quartile_3m) || 3;
      const q3y = Number(f.quartile_3y) || 3;
      return q1m <= 2 && q3y >= 3;
    }).sort((a, b) => (Number(a.quartile_1m) || 5) - (Number(b.quartile_1m) || 5));

    return { consistent, deteriorating, improving };
  }, [funds]);

  const groups = [
    { key: 'consistent', label: 'Consistently Top Half', funds: consistent, color: '#047857', desc: 'Q1-Q2 in both 1Y and 3Y — reliable performers' },
    { key: 'improving', label: 'Recently Improving', funds: improving, color: '#0d9488', desc: 'Was Q3-Q4 long-term, now Q1-Q2 recently' },
    { key: 'deteriorating', label: 'Deteriorating', funds: deteriorating, color: '#be123c', desc: 'Was Q1-Q2 long-term, now Q3-Q4 recently' },
  ];

  return (
    <div className="glass-card p-5">
      <p className="section-title mb-1">Quartile Movers</p>
      <p className="text-[11px] text-slate-400 mb-4">
        Quartile = rank within category (Q1 = top 25%, Q4 = bottom 25%). Tracks trajectory over time.
      </p>

      <div className="space-y-3">
        {groups.map((g) => {
          const isExpanded = expandedType === g.key;
          return (
            <div key={g.key}>
              <button
                type="button"
                onClick={() => setExpandedType(isExpanded ? null : g.key)}
                className="w-full text-left group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{ background: g.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">{g.label}</p>
                    <p className="text-[10px] text-slate-400">{g.desc}</p>
                  </div>
                  <span className="text-sm font-extrabold tabular-nums shrink-0" style={{ color: g.color }}>
                    {g.funds.length}
                  </span>
                  <svg
                    className={`w-3 h-3 text-slate-300 group-hover:text-teal-500 transition-all ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {isExpanded && g.funds.length > 0 && (
                <div className="mt-2 ml-5 border-l-2 border-slate-100 pl-3">
                  {/* Show quartile trajectory for top funds */}
                  <div className="mb-2">
                    {g.funds.slice(0, 5).map((f) => (
                      <div key={f.mstar_id} className="flex items-center gap-2 py-1">
                        <span className="text-[10px] font-semibold text-slate-600 w-[140px] truncate">
                          {(f.fund_name || '').replace(/ - Direct.*| Direct.*/, '').slice(0, 20)}
                        </span>
                        <div className="flex gap-1 items-center">
                          <span className="text-[9px] text-slate-400">1M</span><QDot q={f.quartile_1m} />
                          <span className="text-[9px] text-slate-400">3M</span><QDot q={f.quartile_3m} />
                          <span className="text-[9px] text-slate-400">1Y</span><QDot q={f.quartile_1y} />
                          <span className="text-[9px] text-slate-400">3Y</span><QDot q={f.quartile_3y} />
                          <span className="text-[9px] text-slate-400">5Y</span><QDot q={f.quartile_5y} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <FundListPanel
                    funds={g.funds}
                    sortKey="return_1y"
                    returnPeriod="1y"
                    maxItems={10}
                    showRank={true}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
        {consistent.length} funds maintain top-half rank across periods.
        {deteriorating.length > 0 && ` Watch ${deteriorating.length} funds showing recent weakness.`}
        {improving.length > 0 && ` ${improving.length} funds are turning around — worth investigating.`}
      </p>
    </div>
  );
}

/* ── Card 4: Risk-Efficiency Map ──────────── */

function RiskEfficiencyCard({ funds }) {
  const [expandedCat, setExpandedCat] = useState(null);

  const catData = useMemo(() => {
    const map = {};
    funds.forEach((f) => {
      const cat = f.broad_category || f.category_name;
      if (!cat) return;
      if (!map[cat]) map[cat] = { funds: [], returns: [], sharpes: [], stddevs: [], drawdowns: [] };
      map[cat].funds.push(f);
      const r3 = Number(f.return_3y) || Number(f.return_1y) || 0;
      map[cat].returns.push(r3);
      if (f.sharpe_3y != null) map[cat].sharpes.push(Number(f.sharpe_3y));
      if (f.std_dev_3y != null) map[cat].stddevs.push(Number(f.std_dev_3y));
      if (f.max_drawdown_3y != null) map[cat].drawdowns.push(Number(f.max_drawdown_3y));
    });

    const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    return Object.entries(map)
      .map(([cat, d]) => ({
        category: cat,
        count: d.funds.length,
        avgReturn: avg(d.returns),
        avgSharpe: avg(d.sharpes),
        avgStdDev: avg(d.stddevs),
        avgDD: avg(d.drawdowns),
        funds: d.funds,
      }))
      .filter((c) => c.avgSharpe != null && c.count >= 3)
      .sort((a, b) => (b.avgSharpe || 0) - (a.avgSharpe || 0))
      .slice(0, 8);
  }, [funds]);

  const bestSharpe = catData[0];
  const worstDD = [...catData].sort((a, b) => (a.avgDD || 0) - (b.avgDD || 0))[0];

  return (
    <div className="glass-card p-5">
      <p className="section-title mb-1">Risk-Efficiency Map</p>
      <p className="text-[11px] text-slate-500 mb-4">Risk-adjusted returns by fund type. Sharpe = return per unit of risk. Equity = pure equity funds. Allocation = hybrid/balanced funds (equity + debt mix).</p>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">Category</th>
            <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">#</th>
            <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Avg 3Y</th>
            <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Sharpe</th>
            <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Std Dev</th>
            <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Max DD</th>
            <th className="w-5"></th>
          </tr>
        </thead>
        <tbody>
          {catData.map((r) => {
            const isExpanded = expandedCat === r.category;
            return (
              <>
                <tr
                  key={r.category}
                  className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors"
                  onClick={() => setExpandedCat(isExpanded ? null : r.category)}
                >
                  <td className="py-2 font-semibold text-slate-700">{r.category}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-400">{r.count}</td>
                  <td className={`py-2 px-2 text-right tabular-nums font-bold ${returnColorClass(r.avgReturn)}`}>
                    {r.avgReturn != null ? formatPct(r.avgReturn) : '--'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ color: scoreColor((r.avgSharpe || 0) * 40) }}>
                    {r.avgSharpe != null ? r.avgSharpe.toFixed(2) : '--'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">
                    {r.avgStdDev != null ? r.avgStdDev.toFixed(1) : '--'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-rose-600">
                    {r.avgDD != null ? formatPct(r.avgDD) : '--'}
                  </td>
                  <td className="py-2">
                    <svg
                      className={`w-3 h-3 text-slate-300 transition-all ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${r.category}-exp`}>
                    <td colSpan={7} className="py-2 px-4 border-b border-slate-100">
                      <FundListPanel
                        funds={r.funds}
                        sortKey="sharpe_3y"
                        returnPeriod="3y"
                        maxItems={10}
                        showRank={true}
                      />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>

      <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
        {bestSharpe && `${bestSharpe.category} offers the best risk-adjusted returns (Sharpe ${bestSharpe.avgSharpe?.toFixed(2)}). `}
        {worstDD && worstDD.category !== bestSharpe?.category && `Deepest drawdowns in ${worstDD.category} at ${formatPct(worstDD.avgDD)}.`}
      </p>
    </div>
  );
}

/* ── Card 5: Cap & Style Positioning ──────── */

function CapStyleCard({ funds }) {
  const [expandedCell, setExpandedCell] = useState(null);

  const { grid, caps, styles } = useMemo(() => {
    const grid = {};
    const caps = ['Large', 'Mid', 'Small'];
    const styles = ['Value', 'Blend', 'Growth'];
    caps.forEach((c) => styles.forEach((s) => {
      grid[`${c}-${s}`] = { funds: [], returns: [] };
    }));

    funds.forEach((f) => {
      // Derive from cap allocation if no equity_style_box
      let capLabel = null;
      let styleLabel = 'Blend';

      if (f.equity_style_box) {
        const parts = f.equity_style_box.split(/\s+/);
        capLabel = caps.find((c) => parts[0]?.toLowerCase().includes(c.toLowerCase()));
        styleLabel = styles.find((s) => parts.slice(1).join(' ').toLowerCase().includes(s.toLowerCase())) || 'Blend';
      } else {
        // Infer from cap allocation
        const large = Number(f.india_large_cap_pct) || 0;
        const mid = Number(f.india_mid_cap_pct) || 0;
        const small = Number(f.india_small_cap_pct) || 0;
        if (large + mid + small === 0) return;
        if (large >= mid && large >= small) capLabel = 'Large';
        else if (mid >= large && mid >= small) capLabel = 'Mid';
        else capLabel = 'Small';
      }

      if (!capLabel) return;
      const key = `${capLabel}-${styleLabel}`;
      if (grid[key]) {
        grid[key].funds.push(f);
        grid[key].returns.push(Number(f.return_1y) || 0);
      }
    });

    Object.keys(grid).forEach((k) => {
      const arr = grid[k].returns;
      grid[k].avg = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    });
    return { grid, caps, styles };
  }, [funds]);

  function returnBg(val) {
    const n = Number(val) || 0;
    if (n >= 20) return '#d1fae5';
    if (n >= 10) return '#ccfbf1';
    if (n >= 0) return '#fef9c3';
    return '#ffe4e6';
  }

  return (
    <div className="glass-card p-5">
      <p className="section-title mb-1">Cap & Style Positioning</p>
      <p className="text-[11px] text-slate-400 mb-4">
        The Morningstar Style Box maps funds on two axes: market cap (Large/Mid/Small) and investment style (Value/Blend/Growth).
        Click any cell to see its funds.
      </p>

      <table className="w-full border-collapse" style={{ borderSpacing: '4px' }}>
        <thead>
          <tr>
            <th className="w-14"></th>
            {styles.map((s) => (
              <th key={s} className="text-center text-[10px] font-bold text-slate-400 uppercase pb-2">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {caps.map((cap) => (
            <tr key={cap}>
              <td className="text-[10px] font-bold text-slate-400 uppercase py-1 pr-2">{cap}</td>
              {styles.map((style) => {
                const key = `${cap}-${style}`;
                const cell = grid[key];
                const isExpanded = expandedCell === key;
                if (!cell || cell.funds.length === 0) {
                  return (
                    <td key={style} className="text-center py-3 px-2 rounded-md bg-slate-50/50">
                      <span className="text-slate-300 text-[10px]">--</span>
                    </td>
                  );
                }
                return (
                  <td key={style} className="text-center align-top">
                    <button
                      type="button"
                      onClick={() => setExpandedCell(isExpanded ? null : key)}
                      className="w-full py-3 px-2 rounded-md hover:opacity-80 transition-all"
                      style={{ background: returnBg(cell.avg) }}
                    >
                      <strong className="text-slate-800 text-sm">{cell.funds.length}</strong>
                      <br />
                      <span className={`text-[10px] font-semibold ${returnColorClass(cell.avg)}`}>
                        {cell.avg != null ? formatPct(cell.avg) : '--'}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Expanded fund list — rendered BELOW the table to avoid cell overlap */}
      {expandedCell && grid[expandedCell]?.funds.length > 0 && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-700">{expandedCell.replace('-', ' ')} — {grid[expandedCell].funds.length} funds</p>
            <button type="button" onClick={() => setExpandedCell(null)} className="text-[10px] text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <FundListPanel
            funds={grid[expandedCell].funds}
            sortKey="return_1y"
            returnPeriod="1y"
            maxItems={8}
            showRank={true}
          />
        </div>
      )}

      <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
        {(() => {
          let best = null;
          let bestAvg = -999;
          Object.entries(grid).forEach(([k, v]) => {
            if (v.avg != null && v.avg > bestAvg && v.funds.length >= 2) { bestAvg = v.avg; best = k; }
          });
          return best ? `${best.replace('-', ' ')} is the best-performing zone at ${formatPct(bestAvg)}. ` : '';
        })()}
        Large = top 70% of market cap. Mid = next 20%. Small = bottom 10%.
      </p>
    </div>
  );
}

/* ── Card 6: Valuation Pulse ──────────────── */

function ValuationPulseCard({ funds }) {
  const [expandedCat, setExpandedCat] = useState(null);

  const catVals = useMemo(() => {
    const map = {};
    funds.forEach((f) => {
      const cat = f.broad_category || f.category_name;
      if (!cat) return;
      if (!map[cat]) map[cat] = { funds: [], pe: [], pb: [], dy: [], to: [] };
      map[cat].funds.push(f);
      if (f.pe_ratio) map[cat].pe.push(Number(f.pe_ratio));
      if (f.pb_ratio) map[cat].pb.push(Number(f.pb_ratio));
      if (f.prospective_div_yield) map[cat].dy.push(Number(f.prospective_div_yield));
      if (f.turnover_ratio) map[cat].to.push(Number(f.turnover_ratio));
    });

    const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    return Object.entries(map)
      .filter(([, v]) => v.pe.length >= 2)
      .map(([cat, v]) => ({
        category: cat,
        pe: avg(v.pe),
        pb: avg(v.pb),
        divYield: avg(v.dy),
        turnover: avg(v.to),
        funds: v.funds,
      }))
      .sort((a, b) => (a.pe || 0) - (b.pe || 0))
      .slice(0, 6);
  }, [funds]);

  const highPE = catVals.find((v) => v.pe > 35);
  const bestYield = [...catVals].filter((v) => v.divYield != null).sort((a, b) => (b.divYield || 0) - (a.divYield || 0))[0];

  return (
    <div className="glass-card p-5">
      <p className="section-title mb-1">Valuation Pulse</p>
      <p className="text-[11px] text-slate-500 mb-4">Are fund types cheap or expensive? P/E = Price/Earnings (lower = cheaper). P/B = Price/Book. Div Yield = dividend income %. Turnover = how often the fund trades. Equity = pure equity. Allocation = hybrid/balanced funds.</p>

      {catVals.length === 0 ? (
        <p className="text-xs text-slate-400">Valuation data not yet available.</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">Category</th>
              <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">P/E</th>
              <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">P/B</th>
              <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Div Yield</th>
              <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Turnover</th>
              <th className="w-5"></th>
            </tr>
          </thead>
          <tbody>
            {catVals.map((v) => {
              const isExpanded = expandedCat === v.category;
              return (
                <>
                  <tr
                    key={v.category}
                    className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors"
                    onClick={() => setExpandedCat(isExpanded ? null : v.category)}
                  >
                    <td className="py-2 font-semibold text-slate-700">{v.category}</td>
                    <td className={`py-2 px-2 text-right tabular-nums font-semibold ${v.pe > 35 ? 'text-amber-600' : ''}`}>
                      {v.pe != null ? v.pe.toFixed(1) : '--'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">
                      {v.pb != null ? v.pb.toFixed(1) : '--'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">
                      {v.divYield != null ? v.divYield.toFixed(1) + '%' : '--'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">
                      {v.turnover != null ? Math.round(v.turnover) + '%' : '--'}
                    </td>
                    <td className="py-2">
                      <svg
                        className={`w-3 h-3 text-slate-300 transition-all ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${v.category}-exp`}>
                      <td colSpan={6} className="py-2 px-4 border-b border-slate-100">
                        <FundListPanel
                          funds={v.funds}
                          sortKey="pe_ratio"
                          returnPeriod="1y"
                          maxItems={10}
                          showRank={true}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
        {highPE && `${highPE.category} at ${highPE.pe.toFixed(0)}x P/E — premium valuation, ensure growth justifies it. `}
        {bestYield && `Best dividend yield in ${bestYield.category} at ${bestYield.divYield?.toFixed(1)}%.`}
      </p>
    </div>
  );
}

/* ── Main Export ───────────────────────────── */

export default function AnalyticsPanel({ funds }) {
  return (
    <div className="space-y-5 animate-in">
      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReturnDistributionCard funds={funds} />
        <AMCLandscapeCard funds={funds} />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <QuartileMoversCard funds={funds} />
        <RiskEfficiencyCard funds={funds} />
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CapStyleCard funds={funds} />
        <ValuationPulseCard funds={funds} />
      </div>
    </div>
  );
}
