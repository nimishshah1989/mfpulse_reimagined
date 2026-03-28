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
              className="w-full bg-teal-500 rounded-t-sm min-h-[2px] transition-all hover:bg-teal-600"
              style={{ height: `${Math.max(heightPct, 3)}%` }}
              title={`${bucket.min}-${bucket.max}: ${bucket.count} funds`}
            />
            <span className="text-[8px] text-slate-400 mt-0.5 truncate w-full text-center font-mono">
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
    <Card>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {LENS_KEYS.map((key) => {
          const lens = LENS_OPTIONS.find((l) => l.key === key);
          const dist = lensDistribution[key];

          return (
            <div
              key={key}
              className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-teal-200 transition-colors"
            >
              <p className="text-[11px] font-bold text-slate-700 mb-2">
                {lens ? lens.label : key}
              </p>
              {dist && dist.buckets ? (
                <MiniHistogram buckets={dist.buckets} />
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">No data</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          onClick={() => onNavigate('/universe')}
        >
          Explore full Universe →
        </button>
      </div>
    </Card>
  );
}
