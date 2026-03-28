import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

const QUADRANT_STYLES = {
  Leading: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'Entering Leading' },
  Weakening: { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'Weakening' },
  Lagging: { border: 'border-l-red-500', bg: 'bg-red-50', text: 'Warning' },
  Improving: { border: 'border-l-teal-500', bg: 'bg-teal-50', text: 'Improving' },
};

export default function SectorMoves({ sectors, onNavigate, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <SkeletonLoader key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!sectors || sectors.length === 0) {
    return (
      <p className="text-xs text-slate-400">No sector movement data available.</p>
    );
  }

  // Show notable sectors: Leading, Weakening, Improving
  const notable = sectors.filter((s) =>
    s.quadrant === 'Leading' || s.quadrant === 'Weakening' || s.quadrant === 'Improving'
  ).slice(0, 6);

  if (notable.length === 0) {
    return (
      <p className="text-xs text-slate-400">No notable sector moves today.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {notable.map((sector) => {
        const style = QUADRANT_STYLES[sector.quadrant] || QUADRANT_STYLES.Improving;
        return (
          <div
            key={sector.sector_name}
            className={`border-l-4 ${style.border} ${style.bg} rounded-lg p-3`}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-slate-700">{sector.sector_name}</h4>
              <span className="text-[10px] font-medium text-slate-500">{style.text}</span>
            </div>
            <p className="text-xs text-slate-600">
              RS Score: <span className="font-mono tabular-nums">{sector.rs_score?.toFixed(0) ?? '—'}</span>
              {sector.momentum != null && (
                <span className="ml-2">
                  Mom: <span className="font-mono tabular-nums">{sector.momentum.toFixed(1)}</span>
                </span>
              )}
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/sectors')}
                className="text-[10px] text-teal-600 hover:text-teal-700 mt-1"
              >
                View in Sector Intelligence →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
