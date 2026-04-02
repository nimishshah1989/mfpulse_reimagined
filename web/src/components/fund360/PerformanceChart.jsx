import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { fetchNAVHistory } from '../../lib/api';
import { formatPct, formatINR } from '../../lib/format';
import {
  PERIODS, PERIOD_LABELS, NIFTY_CAGR,
  synthBenchmarkSeries, formatAxisDate, downsample,
} from './perfChartHelpers';

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const d = new Date(row.date);
  const formatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="rounded-lg bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl border border-slate-200 min-w-[160px]">
      <p className="text-[10px] text-slate-500 mb-2 font-medium">{formatted}</p>
      {row.fundGrowth != null && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
          <span className="text-xs text-slate-500">Fund</span>
          <span className="font-mono tabular-nums text-sm font-bold text-slate-900 ml-auto">
            {formatINR(row.fundGrowth, 0)}
          </span>
        </div>
      )}
      {row.niftyGrowth != null && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
          <span className="text-xs text-slate-500">Nifty 50</span>
          <span className="font-mono tabular-nums text-sm font-semibold text-slate-600 ml-auto">
            {formatINR(row.niftyGrowth, 0)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * PerformanceChart -- Growth-of-10K chart with fund NAV + Nifty 50 TRI overlay.
 * Chart takes 3/4 width, stats sidebar 1/4 with comparison callouts.
 *
 * Props:
 *   mstarId          string
 *   initialData      array   — NAV history for default period (1y)
 *   fundReturns      object  — trailing returns (return_1y, return_3y, etc.)
 *   riskStats        object  — risk metrics (sharpe, max drawdown, etc.)
 *   categoryReturns  object  — category average returns (optional)
 */
export default function PerformanceChart({ mstarId, initialData = [], fundReturns, riskStats, categoryReturns }) {
  const [period, setPeriod] = useState('1y');
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const navCache = useRef(new Map());

  useEffect(() => {
    if (initialData.length > 0) navCache.current.set('1y', initialData);
  }, [initialData]);

  const loadPeriod = useCallback(async (p) => {
    setPeriod(p);
    if (navCache.current.has(p)) { setData(navCache.current.get(p)); return; }
    setLoading(true);
    try {
      const result = await fetchNAVHistory(mstarId, p);
      const navPoints = result?.data ?? result ?? [];
      navCache.current.set(p, navPoints);
      setData(navPoints);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [mstarId]);

  // Clean, sort, downsample
  const allClean = data
    .filter((d) => d.nav != null)
    .map((d) => ({ ...d, nav: Number(d.nav) }))
    .filter((d) => !isNaN(d.nav))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const sampledData = downsample(allClean, period);

  const firstNav = sampledData.length > 0 ? Number(sampledData[0].nav) : null;
  const lastNav = sampledData.length > 0 ? Number(sampledData[sampledData.length - 1].nav) : null;
  const periodChange = firstNav && lastNav ? ((lastNav - firstNav) / firstNav) * 100 : null;
  const isPositive = periodChange != null && periodChange >= 0;

  // Growth of 10K — fund
  const growthOf10k = periodChange != null ? Math.round(10000 * (1 + periodChange / 100)) : null;

  // Nifty 50 TRI benchmark growth curve
  const niftyCagr = NIFTY_CAGR[period] ?? 12;
  const dates = sampledData.map((d) => d.date);
  const niftySeries = synthBenchmarkSeries(dates, niftyCagr);
  const niftyFinal = niftySeries ? niftySeries[niftySeries.length - 1] : null;

  // Build chart data with fund growth + benchmark
  const cleanData = sampledData.map((d, i) => ({
    ...d,
    fundGrowth: firstNav ? Math.round(10000 * (d.nav / firstNav)) : null,
    niftyGrowth: niftySeries ? niftySeries[i] : null,
  }));

  // Risk stats for sidebar
  const sharpe1y = riskStats?.sharpe_1y ?? riskStats?.sharpe_ratio;
  const maxDD1y = riskStats?.max_drawdown_1y ?? riskStats?.max_drawdown;

  return (
    <div>
      {/* Header with period toggles */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs text-slate-500">Growth of {'\u20B9'}10,000 invested</p>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => loadPeriod(p)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-all ${
                period === p
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart + Stats sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
              <svg className="animate-spin w-5 h-5 mr-2 text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading chart data...
            </div>
          ) : cleanData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
              No NAV data available for this period
            </div>
          ) : (
            <ResponsiveContainer key={`perf-${period}`} width="100%" height={280}>
              <ComposedChart data={cleanData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="navGradient360" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? '#0d9488' : '#dc2626'} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={isPositive ? '#0d9488' : '#dc2626'} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(d, period)}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false} minTickGap={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}
                  axisLine={false} tickLine={false} width={60}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `\u20B9${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip content={<TooltipContent />} />
                <Area
                  type="monotone" dataKey="fundGrowth" name="Fund"
                  stroke={isPositive ? '#0d9488' : '#dc2626'} strokeWidth={2}
                  fill="url(#navGradient360)" dot={false}
                  activeDot={{ r: 5, fill: isPositive ? '#0d9488' : '#dc2626', stroke: '#fff', strokeWidth: 2 }}
                />
                {niftySeries && (
                  <Line
                    type="monotone" dataKey="niftyGrowth" name="Nifty 50 TRI"
                    stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }}
                  />
                )}
                <Legend
                  verticalAlign="top" align="left" iconType="line"
                  wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats sidebar */}
        <div className="space-y-3">
          {growthOf10k != null && (
            <div className="bg-gradient-to-br from-teal-50/50 to-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 mb-1">Fund — {'\u20B9'}10,000 invested</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                {formatINR(growthOf10k, 0)}
              </p>
              {periodChange != null && (
                <p className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPct(periodChange)} in {PERIOD_LABELS[period]}
                </p>
              )}
            </div>
          )}

          {niftyFinal != null && (
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1">Nifty 50 TRI — {'\u20B9'}10,000</p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-600">
                {formatINR(niftyFinal, 0)}
              </p>
              {growthOf10k != null && (
                <p className={`text-[10px] font-semibold ${growthOf10k > niftyFinal ? 'text-emerald-600' : 'text-red-600'}`}>
                  Fund {growthOf10k > niftyFinal ? 'beats' : 'trails'} Nifty by {formatINR(Math.abs(growthOf10k - niftyFinal), 0)}
                </p>
              )}
            </div>
          )}

          {maxDD1y != null && (
            <div className="bg-gradient-to-br from-teal-50/50 to-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 mb-1">Max Drawdown</p>
              <p className="text-lg font-bold font-mono tabular-nums text-red-600">
                {Number(maxDD1y).toFixed(1)}%
              </p>
            </div>
          )}

          {sharpe1y != null && (
            <div className="bg-gradient-to-br from-teal-50/50 to-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 mb-1">Sharpe Ratio</p>
              <p className="text-lg font-bold font-mono tabular-nums text-teal-700">
                {Number(sharpe1y).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
