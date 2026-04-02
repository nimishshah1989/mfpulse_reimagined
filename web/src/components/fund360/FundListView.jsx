import { formatPct, formatAUM, formatCount } from '../../lib/format';
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

function getBestTier(fund) {
  const tierRank = {
    LEADER: 1, ALPHA_MACHINE: 1, ROCK_SOLID: 1, LOW_RISK: 1, LEAN: 1, FORTRESS: 1,
    STRONG: 2, POSITIVE: 2, CONSISTENT: 2, MODERATE: 2, FAIR: 2, STURDY: 2,
    AVERAGE: 3, NEUTRAL: 3, MIXED: 3, ELEVATED: 3, EXPENSIVE: 3, FRAGILE: 3,
    WEAK: 4, NEGATIVE: 4, ERRATIC: 4, HIGH_RISK: 4, BLOATED: 4, VULNERABLE: 4,
  };
  let best = null;
  let bestRank = 99;
  for (const { key } of LENS_OPTIONS) {
    const tier = fund[LENS_CLASS_KEYS[key]];
    if (tier && (tierRank[tier] || 99) < bestRank) {
      bestRank = tierRank[tier] || 99;
      best = tier;
    }
  }
  return best;
}

/**
 * FundListView — tabular list view matching the mockup.
 * Columns: Fund Name | 1Y Ret | AUM (Cr) | Sharpe | Alpha | Lens Scores | Top Tier
 */
export default function FundListView({ funds, onSelect }) {
  if (!funds || funds.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[2fr_70px_80px_70px_70px_120px_90px] px-3.5 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-200 bg-slate-50/50">
        <span>Fund Name</span>
        <span className="text-right">1Y Ret</span>
        <span className="text-right">AUM (Cr)</span>
        <span className="text-right">Sharpe</span>
        <span className="text-right">Alpha</span>
        <span className="text-center">Lens Scores</span>
        <span className="text-center">Top Tier</span>
      </div>

      {/* Data rows */}
      {funds.map((f) => {
        const ret1y = f.return_1y != null ? Number(f.return_1y) : null;
        const aumCr = f.aum != null ? Number(f.aum) / 10000000 : null;
        const sharpe = f.sharpe_3y != null ? Number(f.sharpe_3y) : null;
        const alpha = f.alpha_3y != null ? Number(f.alpha_3y) : null;
        const bestTier = getBestTier(f);

        return (
          <button
            key={f.mstar_id}
            type="button"
            onClick={() => onSelect(f.mstar_id)}
            className="grid grid-cols-[2fr_70px_80px_70px_70px_120px_90px] items-center px-3.5 py-2.5 border-b border-slate-100 text-[12px] hover:bg-slate-50 transition-colors cursor-pointer w-full text-left"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{f.fund_name || f.mstar_id}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {f.amc_name} {'\u00B7'} {f.category_name} {f.purchase_mode ? `\u00B7 ${f.purchase_mode}` : ''}
              </p>
            </div>
            <span className={`text-right font-mono tabular-nums font-bold ${ret1y != null && ret1y >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {ret1y != null ? formatPct(ret1y) : '\u2014'}
            </span>
            <span className="text-right font-mono tabular-nums text-slate-700">
              {aumCr != null ? formatCount(Math.round(aumCr)) : '\u2014'}
            </span>
            <span className={`text-right font-mono tabular-nums font-semibold ${sharpe != null && sharpe >= 1 ? 'text-emerald-600' : sharpe != null && sharpe >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>
              {sharpe != null ? sharpe.toFixed(2) : '\u2014'}
            </span>
            <span className={`text-right font-mono tabular-nums font-semibold ${alpha != null && alpha >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {alpha != null ? formatPct(alpha) : '\u2014'}
            </span>
            <div className="flex gap-1 justify-center">
              {LENS_OPTIONS.map(({ key }) => (
                <LensDot key={key} score={f[key]} />
              ))}
            </div>
            <div className="text-center">
              {bestTier ? (
                <Badge variant="tier" className="text-[9px]">{bestTier}</Badge>
              ) : (
                <span className="text-[10px] text-slate-300">{'\u2014'}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
