import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { fetchNAVHistory } from '../../lib/api';
import { formatPct } from '../../lib/format';

const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y', 'since_inception'];
const PERIOD_LABELS = {
  '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y',
  '3y': '3Y', '5y': '5Y', since_inception: 'MAX',
};

function formatAxisDate(dateStr, period) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Short periods: day + month
  if (period === '1m' || period === '3m') {
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }
  // Medium periods: month + short year
  if (period === '6m' || period === '1y') {
    return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  }
  // Long periods (3y, 5y, max): quarter + year for readability
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter} '${String(d.getFullYear()).slice(2)}`;
}

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { date: nav_date, nav } = payload[0].payload;
  const d = new Date(nav_date);
  const formatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="rounded-lg bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl border border-slate-200">
      <p className="text-[10px] text-slate-500 mb-1 font-medium">{formatted}</p>
      <p className="font-mono tabular-nums text-lg font-bold text-slate-900">
        {nav != null ? Number(nav).toFixed(2) : '--'}
      </p>
      <p className="text-[9px] text-slate-400">NAV</p>
    </div>
  );
}

/**
 * PerformanceChart -- NAV line chart with period toggles + stats sidebar.
 * Matches mockup: chart takes 3/4, stats sidebar 1/4.
 *
 * Props:
 *   mstarId      string
 *   initialData  array
 *   fundReturns  object
 *   riskStats    object
 */
export default function PerformanceChart({ mstarId, initialData = [], fundReturns, riskStats }) {
  const [period, setPeriod] = useState('1y');
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const navCache = useRef(new Map());

  useEffect(() => {
    if (initialData.length > 0) {
      navCache.current.set('1y', initialData);
    }
  }, [initialData]);

  const loadPeriod = useCallback(async (p) => {
    setPeriod(p);
    if (navCache.current.has(p)) {
      setData(navCache.current.get(p));
      return;
    }
    setLoading(true);
    try {
      const result = await fetchNAVHistory(mstarId, p);
      const navPoints = result?.data ?? result ?? [];
      navCache.current.set(p, navPoints);
      setData(navPoints);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [mstarId]);

  const cleanData = data
    .filter((d) => d.nav != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const firstNav = cleanData.length > 0 ? Number(cleanData[0].nav) : null;
  const lastNav = cleanData.length > 0 ? Number(cleanData[cleanData.length - 1].nav) : null;
  const periodChange = firstNav && lastNav ? ((lastNav - firstNav) / firstNav) * 100 : null;
  const isPositive = periodChange != null && periodChange >= 0;

  // Growth of 10K
  const growthOf10k = periodChange != null ? Math.round(10000 * (1 + periodChange / 100)) : null;

  // Risk stats for sidebar
  const sharpe1y = riskStats?.sharpe_1y ?? riskStats?.sharpe_ratio;
  const maxDD1y = riskStats?.max_drawdown_1y ?? riskStats?.max_drawdown;

  return (
    <div>
      {/* Header with period toggles */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-xs text-slate-500">Growth of {'\u20B9'}10,000 invested</p>
        </div>
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
        {/* Chart (3 cols) */}
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
                    <stop offset="0%" stopColor={isPositive ? '#0d9488' : '#dc2626'} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={isPositive ? '#0d9488' : '#dc2626'} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatAxisDate(d, period)}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<TooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="nav"
                  stroke={isPositive ? '#0d9488' : '#dc2626'}
                  strokeWidth={2}
                  fill="url(#navGradient360)"
                  dot={false}
                  activeDot={{ r: 5, fill: isPositive ? '#0d9488' : '#dc2626', stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats sidebar */}
        <div className="space-y-3">
          {growthOf10k != null && (
            <div className="bg-gradient-to-br from-teal-50/50 to-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 mb-1">Growth of {'\u20B9'}10,000</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                {'\u20B9'}{growthOf10k.toLocaleString('en-IN')}
              </p>
              {periodChange != null && (
                <p className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPct(periodChange)} in {PERIOD_LABELS[period]}
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
