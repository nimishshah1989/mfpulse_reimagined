import InfoIcon from '../shared/InfoIcon';
const PALETTE = [
  '#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444',
  '#94a3b8', '#059669', '#7c3aed', '#db2777', '#ea580c',
];

/**
 * SectorAllocation -- compact sector list with color dots, matching mockup.
 *
 * Props:
 *   sectors          array  -- { sector_name, net_pct|allocation_pct }
 *   sectorQuadrants  object
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

  // Show top 5 individually, rest as "Others"
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const othersTotal = rest.reduce((s, sec) => s + (Number(sec.net_pct || sec.allocation_pct) || 0), 0);

  const displayList = [...top];
  if (rest.length > 0) {
    displayList.push({
      sector_name: `Others (${rest.length} sectors)`,
      net_pct: othersTotal,
      _isOthers: true,
    });
  }

  return (
    <div className="space-y-2">
      {displayList.map((s, i) => {
        const alloc = Number(s.net_pct || s.allocation_pct) || 0;
        const colorIdx = s._isOthers ? PALETTE.length - 1 : i;
        return (
          <div key={s.sector_name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: PALETTE[colorIdx % PALETTE.length] }}
            />
            <span className="text-xs text-slate-600 flex-1 truncate">{s.sector_name}</span>
            <span className="text-xs font-bold font-mono tabular-nums text-slate-700 flex-shrink-0">
              {alloc.toFixed(1)}%
            </span>
          </div>
        );
      })}

      {/* MarketPulse leading sectors insight */}
      {sectorQuadrants && (() => {
        const leadingPct = sorted.reduce((sum, s) => {
          const alloc = Number(s.net_pct || s.allocation_pct) || 0;
          const q = sectorQuadrants[s.sector_name]?.quadrant;
          return q === 'Leading' ? sum + alloc : sum;
        }, 0);
        if (leadingPct <= 0) return null;
        return (
          <div className="flex items-start gap-2 bg-emerald-50 rounded-lg px-3 py-2 mt-2">
            <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-[11px] text-emerald-700 font-medium">
              {leadingPct.toFixed(1)}% in leading sectors per MarketPulse
            </span>
          </div>
        );
      })()}
    </div>
  );
}
