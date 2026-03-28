import { useMemo, useState } from 'react';
import { lensLabel, lensColor, LENS_LABELS } from '../../lib/lens';
import { formatCount } from '../../lib/format';

const TIER_ORDER = [
  { label: 'Exceptional', score: 95 },
  { label: 'Leader', score: 80 },
  { label: 'Strong', score: 65 },
  { label: 'Adequate', score: 50 },
  { label: 'Weak', score: 35 },
  { label: 'Poor', score: 15 },
];

/**
 * Compact horizontal stacked bar showing tier distribution.
 * Each segment is proportional. Hover shows count + percentage. Click highlights.
 */
export default function TierSummary({ funds = [], colorLens, onTierClick, selectedTier }) {
  const [hoveredTier, setHoveredTier] = useState(null);
  const lensKey = colorLens || 'return_score';
  const lensName = LENS_LABELS[lensKey] || 'Return';

  const tierCounts = useMemo(() => {
    const counts = {};
    funds.forEach((f) => {
      const score = Number(f[lensKey]) || 0;
      const label = lensLabel(score);
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, [funds, lensKey]);

  const total = funds.length;
  if (total === 0) return null;

  return (
    <div className="px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Label */}
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
          {lensName}
        </span>

        {/* Stacked bar */}
        <div className="flex-1 h-5 rounded-full overflow-hidden flex bg-slate-100 relative">
          {TIER_ORDER.map(({ label, score }) => {
            const count = tierCounts[label] || 0;
            if (count === 0) return null;
            const pct = (count / total) * 100;
            const color = lensColor(score);
            const isSelected = selectedTier === label;
            const isHovered = hoveredTier === label;

            return (
              <button
                key={label}
                type="button"
                onClick={() => onTierClick?.(isSelected ? null : label)}
                onMouseEnter={() => setHoveredTier(label)}
                onMouseLeave={() => setHoveredTier(null)}
                className="h-full relative transition-all"
                style={{
                  width: `${Math.max(pct, 1.5)}%`,
                  backgroundColor: color,
                  opacity: selectedTier && !isSelected ? 0.3 : isHovered ? 0.9 : 0.75,
                  outline: isSelected ? '2px solid white' : 'none',
                  outlineOffset: '-2px',
                }}
                title={`${label}: ${formatCount(count)} (${pct.toFixed(1)}%)`}
              >
                {pct > 8 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90">
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Hover tooltip */}
          {hoveredTier && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded-md whitespace-nowrap pointer-events-none z-10">
              {hoveredTier}: {formatCount(tierCounts[hoveredTier] || 0)} (
              {(((tierCounts[hoveredTier] || 0) / total) * 100).toFixed(1)}%)
            </div>
          )}
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {TIER_ORDER.filter(({ label }) => (tierCounts[label] || 0) > 0)
            .slice(0, 4)
            .map(({ label, score }) => (
              <div key={label} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: lensColor(score) }}
                />
                <span className="text-[9px] text-slate-500 whitespace-nowrap">{label}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
