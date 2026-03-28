import { useState } from 'react';
import Card from '../shared/Card';
import EmptyState from '../shared/EmptyState';
import { MORNINGSTAR_SECTORS } from '../../lib/sectors';

/** Diverging green-white-red color scale based on quadrant */
function quadrantBgColor(quadrant) {
  switch (quadrant) {
    case 'Leading': return '#dcfce7';
    case 'Improving': return '#d5f5f6';
    case 'Weakening': return '#fef3c7';
    case 'Lagging': return '#fee2e2';
    default: return '#f1f5f9';
  }
}

function quadrantTextColor(quadrant) {
  switch (quadrant) {
    case 'Leading': return '#166534';
    case 'Improving': return '#115e59';
    case 'Weakening': return '#92400e';
    case 'Lagging': return '#991b1b';
    default: return '#94a3b8';
  }
}

function quadrantFullBgColor(quadrant) {
  switch (quadrant) {
    case 'Leading': return '#059669';
    case 'Improving': return '#0d9488';
    case 'Weakening': return '#d97706';
    case 'Lagging': return '#dc2626';
    default: return '#f1f5f9';
  }
}

function getMonthLabel(monthsAgo, currentMonth) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = currentMonth ? new Date(currentMonth) : new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return months[d.getMonth()];
}

/**
 * 12-month sector rotation heatmap with clickable cells and hover tooltips.
 *
 * Props:
 *   sectorData — array of sector objects with optional .history array
 *   currentMonth — ISO date string for the current month (defaults to today)
 *   online — whether MarketPulse is reachable
 *   onSectorClick — callback(sectorName) when a sector row/cell is clicked
 */
export default function RotationHeatmap({ sectorData, currentMonth, online, onSectorClick }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  if (!online || !sectorData || sectorData.length === 0) {
    return (
      <Card title="Sector Rotation Heatmap">
        <EmptyState message="Sector heatmap requires MarketPulse data" />
      </Card>
    );
  }

  const NUM_MONTHS = 12;

  // Build quadrant + RS score map per sector per month
  const sectorDataMap = {};
  for (const sector of sectorData) {
    const arr = new Array(NUM_MONTHS).fill(null);
    if (sector.quadrant) {
      arr[NUM_MONTHS - 1] = {
        quadrant: sector.quadrant,
        rs_score: sector.rs_score,
        rs_rank: sector.rs_rank,
        rs_momentum: sector.rs_momentum,
      };
    }
    if (Array.isArray(sector.history)) {
      for (let i = 0; i < sector.history.length && i < NUM_MONTHS - 1; i++) {
        const histEntry = sector.history[i];
        const monthIndex = NUM_MONTHS - 2 - i;
        if (histEntry?.quadrant) {
          arr[monthIndex] = {
            quadrant: histEntry.quadrant,
            rs_score: histEntry.rs_score,
            rs_rank: histEntry.rs_rank,
            rs_momentum: histEntry.rs_momentum,
          };
        }
      }
    }
    sectorDataMap[sector.sector_name] = arr;
  }

  const columnLabels = Array.from({ length: NUM_MONTHS }, (_, i) =>
    getMonthLabel(NUM_MONTHS - 1 - i, currentMonth)
  );

  return (
    <Card title="Sector Rotation Heatmap">
      <div className="overflow-x-auto relative">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 pl-1 text-slate-500 font-medium whitespace-nowrap w-36 sticky left-0 bg-white z-10">
                Sector
              </th>
              {columnLabels.map((label, i) => (
                <th
                  key={i}
                  className={`text-center py-2 px-1 font-medium w-12 ${
                    i === NUM_MONTHS - 1 ? 'text-teal-700 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {label}
                  {i === NUM_MONTHS - 1 && (
                    <span className="block text-[9px] font-normal text-teal-500">Now</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MORNINGSTAR_SECTORS.map((sectorName) => {
              const months = sectorDataMap[sectorName] || new Array(NUM_MONTHS).fill(null);

              return (
                <tr
                  key={sectorName}
                  className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td
                    className="py-1.5 pr-3 pl-1 text-slate-700 font-medium whitespace-nowrap sticky left-0 bg-white z-10 cursor-pointer hover:text-teal-700 transition-colors"
                    onClick={() => onSectorClick?.(sectorName)}
                  >
                    {sectorName}
                  </td>
                  {months.map((data, i) => {
                    const isCurrentMonth = i === NUM_MONTHS - 1;
                    const quadrant = data?.quadrant || null;
                    const bgColor = quadrant ? quadrantBgColor(quadrant) : '#f8fafc';
                    const textColor = quadrant ? quadrantTextColor(quadrant) : '#94a3b8';
                    const isHovered = hoveredCell?.sector === sectorName && hoveredCell?.month === i;

                    return (
                      <td
                        key={i}
                        className={`py-1.5 px-1 text-center relative ${
                          isCurrentMonth ? 'ring-2 ring-teal-400 ring-inset rounded' : ''
                        }`}
                        onMouseEnter={() => setHoveredCell({ sector: sectorName, month: i, data })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => onSectorClick?.(sectorName)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span
                          className={`inline-flex items-center justify-center rounded text-[9px] font-semibold transition-transform ${
                            isHovered ? 'scale-110 shadow-sm' : ''
                          }`}
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            width: 32,
                            height: 22,
                            border: isHovered ? `1.5px solid ${quadrantFullBgColor(quadrant)}` : '1px solid transparent',
                          }}
                        >
                          {quadrant ? quadrant.slice(0, 2) : '\u2014'}
                        </span>

                        {/* Hover tooltip */}
                        {isHovered && data && (
                          <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                            <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-xs whitespace-nowrap">
                              <p className="font-semibold text-slate-800">{sectorName}</p>
                              <p className="text-slate-600">{columnLabels[i]}</p>
                              <div className="mt-1 space-y-0.5">
                                <p className="font-mono tabular-nums">
                                  Quadrant: <span style={{ color: quadrantFullBgColor(data.quadrant) }} className="font-semibold">{data.quadrant}</span>
                                </p>
                                {data.rs_score != null && (
                                  <p className="font-mono tabular-nums">RS Score: {data.rs_score}</p>
                                )}
                                {data.rs_rank != null && (
                                  <p className="font-mono tabular-nums">Rank: #{data.rs_rank}</p>
                                )}
                                {data.rs_momentum != null && (
                                  <p className="font-mono tabular-nums">
                                    Momentum: {data.rs_momentum > 0 ? '+' : ''}{Number(data.rs_momentum).toFixed(1)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100">
          {[
            { label: 'Leading', quadrant: 'Leading' },
            { label: 'Improving', quadrant: 'Improving' },
            { label: 'Weakening', quadrant: 'Weakening' },
            { label: 'Lagging', quadrant: 'Lagging' },
          ].map(({ label, quadrant }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded"
                style={{
                  backgroundColor: quadrantBgColor(quadrant),
                  border: `1px solid ${quadrantFullBgColor(quadrant)}`,
                  width: 14,
                  height: 14,
                }}
              />
              <span className="text-xs text-slate-600 font-medium">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded"
              style={{ backgroundColor: '#f8fafc', width: 14, height: 14, border: '1px solid #cbd5e1' }}
            />
            <span className="text-xs text-slate-500">No data</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
