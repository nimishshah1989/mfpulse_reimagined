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

/**
 * Weight bar with gradient intensity based on allocation.
 */
function WeightBar({ weight, maxWeight }) {
  if (weight == null) return null;
  const pct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
  // Intensity: higher weight = darker teal
  const opacity = 0.3 + (pct / 100) * 0.7;

  return (
    <div className="w-24 h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${Math.min(pct, 100)}%`,
          backgroundColor: `rgba(13, 148, 136, ${opacity})`,
        }}
      />
    </div>
  );
}

/**
 * HoldingsTable — top holdings with weight bars, sector tags, and quadrant badges.
 *
 * Props:
 *   holdings        array  — holding objects { name, isin, sector, weight_pct }
 *   sectorQuadrants object — optional map of sector_name -> quadrant string
 */
export default function HoldingsTable({ holdings, sectorQuadrants }) {
  if (!holdings || holdings.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No holdings data available
      </div>
    );
  }

  const maxWeight = Math.max(...holdings.map((h) => Number(h.weight_pct) || 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[580px]">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-[11px] font-semibold text-slate-500 py-2.5 px-3 text-left border-b border-slate-200 w-8">#</th>
            <th className="text-[11px] font-semibold text-slate-500 py-2.5 px-3 text-left border-b border-slate-200">Holding</th>
            <th className="text-[11px] font-semibold text-slate-500 py-2.5 px-3 text-left border-b border-slate-200">Sector</th>
            <th className="text-[11px] font-semibold text-slate-500 py-2.5 px-3 text-right border-b border-slate-200">Weight</th>
            <th className="text-[11px] font-semibold text-slate-500 py-2.5 px-3 text-left border-b border-slate-200 w-28">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => {
            const quadrant = sectorQuadrants && h.sector ? sectorQuadrants[h.sector] : null;
            const weight = h.weight_pct != null ? Number(h.weight_pct) : null;
            return (
              <tr key={h.isin || i} className="hover:bg-slate-50/70 transition-colors group">
                <td className="text-xs text-slate-400 py-3 px-3 border-b border-slate-100 font-mono tabular-nums">
                  {i + 1}
                </td>
                <td className="py-3 px-3 border-b border-slate-100">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(h.name)}+stock`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-slate-800 hover:text-teal-600 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {h.name}
                  </a>
                  {h.isin && (
                    <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                      {h.isin}
                    </span>
                  )}
                </td>
                <td className="text-xs text-slate-600 py-3 px-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {h.sector && (
                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-medium">
                        {h.sector}
                      </span>
                    )}
                    {quadrant && <QuadrantBadge quadrant={quadrant} />}
                  </div>
                </td>
                <td className="py-3 px-3 border-b border-slate-100 text-right">
                  <span className="text-sm font-mono tabular-nums font-semibold text-slate-800">
                    {weight != null ? `${weight.toFixed(2)}%` : '\u2014'}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">of portfolio</span>
                </td>
                <td className="py-3 px-3 border-b border-slate-100">
                  <WeightBar weight={weight} maxWeight={maxWeight} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
