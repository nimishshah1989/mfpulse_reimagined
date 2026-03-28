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
    filter: (f) =>
      (f.alpha_class === 'ALPHA_MACHINE' || f.alpha_class === 'POSITIVE') &&
      (f.consistency_class === 'ROCK_SOLID' || f.consistency_class === 'CONSISTENT'),
    filterParams: 'alpha_class=ALPHA_MACHINE,POSITIVE&consistency_class=ROCK_SOLID,CONSISTENT',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    id: 'low-risk-leaders',
    name: 'Low-Risk Leaders',
    description: 'Top returns with minimal volatility',
    color: 'teal',
    filter: (f) =>
      f.risk_class === 'LOW_RISK' &&
      (f.return_class === 'LEADER' || f.return_class === 'STRONG'),
    filterParams: 'risk_class=LOW_RISK&return_class=LEADER,STRONG',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    id: 'high-efficiency',
    name: 'High Efficiency Picks',
    description: 'Maximum return per rupee of expense',
    color: 'blue',
    filter: (f) =>
      f.efficiency_class === 'LEAN' &&
      f.return_class !== 'WEAK',
    filterParams: 'efficiency_class=LEAN&return_class=LEADER,STRONG,AVERAGE',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: 'turnaround',
    name: 'Turnaround Candidates',
    description: 'Weak returns but positive alpha -- potential comeback',
    color: 'amber',
    filter: (f) =>
      f.return_class === 'WEAK' &&
      f.alpha_class === 'POSITIVE',
    filterParams: 'return_class=WEAK&alpha_class=POSITIVE',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
  {
    id: 'fortress',
    name: 'Fortress Funds',
    description: 'Maximum resilience with low risk',
    color: 'indigo',
    filter: (f) =>
      f.resilience_class === 'FORTRESS' &&
      f.risk_class === 'LOW_RISK',
    filterParams: 'resilience_class=FORTRESS&risk_class=LOW_RISK',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
  },
  {
    id: 'avoid',
    name: 'Avoid Zone',
    description: 'Weak returns, high risk, erratic behavior',
    color: 'red',
    filter: (f) =>
      f.return_class === 'WEAK' &&
      f.risk_class === 'HIGH_RISK' &&
      f.consistency_class === 'ERRATIC',
    filterParams: 'return_class=WEAK&risk_class=HIGH_RISK&consistency_class=ERRATIC',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
];

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200 hover:border-emerald-300',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    countBg: 'bg-emerald-100',
    countText: 'text-emerald-700',
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200 hover:border-teal-300',
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600',
    countBg: 'bg-teal-100',
    countText: 'text-teal-700',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-300',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    countBg: 'bg-blue-100',
    countText: 'text-blue-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200 hover:border-amber-300',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    countBg: 'bg-amber-100',
    countText: 'text-amber-700',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200 hover:border-indigo-300',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    countBg: 'bg-indigo-100',
    countText: 'text-indigo-700',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200 hover:border-red-300',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    countBg: 'bg-red-100',
    countText: 'text-red-700',
  },
};

function BucketCard({ bucket, count, onClick }) {
  const colors = COLOR_MAP[bucket.color] || COLOR_MAP.teal;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 w-[200px] rounded-xl border ${colors.border} ${colors.bg} p-4 text-left transition-all hover:shadow-md cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-1.5 rounded-lg ${colors.iconBg} ${colors.iconText}`}>
          {bucket.icon}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono tabular-nums ${colors.countBg} ${colors.countText}`}>
          {count}
        </span>
      </div>
      <h4 className="text-xs font-bold text-slate-800 mb-0.5 leading-tight">
        {bucket.name}
      </h4>
      <p className="text-[10px] text-slate-500 leading-snug">
        {bucket.description}
      </p>
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

  const bucketCounts = useMemo(() => {
    if (!universe || universe.length === 0) return {};
    const counts = {};
    BUCKET_DEFINITIONS.forEach((bucket) => {
      counts[bucket.id] = universe.filter(bucket.filter).length;
    });
    return counts;
  }, [universe]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonLoader key={i} className="h-28 w-[200px] rounded-xl flex-shrink-0" />
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
            count={bucketCounts[bucket.id] || 0}
            onClick={() => handleBucketClick(bucket)}
          />
        ))}
      </div>
    </div>
  );
}
