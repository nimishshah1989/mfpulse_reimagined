import { useState, useEffect, useRef } from 'react';
import { fetchUniverseData } from '../../lib/api';
import { cachedFetch } from '../../lib/cache';
import { formatCount } from '../../lib/format';

const BUCKETS = [
  {
    id: 'alpha',
    name: 'Consistent Alpha Generators',
    description: 'Funds with proven manager skill and reliable performance',
    color: 'emerald',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    filter: (f) =>
      ['ALPHA_MACHINE', 'POSITIVE'].includes(f.alpha_class) &&
      ['ROCK_SOLID', 'CONSISTENT'].includes(f.consistency_class),
  },
  {
    id: 'lowrisk',
    name: 'Low-Risk Leaders',
    description: 'Strong returns with minimal volatility',
    color: 'teal',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    filter: (f) =>
      f.risk_class === 'LOW_RISK' &&
      ['LEADER', 'STRONG'].includes(f.return_class),
  },
  {
    id: 'efficient',
    name: 'High Efficiency Picks',
    description: 'Maximum returns per unit of cost',
    color: 'blue',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    filter: (f) => f.efficiency_class === 'LEAN' && f.return_class !== 'WEAK',
  },
  {
    id: 'turnaround',
    name: 'Turnaround Candidates',
    description: 'Weak returns but positive alpha signals recovery',
    color: 'amber',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    filter: (f) => f.return_class === 'WEAK' && f.alpha_class === 'POSITIVE',
  },
  {
    id: 'fortress',
    name: 'Fortress Funds',
    description: 'Rock-solid consistency with low risk profile',
    color: 'indigo',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    filter: (f) =>
      f.risk_class === 'LOW_RISK' &&
      ['ROCK_SOLID', 'CONSISTENT'].includes(f.consistency_class),
  },
  {
    id: 'avoid',
    name: 'Avoid Zone',
    description: 'Weak returns combined with high risk',
    color: 'red',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    filter: (f) => f.return_class === 'WEAK' && f.risk_class === 'HIGH_RISK',
  },
];

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    count: 'text-emerald-700',
    hover: 'hover:border-emerald-400 hover:shadow-emerald-100',
    activeBg: 'bg-emerald-100',
    activeBorder: 'border-emerald-500',
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    icon: 'text-teal-600',
    count: 'text-teal-700',
    hover: 'hover:border-teal-400 hover:shadow-teal-100',
    activeBg: 'bg-teal-100',
    activeBorder: 'border-teal-500',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    count: 'text-blue-700',
    hover: 'hover:border-blue-400 hover:shadow-blue-100',
    activeBg: 'bg-blue-100',
    activeBorder: 'border-blue-500',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    count: 'text-amber-700',
    hover: 'hover:border-amber-400 hover:shadow-amber-100',
    activeBg: 'bg-amber-100',
    activeBorder: 'border-amber-500',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: 'text-indigo-600',
    count: 'text-indigo-700',
    hover: 'hover:border-indigo-400 hover:shadow-indigo-100',
    activeBg: 'bg-indigo-100',
    activeBorder: 'border-indigo-500',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    count: 'text-red-700',
    hover: 'hover:border-red-400 hover:shadow-red-100',
    activeBg: 'bg-red-100',
    activeBorder: 'border-red-500',
  },
};

/**
 * SmartBuckets -- horizontally scrollable bucket cards.
 *
 * Props:
 *   activeBucket   string|null -- currently active bucket id
 *   onSelect       func(bucketId, fundIds) -- called when a bucket is clicked
 *   universe       array -- optional pre-loaded universe data
 */
const PURCHASE_MODE_LABEL = { 1: 'Regular', 2: 'Direct' };

export default function SmartBuckets({ activeBucket, onSelect, universe: externalUniverse, purchaseMode = 1 }) {
  const [universe, setUniverse] = useState(externalUniverse || []);
  const [loading, setLoading] = useState(!externalUniverse);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (externalUniverse) {
      setUniverse(externalUniverse);
      setLoading(false);
      return;
    }
    let cancelled = false;
    cachedFetch('universe', fetchUniverseData, 600)
      .then((data) => { if (!cancelled) setUniverse(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [externalUniverse]);

  const modeLabel = PURCHASE_MODE_LABEL[purchaseMode];
  const filteredUniverse = modeLabel
    ? universe.filter((f) => f.purchase_mode === modeLabel)
    : universe;

  const bucketCounts = BUCKETS.map((bucket) => {
    const matching = filteredUniverse.filter(bucket.filter);
    return { ...bucket, count: matching.length, fundIds: matching.map((f) => f.mstar_id) };
  });

  const handleClick = (bucket) => {
    if (activeBucket === bucket.id) {
      onSelect(null, []);
    } else {
      onSelect(bucket.id, bucket.fundIds);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-52 h-28 bg-slate-100 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {bucketCounts.map((bucket) => {
          const colors = COLOR_MAP[bucket.color];
          const isActive = activeBucket === bucket.id;
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => handleClick(bucket)}
              className={`flex-shrink-0 w-52 rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-md ${
                isActive
                  ? `${colors.activeBg} ${colors.activeBorder} shadow-md`
                  : `${colors.bg} ${colors.border} ${colors.hover}`
              }`}
            >
              <div className={`${colors.icon} mb-2`}>{bucket.icon}</div>
              <p className="text-xs font-semibold text-slate-800 leading-tight">{bucket.name}</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-2">{bucket.description}</p>
              <p className={`text-lg font-mono tabular-nums font-bold mt-2 ${colors.count}`}>
                {formatCount(bucket.count)}
                <span className="text-[10px] font-normal text-slate-400 ml-1">funds</span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { BUCKETS };
