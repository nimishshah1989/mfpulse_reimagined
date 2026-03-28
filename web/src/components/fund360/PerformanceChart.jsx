import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { fetchNAVHistory } from '../../lib/api';
import { formatINR } from '../../lib/format';
import Pill from '../shared/Pill';

const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y', 'max'];
const PERIOD_LABELS = { '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y', '3y': '3Y', '5y': '5Y', max: 'Max' };

function formatAxisDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { nav_date, nav } = payload[0].payload;
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-lg border border-slate-200 text-sm">
      <p className="text-slate-500">{nav_date}</p>
      <p className="font-mono tabular-nums font-semibold text-slate-900">
        {formatINR(nav, 2)}
      </p>
    </div>
  );
}

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
      navCache.current.set(p, result);
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [mstarId]);

  const yFormatter = (v) => formatINR(v, 0);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {PERIODS.map((p) => (
          <Pill
            key={p}
            active={period === p}
            onClick={() => loadPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </Pill>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
          Loading...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="nav_date"
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
              width={60}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<TooltipContent />} />
            <Area
              type="monotone"
              dataKey="nav"
              stroke="#0d9488"
              strokeWidth={2}
              fill="url(#navGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
