const PALETTE = [
  '#0d9488', '#059669', '#0284c7', '#7c3aed', '#db2777',
  '#ea580c', '#ca8a04', '#4f46e5', '#dc2626', '#64748b',
  '#0891b2', '#16a34a', '#9333ea', '#e11d48', '#d97706',
];

const QUADRANT_BADGE = {
  Leading:    { label: 'Leading',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Improving:  { label: 'Improving',  bg: 'bg-teal-100',    text: 'text-teal-700' },
  Weakening:  { label: 'Weakening',  bg: 'bg-amber-100',   text: 'text-amber-700' },
  Lagging:    { label: 'Lagging',    bg: 'bg-red-100',     text: 'text-red-700' },
};

/**
 * SectorAllocation -- stacked horizontal bar + detail table + MarketPulse quadrant tags.
 *
 * Props:
 *   sectors          array  -- { sector_name, net_pct|allocation_pct }
 *   sectorQuadrants  object -- map of sector display_name → { quadrant: 'Leading'|'Improving'|'Weakening'|'Lagging' }
 */
export default function SectorAllocation({ sectors, sectorQuadrants }) {
  if (!sectors || sectors.length === 0) {
    return (
      <div className="py-16 text-center">
        <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        <p className="text-sm text-slate-400">No sector data available</p>
      </div>
    );
  }

  const sorted = [...sectors].sort(
    (a, b) => (Number(b.net_pct || b.allocation_pct) || 0) - (Number(a.net_pct || a.allocation_pct) || 0)
  );

  const total = sorted.reduce((sum, s) => sum + (Number(s.net_pct || s.allocation_pct) || 0), 0);
  const maxAlloc = sorted.length > 0 ? Number(sorted[0].net_pct || sorted[0].allocation_pct) || 0 : 0;

  return (
    <div className="space-y-5">
      {/* Stacked horizontal bar */}
      <div className="w-full h-10 rounded-xl overflow-hidden flex bg-slate-100 shadow-inner">
        {sorted.map((s, i) => {
          const alloc = Number(s.net_pct || s.allocation_pct) || 0;
          const width = total > 0 ? (alloc / total) * 100 : 0;
          if (width < 0.3) return null;
          return (
            <div
              key={s.sector_name}
              className="h-full relative group transition-all duration-200 hover:brightness-110 cursor-default"
              style={{
                width: `${width}%`,
                backgroundColor: PALETTE[i % PALETTE.length],
              }}
              title={`${s.sector_name}: ${alloc.toFixed(1)}%`}
            >
              {width > 10 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white truncate px-1 drop-shadow-sm">
                  {width > 18 ? s.sector_name : `${alloc.toFixed(0)}%`}
                </span>
              )}
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {s.sector_name}: {alloc.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Sector detail rows */}
      <div className="space-y-0.5">
        {sorted.map((s, i) => {
          const alloc = Number(s.net_pct || s.allocation_pct) || 0;
          const barPct = maxAlloc > 0 ? (alloc / maxAlloc) * 100 : 0;
          const qKey = sectorQuadrants ? (sectorQuadrants[s.sector_name]?.quadrant || null) : null;
          const quadrantInfo = qKey ? QUADRANT_BADGE[qKey] || null : null;
          return (
            <div key={s.sector_name} className="flex items-center gap-2 py-1.5 group hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-xs font-medium text-slate-700 w-32 truncate flex-shrink-0">
                {s.sector_name}
              </span>
              {quadrantInfo && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${quadrantInfo.bg} ${quadrantInfo.text}`}>
                  {quadrantInfo.label}
                </span>
              )}
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: PALETTE[i % PALETTE.length],
                    opacity: 0.65,
                  }}
                />
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-slate-700 w-14 text-right flex-shrink-0">
                {alloc.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <span className="text-xs font-medium text-slate-500">Total allocated</span>
        <span className="text-sm font-mono tabular-nums font-bold text-slate-700">
          {total.toFixed(1)}%
        </span>
      </div>

      {/* MarketPulse leading sectors insight */}
      {sectorQuadrants && (() => {
        const leadingPct = sorted.reduce((sum, s) => {
          const alloc = Number(s.net_pct || s.allocation_pct) || 0;
          const q = sectorQuadrants[s.sector_name]?.quadrant;
          return q === 'Leading' ? sum + alloc : sum;
        }, 0);
        if (leadingPct <= 0) return null;
        return (
          <div className="flex items-start gap-2 bg-emerald-50 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-[11px] text-emerald-700 font-medium">
              {leadingPct.toFixed(1)}% of holdings are in leading sectors per MarketPulse
            </span>
          </div>
        );
      })()}
    </div>
  );
}
