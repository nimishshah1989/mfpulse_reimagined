import { useRouter } from 'next/router';
import Card from '../shared/Card';
import TierBadge from '../shared/TierBadge';
import { LENS_CLASS_KEYS, LENS_OPTIONS } from '../../lib/lens';

/**
 * Selects alternatives: top 3 by return_score + top 2 by efficiency_score (deduplicated).
 */
function selectAlternatives(peers, currentMstarId) {
  const filtered = (peers || []).filter((p) => p.mstar_id !== currentMstarId);

  const top3Return = [...filtered]
    .sort((a, b) => (Number(b.return_score) || 0) - (Number(a.return_score) || 0))
    .slice(0, 3);

  const returnIds = new Set(top3Return.map((p) => p.mstar_id));

  const top2Eff = [...filtered]
    .sort((a, b) => (Number(b.efficiency_score) || 0) - (Number(a.efficiency_score) || 0))
    .slice(0, 2)
    .filter((p) => !returnIds.has(p.mstar_id));

  return [...top3Return, ...top2Eff];
}

function reasonForPeer(peer, idx) {
  if (idx < 3) {
    const score = peer.return_score != null ? Math.round(Number(peer.return_score)) : null;
    return score != null
      ? `Return score ${score} — top performer in category`
      : 'Top performer by returns';
  }
  const score = peer.efficiency_score != null ? Math.round(Number(peer.efficiency_score)) : null;
  return score != null
    ? `Efficiency score ${score} — lean cost structure`
    : 'Efficient cost structure';
}

function PeerCard({ peer, reason, isReturnPick, onCompare }) {
  const router = useRouter();
  const fundName = peer.fund_name || peer.legal_name || peer.mstar_id;

  const tiers = LENS_OPTIONS
    .map(({ key }) => peer[LENS_CLASS_KEYS[key]])
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 truncate">{fundName}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{reason}</p>
        </div>
        {isReturnPick && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700 rounded-full">
            Top Return
          </span>
        )}
      </div>

      {/* Tier pills */}
      <div className="flex flex-wrap gap-1">
        {tiers.map((tier) => (
          <TierBadge key={tier} tier={tier} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          type="button"
          onClick={() => router.push(`/fund360?fund=${peer.mstar_id}`)}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
        >
          View
        </button>
        <button
          type="button"
          onClick={() => onCompare && onCompare(peer.mstar_id)}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Compare
        </button>
      </div>
    </div>
  );
}

/**
 * SmartAlternatives — top 3 peers by return_score + top 2 by efficiency_score.
 *
 * Props:
 *   peers          array  — peer fund objects with lens scores
 *   currentMstarId string — exclude this fund from alternatives
 *   onCompare      func   — optional callback(mstarId) to open compare mode
 */
export default function SmartAlternatives({ peers, currentMstarId, onCompare }) {
  const alternatives = selectAlternatives(peers, currentMstarId);

  if (!alternatives || alternatives.length === 0) return null;

  const returnSet = new Set(
    [...(peers || [])]
      .filter((p) => p.mstar_id !== currentMstarId)
      .sort((a, b) => (Number(b.return_score) || 0) - (Number(a.return_score) || 0))
      .slice(0, 3)
      .map((p) => p.mstar_id)
  );

  return (
    <Card title="Smart Alternatives">
      <p className="text-xs text-slate-400 mb-4">
        Top performers in the same category, by return and efficiency.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {alternatives.map((peer, idx) => (
          <PeerCard
            key={peer.mstar_id}
            peer={peer}
            reason={reasonForPeer(peer, returnSet.has(peer.mstar_id) ? 0 : 3)}
            isReturnPick={returnSet.has(peer.mstar_id)}
            onCompare={onCompare}
          />
        ))}
      </div>
    </Card>
  );
}
