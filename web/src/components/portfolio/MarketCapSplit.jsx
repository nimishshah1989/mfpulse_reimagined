import SectionTitle from '../shared/SectionTitle';

const CAP_CONFIG = [
  { key: 'large', label: 'Large', color: '#0d9488' },
  { key: 'mid', label: 'Mid', color: '#2dd4bf' },
  { key: 'small', label: 'Small', color: '#d97706' },
  { key: 'micro', label: 'Micro', color: '#94a3b8' },
];

export default function MarketCapSplit({ data }) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Market Cap Allocation</SectionTitle>
        <p className="text-sm text-slate-400">No market cap data available.</p>
      </div>
    );
  }

  const segments = CAP_CONFIG.map((cfg) => ({
    ...cfg,
    value: data[cfg.key] ?? 0,
  })).filter((s) => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Blended market capitalization split across portfolio holdings">
        Market Cap Allocation
      </SectionTitle>

      {total === 0 ? (
        <p className="text-sm text-slate-400">No allocation data.</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-8 rounded-lg overflow-hidden mb-3">
            {segments.map((seg) => {
              const widthPct = (seg.value / total) * 100;
              return (
                <div
                  key={seg.key}
                  className="flex items-center justify-center transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: seg.color,
                    minWidth: widthPct > 3 ? undefined : '2px',
                  }}
                >
                  {widthPct >= 10 && (
                    <span className="text-white text-[10px] font-bold font-mono tabular-nums">
                      {seg.value.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            {segments.map((seg) => (
              <div key={seg.key} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-[11px] text-slate-500">
                  {seg.label}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-700 font-medium">
                  {seg.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
