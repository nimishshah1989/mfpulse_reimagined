import Card from '../shared/Card';
import EmptyState from '../shared/EmptyState';
import { MORNINGSTAR_SECTORS, QUADRANT_COLORS } from '../../lib/sectors';

const QUADRANT_CELL_COLORS = {
  Leading: '#059669',
  Improving: '#0d9488',
  Weakening: '#d97706',
  Lagging: '#dc2626',
};

const QUADRANT_TEXT_COLORS = {
  Leading: '#fff',
  Improving: '#fff',
  Weakening: '#fff',
  Lagging: '#fff',
};

function getMonthLabel(monthsAgo, currentMonth) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = currentMonth ? new Date(currentMonth) : new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return months[d.getMonth()];
}

/**
 * 12-month sector rotation heatmap.
 *
 * Props:
 *   sectorData — array of sector objects with optional .history array
 *   currentMonth — ISO date string for the current month (defaults to today)
 *   online — whether MarketPulse is reachable
 */
export default function RotationHeatmap({ sectorData, currentMonth, online }) {
  if (!online || !sectorData || sectorData.length === 0) {
    return (
      <Card title="Sector Rotation Heatmap">
        <EmptyState message="Sector heatmap requires MarketPulse data" />
      </Card>
    );
  }

  // Build a map: sectorName → [quadrant for 11 months ago, ..., quadrant for current month]
  // Index 0 = 11 months ago, index 11 = current month
  const NUM_MONTHS = 12;

  const sectorQuadrantMap = {};
  for (const sector of sectorData) {
    const arr = new Array(NUM_MONTHS).fill(null);
    // Current month
    if (sector.quadrant) {
      arr[NUM_MONTHS - 1] = sector.quadrant;
    }
    // Historical months — history[0] is previous month, history[1] is 2 months ago, etc.
    if (Array.isArray(sector.history)) {
      for (let i = 0; i < sector.history.length && i < NUM_MONTHS - 1; i++) {
        const histEntry = sector.history[i];
        const monthIndex = NUM_MONTHS - 2 - i; // months ago: 1, 2, ...
        if (histEntry?.quadrant) {
          arr[monthIndex] = histEntry.quadrant;
        }
      }
    }
    sectorQuadrantMap[sector.sector_name] = arr;
  }

  // Column headers: 11 months ago → current month
  const columnLabels = Array.from({ length: NUM_MONTHS }, (_, i) =>
    getMonthLabel(NUM_MONTHS - 1 - i, currentMonth)
  );

  return (
    <Card title="Sector Rotation Heatmap">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 pl-1 text-slate-500 font-medium whitespace-nowrap w-36">
                Sector
              </th>
              {columnLabels.map((label, i) => (
                <th
                  key={i}
                  className={`text-center py-2 px-1 font-medium w-10 ${
                    i === NUM_MONTHS - 1 ? 'text-teal-700 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MORNINGSTAR_SECTORS.map((sectorName) => {
              const months = sectorQuadrantMap[sectorName] || new Array(NUM_MONTHS).fill(null);

              return (
                <tr key={sectorName} className="border-t border-slate-50">
                  <td className="py-1.5 pr-3 pl-1 text-slate-700 font-medium whitespace-nowrap">
                    {sectorName}
                  </td>
                  {months.map((quadrant, i) => {
                    const isCurrentMonth = i === NUM_MONTHS - 1;
                    const bgColor = quadrant ? QUADRANT_CELL_COLORS[quadrant] : '#f1f5f9';
                    const textColor = quadrant ? QUADRANT_TEXT_COLORS[quadrant] : '#94a3b8';

                    return (
                      <td
                        key={i}
                        className={`py-1.5 px-1 text-center ${
                          isCurrentMonth ? 'ring-2 ring-teal-400 ring-inset rounded' : ''
                        }`}
                      >
                        <span
                          className="inline-flex items-center justify-center rounded text-[9px] font-medium"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            width: 28,
                            height: 20,
                          }}
                        >
                          {quadrant ? quadrant.slice(0, 2) : ''}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
          {Object.entries(QUADRANT_CELL_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded"
                style={{ backgroundColor: color, width: 12, height: 12 }}
              />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded"
              style={{ backgroundColor: '#f1f5f9', width: 12, height: 12, border: '1px solid #cbd5e1' }}
            />
            <span className="text-xs text-slate-500">No data</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
