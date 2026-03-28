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
import { formatINR } from '../../lib/format';

const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y', 'since_inception'];
const PERIOD_LABELS = {
  '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y',
  '3y': '3Y', '5y': '5Y', since_inception: 'Max',
};

function formatAxisDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { date: nav_date, nav } = payload[0].payload;
  const d = new Date(nav_date);
  const formatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="rounded-lg bg-white px-4 py-3 shadow-xl border border-slate-200">
      <p className="text-xs text-slate-500 mb-1">{formatted}</p>
      <p className="font-mono tabular-nums text-base font-bold text-slate-900">
        {formatINR(nav, 2)}
      </p>
    </div>
  );
}

/**
 * PerformanceChart — prominent NAV chart with period selectors.
 *
 * Props:
 *   mstarId     string
 *   initialData array — initial 1Y nav data
 */
export default function PerformanceChart({ mstarId, initialData = [] }) {
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

  const yFormatter = (v) => formatINR(v, 0);

  // Compute change over period
  const firstNav = data.length > 0 ? Number(data[0].nav) : null;
  const lastNav = data.length > 0 ? Number(data[data.length - 1].nav) : null;
  const periodChange = firstNav && lastNav ? ((lastNav - firstNav) / firstNav) * 100 : null;

  return (
    <div>
      {/* Period pills + change indicator */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => loadPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                period === p
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {periodChange != null && (
          <span
            className={`text-sm font-mono tabular-nums font-semibold ${
              periodChange >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {periodChange >= 0 ? '+' : '\u2212'}{Math.abs(periodChange).toFixed(1)}%
            <span className="text-xs text-slate-400 font-normal ml-1">({PERIOD_LABELS[period]})</span>
          </span>
        )}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-[320px] text-slate-400 text-sm">
          <svg className="animate-spin w-5 h-5 mr-2 text-teal-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading chart data...
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[320px] text-slate-400 text-sm">
          No NAV data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="navGradient360" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={yFormatter}
              tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={65}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<TooltipContent />} />
            <Area
              type="monotone"
              dataKey="nav"
              stroke="#0d9488"
              strokeWidth={2}
              fill="url(#navGradient360)"
              dot={false}
              activeDot={{ r: 5, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
