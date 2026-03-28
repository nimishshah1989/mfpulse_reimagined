import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { formatINR, formatPct } from '../../lib/format';
import { lensColor } from '../../lib/lens';
import { MODE_COLORS, MODE_LABELS, findBestMode, resampleTimeline } from '../../lib/simulation';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

function MetricCard({ label, value, color, subtext }) {
  return (
    <div className="text-center p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${color || ''}`}
         style={!color ? { color: typeof value === 'string' && value.startsWith('+') ? '#059669' : '#dc2626' } : undefined}>
        {value}
      </p>
      {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

function EventLogTable({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-slate-600 mb-2">Event Log</h4>
      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Date</th>
              <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Condition</th>
              <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Amount</th>
              <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Gain Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((evt, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 font-mono tabular-nums text-slate-700">{evt.date}</td>
                <td className="px-3 py-1.5 text-slate-600">{evt.condition || evt.trigger || '—'}</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-700">
                  {formatINR(evt.amount, 0)}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                  (evt.gain_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {evt.gain_pct != null ? formatPct(evt.gain_pct) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SimulationResults({ results, loading, error, onSave }) {
  if (loading) {
    return <SkeletonLoader variant="chart" className="h-96 rounded-xl" />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700 font-medium">Simulation Error</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!results) return null;

  const modes = Object.keys(results).filter((k) => results[k]?.summary);
  const bestMode = findBestMode(results);

  // Merge all timelines for chart
  const chartData = useMemo(() => {
    if (modes.length === 0) return [];
    const firstMode = modes[0];
    const timeline = results[firstMode]?.timeline || [];
    const resampled = resampleTimeline(timeline);
    return resampled.map((point) => {
      const row = { date: point.date };
      modes.forEach((mode) => {
        const modeTimeline = results[mode]?.timeline || [];
        const match = modeTimeline.find((p) => p.date === point.date);
        row[mode] = match ? match.value : null;
      });
      return row;
    });
  }, [results, modes]);

  const events = results[bestMode]?.events || results.SIP_SIGNAL?.events || [];

  return (
    <div className="space-y-6">
      {/* 3-column comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const s = results[mode]?.summary || {};
          const isBest = mode === bestMode;
          return (
            <Card
              key={mode}
              className={isBest ? 'ring-2 ring-teal-500' : ''}
            >
              <div className="text-center mb-3">
                <span
                  className="inline-block w-3 h-3 rounded-full mr-1.5"
                  style={{ backgroundColor: MODE_COLORS[mode] || '#94a3b8' }}
                />
                <span className="text-sm font-semibold text-slate-700">
                  {MODE_LABELS[mode] || mode}
                </span>
                {isBest && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-700 rounded-full">
                    BEST
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                <MetricCard
                  label="XIRR"
                  value={formatPct(s.xirr_pct)}
                  color={(s.xirr_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}
                />
                <MetricCard
                  label="Value"
                  value={formatINR(s.final_value, 0)}
                  color="text-slate-800"
                />
                <MetricCard
                  label="Invested"
                  value={formatINR(s.total_invested, 0)}
                  color="text-slate-500"
                />
              </div>
              {s.max_drawdown_pct != null && (
                <p className="text-center text-[10px] text-slate-400 mt-2">
                  Max drawdown: {formatPct(s.max_drawdown_pct)} | Events: {s.event_count || 0}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Narrative insight */}
      {bestMode && results[bestMode]?.summary && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <p className="text-sm text-teal-800">
            <strong>{MODE_LABELS[bestMode]}</strong> delivers the highest XIRR at{' '}
            <span className="font-mono tabular-nums">{formatPct(results[bestMode].summary.xirr_pct)}</span>,
            {results[bestMode].summary.event_count > 0 &&
              ` triggered by ${results[bestMode].summary.event_count} signal events.`}
            {(!results[bestMode].summary.event_count || results[bestMode].summary.event_count === 0) &&
              ' with consistent systematic investment.'}
          </p>
        </div>
      )}

      {/* Equity curve chart */}
      {chartData.length > 0 && (
        <Card title="Equity Curve">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d) => d.slice(0, 7)}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
              />
              <Tooltip
                formatter={(v) => formatINR(v, 0)}
                labelFormatter={(d) => d}
                contentStyle={{ fontSize: 11 }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {modes.map((mode) => (
                <Line
                  key={mode}
                  type="monotone"
                  dataKey={mode}
                  name={MODE_LABELS[mode] || mode}
                  stroke={MODE_COLORS[mode] || '#94a3b8'}
                  strokeWidth={mode === bestMode ? 2.5 : 1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Event log */}
      <EventLogTable events={events} />

      {/* Save button */}
      {onSave && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Save Strategy
          </button>
        </div>
      )}
    </div>
  );
}
