import Card from '../shared/Card';
import { QUADRANT_COLORS } from '../../lib/sectors';

function EmptyState({ message }) {
  return (
    <div className="py-12 text-center text-sm text-slate-400">{message}</div>
  );
}

function QuadrantBadge({ quadrant }) {
  if (!quadrant) return null;
  const colors = QUADRANT_COLORS[quadrant];
  if (!colors) return null;
  return (
    <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full ${colors.badge}`}>
      {quadrant}
    </span>
  );
}

/**
 * HoldingsTable — top holdings with sector compass quadrant tags.
 *
 * Props:
 *   holdings        array  — holding objects { name, isin, sector, weight_pct }
 *   sectorQuadrants object — optional map of sector_name → quadrant string
 */
export default function HoldingsTable({ holdings, sectorQuadrants }) {
  if (!holdings || holdings.length === 0) {
    return (
      <Card title="Top Holdings">
        <EmptyState message="No holdings data available" />
      </Card>
    );
  }

  return (
    <Card title="Top Holdings">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px]">
          <thead>
            <tr>
              <th className="text-xs font-medium text-slate-500 py-2 px-3 text-left border-b border-slate-200 w-8">#</th>
              <th className="text-xs font-medium text-slate-500 py-2 px-3 text-left border-b border-slate-200">Name</th>
              <th className="text-xs font-medium text-slate-500 py-2 px-3 text-left border-b border-slate-200">ISIN</th>
              <th className="text-xs font-medium text-slate-500 py-2 px-3 text-left border-b border-slate-200">Sector</th>
              <th className="text-xs font-medium text-slate-500 py-2 px-3 text-right border-b border-slate-200">Weight</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const quadrant = sectorQuadrants && h.sector ? sectorQuadrants[h.sector] : null;
              return (
                <tr key={h.isin || i} className="hover:bg-slate-50 transition-colors">
                  <td className="text-xs text-slate-400 py-2 px-3 border-b border-slate-100 font-mono tabular-nums">
                    {i + 1}
                  </td>
                  <td className="text-xs py-2 px-3 border-b border-slate-100">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(h.name)}+stock`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:underline"
                    >
                      {h.name}
                    </a>
                  </td>
                  <td className="text-xs font-mono text-slate-500 py-2 px-3 border-b border-slate-100">
                    {h.isin}
                  </td>
                  <td className="text-xs text-slate-600 py-2 px-3 border-b border-slate-100">
                    <span className="inline-flex items-center">
                      {h.sector}
                      {quadrant && <QuadrantBadge quadrant={quadrant} />}
                    </span>
                  </td>
                  <td className="text-xs py-2 px-3 border-b border-slate-100">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono tabular-nums text-slate-700">
                        {h.weight_pct != null ? `${h.weight_pct.toFixed(2)}%` : '\u2014'}
                      </span>
                      {h.weight_pct != null && (
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full">
                          <div
                            className="h-1.5 bg-teal-500 rounded-full"
                            style={{ width: `${Math.min(h.weight_pct, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
