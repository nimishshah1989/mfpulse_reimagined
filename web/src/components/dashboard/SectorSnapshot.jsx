import { useRouter } from 'next/router';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

const QUADRANT_STYLES = {
  Leading: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
  Weakening: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
  },
  Lagging: {
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
  Improving: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
};

const ACTION_STYLES = {
  BUY: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  HOLD: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  SELL: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  AVOID: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function RSBar({ score, maxScore = 100 }) {
  const pct = Math.max(0, Math.min(100, ((score || 0) / maxScore) * 100));
  const color =
    pct >= 60 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold font-mono tabular-nums text-slate-700 w-8 text-right">
        {score != null ? Math.round(score) : '--'}
      </span>
    </div>
  );
}

function SectorRow({ sector }) {
  const quadrant = sector.quadrant || 'Improving';
  const qStyle = QUADRANT_STYLES[quadrant] || QUADRANT_STYLES.Improving;
  const action = sector.action || '';
  const aStyle = ACTION_STYLES[action.toUpperCase()] || ACTION_STYLES.HOLD;
  const displayName = sector.display_name || sector.sector_name || sector.name || '';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="w-28 flex-shrink-0">
        <p className="text-xs font-medium text-slate-800 truncate">{displayName}</p>
      </div>
      <RSBar score={sector.rs_score} />
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${qStyle.bg} ${qStyle.text}`}>
        {quadrant}
      </span>
      {action && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${aStyle.bg} ${aStyle.text} ${aStyle.border}`}>
          {action.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function SectorSnapshot({ sectors, loading }) {
  const router = useRouter();

  if (loading) {
    return (
      <Card>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonLoader key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (!sectors || sectors.length === 0) {
    return (
      <Card>
        <div className="text-center py-6">
          <p className="text-xs text-slate-400">Sector data unavailable. MarketPulse may be offline.</p>
        </div>
      </Card>
    );
  }

  // Sort by RS score descending, take top 5
  const topSectors = [...sectors]
    .sort((a, b) => (b.rs_score || 0) - (a.rs_score || 0))
    .slice(0, 5);

  return (
    <Card>
      <div>
        {topSectors.map((sector, idx) => (
          <SectorRow key={sector.display_name || sector.sector_name || idx} sector={sector} />
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => router.push('/sectors')}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
        >
          View All Sectors &rarr;
        </button>
      </div>
    </Card>
  );
}
