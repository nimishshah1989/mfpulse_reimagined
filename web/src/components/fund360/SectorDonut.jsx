import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../shared/Card';
import { formatPct } from '../../lib/format';

const SECTOR_COLORS = [
  '#0d9488', '#f59e0b', '#7c3aed', '#ef4444', '#3b82f6',
  '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

function EmptyState({ message }) {
  return (
    <div className="py-12 text-center text-sm text-slate-400">{message}</div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { sector_name, allocation_pct } = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2">
      <p className="text-xs font-medium text-slate-700">{sector_name}</p>
      <p className="text-xs font-mono tabular-nums text-teal-600">{formatPct(allocation_pct)}</p>
    </div>
  );
}

export default function SectorDonut({ sectors }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!sectors || sectors.length === 0) {
    return null;
  }

  return (
    <Card title="Sector Allocation">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-[280px] h-[280px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sectors}
                dataKey="allocation_pct"
                nameKey="sector_name"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={1}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {sectors.map((_, i) => (
                  <Cell
                    key={i}
                    fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.4}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          {sectors.map((s, i) => (
            <div
              key={s.sector_name}
              className="flex items-center gap-2 text-xs cursor-default"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
              />
              <span className="text-slate-600 truncate">{s.sector_name}</span>
              <span className="font-mono tabular-nums text-slate-700 ml-auto pl-2">
                {formatPct(s.allocation_pct)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
