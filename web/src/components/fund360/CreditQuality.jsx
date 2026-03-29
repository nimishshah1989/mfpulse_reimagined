import { useState, useEffect } from 'react';

const QUALITY_GRADES = [
  { key: 'aaa_pct', label: 'AAA', color: '#059669' },
  { key: 'aa_pct', label: 'AA', color: '#10b981' },
  { key: 'a_pct', label: 'A', color: '#34d399' },
  { key: 'bbb_pct', label: 'BBB', color: '#d97706' },
  { key: 'bb_pct', label: 'BB', color: '#f59e0b' },
  { key: 'b_pct', label: 'B', color: '#ef4444' },
  { key: 'below_b_pct', label: 'Below B', color: '#dc2626' },
  { key: 'not_rated_pct', label: 'Not Rated', color: '#94a3b8' },
];

const DEBT_CATEGORIES = [
  'debt', 'bond', 'duration', 'credit', 'liquid', 'gilt', 'overnight',
  'money market', 'fixed maturity', 'floater',
];

export default function CreditQuality({ creditQuality, categoryName }) {
  // Only render for debt fund categories
  const isDebt = categoryName && DEBT_CATEGORIES.some(
    (kw) => categoryName.toLowerCase().includes(kw)
  );

  if (!isDebt || !creditQuality) return null;

  const grades = QUALITY_GRADES.filter((g) => {
    const val = creditQuality[g.key];
    return val != null && Number(val) > 0;
  });

  if (grades.length === 0) return null;

  return (
    <div>
      <div className="space-y-2">
        {grades.map((g) => {
          const val = Number(creditQuality[g.key]) || 0;
          return (
            <div key={g.key} className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-slate-600 w-16 text-right">{g.label}</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(val, 100)}%`, backgroundColor: g.color }}
                />
              </div>
              <span className="text-[11px] font-bold font-mono tabular-nums text-slate-700 w-12 text-right">
                {val.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
