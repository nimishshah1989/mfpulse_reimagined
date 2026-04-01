/**
 * Sub-components for SimulationResults.
 * Extracted to keep each file under 300 lines.
 */

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { formatINR, formatPct } from '../../lib/format';
import { MODE_COLORS, MODE_LABELS, getSignalColor } from '../../lib/simulation';
import Card from '../shared/Card';

export function ComparisonCard({ mode, summary, isBest, modeColor }) {
  const s = summary || {};
  const profit = (s.final_value || 0) - (s.total_invested || 0);
  const profitPct = s.total_invested > 0 ? (profit / s.total_invested) * 100 : 0;

  return (
    <div className={`bg-white rounded-xl border-2 p-5 transition-all ${
      isBest ? 'border-teal-500 shadow-md' : 'border-slate-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: modeColor }} />
          <span className="text-sm font-semibold text-slate-700">{MODE_LABELS[mode] || mode}</span>
        </div>
        {isBest && (
          <span className="px-2.5 py-1 text-[10px] font-bold bg-teal-100 text-teal-700 rounded-full uppercase tracking-wide">
            Recommended
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Final Value</span>
          <span className="text-lg font-bold font-mono tabular-nums text-slate-800">{formatINR(s.final_value, 0)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">XIRR</span>
          <span className={`text-lg font-bold font-mono tabular-nums ${(s.xirr_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatPct(s.xirr_pct)}
          </span>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Total Invested</span>
          <span className="text-sm font-mono tabular-nums text-slate-600">{formatINR(s.total_invested, 0)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Profit</span>
          <span className={`text-sm font-bold font-mono tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatINR(profit, 0)} ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%)
          </span>
        </div>
        {s.max_drawdown_pct != null && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Max Drawdown</span>
            <span className="text-sm font-mono tabular-nums text-red-600">{formatPct(-Math.abs(s.max_drawdown_pct))}</span>
          </div>
        )}
        {s.sharpe_ratio != null && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Sharpe Ratio</span>
            <span className="text-sm font-mono tabular-nums text-slate-600">{Number(s.sharpe_ratio).toFixed(2)}</span>
          </div>
        )}
        {(s.num_topups != null && s.num_topups > 0) && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Signal Events</span>
            <span className="text-sm font-mono tabular-nums text-slate-600">{s.num_topups}</span>
          </div>
        )}
        {s.signal_hit_rate_3m != null && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Hit Rate (3M)</span>
            <span className={`text-sm font-mono tabular-nums ${Number(s.signal_hit_rate_3m) >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>
              {Number(s.signal_hit_rate_3m).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SignalEventTimeline({ results, modes }) {
  const [expanded, setExpanded] = useState(false);

  const allEvents = useMemo(() => {
    const events = [];
    for (const m of modes) {
      const cashflows = results[m]?.cashflow_events || [];
      const timeline = results[m]?.daily_timeline || [];

      for (const cf of cashflows) {
        if (cf.event_type === 'TOPUP' || cf.event_type === 'LUMPSUM') {
          const cfDate = new Date(cf.date);
          const laterDate = new Date(cfDate);
          laterDate.setDate(laterDate.getDate() + 90);
          const laterStr = laterDate.toISOString().split('T')[0];

          let laterNav = null;
          for (const snap of timeline) {
            if (snap.date >= laterStr) { laterNav = snap.nav; break; }
          }

          const gainPct = laterNav != null && cf.nav > 0
            ? ((laterNav - cf.nav) / cf.nav) * 100 : null;

          events.push({
            date: cf.date, mode: m, amount: cf.amount, nav: cf.nav,
            units: cf.units, event_type: cf.event_type, trigger: cf.trigger,
            gain_pct: gainPct,
          });
        }
      }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
  }, [results, modes]);

  if (allEvents.length === 0) return null;

  const displayEvents = expanded ? allEvents : allEvents.slice(0, 5);

  return (
    <Card title={`Signal Event Timeline (${allEvents.length} events)`}>
      <div className="space-y-0">
        <div className="max-h-80 overflow-y-auto">
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />
            {displayEvents.map((evt, i) => {
              const isGain = evt.gain_pct != null && evt.gain_pct >= 0;
              const dotColor = evt.gain_pct != null
                ? (isGain ? '#059669' : '#dc2626') : getSignalColor(evt.trigger);
              return (
                <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  <div className="absolute left-[-16px] top-1 w-3 h-3 rounded-full border-2 border-white flex-shrink-0" style={{ backgroundColor: dotColor }} />
                  <div className="flex-1 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-mono tabular-nums text-slate-600">{evt.date}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {evt.trigger || 'Manual'}{' '}
                        <span className="text-slate-400">({MODE_LABELS[evt.mode] || evt.mode})</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono tabular-nums font-medium text-slate-700">{formatINR(evt.amount, 0)}</p>
                      <p className="text-[10px] font-mono tabular-nums text-slate-400">
                        NAV {Number(evt.nav).toFixed(2)} / {Number(evt.units).toFixed(2)} units
                      </p>
                      {evt.gain_pct != null && (
                        <p className={`text-[10px] font-mono tabular-nums ${isGain ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isGain ? '+' : ''}{evt.gain_pct.toFixed(1)}% (3M)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {allEvents.length > 5 && (
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="mt-3 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors">
            {expanded ? 'Show Less' : `Show All ${allEvents.length} Events`}
          </button>
        )}
      </div>
    </Card>
  );
}

export function CashFlowDetail({ results, modes }) {
  const [expanded, setExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState(modes[0] || '');

  const cashflows = useMemo(() => results[activeMode]?.cashflow_events || [], [results, activeMode]);

  const rows = useMemo(() => {
    let cumUnits = 0;
    let cumInvested = 0;
    return cashflows.map((cf) => {
      cumUnits += Number(cf.units || 0);
      cumInvested += Number(cf.amount || 0);
      const portfolioValue = cumUnits * Number(cf.nav || 0);
      return { ...cf, cumUnits, cumInvested, portfolioValue };
    });
  }, [cashflows]);

  if (cashflows.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Cash Flow Detail</h3>
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          {expanded ? 'Hide' : 'Show Details'}
        </button>
      </div>
      {expanded && (
        <>
          <div className="flex items-center gap-1 mb-3">
            {modes.map((m) => (
              <button key={m} type="button" onClick={() => setActiveMode(m)}
                className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${
                  activeMode === m ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {MODE_LABELS[m] || m}
              </button>
            ))}
          </div>
          <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Type</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Amount</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">NAV</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Units</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Cum. Units</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Cum. Invested</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => {
                  const typeColor = row.event_type === 'SIP'
                    ? 'text-teal-600 bg-teal-50'
                    : row.event_type === 'TOPUP' ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50';
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-mono tabular-nums text-slate-600">{row.date}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor}`}>{row.event_type}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-700">{formatINR(row.amount, 0)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-600">{Number(row.nav).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-600">{Number(row.units).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-600">{row.cumUnits.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-600">{formatINR(row.cumInvested, 0)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums font-medium text-slate-800">{formatINR(row.portfolioValue, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">{rows.length} transactions, {MODE_LABELS[activeMode] || activeMode} mode</p>
        </>
      )}
    </Card>
  );
}

export function EquityCurveChart({ chartData, modes, bestMode, signalDots }) {
  if (!chartData || chartData.length === 0) return null;

  return (
    <Card title="Equity Curve Comparison">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(d) => d.slice(0, 7)} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={55}
            tickFormatter={(v) => {
              if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
              if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
              return `${(v / 1000).toFixed(0)}K`;
            }}
            axisLine={{ stroke: '#e2e8f0' }} />
          <Tooltip formatter={(v, name) => [formatINR(v, 0), name]} labelFormatter={(d) => d}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {modes.map((m) => (
            <Line key={m} type="monotone" dataKey={m} name={MODE_LABELS[m] || m}
              stroke={MODE_COLORS[m] || '#94a3b8'} strokeWidth={m === bestMode ? 2.5 : 1.5}
              dot={false} strokeDasharray={m === bestMode ? undefined : '4 2'} connectNulls />
          ))}
          {signalDots.map((dot, i) => (
            <ReferenceDot key={`sig-${i}`} x={dot.date} y={dot.value} r={3}
              fill={dot.gain ? '#059669' : '#f59e0b'} stroke="#fff" strokeWidth={1} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-400 mt-1">Dots mark signal-triggered investment events on the recommended mode</p>
    </Card>
  );
}
