import Card from '../shared/Card';
import { lensColor } from '../../lib/lens';
import { LENS_OPTIONS } from '../../lib/lens';

/**
 * Single horizontal track for one lens.
 */
function LensTrack({ label, score }) {
  const pct = score != null ? Math.min(Math.max(Number(score), 0), 100) : null;
  const color = lensColor(score);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 relative h-2 bg-slate-100 rounded-full">
        {pct != null && (
          <>
            {/* Track fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full opacity-20"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
            {/* Dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
              style={{
                left: `calc(${pct}% - 6px)`,
                backgroundColor: color,
              }}
            />
          </>
        )}
      </div>
      <span
        className="text-xs font-mono tabular-nums font-semibold w-8 text-right"
        style={{ color: pct != null ? color : '#94a3b8' }}
      >
        {pct != null ? Math.round(pct) : '—'}
      </span>
    </div>
  );
}

/**
 * PeerPositioning — 6 horizontal tracks showing each lens percentile.
 *
 * Props:
 *   scores object — { return_score, risk_score, consistency_score, alpha_score, efficiency_score, resilience_score }
 */
export default function PeerPositioning({ scores }) {
  if (!scores) return null;

  return (
    <Card title="Peer Positioning">
      <p className="text-[11px] text-slate-400 mb-3">
        Each bar shows where this fund sits among its peers (0 = bottom, 100 = top).
      </p>
      <div>
        {LENS_OPTIONS.map(({ key, label }) => (
          <LensTrack key={key} label={label} score={scores[key]} />
        ))}
      </div>
    </Card>
  );
}
