import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Area,
} from 'recharts';
import InfoIcon from '../shared/InfoIcon';
import SkeletonLoader from '../shared/SkeletonLoader';
import { resampleTimeline, MODE_LABELS, findBestMode } from '../../lib/simulation';

const MODES_TO_SHOW = ['SIP', 'SIP_SIGNAL'];

function formatYAxis(val) {
  if (val >= 10000000) return `\u20B9${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `\u20B9${(val / 100000).toFixed(0)}L`;
  if (val >= 1000) return `\u20B9${(val / 1000).toFixed(0)}K`;
  return `\u20B9${val}`;
}

function formatTooltipValue(val) {
  if (val == null) return '\u2014';
  if (val >= 10000000) return `\u20B9${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `\u20B9${(val / 100000).toFixed(1)}L`;
  return `\u20B9${val.toLocaleString('en-IN')}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const date = label ? new Date(label).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  }) : '';

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="text-slate-500 font-medium mb-1">{date}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span
              className="w-2 h-0.5 rounded"
              style={{ backgroundColor: p.stroke || p.color || p.fill }}
            />
            <span className="text-slate-600">{p.name}:</span>
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {formatTooltipValue(p.value)}
            </span>
          </div>
        ))}
    </div>
  );
}

export default function EquityCurve({ results, cashflowEvents, isLoading }) {
  const bestMode = useMemo(() => findBestMode(results), [results]);

  const chartData = useMemo(() => {
    if (!results) return [];

    const resampled = {};
    let maxLen = 0;

    MODES_TO_SHOW.forEach((mode) => {
      const timeline = results[mode]?.daily_timeline;
      if (timeline?.length > 0) {
        resampled[mode] = resampleTimeline(timeline, 150);
        maxLen = Math.max(maxLen, resampled[mode].length);
      }
    });

    if (maxLen === 0) return [];

    const base = Object.values(resampled).reduce(
      (a, b) => (a.length >= b.length ? a : b),
      []
    );

    return base.map((pt, i) => {
      const row = { date: pt.date };
      MODES_TO_SHOW.forEach((mode) => {
        if (resampled[mode]?.[i]) {
          row[mode] = resampled[mode][i].portfolio_value;
        }
      });
      // Benchmark
      if (pt.benchmark_value != null) {
        row.benchmark = pt.benchmark_value;
      }
      return row;
    });
  }, [results]);

  // Signal deployment events as scatter points
  const signalPoints = useMemo(() => {
    if (!cashflowEvents?.length || !chartData.length) return [];

    return cashflowEvents
      .filter((e) => e.event_type === 'SIGNAL_TOPUP' || e.trigger !== 'SIP')
      .map((e) => {
        // Find nearest chart data point
        const eventDate = new Date(e.date).getTime();
        let closest = chartData[0];
        let minDiff = Infinity;
        for (const pt of chartData) {
          const diff = Math.abs(new Date(pt.date).getTime() - eventDate);
          if (diff < minDiff) {
            minDiff = diff;
            closest = pt;
          }
        }
        const mode = bestMode === 'SIP_SIGNAL' ? 'SIP_SIGNAL' : 'SIP';
        return {
          date: closest.date,
          signal: closest[mode] || closest.SIP_SIGNAL || closest.SIP,
        };
      })
      .filter((p) => p.signal != null);
  }, [cashflowEvents, chartData, bestMode]);

  // Merge signal points into chart data
  const mergedData = useMemo(() => {
    if (!signalPoints.length) return chartData;
    const signalDates = new Set(signalPoints.map((p) => p.date));
    return chartData.map((pt) => ({
      ...pt,
      signal: signalDates.has(pt.date)
        ? signalPoints.find((s) => s.date === pt.date)?.signal
        : undefined,
    }));
  }, [chartData, signalPoints]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="section-title mb-3">Equity Curve + Signal Events</p>
        <SkeletonLoader variant="chart" className="h-[320px]" />
      </div>
    );
  }

  if (mergedData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="section-title mb-3">Equity Curve + Signal Events</p>
        <div className="h-[320px] flex items-center justify-center text-sm text-slate-400">
          Run a simulation to see the equity curve
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="section-title">Equity Curve + Signal Events</p>
          <InfoIcon tip="The teal line shows portfolio value over time. Orange diamonds mark signal-triggered deployments. The gray dashed line shows Pure SIP for comparison." />
        </div>
        <div className="flex gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-teal-500 rounded" />
            <span className="text-slate-500">SIP + Signals</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-slate-300 rounded" />
            <span className="text-slate-500">Pure SIP</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            <span className="text-slate-500">Signal Deploy</span>
          </div>
        </div>
      </div>

      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={mergedData}
            margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
          >
            <XAxis
              dataKey="date"
              tickFormatter={(d) => {
                const dt = new Date(d);
                return dt.toLocaleDateString('en-IN', {
                  month: 'short',
                  year: '2-digit',
                });
              }}
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* SIP + Signals area fill */}
            <Area
              type="monotone"
              dataKey="SIP_SIGNAL"
              name={MODE_LABELS.SIP_SIGNAL}
              stroke="none"
              fill="rgba(13,148,136,0.06)"
              connectNulls
            />

            {/* Pure SIP dashed line */}
            <Line
              type="monotone"
              dataKey="SIP"
              name={MODE_LABELS.SIP}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />

            {/* SIP + Signals solid line */}
            <Line
              type="monotone"
              dataKey="SIP_SIGNAL"
              name={MODE_LABELS.SIP_SIGNAL}
              stroke="#0d9488"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />

            {/* Benchmark if available */}
            <Line
              type="monotone"
              dataKey="benchmark"
              name="Benchmark"
              stroke="#cbd5e1"
              strokeDasharray="2 2"
              strokeWidth={1}
              dot={false}
              connectNulls
            />

            {/* Signal deployment scatter */}
            <Scatter
              dataKey="signal"
              name="Signal Deploy"
              fill="#f59e0b"
              stroke="#d97706"
              strokeWidth={2}
              shape="diamond"
              r={5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
