import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import SkeletonLoader from '../shared/SkeletonLoader';
import SectionTitle from '../shared/SectionTitle';
import { formatPct } from '../../lib/format';

const PERIOD_OPTIONS = [
  { key: 'return_1m', label: '1M' },
  { key: 'return_3m', label: '3M' },
  { key: 'return_1y', label: '1Y' },
  { key: 'return_3y', label: '3Y' },
];

function returnColor(ret) {
  if (ret == null) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', name: 'text-slate-700' };
  if (ret >= 20) return { bg: 'bg-emerald-200/70', border: 'border-emerald-200', text: 'text-emerald-800', name: 'text-emerald-900' };
  if (ret >= 15) return { bg: 'bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-800', name: 'text-emerald-900' };
  if (ret >= 10) return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', name: 'text-emerald-800' };
  if (ret >= 5) return { bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-700', name: 'text-teal-800' };
  if (ret >= 0) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', name: 'text-slate-700' };
  return { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600', name: 'text-red-700' };
}

function CategoryTile({ category, count, avgReturn, large, onClick }) {
  const colors = returnColor(avgReturn);

  if (large) {
    return (
      <div
        className={`col-span-2 row-span-2 rounded-lg p-3 ${colors.bg} border ${colors.border} cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all`}
        style={{ minHeight: '100px' }}
        onClick={onClick}
      >
        <p className={`text-xs font-semibold ${colors.name}`}>{category}</p>
        <p className={`text-2xl font-bold ${colors.text} tabular-nums mt-1`}>
          {avgReturn != null ? formatPct(avgReturn) : '--'}
        </p>
        <p className={`text-[10px] ${colors.text} mt-0.5`}>{count} funds</p>
      </div>
    );
  }

  if (count >= 30) {
    return (
      <div
        className={`col-span-2 rounded-lg p-3 ${colors.bg} border ${colors.border} cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all`}
        onClick={onClick}
      >
        <p className={`text-xs font-semibold ${colors.name}`}>{category}</p>
        <p className={`text-lg font-bold ${colors.text} tabular-nums`}>
          {avgReturn != null ? formatPct(avgReturn) : '--'}
        </p>
        <p className={`text-[10px] ${colors.text}`}>{count} funds</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-2.5 ${colors.bg} border ${colors.border} cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all`}
      onClick={onClick}
    >
      <p className={`text-[10px] font-semibold ${colors.name}`}>{category}</p>
      <p className={`text-sm font-bold ${colors.text} tabular-nums`}>
        {avgReturn != null ? formatPct(avgReturn) : '--'}
      </p>
      <p className="text-[9px] text-slate-400">{count}</p>
    </div>
  );
}

export default function CategoryHeatmap({ universe, loading }) {
  const router = useRouter();
  const [period, setPeriod] = useState('return_1y');

  const categories = useMemo(() => {
    if (!universe || universe.length === 0) return [];

    // Exclude low-signal categories
    const EXCLUDED_CATEGORIES = ['Overnight Fund', 'Liquid Fund', 'Money Market Fund', 'Index Fund', 'Fund of Funds'];

    // Group by category_name
    const grouped = {};
    universe.forEach((f) => {
      const cat = f.category_name;
      if (!cat) return;
      if (EXCLUDED_CATEGORIES.some((ex) => cat.toLowerCase().includes(ex.toLowerCase()))) return;
      if (!grouped[cat]) grouped[cat] = { funds: [], sum: 0, count: 0 };
      grouped[cat].funds.push(f);
      const ret = f[period];
      if (ret != null) {
        grouped[cat].sum += Number(ret);
        grouped[cat].count += 1;
      }
    });

    return Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        fundCount: data.funds.length,
        avgReturn: data.count > 0 ? data.sum / data.count : null,
      }))
      .filter((cat) => cat.fundCount > 0 && cat.avgReturn != null)
      .sort((a, b) => (b.fundCount || 0) - (a.fundCount || 0));
  }, [universe, period]);

  if (loading || !universe) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-64 rounded-lg" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-xs text-slate-400 text-center py-6">No category data available.</p>
      </div>
    );
  }

  const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label || '1Y';

  // Take top 15 categories
  const topCats = categories.slice(0, 15);
  const largest = topCats[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in" style={{ animationDelay: '0.4s' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">
          Category Performance Heatmap &mdash; {periodLabel} Returns
        </p>
        <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                period === key
                  ? 'bg-white shadow-sm text-teal-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {topCats.map((cat, idx) => (
          <CategoryTile
            key={cat.name}
            category={cat.name}
            count={cat.fundCount}
            avgReturn={cat.avgReturn}
            large={idx === 0}
            onClick={() => router.push(`/universe?category=${encodeURIComponent(cat.name)}`)}
          />
        ))}
      </div>
    </div>
  );
}
