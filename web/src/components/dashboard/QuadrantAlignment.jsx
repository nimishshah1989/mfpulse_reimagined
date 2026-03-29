import { useState, useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';

const ZONE_COLORS = {
  leading:   '#059669',
  improving: '#0ea5e9',
  weakening: '#d97706',
  lagging:   '#ef4444',
};

const ZONE_LABELS = ['leading', 'improving', 'weakening', 'lagging'];

function tailwindColor(pct) {
  if (pct > 50) return '#059669';
  if (pct >= 45) return '#10b981';
  if (pct >= 30) return '#d97706';
  return '#ef4444';
}

function headwindStyle(pct) {
  if (pct > 60) return { color: '#ef4444', fontWeight: 700 };
  return { color: '#94a3b8' };
}

/* ──────── Stacked Bar ──────── */

function StackedBar({ row }) {
  const [hovered, setHovered] = useState(false);

  const segments = ZONE_LABELS.map((zone) => ({
    zone,
    pct: row[`${zone}_pct`] ?? 0,
    color: ZONE_COLORS[zone],
  })).filter((s) => s.pct > 0);

  return (
    <div
      className="flex h-[22px] rounded overflow-hidden cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {segments.map((s) => (
        <div
          key={s.zone}
          className="relative flex items-center justify-center transition-opacity duration-150"
          style={{ width: `${s.pct}%`, backgroundColor: s.color }}
        >
          {hovered && s.pct >= 8 && (
            <span className="text-[9px] font-bold text-white leading-none select-none">
              {Math.round(s.pct)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ──────── Insight Bar ──────── */

function InsightBar({ data }) {
  const insight = useMemo(() => {
    if (!data || data.length === 0) return null;

    const sorted = [...data];
    const topTailwind = sorted
      .sort((a, b) => (b.tailwind_pct ?? 0) - (a.tailwind_pct ?? 0))
      .slice(0, 3)
      .map((d) => d.category_name);

    const worstHeadwind = [...data]
      .sort((a, b) => (b.headwind_pct ?? 0) - (a.headwind_pct ?? 0))
      .slice(0, 2)
      .filter((d) => (d.headwind_pct ?? 0) > 40)
      .map((d) => d.category_name);

    const parts = [];
    if (topTailwind.length > 0) {
      parts.push(`Strongest tailwinds: ${topTailwind.join(', ')}`);
    }
    if (worstHeadwind.length > 0) {
      parts.push(`Headwind caution: ${worstHeadwind.join(', ')}`);
    }
    return parts.length > 0 ? parts.join('. ') + '.' : null;
  }, [data]);

  if (!insight) return null;

  return (
    <div
      className="mt-4 px-4 py-3 rounded-lg border"
      style={{
        background: 'linear-gradient(135deg, #f0fdfa, #ecfdf5)',
        borderColor: '#ccfbf1',
      }}
    >
      <p className="text-[11px] leading-relaxed" style={{ color: '#0f766e' }}>
        <span className="font-semibold">Insight:</span> {insight}
      </p>
    </div>
  );
}

/* ──────── Main Component ──────── */

export default function QuadrantAlignment({ alignmentData, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-6 w-52 rounded mb-4" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonLoader key={i} className="h-8 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!alignmentData || alignmentData.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <p className="section-title">Quadrant Alignment</p>
      <p className="text-[10px] text-slate-400 -mt-1 mb-4">
        Category positioning across sector rotation zones
      </p>

      {/* Column headers */}
      <div
        className="grid items-center pb-2 mb-1 border-b border-slate-100"
        style={{ gridTemplateColumns: '140px 1fr 60px 60px' }}
      >
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">
          Category
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">
          Zone Distribution
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium text-right">
          Tailwind
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium text-right">
          Headwind
        </span>
      </div>

      {/* Data rows */}
      <div className="space-y-0.5">
        {alignmentData.map((row) => {
          const tw = row.tailwind_pct ?? 0;
          const hw = row.headwind_pct ?? 0;

          return (
            <div
              key={row.category_name}
              className="grid items-center py-2 px-1 rounded-md hover:bg-slate-50 transition-colors"
              style={{ gridTemplateColumns: '140px 1fr 60px 60px' }}
            >
              {/* Category name + fund count */}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {row.category_name}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {row.fund_count} funds
                </p>
              </div>

              {/* Stacked bar */}
              <div className="px-2">
                <StackedBar row={row} />
              </div>

              {/* Tailwind % */}
              <p
                className="text-xs font-bold text-right font-mono tabular-nums"
                style={{ color: tailwindColor(tw) }}
              >
                {Math.round(tw)}%
              </p>

              {/* Headwind % */}
              <p
                className="text-xs text-right font-mono tabular-nums"
                style={headwindStyle(hw)}
              >
                {Math.round(hw)}%
              </p>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
        {ZONE_LABELS.map((zone) => (
          <div key={zone} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: ZONE_COLORS[zone] }}
            />
            <span className="text-[10px] text-slate-500 capitalize">{zone}</span>
          </div>
        ))}
      </div>

      {/* Insight bar */}
      <InsightBar data={alignmentData} />
    </div>
  );
}
