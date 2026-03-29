import { formatPct, formatAUM } from '../../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS, scoreColor } from '../../lib/lens';
import Badge from '../shared/Badge';

/**
 * Tiny colored dot for a single lens score.
 */
function LensDot({ score }) {
  const color = score != null ? scoreColor(Number(score)) : '#e2e8f0';
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
      title={score != null ? `Score: ${Math.round(Number(score))}` : 'No score'}
    />
  );
}

/**
 * FundCardGrid -- renders funds as visual cards in a 2-column grid.
 *
 * Props:
 *   funds    array  -- fund objects with scores
 *   onSelect func   -- called with mstar_id when a fund is clicked
 */
export default function FundCardGrid({ funds, onSelect }) {
  if (!funds || funds.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {funds.map((f) => {
        const name = f.fund_name || f.legal_name || f.mstar_id;
        const ret1y = f.return_1y != null ? Number(f.return_1y) : null;
        const aumCr = f.aum != null ? Number(f.aum) / 10000000 : null;

        // Collect tier tags
        const tiers = LENS_OPTIONS
          .map(({ key }) => ({ key, tier: f[LENS_CLASS_KEYS[key]] }))
          .filter(({ tier }) => tier);

        return (
          <button
            key={f.mstar_id}
            type="button"
            onClick={() => onSelect(f.mstar_id)}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:shadow-lg hover:border-slate-300 transition-all duration-200 group"
          >
            {/* Top row: name + return */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-teal-700 transition-colors">
                  {name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {f.amc_name}
                </p>
              </div>
              {ret1y != null && (
                <div className="text-right flex-shrink-0">
                  <span
                    className={`text-sm font-mono tabular-nums font-bold ${
                      ret1y >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {formatPct(ret1y)}
                  </span>
                  <p className="text-[9px] text-slate-400 mt-0.5">1Y Return</p>
                </div>
              )}
            </div>

            {/* Category + AUM row */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {f.category_name && (
                <Badge variant="category">{f.category_name}</Badge>
              )}
              {aumCr != null && (
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                  {formatAUM(aumCr)}
                </span>
              )}
            </div>

            {/* 6 lens dots */}
            <div className="flex items-center gap-1.5 mt-3">
              {LENS_OPTIONS.map(({ key }) => (
                <LensDot key={key} score={f[key]} />
              ))}
              {f.headline_tag && (
                <span className="text-[10px] italic text-slate-400 ml-2 truncate">
                  {f.headline_tag}
                </span>
              )}
            </div>

            {/* Tier tags */}
            {tiers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {tiers.slice(0, 5).map(({ key, tier }) => (
                  <Badge key={key} variant="tier" className="text-[9px]">
                    {tier}
                  </Badge>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
