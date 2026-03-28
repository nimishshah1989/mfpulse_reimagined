import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatINR, formatPct } from '../../lib/format';
import { MODE_COLORS, MODE_LABELS, findBestMode, resampleTimeline, getSignalColor } from '../../lib/simulation';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

function MetricCard({ label, value, color, subtext }) {
  return (
    <div className="text-center p-3">
      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold font-mono tabular-nums mt-1 ${color || ''}`}
         style={!color ? { color: typeof value === 'string' && value.startsWith('+') ? '#059669' : '#dc2626' } : undefined}>
        {value}
      </p>
      {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

function ComparisonCard({ mode, summary, isBest, modeColor }) {
  const s = summary || {};
  const profit = (s.final_value || 0) - (s.total_invested || 0);
  const profitPct = s.total_invested > 0 ? (profit / s.total_invested) * 100 : 0;

  return (
    <div className={`bg-white rounded-xl border-2 p-5 transition-all ${
      isBest ? 'border-teal-500 shadow-md' : 'border-slate-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: modeColor }}
          />
          <span className="text-sm font-semibold text-slate-700">
            {MODE_LABELS[mode] || mode}
          </span>
        </div>
        {isBest && (
          <span className="px-2.5 py-1 text-[10px] font-bold bg-teal-100 text-teal-700 rounded-full uppercase tracking-wide">
            Recommended
          </span>
        )}
      </div>

      {/* Key metrics */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Final Value</span>
          <span className="text-lg font-bold font-mono tabular-nums text-slate-800">
            {formatINR(s.final_value, 0)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">XIRR</span>
          <span className={`text-lg font-bold font-mono tabular-nums ${
            (s.xirr_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {formatPct(s.xirr_pct)}
          </span>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Total Invested</span>
          <span className="text-sm font-mono tabular-nums text-slate-600">
            {formatINR(s.total_invested, 0)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">Profit</span>
          <span className={`text-sm font-bold font-mono tabular-nums ${
            profit >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {formatINR(profit, 0)} ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%)
          </span>
        </div>
        {s.max_drawdown_pct != null && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Max Drawdown</span>
            <span className="text-sm font-mono tabular-nums text-red-600">
              {formatPct(s.max_drawdown_pct)}
            </span>
          </div>
        )}
        {s.event_count != null && s.event_count > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">Signal Events</span>
            <span className="text-sm font-mono tabular-nums text-slate-600">
              {s.event_count}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function EventTimeline({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <Card title="Signal Event Log">
      <div className="max-h-64 overflow-y-auto">
        <div className="relative pl-6">
          {/* Timeline line */}
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />

          {events.map((evt, i) => {
            const signalColor = getSignalColor(evt.condition || evt.trigger);
            return (
              <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                {/* Timeline dot */}
                <div
                  className="absolute left-[-16px] top-1 w-3 h-3 rounded-full border-2 border-white flex-shrink-0"
                  style={{ backgroundColor: signalColor }}
                />
                {/* Content */}
                <div className="flex-1 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono tabular-nums text-slate-600">{evt.date}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{evt.condition || evt.trigger || 'Manual'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono tabular-nums font-medium text-slate-700">
                      {formatINR(evt.amount, 0)}
                    </p>
                    {evt.gain_pct != null && (
                      <p className={`text-[10px] font-mono tabular-nums ${
                        (evt.gain_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatPct(evt.gain_pct)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export default function SimulationResults({ results, loading, error, onSave }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <SkeletonLoader key={i} className="h-64 rounded-xl" />
          ))}
        </div>
        <SkeletonLoader variant="chart" className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm text-red-700 font-medium">Simulation Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
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
      modes.forEach((m) => {
        const modeTimeline = results[m]?.timeline || [];
        const match = modeTimeline.find((p) => p.date === point.date);
        row[m] = match ? match.value : null;
      });
      return row;
    });
  }, [results, modes]);

  const events = results[bestMode]?.events || results.SIP_SIGNAL?.events || [];

  return (
    <div className="space-y-6">
      {/* 3-card comparison layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((m) => (
          <ComparisonCard
            key={m}
            mode={m}
            summary={results[m]?.summary}
            isBest={m === bestMode}
            modeColor={MODE_COLORS[m] || '#94a3b8'}
          />
        ))}
      </div>

      {/* Narrative insight */}
      {bestMode && results[bestMode]?.summary && (
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-teal-800 mb-1">Recommendation</p>
              <p className="text-sm text-teal-700 leading-relaxed">
                <strong>{MODE_LABELS[bestMode]}</strong> delivers the highest XIRR at{' '}
                <span className="font-mono tabular-nums font-semibold">{formatPct(results[bestMode].summary.xirr_pct)}</span>
                {results[bestMode].summary.event_count > 0
                  ? `, triggered by ${results[bestMode].summary.event_count} signal events. Signal-based deployment captured market dips effectively.`
                  : ' with consistent systematic investment. Discipline beats timing in this scenario.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Equity curve chart */}
      {chartData.length > 0 && (
        <Card title="Equity Curve Comparison">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(d) => d.slice(0, 7)}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip
                formatter={(v) => [formatINR(v, 0), undefined]}
                labelFormatter={(d) => d}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {modes.map((m) => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  name={MODE_LABELS[m] || m}
                  stroke={MODE_COLORS[m] || '#94a3b8'}
                  strokeWidth={m === bestMode ? 2.5 : 1.5}
                  dot={false}
                  strokeDasharray={m === bestMode ? undefined : '4 2'}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Signal event timeline */}
      <EventTimeline events={events} />

      {/* Save button */}
      {onSave && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">Save this strategy to your repository for future reference.</p>
          <button
            type="button"
            onClick={onSave}
            className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
          >
            Save Strategy
          </button>
        </div>
      )}
    </div>
  );
}
