import { lensColor } from '../../lib/lens';
import { LENS_OPTIONS } from '../../lib/lens';

/**
 * Single horizontal bar track comparing fund vs peer average.
 */
function LensTrack({ label, score, peerAvg }) {
  const pct = score != null ? Math.min(Math.max(Number(score), 0), 100) : null;
  const peerPct = peerAvg != null ? Math.min(Math.max(Number(peerAvg), 0), 100) : 50;
  const color = lensColor(score);

  return (
    <div className="flex items-center gap-3 py-2 group hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
      <span className="text-xs font-medium text-slate-600 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 relative h-4 bg-slate-100 rounded-full overflow-hidden">
        {/* Peer average bar (background) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${peerPct}%`,
            backgroundColor: '#cbd5e1',
            opacity: 0.5,
          }}
        />
        {/* Fund score bar (foreground) */}
        {pct != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
              opacity: 0.85,
            }}
          />
        )}
        {/* Peer average marker line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
          style={{ left: `${peerPct}%` }}
          title={`Peer avg: ${Math.round(peerPct)}`}
        />
      </div>
      <div className="flex-shrink-0 w-20 text-right">
        <span
          className="text-sm font-mono tabular-nums font-bold"
          style={{ color: pct != null ? color : '#94a3b8' }}
        >
          {pct != null ? Math.round(pct) : '\u2014'}
        </span>
        <span className="text-[10px] text-slate-400 ml-1">/ 100</span>
      </div>
    </div>
  );
}

/**
 * PeerPositioning — horizontal bar charts for each lens showing fund vs peer average.
 *
 * Props:
 *   scores   object — { return_score, risk_score, ... }
 *   peerAvgs object — optional { return_score: avg, ... }
 *   rank     object — optional { rank, total }
 */
export default function PeerPositioning({ scores, peerAvgs, rank }) {
  if (!scores) return null;

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2 rounded-full inline-block bg-teal-500 opacity-85" />
          Fund
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2 rounded-full inline-block bg-slate-300 opacity-50" />
          Peer avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3 inline-block bg-slate-400" />
          Avg marker
        </span>
        {rank && rank.rank != null && rank.total != null && (
          <span className="ml-auto text-xs font-medium text-slate-600">
            Rank {rank.rank} of {rank.total}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-400">
        Each bar shows where this fund sits among its peers (0 = bottom, 100 = top).
      </p>

      {/* Lens tracks */}
      <div>
        {LENS_OPTIONS.map(({ key, label }) => (
          <LensTrack
            key={key}
            label={label}
            score={scores[key]}
            peerAvg={peerAvgs?.[key] ?? 50}
          />
        ))}
      </div>
    </div>
  );
}
