import { useMemo } from 'react';
import { lensLabel, lensColor, lensBgColor, LENS_OPTIONS, LENS_LABELS } from '../../lib/lens';

/**
 * Shows tier breakdown counts for the chosen color lens.
 * Each card is clickable — calls onTierClick(tierLabel).
 */
export default function TierSummary({ funds = [], colorLens, onTierClick }) {
  const lensKey = colorLens || 'return_score';
  const lensName = LENS_LABELS[lensKey] || 'Return';

  const tierCounts = useMemo(() => {
    const counts = {};
    funds.forEach((f) => {
      const score = Number(f[lensKey]) || 0;
      const label = lensLabel(score);
      if (!counts[label]) {
        counts[label] = { count: 0, score };
      }
      counts[label].count += 1;
    });
    return counts;
  }, [funds, lensKey]);

  // Tier labels in score-descending order using spec thresholds
  const TIER_ORDER = ['Exceptional', 'Leader', 'Strong', 'Adequate', 'Weak', 'Poor'];
  const TIER_SCORES = { Exceptional: 95, Leader: 80, Strong: 65, Adequate: 50, Weak: 35, Poor: 15 };

  const total = funds.length;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 flex-wrap">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
        {lensName}:
      </span>
      {TIER_ORDER.map((tierLabel) => {
        const entry = tierCounts[tierLabel];
        const count = entry ? entry.count : 0;
        const scoreForColor = TIER_SCORES[tierLabel] || 50;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;

        return (
          <button
            key={tierLabel}
            type="button"
            onClick={() => onTierClick && onTierClick(tierLabel)}
            disabled={count === 0}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium
              transition-all cursor-pointer
              ${count === 0 ? 'opacity-40 cursor-default' : 'hover:shadow-sm hover:scale-105'}
            `}
            style={{
              backgroundColor: lensBgColor(scoreForColor),
              color: lensColor(scoreForColor),
              borderColor: lensColor(scoreForColor) + '33',
            }}
          >
            <span>{tierLabel}</span>
            <span className="font-mono font-semibold">{count}</span>
            {total > 0 && count > 0 && (
              <span className="opacity-70">({pct}%)</span>
            )}
          </button>
        );
      })}
      <span className="ml-auto text-[11px] text-slate-400 font-mono">
        {total.toLocaleString('en-IN')} total
      </span>
    </div>
  );
}
