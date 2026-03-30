import { formatPct, formatAUM } from '../../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS, scoreColor } from '../../lib/lens';
import Badge from '../shared/Badge';

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
 * Enhanced with Sharpe ratio, AUM, and headline tag per approved mockup.
 */
export default function FundCardGrid({ funds, onSelect }) {
  if (!funds || funds.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {funds.map((f) => {
        const name = f.fund_name || f.legal_name || f.mstar_id;
        const ret1y = f.return_1y != null ? Number(f.return_1y) : null;
        const aumCr = f.aum != null ? Number(f.aum) / 10000000 : null;
        const sharpe = f.sharpe_3y != null ? Number(f.sharpe_3y) : null;

        // Collect top 3 tier tags (best tiers first)
        const tierRank = {
          LEADER: 1, ALPHA_MACHINE: 1, ROCK_SOLID: 1, LOW_RISK: 1, LEAN: 1, FORTRESS: 1,
          STRONG: 2, POSITIVE: 2, CONSISTENT: 2, MODERATE: 2, FAIR: 2, STURDY: 2,
        };
        const tiers = LENS_OPTIONS
          .map(({ key }) => ({ key, tier: f[LENS_CLASS_KEYS[key]] }))
          .filter(({ tier }) => tier && tierRank[tier])
          .sort((a, b) => (tierRank[a.tier] || 99) - (tierRank[b.tier] || 99))
          .slice(0, 3);

        return (
          <button
            key={f.mstar_id}
            type="button"
            onClick={() => onSelect(f.mstar_id)}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-teal-300 hover:shadow-lg transition-all duration-200 group flex flex-col gap-2"
          >
            {/* Row 1: Name + Return */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-800 truncate group-hover:text-teal-700 transition-colors">
                  {name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {f.amc_name} {'\u00B7'} {f.category_name}
                </p>
              </div>
              {ret1y != null && (
                <div className="text-right flex-shrink-0">
                  <span
                    className={`text-base font-mono tabular-nums font-extrabold ${
                      ret1y >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {formatPct(ret1y)}
                  </span>
                  <p className="text-[9px] text-slate-400 mt-0.5">1Y Return</p>
                </div>
              )}
            </div>

            {/* Row 2: Lens dots + headline */}
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {LENS_OPTIONS.map(({ key }) => (
                  <LensDot key={key} score={f[key]} />
                ))}
              </div>
              {f.headline_tag && (
                <span className="text-[9px] italic text-slate-400 ml-1.5 truncate">
                  &ldquo;{f.headline_tag}&rdquo;
                </span>
              )}
            </div>

            {/* Row 3: Tier badges + AUM + Sharpe */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1 flex-wrap">
                {tiers.map(({ key, tier }) => (
                  <Badge key={key} variant="tier" className="text-[9px]">
                    {tier}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-3 items-center flex-shrink-0">
                {aumCr != null && (
                  <span className="text-[10px] text-slate-400">
                    AUM: <span className="font-mono tabular-nums font-semibold text-slate-600">{formatAUM(aumCr)}</span>
                  </span>
                )}
                {sharpe != null && (
                  <span className="text-[10px] text-slate-400">
                    Sharpe: <span className={`font-mono tabular-nums font-semibold ${sharpe >= 1 ? 'text-emerald-600' : sharpe >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>{sharpe.toFixed(2)}</span>
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
