import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
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

function StackedBar({ row, onSegmentClick }) {
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
          className="relative flex items-center justify-center transition-opacity duration-150 cursor-pointer hover:brightness-110"
          style={{ width: `${s.pct}%`, backgroundColor: s.color }}
          onClick={() => onSegmentClick && onSegmentClick(row.category_name, s.zone)}
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

/* ──────── Drill-Down Panel ──────── */

function DrillDownPanel({ category, zone, universe, onFundClick, onClose }) {
  const zoneColor = ZONE_COLORS[zone] || '#94a3b8';

  const funds = useMemo(() => {
    if (!universe || !universe.length) return [];
    return universe
      .filter(f => f.category_name === category)
      .sort((a, b) => (b.aum || 0) - (a.aum || 0))
      .slice(0, 10);
  }, [universe, category]);

  return (
    <div className="mt-2 mb-2 bg-slate-50 border border-slate-200 rounded-lg p-3 animate-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: zoneColor }} />
          <span className="text-xs font-semibold text-slate-700">{category}</span>
          <span className="text-[10px] text-slate-400 capitalize">· {zone} zone</span>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
      </div>
      {funds.length === 0 ? (
        <p className="text-[10px] text-slate-400 py-2">No fund data available for this category.</p>
      ) : (
        <div className="space-y-1">
          {funds.map(f => (
            <div
              key={f.mstar_id}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white cursor-pointer transition-colors"
              onClick={() => onFundClick && onFundClick(f.mstar_id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-700 truncate">{f.fund_name}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className={`text-[10px] font-semibold tabular-nums ${f.return_1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {f.return_1y != null ? `${f.return_1y >= 0 ? '+' : ''}${Number(f.return_1y).toFixed(1)}%` : '--'}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums" style={{ width: 50, textAlign: 'right' }}>
                  {f.aum ? `${(Number(f.aum) / 1e7).toFixed(0)} Cr` : '--'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────── Main Component ──────── */

export default function QuadrantAlignment({ alignmentData, universe, onFundClick, loading }) {
  const [drillDown, setDrillDown] = useState(null);
  const router = useRouter();

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
                <StackedBar row={row} onSegmentClick={(cat, zone) => setDrillDown({ category: cat, zone })} />
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

      {/* Drill-down panel */}
      {drillDown && (
        <DrillDownPanel
          category={drillDown.category}
          zone={drillDown.zone}
          universe={universe}
          onFundClick={onFundClick}
          onClose={() => setDrillDown(null)}
        />
      )}

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
