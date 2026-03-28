const TYPE_LABELS = {
  E: { label: 'Equity', color: 'bg-teal-100 text-teal-700' },
  CR: { label: 'Cash', color: 'bg-amber-100 text-amber-700' },
  B: { label: 'Bond', color: 'bg-blue-100 text-blue-700' },
  ST: { label: 'ST', color: 'bg-slate-100 text-slate-600' },
  Equity: { label: 'Equity', color: 'bg-teal-100 text-teal-700' },
  Bond: { label: 'Bond', color: 'bg-blue-100 text-blue-700' },
  Cash: { label: 'Cash', color: 'bg-amber-100 text-amber-700' },
  Other: { label: 'Other', color: 'bg-slate-100 text-slate-600' },
};

const SECTOR_COLORS = [
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
 * HoldingsTable -- top holdings with weight bars, sector tags, type badges.
 *
 * Props:
 *   holdings  array
 */
export default function HoldingsTable({ holdings }) {
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
  const sectorMap = {};
  let sectorIdx = 0;

  function getSectorColor(sector) {
    if (!sector) return 'bg-slate-100 text-slate-500';
    if (!sectorMap[sector]) {
      sectorMap[sector] = SECTOR_COLORS[sectorIdx % SECTOR_COLORS.length];
      sectorIdx += 1;
    }
    return sectorMap[sector];
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="bg-slate-50/80">
            <th className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-3 px-3 text-left border-b border-slate-200 w-8">#</th>
            <th className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-3 px-3 text-left border-b border-slate-200">Holding</th>
            <th className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-3 px-3 text-left border-b border-slate-200">Sector</th>
            <th className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-3 px-3 text-center border-b border-slate-200 w-16">Type</th>
            <th className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-3 px-3 text-right border-b border-slate-200 w-20">Weight</th>
            <th className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-3 px-3 text-left border-b border-slate-200 w-32">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => {
            const weight = Number(h.weighting_pct || h.weight_pct) || 0;
            const barPct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
            const sector = h.global_sector || h.sector;
            const holdingName = h.holding_name || h.name;
            const holdingType = h.holding_type || h.type;
            const typeInfo = holdingType ? TYPE_LABELS[holdingType] || TYPE_LABELS.Other : null;

            return (
              <tr key={h.isin || i} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100 last:border-0">
                <td className="text-[11px] text-slate-400 py-3.5 px-3 font-mono tabular-nums">
                  {i + 1}
                </td>
                <td className="py-3.5 px-3">
                  <span className="text-sm font-medium text-slate-800 group-hover:text-teal-700 transition-colors">
                    {holdingName}
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  {sector && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${getSectorColor(sector)}`}>
                      {sector}
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-3 text-center">
                  {typeInfo && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-3 text-right">
                  <span className="text-sm font-mono tabular-nums font-bold text-slate-800">
                    {weight.toFixed(2)}%
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(barPct, 100)}%`,
                        background: `linear-gradient(90deg, #0d9488 0%, #14b8a6 100%)`,
                        opacity: 0.4 + (barPct / 100) * 0.6,
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
