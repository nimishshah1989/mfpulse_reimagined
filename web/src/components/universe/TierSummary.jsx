import { useMemo } from 'react';
import { lensLabel, lensColor, lensBgColor, LENS_LABELS } from '../../lib/lens';

/**
 * Shows tier breakdown as clickable KPI cards.
 * Each card: tier name, fund count (large), percentage, colored proportion bar.
 * Clicking highlights those funds in the scatter chart.
 */
export default function TierSummary({ funds = [], colorLens, onTierClick, selectedTier }) {
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

  const TIER_ORDER = ['Exceptional', 'Leader', 'Strong', 'Adequate', 'Weak', 'Poor'];
  const TIER_SCORES = { Exceptional: 95, Leader: 80, Strong: 65, Adequate: 50, Weak: 35, Poor: 15 };

  const total = funds.length;

  return (
    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {lensName} Distribution
        </span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {TIER_ORDER.map((tierLabel) => {
          const entry = tierCounts[tierLabel];
          const count = entry ? entry.count : 0;
          const scoreForColor = TIER_SCORES[tierLabel] || 50;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const tierColor = lensColor(scoreForColor);
          const tierBg = lensBgColor(scoreForColor);
          const isSelected = selectedTier === tierLabel;
          const isActive = count > 0;

          return (
            <button
              key={tierLabel}
              type="button"
              onClick={() => {
                if (!isActive) return;
                if (onTierClick) {
                  onTierClick(isSelected ? null : tierLabel);
                }
              }}
              disabled={!isActive}
              className={`
                relative overflow-hidden rounded-lg border text-left transition-all
                ${isActive ? 'cursor-pointer hover:shadow-md' : 'opacity-40 cursor-default'}
                ${isSelected ? 'ring-2 ring-offset-1 shadow-md' : ''}
              `}
              style={{
                borderColor: isSelected ? tierColor : tierColor + '33',
                ringColor: tierColor,
              }}
            >
              {/* Colored top border */}
              <div
                className="h-1 w-full"
                style={{ backgroundColor: tierColor }}
              />

              <div className="px-3 py-2" style={{ backgroundColor: isSelected ? tierBg : 'white' }}>
                {/* Tier name */}
                <p
                  className="text-[11px] font-semibold truncate"
                  style={{ color: tierColor }}
                >
                  {tierLabel}
                </p>

                {/* Fund count - large */}
                <p className="font-mono text-xl font-bold text-slate-800 leading-tight mt-0.5">
                  {count.toLocaleString('en-IN')}
                </p>

                {/* Percentage */}
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {pct}% of total
                </p>

                {/* Proportion bar */}
                <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      backgroundColor: tierColor,
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
