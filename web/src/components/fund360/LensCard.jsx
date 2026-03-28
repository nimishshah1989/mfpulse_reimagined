import { lensColor, lensBgColor } from '../../lib/lens';

/**
 * LensCard — shows one lens with score, bar, peer context, and stats.
 *
 * Props:
 *   name         string  — e.g. "Return"
 *   score        number  — 0-100 percentile
 *   categoryName string  — e.g. "Flexi Cap"
 *   peerStats    object  — optional { avg, best, rank, total }
 */
export default function LensCard({ name, score, categoryName, peerStats }) {
  const color = lensColor(score);
  const bgColor = lensBgColor(score);
  const displayScore = score != null ? Math.round(Number(score)) : null;

  const peerContext = () => {
    if (displayScore == null) return null;
    if (displayScore > 50) {
      return `Top ${100 - displayScore}% in ${categoryName || 'category'}`;
    }
    return `Below ${displayScore}% of peers`;
  };

  return (
    <div
      className="rounded-xl border border-slate-200 p-4 bg-white flex flex-col gap-3"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header: name + score */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {name}
        </span>
        <span
          className="text-lg font-mono tabular-nums font-bold"
          style={{ color }}
        >
          {displayScore != null ? displayScore : '—'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(displayScore ?? 0, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Peer context */}
      {displayScore != null && categoryName && (
        <p className="text-xs text-slate-500 leading-tight">{peerContext()}</p>
      )}

      {/* Stats row */}
      {peerStats && (
        <div className="text-[11px] font-mono text-slate-400 flex gap-2 flex-wrap">
          {peerStats.avg != null && <span>Avg: {Math.round(peerStats.avg)}</span>}
          {peerStats.best != null && <span>· Best: {Math.round(peerStats.best)}</span>}
          {peerStats.rank != null && peerStats.total != null && (
            <span>· Rank: {peerStats.rank} of {peerStats.total}</span>
          )}
        </div>
      )}
    </div>
  );
}
