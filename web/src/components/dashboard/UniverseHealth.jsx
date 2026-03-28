import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { LENS_OPTIONS } from '../../lib/lens';

function MiniHistogram({ buckets }) {
  if (!buckets || buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="flex items-end gap-0.5 h-[60px]">
      {buckets.slice(0, 10).map((bucket, idx) => {
        const heightPct = (bucket.count / maxCount) * 100;
        return (
          <div key={idx} className="flex flex-col items-center flex-1 min-w-0">
            <div
              className="w-full bg-teal-500 rounded-t-sm min-h-[2px]"
              style={{ height: `${Math.max(heightPct, 3)}%` }}
            />
            <span className="text-[9px] text-slate-400 mt-0.5 truncate w-full text-center">
              {bucket.min}-{bucket.max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const LENS_KEYS = [
  'return_score',
  'risk_score',
  'consistency_score',
  'alpha_score',
  'efficiency_score',
  'resilience_score',
];

export default function UniverseHealth({ lensDistribution, onNavigate }) {
  if (!lensDistribution) {
    return <SkeletonLoader className="h-64 rounded-xl" />;
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {LENS_KEYS.map((key) => {
          const lens = LENS_OPTIONS.find((l) => l.value === key);
          const dist = lensDistribution[key];

          return (
            <div
              key={key}
              className="bg-white rounded-xl p-3 shadow-sm border border-slate-100"
            >
              <p className="text-xs font-semibold text-slate-700 mb-2">
                {lens ? lens.label : key}
              </p>
              {dist && dist.buckets ? (
                <MiniHistogram buckets={dist.buckets} />
              ) : (
                <p className="text-xs text-slate-400">No data</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <button
          className="text-xs text-teal-600 hover:underline"
          onClick={() => onNavigate('/universe')}
        >
          Click to explore in Universe Explorer
        </button>
      </div>
    </div>
  );
}
