import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { cachedFetch } from '../../lib/cache';
import { fetchUniverseData } from '../../lib/api';
import { formatPct, formatAUMRaw, formatCount } from '../../lib/format';
import SkeletonLoader from '../shared/SkeletonLoader';
import SectionTitle from '../shared/SectionTitle';

const BUCKET_DEFINITIONS = [
  {
    id: 'consistent-alpha',
    name: 'Consistent Alpha',
    description: 'Alpha + Consistency top tier',
    icon: '\u2605', // star
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    countColor: 'text-violet-600',
    highlightBg: 'bg-violet-50/50',
    filter: (f) =>
      (f.alpha_class === 'ALPHA_MACHINE' || f.alpha_class === 'POSITIVE') &&
      (f.consistency_class === 'ROCK_SOLID' || f.consistency_class === 'CONSISTENT'),
    filterParams: 'alpha_class=ALPHA_MACHINE,POSITIVE&consistency_class=ROCK_SOLID,CONSISTENT',
  },
  {
    id: 'low-risk-leaders',
    name: 'Low-Risk Leaders',
    description: 'Low Risk + Strong Return',
    icon: '\u25CB', // circle
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    countColor: 'text-emerald-600',
    highlightBg: 'bg-emerald-50/50',
    filter: (f) =>
      f.risk_class === 'LOW_RISK' &&
      (f.return_class === 'LEADER' || f.return_class === 'STRONG'),
    filterParams: 'risk_class=LOW_RISK&return_class=LEADER,STRONG',
  },
  {
    id: 'high-efficiency',
    name: 'High Efficiency',
    description: 'Best return per rupee of cost',
    icon: '\u26A1', // lightning
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    countColor: 'text-sky-600',
    highlightBg: 'bg-sky-50/50',
    filter: (f) =>
      f.efficiency_class === 'LEAN' &&
      f.return_class !== 'WEAK',
    filterParams: 'efficiency_class=LEAN&return_class=LEADER,STRONG,AVERAGE',
  },
  {
    id: 'fortress',
    name: 'Fortress Funds',
    description: 'Resilience + Consistency top',
    icon: '\u25C9', // circled dot
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    countColor: 'text-teal-600',
    highlightBg: 'bg-teal-50/50',
    filter: (f) =>
      (f.resilience_class === 'FORTRESS' || f.risk_class === 'LOW_RISK') &&
      (f.consistency_class === 'ROCK_SOLID' || f.consistency_class === 'CONSISTENT'),
    filterParams: 'risk_class=LOW_RISK&consistency_class=ROCK_SOLID,CONSISTENT',
  },
  {
    id: 'turnaround',
    name: 'Turnaround Watch',
    description: 'Improving from weak',
    icon: '\u21BB', // refresh
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    countColor: 'text-amber-600',
    highlightBg: 'bg-amber-50/50',
    filter: (f) =>
      f.return_class === 'WEAK' &&
      f.alpha_class === 'POSITIVE',
    filterParams: 'return_class=WEAK&alpha_class=POSITIVE',
  },
  {
    id: 'rising-stars',
    name: 'Rising Stars',
    description: 'Strong returns + high alpha',
    icon: '\u2191', // up arrow
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    countColor: 'text-orange-600',
    highlightBg: 'bg-orange-50/50',
    filter: (f) =>
      f.return_class === 'LEADER' &&
      (f.alpha_class === 'ALPHA_MACHINE' || f.alpha_class === 'POSITIVE'),
    filterParams: 'return_class=LEADER&alpha_class=ALPHA_MACHINE,POSITIVE',
  },
  {
    id: 'avoid',
    name: 'Avoid Zone',
    description: 'Multiple weak lenses',
    icon: '\u26A0', // warning
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    countColor: 'text-red-500',
    highlightBg: 'bg-red-50/50',
    borderClass: 'border-red-100',
    filter: (f) =>
      f.return_class === 'WEAK' &&
      (f.risk_class === 'HIGH_RISK' || f.consistency_class === 'ERRATIC'),
    filterParams: 'return_class=WEAK&risk_class=HIGH_RISK',
  },
];

function findTopFund(universe, filterFn) {
  const matches = universe.filter(filterFn);
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => (b.return_score || 0) - (a.return_score || 0));
  return sorted[0];
}

function BucketCard({ bucket, count, topFund, onClick, onFundClick }) {
  const borderClass = bucket.borderClass || 'border-slate-200';

  return (
    <div
      onClick={onClick}
      className={`bucket-card glass-card w-[195px] p-3.5 cursor-pointer flex-shrink-0 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
    >
      {/* Icon + name header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${bucket.iconBg} flex items-center justify-center`}>
          <span className={`${bucket.iconColor} text-sm`}>{bucket.icon}</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-800">{bucket.name}</p>
          <p className="text-[10px] text-slate-400">{bucket.description}</p>
        </div>
      </div>

      {/* Count */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-xl font-extrabold ${bucket.countColor} tabular-nums`}>{formatCount(count)}</span>
        <span className="text-[10px] text-slate-400">funds</span>
      </div>

      {/* Top fund highlight */}
      <div className={`${bucket.highlightBg} rounded-lg px-2.5 py-1.5`}>
        {topFund ? (
          <>
            <p className="text-[10px] text-teal-600 truncate cursor-pointer hover:underline"
              onClick={(e) => { e.stopPropagation(); onFundClick?.(topFund.mstar_id); }}>
              Top: {topFund.fund_name}
            </p>
            <div className="flex items-center justify-between gap-1">
              {topFund.return_1y != null && (
                <p className={`text-[10px] font-semibold tabular-nums ${topFund.return_1y >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPct(topFund.return_1y)} 1Y
                </p>
              )}
              {topFund.aum != null && (
                <p className="text-[10px] text-slate-400 tabular-nums">
                  {formatAUMRaw(topFund.aum)}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-[10px] text-slate-500">
            {bucket.id === 'avoid' ? 'High risk, low return, erratic' : 'No matching funds'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SmartBuckets({ universe: externalUniverse }) {
  const router = useRouter();
  const [internalUniverse, setInternalUniverse] = useState(null);
  const [loading, setLoading] = useState(!externalUniverse);

  // Use external universe if provided (from global filters), else fetch own
  const universe = externalUniverse || internalUniverse;

  useEffect(() => {
    if (externalUniverse) { setLoading(false); return; }
    cachedFetch('universe', fetchUniverseData, 600)
      .then((data) => setInternalUniverse(data))
      .catch(() => setInternalUniverse([]))
      .finally(() => setLoading(false));
  }, [externalUniverse]);

  const bucketData = useMemo(() => {
    if (!universe || universe.length === 0) return {};
    const result = {};
    BUCKET_DEFINITIONS.forEach((bucket) => {
      const matches = universe.filter(bucket.filter);
      const topFund = findTopFund(universe, bucket.filter);
      result[bucket.id] = {
        count: matches.length,
        topFund,
      };
    });
    return result;
  }, [universe]);

  const handleBucketClick = (bucket) => {
    router.push(`/universe?${bucket.filterParams}`);
  };

  if (loading) {
    return (
      <div>
        <SectionTitle tip="Pre-built fund categories based on multi-lens classifications">
          SMART BUCKETS
        </SectionTitle>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonLoader key={i} className="h-40 w-[195px] rounded-xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        tip="Pre-built fund categories based on multi-lens classifications"
        right={
          <a
            href="/universe"
            className="text-[11px] text-teal-600 font-medium hover:text-teal-700"
            onClick={(e) => { e.preventDefault(); router.push('/universe'); }}
          >
            View All in Universe &rarr;
          </a>
        }
      >
        SMART BUCKETS
      </SectionTitle>
      <div className="scroll-x">
        <div className="flex gap-3 pb-1" style={{ minWidth: 'max-content' }}>
          {BUCKET_DEFINITIONS.map((bucket) => (
            <BucketCard
              key={bucket.id}
              bucket={bucket}
              count={bucketData[bucket.id]?.count || 0}
              topFund={bucketData[bucket.id]?.topFund}
              onClick={() => handleBucketClick(bucket)}
              onFundClick={(mstarId) => router.push(`/fund360?fund=${mstarId}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
