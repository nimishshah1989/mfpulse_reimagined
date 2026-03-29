import Link from 'next/link';
import SkeletonLoader from '../shared/SkeletonLoader';

const TIERS = [
  { key: 'LEADER', label: 'Leaders', color: '#059669' },
  { key: 'STRONG', label: 'Strong', color: '#10b981' },
  { key: 'AVERAGE', label: 'Average', color: '#d97706' },
  { key: 'WEAK', label: 'Weak', color: '#ef4444' },
];

function countTiers(universe) {
  const counts = { LEADER: 0, STRONG: 0, AVERAGE: 0, WEAK: 0 };
  if (!Array.isArray(universe)) return counts;
  for (const fund of universe) {
    const cls = fund.return_class;
    if (cls in counts) counts[cls] += 1;
  }
  return counts;
}

export default function UniverseSnapshotStrip({ universe, loading }) {
  if (loading) {
    return <SkeletonLoader className="h-24 rounded-xl" />;
  }

  const counts = countTiers(universe);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
          Universe Snapshot
        </h2>
        <Link
          href="/universe"
          className="text-[11px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          Explore Universe &rarr;
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex items-center gap-6">
          {/* Big number */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-[22px] font-bold font-mono tabular-nums text-[#0f172a]">
              {total}
            </span>
            <span className="text-xs font-normal text-[#94a3b8]">scored</span>
          </div>

          {/* Tier counts */}
          <div className="flex items-center gap-6 shrink-0">
            {TIERS.map(({ key, label, color }) => (
              <div key={key} className="flex flex-col items-center">
                <span
                  className="text-base font-bold font-mono tabular-nums"
                  style={{ color }}
                >
                  {counts[key]}
                </span>
                <span className="text-[10px] text-[#64748b]">{label}</span>
              </div>
            ))}
          </div>

          {/* Stacked bar */}
          <div className="flex-1 flex rounded-[5px] overflow-hidden h-2.5">
            {total > 0 &&
              TIERS.map(({ key, color }) => {
                const pct = (counts[key] / total) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={key}
                    className="h-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
}
