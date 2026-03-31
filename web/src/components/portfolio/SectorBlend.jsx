import SectionTitle from '../shared/SectionTitle';

const SECTOR_COLORS = [
  '#0d9488', '#059669', '#10b981', '#14b8a6', '#2dd4bf',
  '#d97706', '#f59e0b', '#fbbf24', '#6366f1', '#8b5cf6',
  '#94a3b8',
];

export default function SectorBlend({ sectors }) {
  if (!sectors?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Blended Sector Exposure</SectionTitle>
        <p className="text-sm text-slate-400">No sector data available.</p>
      </div>
    );
  }

  const sorted = [...sectors].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const maxWeight = Math.max(...sorted.map((s) => s.weight ?? 0), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Weighted-average sector allocation across all portfolio holdings">
        Blended Sector Exposure
      </SectionTitle>
      <div className="space-y-2">
        {sorted.map((sector, i) => {
          const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
          const pct = ((sector.weight ?? 0) / maxWeight) * 100;
          return (
            <div key={sector.name || i} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-32 truncate flex-shrink-0">
                {sector.name || '\u2014'}
              </span>
              <div className="flex-1 h-5 bg-slate-50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-600 w-12 text-right flex-shrink-0">
                {sector.weight != null ? `${sector.weight.toFixed(1)}%` : '\u2014'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
