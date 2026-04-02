/**
 * ComparePanel — head-to-head fund comparison with line charts.
 * Uses Recharts for historical returns and rolling risk curves.
 */
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatPct, formatAUM, formatINR } from '../../lib/format';
import { scoreColor } from '../../lib/lens';

const FUND_COLORS = ['#0f766e', '#1e40af', '#0369a1', '#b45309', '#7c3aed'];
const BENCHMARK_COLOR = '#94a3b8';

function returnColor(val) {
  const n = Number(val) || 0;
  if (n >= 20) return 'text-emerald-700';
  if (n >= 10) return 'text-teal-600';
  if (n >= 0) return 'text-amber-600';
  return 'text-rose-600';
}

function winClass(vals, idx, lower) {
  if (!vals || vals.length < 2) return '';
  const target = vals[idx];
  if (target == null) return '';
  const isWin = lower
    ? vals.every((v, i) => i === idx || v == null || target <= v)
    : vals.every((v, i) => i === idx || v == null || target >= v);
  return isWin ? 'bg-teal-50' : '';
}

export default function ComparePanel({
  funds,
  selectedFundIds,
  onRemoveFund,
  onAddFund,
  allFunds,
}) {
  const router = useRouter();
  const [navData, setNavData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Get selected fund objects from the full fund list
  const selectedFunds = useMemo(() => {
    if (!selectedFundIds?.length || !funds?.length) return [];
    return selectedFundIds
      .map((id) => funds.find((f) => f.mstar_id === id))
      .filter(Boolean)
      .slice(0, 5);
  }, [selectedFundIds, funds]);

  // Fetch NAV comparison data
  useEffect(() => {
    if (selectedFunds.length < 2) {
      setNavData(null);
      setRiskData(null);
      return;
    }

    const ids = selectedFunds.map((f) => f.mstar_id).join(',');
    setLoadingCharts(true);

    Promise.all([
      fetch(`/api/v1/funds/compare/nav?mstar_ids=${ids}&period=3y`)
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null),
      fetch(`/api/v1/funds/compare/risk?mstar_ids=${ids}&limit=36`)
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([navRes, riskRes]) => {
      setNavData(navRes?.data || null);
      setRiskData(riskRes?.data || null);
    }).finally(() => setLoadingCharts(false));
  }, [selectedFunds]);

  // Build chart data from API response
  const returnsChartData = useMemo(() => {
    if (!navData?.funds?.length) return null;
    // Merge all funds' data by date
    const dateMap = {};
    navData.funds.forEach((fundSeries, idx) => {
      (fundSeries.data || []).forEach(({ date, value }) => {
        if (!dateMap[date]) dateMap[date] = { date };
        dateMap[date][`fund_${idx}`] = Number(value);
      });
    });
    if (navData.benchmark) {
      navData.benchmark.forEach(({ date, value }) => {
        if (dateMap[date]) dateMap[date].benchmark = Number(value);
      });
    }
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [navData]);

  const riskChartData = useMemo(() => {
    if (!riskData?.funds?.length) return null;
    const dateMap = {};
    riskData.funds.forEach((fundSeries, idx) => {
      (fundSeries.data || []).forEach(({ date, value }) => {
        if (!dateMap[date]) dateMap[date] = { date };
        dateMap[date][`fund_${idx}`] = Number(value);
      });
    });
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [riskData]);

  // Search suggestions for adding funds
  const searchSuggestions = useMemo(() => {
    if (!searchInput || searchInput.length < 2 || !allFunds) return [];
    const q = searchInput.toLowerCase();
    const selectedSet = new Set(selectedFundIds);
    return allFunds
      .filter((f) => !selectedSet.has(f.mstar_id) && (f.fund_name || '').toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchInput, allFunds, selectedFundIds]);

  const shortName = (name) => (name || '').replace(/ - Direct.*| Direct.*| Fund$/, '').slice(0, 20);

  if (selectedFunds.length < 2) {
    return (
      <div className="glass-card p-8 text-center animate-in">
        <p className="text-sm text-slate-500 mb-2">
          Select at least 2 funds from the Screener to compare.
        </p>
        <p className="text-xs text-slate-400">
          Use the checkboxes in the Screener table, then switch to Compare.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in">
      {/* Fund selector bar */}
      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comparing</span>
        {selectedFunds.map((f, i) => (
          <span
            key={f.mstar_id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border"
            style={{
              color: FUND_COLORS[i],
              borderColor: FUND_COLORS[i] + '40',
              background: FUND_COLORS[i] + '08',
            }}
          >
            {shortName(f.fund_name || f.legal_name)}
            <button
              type="button"
              onClick={() => onRemoveFund?.(f.mstar_id)}
              className="text-slate-400 hover:text-red-500 ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
        {selectedFunds.length < 5 && (
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Add fund..."
              className="px-3 py-1.5 text-xs border border-dashed border-slate-300 rounded-lg w-40 outline-none focus:border-teal-400"
            />
            {searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                {searchSuggestions.map((f) => (
                  <button
                    key={f.mstar_id}
                    type="button"
                    onClick={() => { onAddFund?.(f.mstar_id); setSearchInput(''); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-semibold text-slate-700">{f.fund_name || f.legal_name}</span>
                    <br />
                    <span className="text-slate-400">{f.category_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Line Charts: Returns + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Historical Returns Curve */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Historical Returns Curve (3Y)</p>
          <p className="text-[11px] text-slate-400 mb-3">Cumulative growth of 1L invested</p>
          {loadingCharts ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">Loading chart data...</div>
          ) : returnsChartData ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={returnsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(d) => d?.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [formatINR(v, 0), '']}
                  labelFormatter={(l) => l}
                />
                {selectedFunds.map((f, i) => (
                  <Line
                    key={f.mstar_id}
                    dataKey={`fund_${i}`}
                    name={shortName(f.fund_name)}
                    stroke={FUND_COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                {returnsChartData[0]?.benchmark != null && (
                  <Line
                    dataKey="benchmark"
                    name="Nifty 50"
                    stroke={BENCHMARK_COLOR}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
              NAV comparison data not available. Showing table comparison below.
            </div>
          )}
        </div>

        {/* Rolling Risk Curve */}
        <div className="glass-card p-5">
          <p className="section-title mb-1">Rolling 1Y Risk (Std Dev)</p>
          <p className="text-[11px] text-slate-400 mb-3">12-month rolling standard deviation — lower is smoother</p>
          {loadingCharts ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">Loading chart data...</div>
          ) : riskChartData ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={riskChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(d) => d?.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                  width={35}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [`${Number(v).toFixed(1)}%`, '']}
                />
                {selectedFunds.map((f, i) => (
                  <Line
                    key={f.mstar_id}
                    dataKey={`fund_${i}`}
                    name={shortName(f.fund_name)}
                    stroke={FUND_COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
              Risk history data not available.
            </div>
          )}
        </div>
      </div>

      {/* Tables: Returns + Risk Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Returns Table */}
        <div className="glass-card p-5">
          <p className="section-title mb-3">Returns</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">Period</th>
                {selectedFunds.map((f, i) => (
                  <th key={f.mstar_id} className="text-right py-2 px-2 text-[10px] font-bold uppercase" style={{ color: FUND_COLORS[i] }}>
                    {shortName(f.fund_name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['return_1y', 'return_3y', 'return_5y'].map((key) => {
                const label = key.replace('return_', '').toUpperCase();
                const vals = selectedFunds.map((f) => Number(f[key]) || null);
                return (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="py-2 font-semibold text-slate-600">{label}</td>
                    {selectedFunds.map((f, i) => {
                      const v = Number(f[key]) || null;
                      return (
                        <td key={f.mstar_id} className={`py-2 px-2 text-right tabular-nums font-bold ${returnColor(v)} ${winClass(vals, i, false)}`}>
                          {v != null ? formatPct(v) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Risk Metrics Table */}
        <div className="glass-card p-5">
          <p className="section-title mb-3">Risk Metrics (3Y)</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">Metric</th>
                {selectedFunds.map((f, i) => (
                  <th key={f.mstar_id} className="text-right py-2 px-2 text-[10px] font-bold uppercase" style={{ color: FUND_COLORS[i] }}>
                    {shortName(f.fund_name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'sharpe_3y', label: 'Sharpe', fmt: (v) => v?.toFixed(2) },
                { key: 'alpha_3y', label: 'Alpha', fmt: (v) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(1) : null, colorFn: (v) => v >= 0 ? 'text-emerald-700' : 'text-rose-600' },
                { key: 'beta_3y', label: 'Beta', fmt: (v) => v?.toFixed(2), lower: true },
                { key: 'max_drawdown_3y', label: 'Max DD', fmt: (v) => v != null ? formatPct(v) : null, lower: true },
                { key: 'sortino_3y', label: 'Sortino', fmt: (v) => v?.toFixed(2) },
                { key: 'capture_up_3y', label: 'Capture Up', fmt: (v) => v != null ? Math.round(v) + '%' : null },
                { key: 'capture_down_3y', label: 'Capture Down', fmt: (v) => v != null ? Math.round(v) + '%' : null, lower: true },
              ].map(({ key, label, fmt, lower, colorFn }) => {
                const vals = selectedFunds.map((f) => {
                  const v = f[key];
                  return v != null ? Number(v) : null;
                });
                return (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="py-2 font-semibold text-slate-600">{label}</td>
                    {selectedFunds.map((f, i) => {
                      const v = vals[i];
                      const formatted = v != null ? fmt(v) : '—';
                      return (
                        <td
                          key={f.mstar_id}
                          className={`py-2 px-2 text-right tabular-nums font-semibold ${winClass(vals, i, lower)} ${colorFn ? colorFn(v) : ''}`}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6-Lens Scores + Calendar Year Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 6-Lens Scores */}
        <div className="glass-card p-5">
          <p className="section-title mb-3">6-Lens Scores</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">Lens</th>
                {selectedFunds.map((f, i) => (
                  <th key={f.mstar_id} className="text-right py-2 px-2 text-[10px] font-bold uppercase" style={{ color: FUND_COLORS[i] }}>
                    {shortName(f.fund_name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['return_score', 'risk_score', 'consistency_score', 'alpha_score', 'efficiency_score', 'resilience_score'].map((key) => {
                const label = key.replace('_score', '').replace(/^\w/, (c) => c.toUpperCase());
                const vals = selectedFunds.map((f) => Number(f[key]) || null);
                return (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="py-2 font-semibold text-slate-600">{label}</td>
                    {selectedFunds.map((f, i) => {
                      const v = vals[i];
                      return (
                        <td
                          key={f.mstar_id}
                          className={`py-2 px-2 text-right tabular-nums font-bold ${winClass(vals, i, false)}`}
                          style={{ color: v != null ? scoreColor(v) : '#94a3b8' }}
                        >
                          {v != null ? Math.round(v) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Narrative */}
          {selectedFunds.length >= 2 && (() => {
            const lenses = ['return_score', 'risk_score', 'consistency_score', 'alpha_score', 'efficiency_score', 'resilience_score'];
            const wins = selectedFunds.map((f, fi) => {
              let w = 0;
              lenses.forEach((l) => {
                const vals = selectedFunds.map((ff) => Number(ff[l]) || 0);
                if (vals[fi] >= Math.max(...vals)) w++;
              });
              return w;
            });
            const bestIdx = wins.indexOf(Math.max(...wins));
            return (
              <p className="text-[11px] text-slate-400 mt-3">
                {shortName(selectedFunds[bestIdx]?.fund_name)} wins {wins[bestIdx]} of 6 lenses.
              </p>
            );
          })()}
        </div>

        {/* Sector Exposure Comparison */}
        <div className="glass-card p-5">
          <p className="section-title mb-3">Sector Exposure</p>
          {(() => {
            // Collect all sectors from selected funds
            const sectorData = {};
            selectedFunds.forEach((f) => {
              (f.sector_exposures || []).forEach(({ sector_name, net_pct }) => {
                if (!sectorData[sector_name]) sectorData[sector_name] = {};
                sectorData[sector_name][f.mstar_id] = Number(net_pct) || 0;
              });
            });
            const sectors = Object.entries(sectorData)
              .sort((a, b) => {
                const sumA = Object.values(a[1]).reduce((s, v) => s + v, 0);
                const sumB = Object.values(b[1]).reduce((s, v) => s + v, 0);
                return sumB - sumA;
              })
              .slice(0, 6);

            if (sectors.length === 0) {
              return <p className="text-xs text-slate-400">Sector exposure data not available for these funds.</p>;
            }

            return (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">Sector</th>
                    {selectedFunds.map((f, i) => (
                      <th key={f.mstar_id} className="text-right py-2 px-2 text-[10px] font-bold uppercase" style={{ color: FUND_COLORS[i] }}>
                        {shortName(f.fund_name)}
                      </th>
                    ))}
                    <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Spread</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map(([sector, vals]) => {
                    const fundVals = selectedFunds.map((f) => vals[f.mstar_id] || 0);
                    const spread = Math.max(...fundVals) - Math.min(...fundVals);
                    return (
                      <tr key={sector} className="border-b border-slate-100">
                        <td className="py-2 font-semibold text-slate-600">{sector}</td>
                        {selectedFunds.map((f) => {
                          const v = vals[f.mstar_id] || 0;
                          const isMax = v === Math.max(...fundVals) && v > 0;
                          return (
                            <td key={f.mstar_id} className={`py-2 px-2 text-right tabular-nums ${isMax ? 'font-bold' : 'font-semibold'}`}>
                              {v > 0 ? Math.round(v) + '%' : '—'}
                            </td>
                          );
                        })}
                        <td className={`py-2 px-2 text-right tabular-nums font-semibold ${spread > 12 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {Math.round(spread)}pp
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
