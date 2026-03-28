import { QUADRANT_COLORS } from '../../lib/sectors';

function QuadrantBadge({ quadrant }) {
  if (!quadrant) return null;
  const colors = QUADRANT_COLORS[quadrant];
  if (!colors) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${colors.badge}`}>
      {quadrant}
    </span>
  );
}

const PALETTE = [
  '#0d9488', '#059669', '#0284c7', '#7c3aed', '#db2777',
  '#ea580c', '#ca8a04', '#4f46e5', '#dc2626', '#64748b',
  '#0891b2', '#16a34a', '#9333ea', '#e11d48', '#d97706',
];

/**
 * SectorAllocation — stacked bar + detailed sector table with allocation bars.
 *
 * Props:
 *   sectors array — { sector_name, allocation_pct, quadrant? }
 */
export default function SectorAllocation({ sectors }) {
  if (!sectors || sectors.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No sector data available
      </div>
    );
  }

  const sorted = [...sectors].sort(
    (a, b) => (Number(b.allocation_pct) || 0) - (Number(a.allocation_pct) || 0)
  );

  const total = sorted.reduce((sum, s) => sum + (Number(s.allocation_pct) || 0), 0);
  const maxAlloc = sorted.length > 0 ? Number(sorted[0].allocation_pct) || 0 : 0;

  return (
    <div className="space-y-5">
      {/* Stacked horizontal bar */}
      <div className="w-full h-8 rounded-lg overflow-hidden flex shadow-inner bg-slate-100">
        {sorted.map((s, i) => {
          const width = total > 0 ? (Number(s.allocation_pct) / total) * 100 : 0;
          if (width < 0.5) return null;
          return (
            <div
              key={s.sector_name}
              className="h-full relative group transition-opacity hover:opacity-80"
              style={{
                width: `${width}%`,
                backgroundColor: PALETTE[i % PALETTE.length],
              }}
              title={`${s.sector_name}: ${Number(s.allocation_pct).toFixed(1)}%`}
            >
              {/* Show label if segment is wide enough */}
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white truncate px-1">
                  {width > 15 ? s.sector_name : `${Number(s.allocation_pct).toFixed(0)}%`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Sector detail rows */}
      <div className="space-y-1.5">
        {sorted.map((s, i) => {
          const alloc = Number(s.allocation_pct) || 0;
          const barPct = maxAlloc > 0 ? (alloc / maxAlloc) * 100 : 0;
          return (
            <div key={s.sector_name} className="flex items-center gap-3 py-1.5 group hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
              <div
                className="w-3 h-3 rounded flex-shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700 truncate">{s.sector_name}</span>
                {s.quadrant && <QuadrantBadge quadrant={s.quadrant} />}
              </div>
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0 hidden sm:block">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: PALETTE[i % PALETTE.length],
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 flex-shrink-0 w-12 text-right">
                {alloc.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <span className="text-xs font-medium text-slate-500">Total allocated</span>
        <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
          {total.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
