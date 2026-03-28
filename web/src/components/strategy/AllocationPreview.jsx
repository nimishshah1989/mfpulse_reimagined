import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import InfoIcon from '../shared/InfoIcon';
import { formatPct } from '../../lib/format';

const COLORS = ['#3b82f6', '#14b8a6', '#a855f7', '#f59e0b', '#6366f1', '#ef4444', '#10b981', '#f97316'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs shadow-lg">
      <p className="font-semibold">{d.name}</p>
      <p className="tabular-nums">{d.value.toFixed(1)}%</p>
    </div>
  );
}

export default function AllocationPreview({
  funds,
  configs,
  onLaunch,
  onBacktest,
  onSaveDraft,
}) {
  const chartData = useMemo(() => {
    return funds
      .filter((f) => configs[f.mstar_id]?.allocation_pct > 0)
      .map((f) => ({
        name: f.fund_name?.replace(/ Fund$/, '').replace(/ Direct.*$/, '') || f.mstar_id,
        value: configs[f.mstar_id]?.allocation_pct || 0,
        mstar_id: f.mstar_id,
      }));
  }, [funds, configs]);

  const characteristics = useMemo(() => {
    const total = chartData.reduce((s, d) => s + d.value, 0);
    if (total === 0) return { avgReturn: 0, avgRisk: 0, avgExpense: 0, overlap: 18 };

    let wtdReturn = 0;
    let wtdRisk = 0;
    let wtdExpense = 0;
    chartData.forEach((d) => {
      const fund = funds.find((f) => f.mstar_id === d.mstar_id);
      if (!fund) return;
      const w = d.value / total;
      wtdReturn += (fund.return_1y || 0) * w;
      wtdRisk += (fund.risk_score || 0) * w;
      wtdExpense += (fund.expense_ratio || 0) * w;
    });

    return {
      avgReturn: wtdReturn,
      avgRisk: Math.round(wtdRisk),
      avgExpense: wtdExpense,
      overlap: 18,
    };
  }, [chartData, funds]);

  const riskLabel = characteristics.avgRisk < 35 ? 'LOW' : characteristics.avgRisk < 55 ? 'MOD' : 'HIGH';
  const riskColor = characteristics.avgRisk < 35 ? 'text-blue-500' : characteristics.avgRisk < 55 ? 'text-amber-500' : 'text-red-500';
  const overlapLabel = characteristics.overlap < 25 ? 'LOW' : characteristics.overlap < 40 ? 'MOD' : 'HIGH';
  const overlapColor = characteristics.overlap < 25 ? 'text-emerald-500' : characteristics.overlap < 40 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="mt-5 pt-5 border-t border-slate-100">
      <div className="grid grid-cols-12 gap-5">
        {/* Allocation Donut */}
        <div className="col-span-5">
          <p className="text-xs font-semibold text-slate-500 mb-3">ALLOCATION PREVIEW</p>
          <div className="flex items-center gap-5">
            {chartData.length > 0 ? (
              <div className="w-40 h-40 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      stroke="white"
                      strokeWidth={2}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-40 h-40 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="text-xs text-slate-400">No allocations</span>
              </div>
            )}
            <div className="space-y-1.5">
              {chartData.map((d, i) => (
                <div key={d.mstar_id} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-xs text-slate-600">
                    {d.name} \u2014 {d.value.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Portfolio Characteristics */}
        <div className="col-span-4">
          <p className="text-xs font-semibold text-slate-500 mb-3">PORTFOLIO CHARACTERISTICS</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Wtd. Avg Return (1Y)</p>
              <p className={`text-sm font-bold tabular-nums ${characteristics.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPct(characteristics.avgReturn)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Wtd. Avg Risk Score</p>
              <p className="text-sm font-bold tabular-nums">
                {characteristics.avgRisk} <span className={`text-xs font-normal ${riskColor}`}>{riskLabel}</span>
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Expense Ratio (Wtd)</p>
              <p className="text-sm font-bold tabular-nums">{characteristics.avgExpense.toFixed(2)}%</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-xs text-slate-400">Fund Overlap</p>
              <p className="text-sm font-bold tabular-nums">
                {characteristics.overlap}% <span className={`text-xs font-normal ${overlapColor}`}>{overlapLabel}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="col-span-3 flex flex-col justify-end gap-2">
          <button
            onClick={onLaunch}
            className="w-full px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4-4-4-4M11 3v10" />
            </svg>
            Launch Strategy
          </button>
          <button
            onClick={onBacktest}
            className="w-full px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-sm rounded-xl transition-all flex items-center justify-center gap-2"
          >
            Backtest First
          </button>
          <button
            onClick={onSaveDraft}
            className="w-full px-5 py-2 text-teal-600 font-medium text-xs rounded-xl transition-all hover:bg-teal-50 flex items-center justify-center gap-1"
          >
            Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}
