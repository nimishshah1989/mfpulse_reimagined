import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
import { lensLabel, lensColor, LENS_OPTIONS } from '../../lib/lens';
import { formatPct, formatAUM } from '../../lib/format';

/**
 * Popup card shown when hovering a bubble in BubbleScatter.
 * Positioned absolutely via x/y viewport coordinates.
 * Shows 6 lens scores, AUM in Indian notation, 1Y return colored.
 */
export default function HoverCard({ fund, x, y }) {
  if (!fund) return null;

  // Top-tier lenses for badge display (score >= 75)
  const topLenses = LENS_OPTIONS.filter(
    (l) => Number(fund[l.key]) >= 75
  ).slice(0, 3);

  const return1y = Number(fund.return_1y);
  const return1yValid = !isNaN(return1y);

  // Clamp to viewport
  const cardWidth = 280;
  const cardHeight = 240;
  const left = Math.min(x + 12, window.innerWidth - cardWidth - 8);
  const top = Math.min(y - 20, window.innerHeight - cardHeight - 8);

  return (
    <div
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 pointer-events-none"
      style={{ left, top, width: cardWidth }}
    >
      {/* Fund name + AMC */}
      <div className="mb-2.5">
        <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">
          {fund.fund_name || fund.legal_name || fund.mstar_id}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
          {fund.amc_name} &bull; {fund.category_name}
        </p>
      </div>

      {/* Six lens scores as circles with mini bar underneath */}
      <div className="flex items-center justify-between mb-2.5 gap-1">
        {LENS_OPTIONS.map((l) => {
          const score = Number(fund[l.key]) || 0;
          const color = lensColor(score);
          return (
            <div key={l.key} className="flex flex-col items-center gap-0.5">
              <LensCircle lensKey={l.key} score={fund[l.key]} size="md" />
              <div className="w-6 h-0.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${score}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tier badges for top scores */}
      {topLenses.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {topLenses.map((l) => (
            <TierBadge key={l.key} lensKey={l.key} score={fund[l.key]} />
          ))}
        </div>
      )}

      {/* Key stats row */}
      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
        <div className="flex items-center gap-4">
          <span>
            <span className="text-slate-400">1Y </span>
            {return1yValid ? (
              <span
                className={`font-mono font-semibold tabular-nums ${
                  return1y >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatPct(fund.return_1y)}
              </span>
            ) : (
              <span className="font-mono text-slate-300">&mdash;</span>
            )}
          </span>
          <span>
            <span className="text-slate-400">AUM </span>
            <span className="font-mono text-slate-700 tabular-nums">
              {formatAUM(fund.aum)}
            </span>
          </span>
        </div>

        {fund.mstar_id && (
          <a
            href={`/fund360?fund=${fund.mstar_id}`}
            className="text-teal-600 hover:text-teal-700 font-medium pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            Deep dive &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
