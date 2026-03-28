import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { LENS_OPTIONS } from '../../lib/lens';

function Sparkline({ scores }) {
  const n = scores.length;
  const points = scores
    .map((s, i) => {
      const x = (i / (n - 1)) * 80;
      const y = 24 - (s / 100) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 80 24" width={80} height={24} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="#0d9488"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function getTrend(scores) {
  if (scores.length < 6) {
    const first = scores[0];
    const last = scores[scores.length - 1];
    const diff = last - first;
    if (diff > 2) return { arrow: '\u2191', color: 'text-emerald-600' };
    if (diff < -2) return { arrow: '\u2193', color: 'text-red-600' };
    return { arrow: '\u2192', color: 'text-slate-500' };
  }

  const last3 = scores.slice(-3);
  const first3 = scores.slice(0, 3);
  const avgLast = last3.reduce((a, b) => a + b, 0) / last3.length;
  const avgFirst = first3.reduce((a, b) => a + b, 0) / first3.length;
  const diff = avgLast - avgFirst;

  if (diff > 2) return { arrow: '\u2191', color: 'text-emerald-600' };
  if (diff < -2) return { arrow: '\u2193', color: 'text-red-600' };
  return { arrow: '\u2192', color: 'text-slate-500' };
}

export default function LensHistory({ history }) {
  const isLoading = !history || history.length === 0;

  if (isLoading) {
    return (
      <Card title="Lens Score History">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card title="Lens Score History">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {LENS_OPTIONS.map((lens) => {
          const scores = history.map((h) => Number(h[lens.key]) || 0);

          if (scores.length < 2) {
            return (
              <div key={lens.key} className="p-2">
                <SkeletonLoader />
              </div>
            );
          }

          const trend = getTrend(scores);
          const current = scores[scores.length - 1];

          return (
            <div
              key={lens.key}
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
            >
              <span className="text-xs text-slate-600 w-16 flex-shrink-0">
                {lens.label}
              </span>
              <Sparkline scores={scores} />
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`text-sm ${trend.color}`}>{trend.arrow}</span>
                <span className="text-xs font-mono tabular-nums text-slate-700">
                  {current}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
