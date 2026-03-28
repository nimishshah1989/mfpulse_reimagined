import { QUADRANT_COLORS } from '../../lib/sectors';
import Card from '../shared/Card';

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

/**
 * SectorAllocation — stacked bar + sector list with compass quadrant tags.
 *
 * Props:
 *   sectors array — { sector_name, allocation_pct, quadrant? }
 */
export default function SectorAllocation({ sectors }) {
  if (!sectors || sectors.length === 0) {
    return (
      <Card title="Sector Allocation">
        <div className="py-8 text-center text-sm text-slate-400">No sector data available</div>
      </Card>
    );
  }

  const sorted = [...sectors].sort(
    (a, b) => (Number(b.allocation_pct) || 0) - (Number(a.allocation_pct) || 0)
  );

  const total = sorted.reduce((sum, s) => sum + (Number(s.allocation_pct) || 0), 0);

  const PALETTE = [
    '#0d9488', '#059669', '#0284c7', '#7c3aed', '#db2777',
    '#ea580c', '#ca8a04', '#4f46e5', '#dc2626', '#64748b',
  ];

  return (
    <Card title="Sector Allocation">
      {/* Stacked bar */}
      <div className="w-full h-3 rounded-full overflow-hidden flex mb-5">
        {sorted.map((s, i) => {
          const width = total > 0 ? (Number(s.allocation_pct) / total) * 100 : 0;
          return (
            <div
              key={s.sector_name}
              className="h-full"
              style={{ width: `${width}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
              title={`${s.sector_name}: ${Number(s.allocation_pct).toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Sector list */}
      <div className="space-y-2.5">
        {sorted.map((s, i) => (
          <div key={s.sector_name} className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-xs text-slate-700 truncate">{s.sector_name}</span>
              {s.quadrant && <QuadrantBadge quadrant={s.quadrant} />}
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600 flex-shrink-0">
              {s.allocation_pct != null ? `${Number(s.allocation_pct).toFixed(1)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
