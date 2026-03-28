import { useMemo } from 'react';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../../lib/lens';
import { formatCount } from '../../lib/format';

const TIER_COLORS = {
  // Return lens
  LEADER: { bg: '#059669', label: 'Leader' },
  STRONG: { bg: '#0d9488', label: 'Strong' },
  AVERAGE: { bg: '#f59e0b', label: 'Average' },
  WEAK: { bg: '#dc2626', label: 'Weak' },
  // Risk lens
  LOW_RISK: { bg: '#059669', label: 'Low Risk' },
  MODERATE: { bg: '#0d9488', label: 'Moderate' },
  ELEVATED: { bg: '#f59e0b', label: 'Elevated' },
  HIGH_RISK: { bg: '#dc2626', label: 'High Risk' },
  // Consistency lens
  ROCK_SOLID: { bg: '#059669', label: 'Rock Solid' },
  CONSISTENT: { bg: '#0d9488', label: 'Consistent' },
  MIXED: { bg: '#f59e0b', label: 'Mixed' },
  ERRATIC: { bg: '#dc2626', label: 'Erratic' },
  // Alpha lens
  ALPHA_MACHINE: { bg: '#059669', label: 'Alpha Machine' },
  POSITIVE: { bg: '#0d9488', label: 'Positive' },
  NEUTRAL: { bg: '#f59e0b', label: 'Neutral' },
  NEGATIVE: { bg: '#dc2626', label: 'Negative' },
  // Efficiency lens
  LEAN: { bg: '#059669', label: 'Lean' },
  FAIR: { bg: '#0d9488', label: 'Fair' },
  EXPENSIVE: { bg: '#f59e0b', label: 'Expensive' },
  BLOATED: { bg: '#dc2626', label: 'Bloated' },
};

// Lenses to display (skip resilience since all null)
const DISPLAY_LENSES = LENS_OPTIONS.filter((l) => l.key !== 'resilience_score');

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
      ...TIER_COLORS[tier],
    }))
    .sort((a, b) => {
      // Sort by tier quality: best first
      const order = Object.keys(TIER_COLORS);
      return order.indexOf(a.tier) - order.indexOf(b.tier);
    });
}

function StackedBar({ segments }) {
  if (!segments || segments.length === 0) {
    return (
      <div className="h-4 bg-slate-100 rounded-full" />
    );
  }

  return (
    <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
      {segments.map((seg) => (
        <div
          key={seg.tier}
          className="h-full transition-all relative group"
          style={{ width: `${seg.pct}%`, backgroundColor: seg.bg }}
          title={`${seg.label || seg.tier}: ${seg.count} funds (${seg.pct.toFixed(1)}%)`}
        />
      ))}
    </div>
  );
}

function LensRow({ lens, universe }) {
  const classKey = LENS_CLASS_KEYS[lens.key];
  const segments = useMemo(
    () => computeDistribution(universe, classKey),
    [universe, classKey]
  );
  const totalScored = segments.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">{lens.label}</span>
        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
          {formatCount(totalScored)} scored
        </span>
      </div>
      <StackedBar segments={segments} />
      <div className="flex gap-3 flex-wrap">
        {segments.map((seg) => (
          <div key={seg.tier} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: seg.bg }}
            />
            <span className="text-[10px] text-slate-500">
              {seg.label || seg.tier}: {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UniverseHealth({ universe, onNavigate }) {
  if (!universe) {
    return <SkeletonLoader className="h-64 rounded-xl" />;
  }

  const totalFunds = universe.length;
  const scoredFunds = universe.filter((f) => f.return_score != null).length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-slate-500">
            <span className="font-bold text-slate-700 font-mono tabular-nums">{formatCount(scoredFunds)}</span>
            {' '}of {formatCount(totalFunds)} funds scored
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {DISPLAY_LENSES.map((lens) => (
          <LensRow key={lens.key} lens={lens} universe={universe} />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <button
          type="button"
          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          onClick={() => onNavigate('/universe')}
        >
          Explore full Universe &rarr;
        </button>
      </div>
    </Card>
  );
}
