/**
 * AnalyticsPanel — aggregated views across filtered universe.
 * 6 cards: Style Box, Quartile Consistency, Sector Exposure Heatmap,
 * Risk-Return by Category, Cap Allocation, Valuation Snapshot.
 */
import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { formatPct } from '../../lib/format';
import { scoreColor } from '../../lib/lens';

function returnColorClass(val) {
  const n = Number(val) || 0;
  if (n >= 20) return 'text-emerald-700';
  if (n >= 10) return 'text-teal-600';
  if (n >= 0) return 'text-amber-600';
  return 'text-rose-600';
}

function returnBg(val) {
  const n = Number(val) || 0;
  if (n >= 20) return '#d1fae5';
  if (n >= 10) return '#ccfbf1';
  if (n >= 0) return '#fef9c3';
  return '#ffe4e6';
}

/** Quartile dot badge */
function QDot({ q }) {
  if (q == null) return <span className="text-slate-300 text-[10px]">—</span>;
  const bg = { 1: '#047857', 2: '#0d9488', 3: '#d97706', 4: '#be123c' };
  return (
    <span
      className="inline-flex items-center justify-center w-[22px] h-[22px] rounded text-[10px] font-extrabold text-white"
      style={{ background: bg[q] || '#94a3b8' }}
    >
      {q}
    </span>
  );
}

export default function AnalyticsPanel({ funds }) {
  const router = useRouter();

  // ── Style Box Distribution ──
  const styleBoxData = useMemo(() => {
    const grid = {};
    const caps = ['Large', 'Mid', 'Small'];
    const styles = ['Value', 'Blend', 'Growth'];
    caps.forEach((c) => styles.forEach((s) => { grid[`${c}-${s}`] = { count: 0, returns: [] }; }));

    funds.forEach((f) => {
      const styleBox = f.equity_style_box;
      if (!styleBox) return;
      // Style box format: "Large Value", "Mid Blend", etc.
      const parts = (styleBox || '').split(/\s+/);
      if (parts.length < 2) return;
      const cap = caps.find((c) => parts[0]?.toLowerCase().includes(c.toLowerCase()));
      const style = styles.find((s) => parts.slice(1).join(' ').toLowerCase().includes(s.toLowerCase()));
      if (cap && style) {
        const key = `${cap}-${style}`;
        grid[key].count += 1;
        grid[key].returns.push(Number(f.return_1y) || 0);
      }
    });

    // Compute averages
    Object.keys(grid).forEach((k) => {
      const arr = grid[k].returns;
      grid[k].avg = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    });
    return { grid, caps, styles };
  }, [funds]);

  // ── Quartile Consistency (top 10 by return, show 1M/3M/1Y/3Y/5Y) ──
  const quartileData = useMemo(() => {
    return [...funds]
      .filter((f) => f.quartile_1y != null)
      .sort((a, b) => (Number(b.return_1y) || 0) - (Number(a.return_1y) || 0))
      .slice(0, 8)
      .map((f) => ({
        name: (f.fund_name || f.legal_name || '').replace(/ - Direct.*| Direct.*/, '').slice(0, 22),
        mstar_id: f.mstar_id,
        q1m: f.quartile_1m,
        q3m: f.quartile_3m,
        q1y: f.quartile_1y,
        q3y: f.quartile_3y,
        q5y: f.quartile_5y,
      }));
  }, [funds]);

  // ── Sector Exposure by Category ──
  const sectorHeatmap = useMemo(() => {
    const catSectors = {};
    const sectorSet = new Set();

    funds.forEach((f) => {
      const cat = f.broad_category || f.category_name;
      if (!cat || !f.sector_exposures) return;
      if (!catSectors[cat]) catSectors[cat] = {};
      (f.sector_exposures || []).forEach(({ sector_name, net_pct }) => {
        sectorSet.add(sector_name);
        if (!catSectors[cat][sector_name]) catSectors[cat][sector_name] = [];
        catSectors[cat][sector_name].push(Number(net_pct) || 0);
      });
    });

    // Average per category-sector
    const cats = Object.keys(catSectors).sort();
    const sectors = [...sectorSet].sort().slice(0, 6);
    const data = {};
    cats.forEach((cat) => {
      data[cat] = {};
      sectors.forEach((sec) => {
        const arr = catSectors[cat]?.[sec] || [];
        data[cat][sec] = arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      });
    });

    return { cats: cats.slice(0, 5), sectors, data };
  }, [funds]);

  // ── Risk-Return by Category ──
  const riskReturnData = useMemo(() => {
    const catStats = {};
    funds.forEach((f) => {
      const cat = f.broad_category || f.category_name;
      if (!cat) return;
      if (!catStats[cat]) catStats[cat] = { returns: [], stddevs: [], sharpes: [], drawdowns: [] };
      catStats[cat].returns.push(Number(f.return_3y) || Number(f.return_1y) || 0);
      catStats[cat].stddevs.push(Number(f.std_dev_3y) || 0);
      catStats[cat].sharpes.push(Number(f.sharpe_3y) || 0);
      catStats[cat].drawdowns.push(Number(f.max_drawdown_3y) || 0);
    });

    const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    return Object.entries(catStats)
      .map(([cat, s]) => ({
        category: cat,
        avgReturn: avg(s.returns),
        stdDev: avg(s.stddevs),
        sharpe: avg(s.sharpes),
        maxDD: avg(s.drawdowns),
        count: s.returns.length,
      }))
      .sort((a, b) => b.avgReturn - a.avgReturn)
      .slice(0, 6);
  }, [funds]);

  // ── Cap Allocation by Category ──
  const capAllocData = useMemo(() => {
    const catAlloc = {};
    funds.forEach((f) => {
      const cat = f.broad_category || f.category_name;
      if (!cat) return;
      const large = Number(f.india_large_cap_pct) || 0;
      const mid = Number(f.india_mid_cap_pct) || 0;
      const small = Number(f.india_small_cap_pct) || 0;
      if (large + mid + small === 0) return;
      if (!catAlloc[cat]) catAlloc[cat] = { large: [], mid: [], small: [], count: 0 };
      catAlloc[cat].large.push(large);
      catAlloc[cat].mid.push(mid);
      catAlloc[cat].small.push(small);
      catAlloc[cat].count += 1;
    });

    const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    return Object.entries(catAlloc)
      .filter(([, v]) => v.count >= 3)
      .map(([cat, v]) => ({
        category: cat,
        large: avg(v.large),
        mid: avg(v.mid),
        small: avg(v.small),
      }))
      .sort((a, b) => b.large - a.large)
      .slice(0, 5);
  }, [funds]);

  // ── Valuation Snapshot ──
  const valuationData = useMemo(() => {
    const catVals = {};
    funds.forEach((f) => {
      const cat = f.broad_category || f.category_name;
      if (!cat) return;
      if (!catVals[cat]) catVals[cat] = { pe: [], pb: [], dy: [], to: [] };
      if (f.pe_ratio) catVals[cat].pe.push(Number(f.pe_ratio));
      if (f.pb_ratio) catVals[cat].pb.push(Number(f.pb_ratio));
      if (f.prospective_div_yield) catVals[cat].dy.push(Number(f.prospective_div_yield));
      if (f.turnover_ratio) catVals[cat].to.push(Number(f.turnover_ratio));
    });

    const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    return Object.entries(catVals)
      .filter(([, v]) => v.pe.length >= 2)
      .map(([cat, v]) => ({
        category: cat,
        pe: avg(v.pe),
        pb: avg(v.pb),
        divYield: avg(v.dy),
        turnover: avg(v.to),
      }))
      .sort((a, b) => (a.pe || 0) - (b.pe || 0))
      .slice(0, 5);
  }, [funds]);

  return (
    <div className="space-y-5 animate-in">
      {/* Row 1: Style Box + Quartile Consistency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Style Box Distribution */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Style Box Distribution</p>
          <p className="text-[11px] text-slate-400 mb-3">Fund count and avg 1Y return per style</p>
          <table className="w-full border-collapse" style={{ borderSpacing: '4px' }}>
            <thead>
              <tr>
                <th className="w-12"></th>
                {styleBoxData.styles.map((s) => (
                  <th key={s} className="text-center text-[10px] font-bold text-slate-400 uppercase pb-2">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {styleBoxData.caps.map((cap) => (
                <tr key={cap}>
                  <td className="text-[10px] font-bold text-slate-400 uppercase py-1 pr-2">{cap}</td>
                  {styleBoxData.styles.map((style) => {
                    const cell = styleBoxData.grid[`${cap}-${style}`];
                    if (!cell || cell.count === 0) {
                      return (
                        <td key={style} className="text-center py-2.5 px-1.5 rounded-md bg-slate-50">
                          <span className="text-slate-300 text-[10px]">—</span>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={style}
                        className="text-center py-2.5 px-1.5 rounded-md"
                        style={{ background: returnBg(cell.avg) }}
                      >
                        <strong className="text-slate-800 text-xs">{cell.count}</strong>
                        <br />
                        <span className={`text-[10px] font-semibold ${returnColorClass(cell.avg)}`}>
                          {cell.avg != null ? formatPct(cell.avg) : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Narrative */}
          <p className="text-[11px] text-slate-400 mt-3">
            {(() => {
              let best = null;
              let bestAvg = -999;
              Object.entries(styleBoxData.grid).forEach(([k, v]) => {
                if (v.avg != null && v.avg > bestAvg && v.count >= 2) { bestAvg = v.avg; best = k; }
              });
              return best ? `${best.replace('-', ' ')} is the hot zone at ${formatPct(bestAvg)}.` : '';
            })()}
          </p>
        </div>

        {/* Quartile Consistency */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Quartile Consistency</p>
          <p className="text-[11px] text-slate-400 mb-3">Rank stability across time periods for top funds</p>
          {quartileData.length === 0 ? (
            <p className="text-xs text-slate-400">Quartile data not yet available.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 pr-2 text-[10px] font-bold text-slate-400 uppercase" style={{ minWidth: 120 }}>Fund</th>
                  <th className="text-center py-2 px-1 text-[10px] font-bold text-slate-400">1M</th>
                  <th className="text-center py-2 px-1 text-[10px] font-bold text-slate-400">3M</th>
                  <th className="text-center py-2 px-1 text-[10px] font-bold text-slate-400">1Y</th>
                  <th className="text-center py-2 px-1 text-[10px] font-bold text-slate-400">3Y</th>
                  <th className="text-center py-2 px-1 text-[10px] font-bold text-slate-400">5Y</th>
                </tr>
              </thead>
              <tbody>
                {quartileData.map((f) => (
                  <tr
                    key={f.mstar_id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => router.push(`/fund360?fund=${f.mstar_id}`)}
                  >
                    <td className="py-2 pr-2 font-semibold text-slate-700 truncate max-w-[140px]">{f.name}</td>
                    <td className="text-center py-2 px-1"><QDot q={f.q1m} /></td>
                    <td className="text-center py-2 px-1"><QDot q={f.q3m} /></td>
                    <td className="text-center py-2 px-1"><QDot q={f.q1y} /></td>
                    <td className="text-center py-2 px-1"><QDot q={f.q3y} /></td>
                    <td className="text-center py-2 px-1"><QDot q={f.q5y} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-slate-400 mt-3">
            All-green row = truly consistent. Recent red = deteriorating fund.
          </p>
        </div>
      </div>

      {/* Row 2: Sector Exposure + Risk-Return */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sector Exposure Heatmap */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Sector Exposure by Category</p>
          <p className="text-[11px] text-slate-400 mb-3">Average allocation weight — darker = heavier</p>
          {sectorHeatmap.cats.length === 0 ? (
            <p className="text-xs text-slate-400">Sector data computing...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10px]" style={{ borderSpacing: '3px' }}>
                <thead>
                  <tr>
                    <th className="text-left py-1 px-1.5 font-bold text-slate-400 text-[9px]"></th>
                    {sectorHeatmap.sectors.map((s) => (
                      <th key={s} className="text-center py-1 px-1 font-bold text-slate-400 text-[9px] uppercase">
                        {s.slice(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectorHeatmap.cats.map((cat) => (
                    <tr key={cat}>
                      <td className="font-bold text-slate-600 py-1 px-1.5">{cat}</td>
                      {sectorHeatmap.sectors.map((sec) => {
                        const val = sectorHeatmap.data[cat]?.[sec] || 0;
                        const opacity = Math.min(val / 40, 0.45) + 0.03;
                        return (
                          <td
                            key={sec}
                            className="text-center py-2 px-1 rounded font-semibold"
                            style={{
                              background: `rgba(15,118,110,${opacity})`,
                              color: opacity > 0.25 ? '#064e3b' : '#334155',
                            }}
                          >
                            {val > 0 ? Math.round(val) + '%' : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Risk-Return by Category */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Risk-Return by Category</p>
          <p className="text-[11px] text-slate-400 mb-3">Category averages from 3Y risk stats</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">Category</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Avg 3Y</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Std Dev</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Sharpe</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400">Max DD</th>
              </tr>
            </thead>
            <tbody>
              {riskReturnData.map((r) => (
                <tr key={r.category} className="border-b border-slate-100">
                  <td className="py-2 font-semibold text-slate-700">{r.category}</td>
                  <td className={`py-2 px-2 text-right tabular-nums font-bold ${returnColorClass(r.avgReturn)}`}>
                    {formatPct(r.avgReturn)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">{r.stdDev.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">{r.sharpe.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-rose-600">
                    {formatPct(r.maxDD)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Cap Allocation + Valuations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cap Allocation by Category — data spectrum colors */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Cap Allocation by Category</p>
          <p className="text-[11px] text-slate-400 mb-3">Average Large / Mid / Small cap split</p>
          <div className="space-y-3.5">
            {capAllocData.map((c) => {
              const total = c.large + c.mid + c.small;
              if (total === 0) return null;
              const lPct = (c.large / total) * 100;
              const mPct = (c.mid / total) * 100;
              const sPct = (c.small / total) * 100;
              return (
                <div key={c.category}>
                  <p className="text-xs font-bold text-slate-800 mb-1.5">{c.category}</p>
                  <div className="flex h-[26px] rounded-md overflow-hidden">
                    {lPct > 2 && (
                      <div
                        className="flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ width: `${lPct}%`, background: '#047857' }}
                      >
                        {lPct >= 12 ? `${Math.round(lPct)}% Large` : Math.round(lPct) + '%'}
                      </div>
                    )}
                    {mPct > 2 && (
                      <div
                        className="flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ width: `${mPct}%`, background: '#0d9488' }}
                      >
                        {mPct >= 12 ? `${Math.round(mPct)}% Mid` : Math.round(mPct) + '%'}
                      </div>
                    )}
                    {sPct > 2 && (
                      <div
                        className="flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ width: `${sPct}%`, background: '#d97706' }}
                      >
                        {sPct >= 12 ? `${Math.round(sPct)}% Small` : Math.round(sPct) + '%'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3 text-[11px] text-slate-400">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#047857' }}></span>Large</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#0d9488' }}></span>Mid</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ background: '#d97706' }}></span>Small</span>
          </div>
        </div>

        {/* Valuation Snapshot */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Valuation Snapshot</p>
          <p className="text-[11px] text-slate-400 mb-3">Portfolio-level valuations from holdings data</p>
          {valuationData.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {valuationData.map((v) => (
                  <tr key={v.category} className="border-b border-slate-100">
                    <td className="py-2 font-semibold text-slate-700">{v.category}</td>
                    <td className={`py-2 px-2 text-right tabular-nums font-semibold ${v.pe > 35 ? 'text-amber-600' : ''}`}>
                      {v.pe != null ? v.pe.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">
                      {v.pb != null ? v.pb.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">
                      {v.divYield != null ? v.divYield.toFixed(1) + '%' : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">
                      {v.turnover != null ? Math.round(v.turnover) + '%' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {valuationData.length > 0 && (() => {
            const highPE = valuationData.find((v) => v.pe > 35);
            return highPE ? (
              <p className="text-[11px] text-slate-400 mt-3">
                {highPE.category} at {highPE.pe.toFixed(0)}x P/E — premium valuation.
              </p>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
