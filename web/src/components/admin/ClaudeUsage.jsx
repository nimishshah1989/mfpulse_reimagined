import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for Claude API usage
const MOCK_DAILY = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    calls: Math.floor(Math.random() * 40) + 5,
    tokens: Math.floor(Math.random() * 50000) + 5000,
    cost: parseFloat((Math.random() * 0.20 + 0.02).toFixed(2)),
  };
});

const FEATURES = [
  { name: 'Fund Narratives', calls: 124, tokens: 285000, pct: 45 },
  { name: 'Strategy NL Parser', calls: 67, tokens: 142000, pct: 22 },
  { name: 'Market Briefing', calls: 45, tokens: 98000, pct: 16 },
  { name: 'Search NL Parsing', calls: 38, tokens: 62000, pct: 10 },
  { name: 'Other', calls: 22, tokens: 45000, pct: 7 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-[11px]">
      <div className="font-semibold mb-1">{label}</div>
      <div className="text-teal-300">Calls: {payload[0]?.payload?.calls}</div>
      <div className="text-slate-300">Cost: ${payload[0]?.payload?.cost}</div>
    </div>
  );
}

export default function ClaudeUsage() {
  const totalCalls = FEATURES.reduce((s, f) => s + f.calls, 0);
  const totalTokens = FEATURES.reduce((s, f) => s + f.tokens, 0);
  const totalCost = MOCK_DAILY.reduce((s, d) => s + d.cost, 0);
  const budget = 5.0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Claude API Usage</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Current month token consumption and cost</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-slate-50">
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Total Calls</div>
          <div className="text-lg font-bold text-slate-800 tabular-nums font-mono">{totalCalls}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Total Tokens</div>
          <div className="text-lg font-bold text-slate-800 tabular-nums font-mono">
            {(totalTokens / 1000).toFixed(0)}k
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Est. Cost</div>
          <div className="text-lg font-bold text-slate-800 tabular-nums font-mono">${totalCost.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Budget</div>
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalCost / budget > 0.8 ? 'bg-amber-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.min((totalCost / budget) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                ${totalCost.toFixed(2)} / ${budget.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Daily chart */}
        <div style={{ height: 180 }}>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Daily Usage</div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MOCK_DAILY}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={5} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="cost" stroke="#0d9488" fill="url(#costGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Feature breakdown */}
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">By Feature</div>
          <div className="space-y-2">
            {FEATURES.map((f) => (
              <div key={f.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-700 font-medium">{f.name}</span>
                    <span className="text-slate-400 font-mono tabular-nums">{f.calls} calls</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 w-8 text-right tabular-nums">{f.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
