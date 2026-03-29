import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatINR, formatPct } from '../../lib/format';
import { resampleTimeline } from '../../lib/simulation';
import Card from '../shared/Card';

const COMPARE_COLORS = ['#0d9488', '#7c3aed', '#f59e0b'];

export default function StrategyCompare({ strategies }) {
  if (!strategies || strategies.length < 2) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">Select at least 2 strategies to compare.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-slate-700">Strategy Comparison</h3>

      {/* Metric comparison table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Metric</th>
                {strategies.map((s, i) => (
                  <th key={s.id} className="text-right py-2 px-3 font-medium" style={{ color: COMPARE_COLORS[i] }}>
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { key: 'xirr_pct', label: 'XIRR', format: formatPct },
                { key: 'final_value', label: 'Final Value', format: (v) => formatINR(v, 0) },
                { key: 'total_invested', label: 'Invested', format: (v) => formatINR(v, 0) },
                { key: 'max_drawdown_pct', label: 'Max Drawdown', format: formatPct },
                { key: 'event_count', label: 'Events', format: (v) => v ?? '—' },
              ].map((metric) => (
                <tr key={metric.key}>
                  <td className="py-2 px-3 text-slate-600">{metric.label}</td>
                  {strategies.map((s, i) => {
                    const m = s.latest_backtest || s.metrics || {};
                    return (
                      <td key={s.id} className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                        {metric.format(m[metric.key])}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="py-2 px-3 text-slate-600">Funds</td>
                {strategies.map((s) => (
                  <td key={s.id} className="py-2 px-3 text-right text-slate-800">
                    {s.funds?.length || s.fund_count || 0}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 text-slate-600">Conditions</td>
                {strategies.map((s) => (
                  <td key={s.id} className="py-2 px-3 text-right text-slate-800">
                    {s.rules?.length || s.condition_count || 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Overlaid equity curves */}
      <Card title="Equity Curves">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(0, 7)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
            <Tooltip
              formatter={(v) => formatINR(v, 0)}
              contentStyle={{ fontSize: 11 }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {strategies.map((s, i) => {
              const timeline = s.latest_backtest?.timeline || s.metrics?.timeline || s.timeline || [];
              const data = resampleTimeline(timeline, 100);
              return (
                <Line
                  key={s.id}
                  data={data}
                  type="monotone"
                  dataKey="value"
                  name={s.name}
                  stroke={COMPARE_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
