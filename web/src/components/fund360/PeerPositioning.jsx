import { useRouter } from 'next/router';
import { lensColor, LENS_OPTIONS } from '../../lib/lens';
import { formatPct } from '../../lib/format';

function LensTrack({ label, score, peerAvg }) {
  const pct = score != null ? Math.min(Math.max(Number(score), 0), 100) : null;
  const peerPct = peerAvg != null ? Math.min(Math.max(Number(peerAvg), 0), 100) : 50;
  const color = lensColor(score);

  return (
    <div className="flex items-center gap-3 py-2.5 group hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
      <span className="text-xs font-medium text-slate-600 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 relative h-5 bg-slate-100 rounded-full overflow-hidden">
        {/* Peer average bar */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${peerPct}%`, backgroundColor: '#cbd5e1', opacity: 0.4 }}
        />
        {/* Fund score bar */}
        {pct != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
          />
        )}
        {/* Peer average marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
          style={{ left: `${peerPct}%` }}
        >
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-800 text-white text-[8px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Avg: {Math.round(peerPct)}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 w-16 text-right">
        <span
          className="text-sm font-mono tabular-nums font-bold"
          style={{ color: pct != null ? color : '#94a3b8' }}
        >
          {pct != null ? Math.round(pct) : '\u2014'}
        </span>
      </div>
    </div>
  );
}

function PeerRow({ peer, onNavigate }) {
  const ret = peer.return_1y != null ? Number(peer.return_1y) : null;
  return (
    <button
      type="button"
      onClick={() => onNavigate(peer.mstar_id)}
      className="w-full flex items-center gap-3 py-2.5 px-3 hover:bg-teal-50 rounded-lg transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate group-hover:text-teal-700 transition-colors">
          {peer.fund_name || peer.mstar_id}
        </p>
        <p className="text-[10px] text-slate-400 truncate">{peer.amc_name}</p>
      </div>
      {ret != null && (
        <span className={`text-xs font-mono tabular-nums font-semibold flex-shrink-0 ${
          ret >= 0 ? 'text-emerald-600' : 'text-red-600'
        }`}>
          {formatPct(ret)}
        </span>
      )}
      <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * PeerPositioning -- horizontal lens bars + clickable peer list.
 *
 * Props:
 *   scores   object
 *   peerAvgs object
 *   peers    array
 */
export default function PeerPositioning({ scores, peerAvgs, peers }) {
  const router = useRouter();

  if (!scores) return null;

  const handleNavigate = (mstarId) => {
    router.push(`/fund360?fund=${mstarId}`);
  };

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex items-center gap-5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-2.5 rounded-full inline-block bg-teal-500 opacity-85" />
          Fund Score
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-2.5 rounded-full inline-block bg-slate-300 opacity-40" />
          Peer Average
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-3.5 inline-block bg-slate-500" />
          Avg Marker
        </span>
      </div>

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

      {/* Peer list */}
      {peers && peers.length > 0 && (
        <div className="pt-3 border-t border-slate-200">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Category Peers ({peers.length})
          </p>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {peers.slice(0, 10).map((peer) => (
              <PeerRow key={peer.mstar_id} peer={peer} onNavigate={handleNavigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
