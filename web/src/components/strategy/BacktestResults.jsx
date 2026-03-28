import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '../shared/Card';
import StatCard from '../shared/StatCard';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatPct, formatINR } from '../../lib/format';

function dateLabel(d) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function cellColor(pct) {
  if (pct > 0) return `rgba(5, 150, 105, ${Math.min(Math.abs(pct) / 10, 1)})`;
  if (pct < 0) return `rgba(220, 38, 38, ${Math.min(Math.abs(pct) / 10, 1)})`;
  return '#f1f5f9';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BacktestResults({ data, loading }) {
  if (loading) return <SkeletonLoader rows={6} />;
  if (!data) return null;

  const { xirr, cagr, max_drawdown, sharpe, equity_curve, benchmark_curve, monthly_returns, overlap } = data;
  const xirrPositive = xirr >= 0;

  const chartData = useMemo(() => {
    if (!equity_curve) return [];
    const benchMap = {};
    (benchmark_curve || []).forEach((p) => { benchMap[p.date] = p.value; });
    return equity_curve.map((p) => ({
      date: p.date,
      portfolio: p.value,
      benchmark: benchMap[p.date] ?? null,
    }));
  }, [equity_curve, benchmark_curve]);

  const heatmapData = useMemo(() => {
    if (!monthly_returns || monthly_returns.length === 0) return null;
    const years = [...new Set(monthly_returns.map((r) => r.year))].sort();
    const lookup = {};
    monthly_returns.forEach((r) => { lookup[`${r.year}-${r.month}`] = r.return_pct; });
    return { years, lookup };
  }, [monthly_returns]);

  return (
    <div className="space-y-4">
      {/* XIRR hero */}
      <StatCard
        label="XIRR"
        value={formatPct(xirr)}
        valueClassName={`text-2xl font-mono tabular-nums font-bold ${xirrPositive ? 'text-emerald-600' : 'text-red-600'}`}
      />

      {/* Equity curve */}
      {chartData.length > 0 && (
        <Card className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Equity Curve</h4>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => formatINR(v)} tick={{ fontSize: 10 }} width={70} />
              <Tooltip
                formatter={(v, name) => [formatINR(v), name === 'portfolio' ? 'Portfolio' : 'Benchmark']}
                labelFormatter={dateLabel}
              />
              <Legend />
              <Line type="monotone" dataKey="portfolio" stroke="#0d9488" strokeWidth={2} dot={false} name="Portfolio" />
              <Line type="monotone" dataKey="benchmark" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Benchmark" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="CAGR" value={formatPct(cagr)} valueClassName={`font-mono tabular-nums ${cagr >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
        <StatCard label="Max Drawdown" value={formatPct(max_drawdown)} valueClassName="font-mono tabular-nums text-red-600" />
        <StatCard label="Sharpe Ratio" value={sharpe != null ? sharpe.toFixed(2) : '-'} valueClassName="font-mono tabular-nums text-slate-900" />
      </div>

      {/* Monthly heatmap */}
      {heatmapData && (
        <Card className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Monthly Returns</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono tabular-nums">
              <thead>
                <tr>
                  <th className="text-left text-slate-500 pr-2 py-1">Year</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-center text-slate-500 px-1 py-1">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.years.map((year) => (
                  <tr key={year}>
                    <td className="text-slate-600 pr-2 py-0.5 font-medium">{year}</td>
                    {MONTHS.map((_, mi) => {
                      const val = heatmapData.lookup[`${year}-${mi + 1}`];
                      return (
                        <td key={mi} className="text-center px-1 py-0.5">
                          {val != null ? (
                            <span
                              className="inline-block w-full rounded px-1 py-0.5"
                              style={{ backgroundColor: cellColor(val), color: Math.abs(val) > 4 ? '#fff' : '#334155' }}
                            >
                              {val > 0 ? '+' : ''}{val.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Overlap warning */}
      {overlap && overlap.common_holdings > 0 && (
        <Card className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800 font-medium">
            {overlap.common_holdings} common holding{overlap.common_holdings !== 1 ? 's' : ''} detected across funds in this strategy.
            Consider reviewing for concentration risk.
          </p>
        </Card>
      )}
    </div>
  );
}
