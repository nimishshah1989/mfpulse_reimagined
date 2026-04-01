import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { formatPct } from '../../lib/format';

/**
 * ExpenseVsPerformance — clickable insight card showing expense ratio vs return
 * efficiency. Navigates to universe page sorted by expense on click.
 */
export default function MetricCards({ universe }) {
  const router = useRouter();

  const stats = useMemo(() => {
    if (!universe || universe.length === 0) return null;
    const withExpense = universe.filter(
      (f) => f.net_expense_ratio != null && f.return_1y != null
    );
    if (withExpense.length < 2) return null;

    // Split into cheap (bottom 25%) and expensive (top 25%)
    const sorted = [...withExpense].sort(
      (a, b) => Number(a.net_expense_ratio) - Number(b.net_expense_ratio)
    );
    const q1 = Math.floor(sorted.length * 0.25);
    const q3 = Math.floor(sorted.length * 0.75);
    const cheap = sorted.slice(0, q1);
    const expensive = sorted.slice(q3);

    const avgRet = (arr) =>
      arr.reduce((s, f) => s + Number(f.return_1y), 0) / arr.length;
    const avgExp = (arr) =>
      arr.reduce((s, f) => s + Number(f.net_expense_ratio), 0) / arr.length;

    return {
      cheapAvgReturn: avgRet(cheap),
      cheapAvgExpense: avgExp(cheap),
      expensiveAvgReturn: avgRet(expensive),
      expensiveAvgExpense: avgExp(expensive),
      leanCount: universe.filter((f) => f.efficiency_class === 'LEAN').length,
      bloatedCount: universe.filter((f) => f.efficiency_class === 'BLOATED').length,
    };
  }, [universe]);

  if (!stats) return null;

  const advantage = stats.cheapAvgReturn - stats.expensiveAvgReturn;

  return (
    <button
      type="button"
      role="link"
      aria-label="View expense vs performance rankings in Universe screener"
      onClick={() => router.push('/universe?sort=net_expense_ratio')}
      className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-teal-300 transition-all cursor-pointer w-full block"
    >
      <p className="section-title mb-3">Expense vs Performance</p>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="bg-emerald-50 rounded-lg px-3 py-2">
          <p className="text-[9px] uppercase text-emerald-600 font-semibold tracking-wider">
            Low Cost (Bottom 25%)
          </p>
          <p className="text-lg font-bold font-mono tabular-nums text-emerald-700">
            {formatPct(stats.cheapAvgReturn)}
          </p>
          <p className="text-[10px] text-emerald-600">
            Avg expense: {stats.cheapAvgExpense.toFixed(2)}%
          </p>
        </div>
        <div className="bg-red-50 rounded-lg px-3 py-2">
          <p className="text-[9px] uppercase text-red-600 font-semibold tracking-wider">
            High Cost (Top 25%)
          </p>
          <p className="text-lg font-bold font-mono tabular-nums text-red-700">
            {formatPct(stats.expensiveAvgReturn)}
          </p>
          <p className="text-[10px] text-red-600">
            Avg expense: {stats.expensiveAvgExpense.toFixed(2)}%
          </p>
        </div>
      </div>
      <p className="text-[11px] text-slate-600 leading-snug">
        Low-cost funds outperform by{' '}
        <span className={`font-semibold ${advantage >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {advantage >= 0 ? '+' : ''}{advantage.toFixed(1)}%
        </span>{' '}
        on average. {stats.leanCount} lean funds, {stats.bloatedCount} bloated.
      </p>
      <p className="text-[10px] text-teal-600 font-medium mt-2">
        View efficiency rankings {'\u2192'}
      </p>
    </button>
  );
}
