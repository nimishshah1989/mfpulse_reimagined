import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchClaudeUsage } from '../../lib/api';

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
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    fetchClaudeUsage()
      .then((res) => setUsage(res?.data || res))
      .catch(() => {});
  }, []);

  const totalCalls = usage?.total_calls ?? 0;
  const totalInput = usage?.total_input_tokens ?? 0;
  const totalOutput = usage?.total_output_tokens ?? 0;
  const totalTokens = totalInput + totalOutput;
  const totalCost = usage?.estimated_cost_usd ?? 0;
  const budget = 5.0;
  const model = usage?.model ?? 'claude-haiku-4-5';
  const features = usage?.feature_breakdown ?? [];
  const cacheEntries = usage?.cache_entries ?? 0;

  // Compute feature percentages
  const totalFeatureTokens = features.reduce((s, f) => s + (f.tokens || 0), 0) || 1;
  const featureRows = features.map((f) => ({
    ...f,
    pct: Math.round(((f.tokens || 0) / totalFeatureTokens) * 100),
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Claude API Usage</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Model: {model} | Cache entries: {cacheEntries}
            </p>
          </div>
          {totalCalls === 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              No calls yet
            </span>
          )}
        </div>
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
            {totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(0)}k` : totalTokens}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Est. Cost</div>
          <div className="text-lg font-bold text-slate-800 tabular-nums font-mono">${totalCost.toFixed(4)}</div>
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

      {/* Feature breakdown */}
      {featureRows.length > 0 ? (
        <div className="p-4">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">By Feature</div>
          <div className="space-y-2">
            {featureRows.map((f) => (
              <div key={f.feature} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-700 font-medium">{f.feature}</span>
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
      ) : (
        <div className="p-4 text-center">
          <p className="text-[11px] text-slate-400">
            API usage data will appear here as Claude features are used across the platform.
          </p>
        </div>
      )}
    </div>
  );
}
