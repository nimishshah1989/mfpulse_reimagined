import { useState, useMemo } from 'react';
import EmptyState from '../shared/EmptyState';
import SectionTitle from '../shared/SectionTitle';

const QUADRANT_CELL = {
  Leading: {
    bg: 'bg-emerald-100',
    bgStrong: 'bg-emerald-200',
    text: 'text-emerald-700',
    textStrong: 'text-emerald-800',
    ring: 'ring-emerald-400',
    abbr: 'LED',
  },
  Improving: {
    bg: 'bg-sky-100',
    bgStrong: 'bg-sky-200',
    text: 'text-sky-700',
    textStrong: 'text-sky-800',
    ring: 'ring-sky-400',
    abbr: 'IMP',
  },
  Weakening: {
    bg: 'bg-amber-100',
    bgStrong: 'bg-amber-200',
    text: 'text-amber-700',
    textStrong: 'text-amber-800',
    ring: 'ring-amber-400',
    abbr: 'WKN',
  },
  Lagging: {
    bg: 'bg-red-100',
    bgStrong: 'bg-red-200',
    text: 'text-red-600',
    textStrong: 'text-red-800',
    ring: 'ring-red-400',
    abbr: 'LAG',
  },
};

function getMonthLabel(monthsAgo, currentMonth) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const now = currentMonth ? new Date(currentMonth) : new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return months[d.getMonth()];
}

function deriveTrend(months) {
  if (!months || months.length < 2) return null;
  const last = months[months.length - 1]?.quadrant;
  const prev = months[months.length - 2]?.quadrant;
  if (!last || !prev) return null;

  const rank = { Leading: 4, Improving: 3, Weakening: 2, Lagging: 1 };
  const diff = (rank[last] || 0) - (rank[prev] || 0);

  if (last === 'Leading' && prev === 'Improving')
    return { icon: '\u2191\u2191', text: 'Strong momentum', color: 'text-emerald-600' };
  if (last === 'Leading' && prev === 'Leading')
    return { icon: '\u2191', text: 'Holding strong', color: 'text-emerald-600' };
  if (last === 'Improving')
    return { icon: '\u2197', text: 'Breakout forming', color: 'text-sky-600' };
  if (last === 'Weakening' && diff < 0)
    return { icon: '\u2198', text: 'Losing momentum', color: 'text-amber-600' };
  if (last === 'Lagging' && prev === 'Lagging')
    return { icon: '\u2193', text: 'Persistent weakness', color: 'text-red-500' };
  if (last === 'Lagging')
    return { icon: '\u2193', text: 'Full cycle down', color: 'text-red-500' };
  if (diff > 0)
    return { icon: '\u2191', text: 'Improving', color: 'text-emerald-600' };
  if (diff < 0)
    return { icon: '\u2193', text: 'Declining', color: 'text-red-500' };
  return { icon: '\u2192', text: 'Stable', color: 'text-slate-500' };
}

export default function RotationHeatmap({
  sectorData,
  currentMonth,
  online,
  onSectorClick,
}) {
  const [hoveredCell, setHoveredCell] = useState(null);
  const NUM_MONTHS = 6;

  const sectorNames = useMemo(() => {
    if (!sectorData?.length) return [];
    return sectorData
      .map((s) => s.sector_name || s.display_name || s.name)
      .filter(Boolean);
  }, [sectorData]);

  if (!online || !sectorData || sectorData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in">
        <SectionTitle
          tip="Track how sectors move through quadrants over time"
        >
          Sector Rotation Heatmap — Quadrant History
        </SectionTitle>
        <EmptyState message="Sector heatmap requires MarketPulse data" />
      </div>
    );
  }

  // Build data map
  const sectorDataMap = {};
  for (const sector of sectorData) {
    const arr = new Array(NUM_MONTHS).fill(null);
    if (sector.quadrant) {
      arr[NUM_MONTHS - 1] = {
        quadrant: sector.quadrant,
        rs_score: sector.rs_score,
        rs_momentum: sector.rs_momentum,
      };
    }
    if (Array.isArray(sector.history)) {
      for (let i = 0; i < sector.history.length && i < NUM_MONTHS - 1; i++) {
        const h = sector.history[i];
        const idx = NUM_MONTHS - 2 - i;
        if (h?.quadrant) {
          arr[idx] = {
            quadrant: h.quadrant,
            rs_score: h.rs_score,
            rs_momentum: h.rs_momentum,
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
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-title">
            Sector Rotation Heatmap — Quadrant History
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Track how sectors move through quadrants over time
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9px] text-slate-400 uppercase tracking-wider">
              <th className="text-left pb-2 pr-4 font-medium w-32">Sector</th>
              {columnLabels.map((label, i) => (
                <th
                  key={i}
                  className={`text-center pb-2 font-medium w-16 ${
                    i === NUM_MONTHS - 1
                      ? 'text-teal-700 font-semibold border-r-2 border-teal-200'
                      : ''
                  }`}
                >
                  {label}
                  {i === NUM_MONTHS - 1 && (
                    <span className="block text-[8px] font-normal text-teal-500">
                      Now
                    </span>
                  )}
                </th>
              ))}
              <th className="text-left pb-2 pl-3 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sectorNames.map((sectorName) => {
              const months =
                sectorDataMap[sectorName] ||
                new Array(NUM_MONTHS).fill(null);
              const trend = deriveTrend(months);

              return (
                <tr key={sectorName}>
                  <td
                    className="py-2 pr-4 font-medium text-slate-700 cursor-pointer hover:text-teal-700 transition-colors"
                    onClick={() => onSectorClick?.(sectorName)}
                  >
                    {sectorName}
                  </td>
                  {months.map((data, i) => {
                    const isNow = i === NUM_MONTHS - 1;
                    const q = data?.quadrant || null;
                    const style = q ? QUADRANT_CELL[q] : null;

                    return (
                      <td
                        key={i}
                        className={`py-2 text-center ${
                          isNow ? 'border-r-2 border-teal-200' : ''
                        }`}
                        onMouseEnter={() =>
                          setHoveredCell({ sector: sectorName, month: i, data })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => onSectorClick?.(sectorName)}
                      >
                        {style ? (
                          <span
                            className={`inline-block w-8 h-6 rounded leading-6 text-[10px] font-semibold cursor-pointer transition-transform hover:scale-105 ${
                              isNow
                                ? `${style.bgStrong} ${style.textStrong} font-bold ring-2 ${style.ring}`
                                : `${style.bg} ${style.text}`
                            }`}
                          >
                            {style.abbr}
                          </span>
                        ) : (
                          <span className="inline-block w-8 h-6 rounded bg-slate-50 text-slate-300 leading-6 text-[10px]">
                            &mdash;
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3">
                    {trend ? (
                      <span className={`${trend.color} font-semibold`}>
                        {trend.icon} {trend.text}
                      </span>
                    ) : (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100">
        {Object.entries(QUADRANT_CELL).map(([name, style]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span
              className={`inline-block w-7 h-4 rounded ${style.bg} text-[8px] ${style.text} text-center leading-4 font-bold`}
            >
              {style.abbr}
            </span>
            <span className="text-[10px] text-slate-500">{name}</span>
          </div>
        ))}
        <span className="text-[10px] text-slate-400 ml-auto">
          Ideal rotation: LAG &rarr; IMP &rarr; LED &rarr; WKN (clockwise)
        </span>
      </div>
    </div>
  );
}
