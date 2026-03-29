const SECTOR_COLORS = {
  'Financial Services': 'bg-teal-50 text-teal-700',
  'Technology': 'bg-blue-50 text-blue-700',
  'Consumer Defensive': 'bg-purple-50 text-purple-700',
  'Healthcare': 'bg-amber-50 text-amber-700',
  'Energy': 'bg-rose-50 text-rose-700',
  'Industrials': 'bg-emerald-50 text-emerald-700',
  'Consumer Cyclical': 'bg-indigo-50 text-indigo-700',
  'Communication Services': 'bg-orange-50 text-orange-700',
};

const FALLBACK_SECTOR_COLORS = [
  'bg-teal-50 text-teal-700',
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-emerald-50 text-emerald-700',
  'bg-indigo-50 text-indigo-700',
  'bg-orange-50 text-orange-700',
];

/**
 * HoldingsTable -- compact holding rows with weight bars matching mockup.
 *
 * Props:
 *   holdings         array
 *   sectorQuadrants  object
 */
export default function HoldingsTable({ holdings, sectorQuadrants }) {
  if (!holdings || holdings.length === 0) {
    return (
      <div className="py-16 text-center">
        <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-sm text-slate-400">Holdings data pending for this fund</p>
      </div>
    );
  }

  const maxWeight = Math.max(...holdings.map((h) => Number(h.weighting_pct || h.weight_pct) || 0));
  const hasWeightData = maxWeight > 0;
  const totalWeight = holdings.reduce((s, h) => s + (Number(h.weighting_pct || h.weight_pct) || 0), 0);

  // Sector color mapping
  const sectorColorMap = {};
  let colorIdx = 0;
  function getSectorColor(sector) {
    if (!sector) return 'bg-slate-50 text-slate-500';
    if (SECTOR_COLORS[sector]) return SECTOR_COLORS[sector];
    if (!sectorColorMap[sector]) {
      sectorColorMap[sector] = FALLBACK_SECTOR_COLORS[colorIdx % FALLBACK_SECTOR_COLORS.length];
      colorIdx += 1;
    }
    return sectorColorMap[sector];
  }

  return (
    <div>
      {/* Concentration badge */}
      {hasWeightData && totalWeight > 50 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500">
            Top {holdings.length} = <span className="font-semibold">{totalWeight.toFixed(1)}%</span> of portfolio
          </p>
          {totalWeight > 60 && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-medium">
              High concentration
            </span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {holdings.map((h, i) => {
          const weight = Number(h.weighting_pct || h.weight_pct) || 0;
          const barPct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
          const sector = h.global_sector || h.sector;
          const holdingName = h.holding_name || h.name || h.security_name;

          return (
            <div
              key={h.isin || i}
              className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
            >
              <div className="w-6 text-center">
                <span className="text-[10px] text-slate-400 font-mono">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {holdingName}
                  </p>
                  {h.share_change != null && Number(h.share_change) !== 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                      Number(h.share_change) > 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {Number(h.share_change) > 0 ? '\u25B2' : '\u25BC'}{' '}
                      {Number(h.share_change) > 0 ? 'Added' : 'Reduced'}
                    </span>
                  )}
                  {sector && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${getSectorColor(sector)}`}>
                      {sector}
                    </span>
                  )}
                </div>
              </div>
              {hasWeightData && (
                <>
                  <div className="w-32 flex-shrink-0">
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(barPct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono tabular-nums text-slate-700 w-14 text-right flex-shrink-0">
                    {weight.toFixed(2)}%
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
