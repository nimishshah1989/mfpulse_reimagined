import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR, formatPct } from '../../lib/format';
import { lensColor } from '../../lib/lens';
import { MODE_COLORS, MODE_LABELS, resampleTimeline } from '../../lib/simulation';
import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
import Card from '../shared/Card';

export default function StrategyDetail({ strategy }) {
  const s = strategy;
  const funds = s.funds || [];
  const allocations = s.allocations || {};
  const metrics = s.latest_backtest || s.metrics || {};
  const rules = s.rules || [];

  const chartData = useMemo(() => {
    const timeline = metrics.timeline || s.timeline || [];
    return resampleTimeline(timeline, 100);
  }, [metrics, s]);

  return (
    <div className="p-4 border-t border-slate-100 space-y-4">
      {/* Fund list with allocations + lens tags */}
      {funds.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-600 mb-2">Fund Allocations</h4>
          <div className="space-y-1.5">
            {funds.map((fund) => (
              <div key={fund.mstar_id} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {fund.return_score != null && <LensCircle scoreKey="return_score" score={fund.return_score} size="sm" />}
                  {fund.alpha_score != null && <LensCircle scoreKey="alpha_score" score={fund.alpha_score} size="sm" />}
                  {fund.resilience_score != null && <LensCircle scoreKey="resilience_score" score={fund.resilience_score} size="sm" />}
                </div>
                <span className="text-xs text-slate-700 truncate flex-1">{fund.fund_name}</span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {allocations[fund.mstar_id] || fund.allocation || 0}%
                </span>
                {fund.return_class && (
                  <TierBadge tier={fund.return_class} score={fund.return_score} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment conditions summary */}
      {rules.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-600 mb-2">Conditions</h4>
          <div className="space-y-1">
            {rules.map((rule, i) => (
              <div key={i} className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1.5">
                <span className="font-medium">{rule.name}:</span>{' '}
                {rule.conditions.map((c, j) => (
                  <span key={j}>
                    {j > 0 && <span className="text-slate-400"> {rule.logic} </span>}
                    {c.signal_name} {c.operator} {c.threshold}
                  </span>
                ))}
                <span className="text-slate-400"> → {rule.multiplier}x SIP, {rule.cooloff_days}d cooloff</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equity curve chart */}
      {chartData.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-600 mb-2">Equity Curve</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(0, 7)} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip
                formatter={(v) => formatINR(v, 0)}
                contentStyle={{ fontSize: 10 }}
              />
              <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 3-column results */}
      {metrics.xirr_pct != null && (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[10px] text-slate-500">XIRR</p>
            <p className="text-lg font-bold font-mono tabular-nums"
               style={{ color: (metrics.xirr_pct || 0) >= 0 ? '#059669' : '#dc2626' }}>
              {formatPct(metrics.xirr_pct)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Max Drawdown</p>
            <p className="text-lg font-bold font-mono tabular-nums text-red-600">
              {formatPct(metrics.max_drawdown_pct)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Sharpe</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-800">
              {metrics.sharpe?.toFixed(2) || '—'}
            </p>
          </div>
        </div>
      )}

      {/* Event log table */}
      {metrics.events && metrics.events.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-600 mb-2">
            Event Log ({metrics.events.length} events)
          </h4>
          <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1 text-slate-500 font-medium">Date</th>
                  <th className="text-left px-2 py-1 text-slate-500 font-medium">Trigger</th>
                  <th className="text-right px-2 py-1 text-slate-500 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.events.slice(0, 20).map((evt, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 font-mono tabular-nums">{evt.date}</td>
                    <td className="px-2 py-1 text-slate-600">{evt.trigger || evt.condition || '—'}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{formatINR(evt.amount, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
