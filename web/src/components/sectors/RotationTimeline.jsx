import Card from '../shared/Card';
import { MORNINGSTAR_SECTORS, QUADRANT_COLORS } from '../../lib/sectors';

export default function RotationTimeline({ currentSectorData, online }) {
  if (!online || !currentSectorData || currentSectorData.length === 0) {
    return null;
  }

  const quadrantMap = {};
  for (const item of currentSectorData) {
    quadrantMap[item.sector_name] = item.quadrant;
  }

  return (
    <Card title="Sector Rotation Timeline">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Sector
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Current Quadrant
              </th>
            </tr>
          </thead>
          <tbody>
            {MORNINGSTAR_SECTORS.map((sectorName) => {
              const quadrant = quadrantMap[sectorName];
              const colors = quadrant ? QUADRANT_COLORS[quadrant] : null;

              return (
                <tr key={sectorName} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-700">{sectorName}</td>
                  <td className="py-2 px-3">
                    {quadrant && colors ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}
                      >
                        {quadrant}
                      </span>
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Placeholder for historical timeline */}
      <div className="mt-4 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
        <p className="text-slate-400 text-sm">
          24-month historical rotation timeline coming soon
        </p>
      </div>
    </Card>
  );
}
