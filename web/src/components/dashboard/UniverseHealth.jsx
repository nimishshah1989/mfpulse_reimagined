import { useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';
import SectionTitle from '../shared/SectionTitle';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../../lib/lens';
import { formatCount } from '../../lib/format';

// Tier order per lens -- best tier first
const TIER_META = {
  // Return
  LEADER: { bg: 'bg-emerald-500', color: '#059669', label: 'Leader', order: 0 },
  STRONG: { bg: 'bg-teal-400', color: '#2dd4bf', label: 'Strong', order: 1 },
  AVERAGE: { bg: 'bg-amber-400', color: '#fbbf24', label: 'Average', order: 2 },
  WEAK: { bg: 'bg-red-400', color: '#f87171', label: 'Weak', order: 3 },
  // Risk
  LOW_RISK: { bg: 'bg-emerald-500', color: '#059669', label: 'Low Risk', order: 0 },
  MODERATE: { bg: 'bg-teal-400', color: '#2dd4bf', label: 'Moderate', order: 1 },
  ELEVATED: { bg: 'bg-amber-400', color: '#fbbf24', label: 'Elevated', order: 2 },
  HIGH_RISK: { bg: 'bg-red-400', color: '#f87171', label: 'High Risk', order: 3 },
  // Consistency
  ROCK_SOLID: { bg: 'bg-emerald-500', color: '#059669', label: 'Rock Solid', order: 0 },
  CONSISTENT: { bg: 'bg-teal-400', color: '#2dd4bf', label: 'Consistent', order: 1 },
  MIXED: { bg: 'bg-amber-400', color: '#fbbf24', label: 'Mixed', order: 2 },
  ERRATIC: { bg: 'bg-red-400', color: '#f87171', label: 'Erratic', order: 3 },
  // Alpha
  ALPHA_MACHINE: { bg: 'bg-emerald-500', color: '#059669', label: 'Alpha Machine', order: 0 },
  POSITIVE: { bg: 'bg-teal-400', color: '#2dd4bf', label: 'Positive', order: 1 },
  NEUTRAL: { bg: 'bg-amber-400', color: '#fbbf24', label: 'Neutral', order: 2 },
  NEGATIVE: { bg: 'bg-red-400', color: '#f87171', label: 'Negative', order: 3 },
  // Efficiency
  LEAN: { bg: 'bg-emerald-500', color: '#059669', label: 'Lean', order: 0 },
  FAIR: { bg: 'bg-teal-400', color: '#2dd4bf', label: 'Fair', order: 1 },
  EXPENSIVE: { bg: 'bg-amber-400', color: '#fbbf24', label: 'Expensive', order: 2 },
  BLOATED: { bg: 'bg-red-400', color: '#f87171', label: 'Bloated', order: 3 },
  // Resilience
  FORTRESS: { bg: 'bg-emerald-500', color: '#059669', label: 'Fortress', order: 0 },
  STURDY: { bg: 'bg-teal-400', color: '#2dd4bf', label: 'Sturdy', order: 1 },
  FRAGILE: { bg: 'bg-amber-400', color: '#fbbf24', label: 'Fragile', order: 2 },
  VULNERABLE: { bg: 'bg-red-400', color: '#f87171', label: 'Vulnerable', order: 3 },
};

function computeDistribution(universe, classKey) {
  if (!universe || universe.length === 0) return [];
  const counts = {};
  let total = 0;
  universe.forEach((f) => {
    const cls = f[classKey];
    if (cls) {
      counts[cls] = (counts[cls] || 0) + 1;
      total += 1;
    }
  });
  return Object.entries(counts)
    .map(([tier, count]) => ({
      tier,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
      ...(TIER_META[tier] || { bg: 'bg-slate-300', color: '#94a3b8', label: tier, order: 99 }),
    }))
    .sort((a, b) => a.order - b.order);
}

function StackedBarRow({ lensLabel, segments }) {
  // Show top 2 tiers in the right-side summary
  const topTwo = segments.filter((s) => s.order <= 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-slate-600 w-20">{lensLabel}</span>
        <div className="flex gap-3 text-[10px] text-slate-400">
          {topTwo.map((s) => (
            <span key={s.tier} className="tabular-nums">
              {formatCount(s.count)} {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex h-5 rounded-md overflow-hidden">
        {segments.map((seg) => (
          <div
            key={seg.tier}
            className={`${seg.bg} health-bar`}
            style={{ width: `${seg.pct}%` }}
            title={`${seg.label}: ${seg.count} funds (${seg.pct.toFixed(1)}%)`}
          />
        ))}
      </div>
    </div>
  );
}

export default function UniverseHealth({ universe, onNavigate }) {
  const distributions = useMemo(() => {
    if (!universe) return {};
    const result = {};
    LENS_OPTIONS.forEach((lens) => {
      const classKey = LENS_CLASS_KEYS[lens.key];
      if (classKey) {
        result[lens.key] = computeDistribution(universe, classKey);
      }
    });
    return result;
  }, [universe]);

  if (!universe) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-72 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Universe Health &mdash; Lens Distribution</p>
        <button
          type="button"
          onClick={() => onNavigate('/universe')}
          className="text-[10px] text-teal-600 font-medium hover:text-teal-700"
        >
          Explore Universe &rarr;
        </button>
      </div>

      <div className="space-y-3">
        {LENS_OPTIONS.map((lens) => {
          const segments = distributions[lens.key] || [];
          return (
            <StackedBarRow
              key={lens.key}
              lensLabel={lens.label}
              segments={segments}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-slate-500">Top Tier</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-teal-400" />
          <span className="text-[10px] text-slate-500">Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-slate-500">Average</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-red-400" />
          <span className="text-[10px] text-slate-500">Weak</span>
        </div>
      </div>
    </div>
  );
}
