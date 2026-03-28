import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

const QUADRANT_STYLES = {
  Leading: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50',
    text: 'Leading',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
  Weakening: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    text: 'Weakening',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  Lagging: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    text: 'Lagging',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
  },
  Improving: {
    border: 'border-l-teal-500',
    bg: 'bg-teal-50',
    text: 'Improving',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
  },
};

export default function SectorMoves({ sectors, onNavigate, loading }) {
  if (loading) {
    return (
      <Card>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <SkeletonLoader key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (!sectors || sectors.length === 0) {
    return (
      <Card>
        <div className="text-center py-4">
          <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
          </svg>
          <p className="text-xs text-slate-400">No sector movement data available.</p>
        </div>
      </Card>
    );
  }

  const notable = sectors.filter((s) =>
    s.quadrant === 'Leading' || s.quadrant === 'Weakening' || s.quadrant === 'Improving'
  ).slice(0, 6);

  if (notable.length === 0) {
    return (
      <Card>
        <p className="text-xs text-slate-400 text-center py-4">No notable sector moves today.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-2">
        {notable.map((sector) => {
          const style = QUADRANT_STYLES[sector.quadrant] || QUADRANT_STYLES.Improving;
          return (
            <div
              key={sector.sector_name}
              className={`border-l-4 ${style.border} ${style.bg} rounded-lg p-3 flex items-center justify-between`}
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-xs font-bold text-slate-800">{sector.sector_name}</h4>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                    {style.text}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  RS: <span className="font-mono tabular-nums font-medium text-slate-700">{sector.rs_score?.toFixed(0) ?? '--'}</span>
                  {sector.momentum != null && (
                    <span className="ml-3">
                      Momentum: <span className="font-mono tabular-nums font-medium text-slate-700">{sector.momentum.toFixed(1)}</span>
                    </span>
                  )}
                </p>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/sectors')}
                  className="text-[10px] text-teal-600 hover:text-teal-700 font-medium flex-shrink-0"
                >
                  Details →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
