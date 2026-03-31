import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import SectionTitle from '../shared/SectionTitle';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="font-mono tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

export default function EquityCurve({ data }) {
  if (!data?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Equity Curve</SectionTitle>
        <p className="text-sm text-slate-400">No equity curve data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Portfolio NAV indexed to 100 at inception, compared with benchmark">
        Equity Curve
      </SectionTitle>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="plainline"
          />
          <Area
            type="monotone"
            dataKey="portfolio"
            name="Portfolio"
            stroke="#0d9488"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
            activeDot={{ r: 3, fill: '#0d9488' }}
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            name="Benchmark"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 3, fill: '#94a3b8' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
