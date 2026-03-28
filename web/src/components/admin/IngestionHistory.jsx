import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Generate mock 30-day data
function generateMockData() {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const success = Math.floor(Math.random() * 2000) + 500;
    const errors = Math.random() > 0.85 ? Math.floor(Math.random() * 50) : 0;
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      success,
      errors,
      total: success + errors,
    });
  }
  return data;
}

const MOCK_DATA = generateMockData();

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-[11px]">
      <div className="font-semibold mb-1">{label}</div>
      <div className="text-emerald-300">Success: {payload[0]?.value?.toLocaleString('en-IN')}</div>
      {payload[1]?.value > 0 && (
        <div className="text-red-300">Errors: {payload[1].value}</div>
      )}
    </div>
  );
}

export default function IngestionHistory() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Ingestion History</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Records processed daily over the last 30 days</p>
      </div>
      <div className="p-4" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MOCK_DATA} barGap={1}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="success" stackId="a" radius={[2, 2, 0, 0]}>
              {MOCK_DATA.map((entry, i) => (
                <Cell key={i} fill="#10b981" opacity={0.7} />
              ))}
            </Bar>
            <Bar dataKey="errors" stackId="a" radius={[2, 2, 0, 0]}>
              {MOCK_DATA.map((entry, i) => (
                <Cell key={i} fill={entry.errors > 0 ? '#ef4444' : 'transparent'} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
