import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { cachedFetch } from '../../lib/cache';
import { fetchUniverseData } from '../../lib/api';
import SkeletonLoader from '../shared/SkeletonLoader';

const BUCKET_DEFINITIONS = [
  {
    id: 'consistent-alpha',
    name: 'Consistent Alpha Generators',
    description: 'Strong alpha with rock-solid consistency',
    color: 'emerald',
    emoji: '\u2B50',
    filter: (f) =>
      (f.alpha_class === 'ALPHA_MACHINE' || f.alpha_class === 'POSITIVE') &&
      (f.consistency_class === 'ROCK_SOLID' || f.consistency_class === 'CONSISTENT'),
    filterParams: 'alpha_class=ALPHA_MACHINE,POSITIVE&consistency_class=ROCK_SOLID,CONSISTENT',
  },
  {
    id: 'low-risk-leaders',
    name: 'Low-Risk Leaders',
    description: 'Top returns with minimal volatility',
    color: 'teal',
    emoji: '\uD83D\uDEE1\uFE0F',
    filter: (f) =>
      f.risk_class === 'LOW_RISK' &&
      (f.return_class === 'LEADER' || f.return_class === 'STRONG'),
    filterParams: 'risk_class=LOW_RISK&return_class=LEADER,STRONG',
  },
  {
    id: 'high-efficiency',
    name: 'High Efficiency Picks',
    description: 'Maximum return per rupee of expense',
    color: 'blue',
    emoji: '\u26A1',
    filter: (f) =>
      f.efficiency_class === 'LEAN' &&
      f.return_class !== 'WEAK',
    filterParams: 'efficiency_class=LEAN&return_class=LEADER,STRONG,AVERAGE',
  },
  {
    id: 'turnaround',
    name: 'Turnaround Candidates',
    description: 'Weak returns but positive alpha -- potential comeback',
    color: 'amber',
    emoji: '\uD83D\uDD04',
    filter: (f) =>
      f.return_class === 'WEAK' &&
      f.alpha_class === 'POSITIVE',
    filterParams: 'return_class=WEAK&alpha_class=POSITIVE',
  },
  {
    id: 'fortress',
    name: 'Fortress Funds',
    description: 'Low risk with rock-solid consistency',
    color: 'indigo',
    emoji: '\uD83C\uDFF0',
    filter: (f) =>
      f.risk_class === 'LOW_RISK' &&
      (f.consistency_class === 'ROCK_SOLID' || f.consistency_class === 'CONSISTENT'),
    filterParams: 'risk_class=LOW_RISK&consistency_class=ROCK_SOLID,CONSISTENT',
  },
  {
    id: 'avoid',
    name: 'Avoid Zone',
    description: 'Weak returns with high risk or erratic behavior',
    color: 'red',
    emoji: '\u26A0\uFE0F',
    filter: (f) =>
      f.return_class === 'WEAK' &&
      (f.risk_class === 'HIGH_RISK' || f.consistency_class === 'ERRATIC'),
    filterParams: 'return_class=WEAK&risk_class=HIGH_RISK',
  },
];

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200 hover:border-emerald-300',
    accent: 'bg-emerald-100 text-emerald-700',
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200 hover:border-teal-300',
    accent: 'bg-teal-100 text-teal-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-300',
    accent: 'bg-blue-100 text-blue-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200 hover:border-amber-300',
    accent: 'bg-amber-100 text-amber-700',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200 hover:border-indigo-300',
    accent: 'bg-indigo-100 text-indigo-700',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200 hover:border-red-300',
    accent: 'bg-red-100 text-red-700',
  },
};

function findTopFund(universe, filterFn) {
  const matches = universe.filter(filterFn);
  if (matches.length === 0) return null;
  // Sort by return_score descending, return top
  const sorted = matches.sort((a, b) => (b.return_score || 0) - (a.return_score || 0));
  return sorted[0];
}

function BucketCard({ bucket, count, topFundName, onClick }) {
  const colors = COLOR_MAP[bucket.color] || COLOR_MAP.teal;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 w-[200px] rounded-xl border ${colors.border} ${colors.bg} p-4 text-left transition-all hover:shadow-md cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{bucket.emoji}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono tabular-nums ${colors.accent}`}>
          {count}
        </span>
      </div>
      <h4 className="text-xs font-bold text-slate-800 mb-0.5 leading-tight">
        {bucket.name}
      </h4>
      <p className="text-[10px] text-slate-500 leading-snug mb-2">
        {bucket.description}
      </p>
      {topFundName && (
        <p className="text-[10px] text-slate-400 truncate">
          Top: <span className="font-medium text-slate-600">{topFundName}</span>
        </p>
      )}
    </button>
  );
}

export default function SmartBuckets() {
  const router = useRouter();
  const [universe, setUniverse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedFetch('universe', fetchUniverseData, 600)
      .then((data) => setUniverse(data))
      .catch(() => setUniverse([]))
      .finally(() => setLoading(false));
  }, []);

  const bucketData = useMemo(() => {
    if (!universe || universe.length === 0) return {};
    const result = {};
    BUCKET_DEFINITIONS.forEach((bucket) => {
      const matches = universe.filter(bucket.filter);
      const topFund = findTopFund(universe, bucket.filter);
      result[bucket.id] = {
        count: matches.length,
        topFundName: topFund?.fund_name || null,
      };
    });
    return result;
  }, [universe]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonLoader key={i} className="h-32 w-[200px] rounded-xl flex-shrink-0" />
        ))}
      </div>
    );
  }

  const handleBucketClick = (bucket) => {
    router.push(`/universe?${bucket.filterParams}`);
  };

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-2">
      <div className="flex gap-3">
        {BUCKET_DEFINITIONS.map((bucket) => (
          <BucketCard
            key={bucket.id}
            bucket={bucket}
            count={bucketData[bucket.id]?.count || 0}
            topFundName={bucketData[bucket.id]?.topFundName}
            onClick={() => handleBucketClick(bucket)}
          />
        ))}
      </div>
    </div>
  );
}
