import { useState, useEffect } from 'react';
import { fetchAssetAllocation } from '../../lib/api';

const ASSET_CLASSES = [
  { key: 'equity_net', label: 'Equity', color: '#0d9488' },
  { key: 'bond_net', label: 'Bond', color: '#0284c7' },
  { key: 'cash_net', label: 'Cash', color: '#d97706' },
  { key: 'other_net', label: 'Other', color: '#64748b' },
];

const CAP_SEGMENTS = [
  { key: 'india_large_cap_pct', label: 'Large Cap', color: '#0d9488' },
  { key: 'india_mid_cap_pct', label: 'Mid Cap', color: '#14b8a6' },
  { key: 'india_small_cap_pct', label: 'Small Cap', color: '#5eead4' },
];

function StackedBar({ segments, height = 'h-8' }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <div className={`w-full ${height} rounded-xl overflow-hidden flex bg-slate-100 shadow-inner`}>
      {segments.map((seg) => {
        const width = (seg.value / total) * 100;
        if (width < 0.5) return null;
        return (
          <div
            key={seg.key}
            className="h-full relative group transition-all duration-200 hover:brightness-110"
            style={{ width: `${width}%`, backgroundColor: seg.color }}
            title={`${seg.label}: ${seg.value.toFixed(1)}%`}
          >
            {width > 12 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white truncate px-1 drop-shadow-sm">
                {width > 22 ? `${seg.label} ${seg.value.toFixed(0)}%` : `${seg.value.toFixed(0)}%`}
              </span>
            )}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {seg.label}: {seg.value.toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * AssetAllocation -- shows equity/bond/cash/other split + cap-size split.
 *
 * Props:
 *   mstarId string
 */
export default function AssetAllocation({ mstarId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    setLoading(true);
    fetchAssetAllocation(mstarId)
      .then((res) => {
        if (!cancelled) setData(res?.data || res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mstarId]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl" />
        <div className="h-4 bg-slate-100 rounded w-2/3" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-slate-400">No asset allocation data available</p>
      </div>
    );
  }

  const assetSegments = ASSET_CLASSES
    .map((a) => ({ ...a, value: Number(data[a.key]) || 0 }))
    .filter((a) => a.value > 0);

  const capSegments = CAP_SEGMENTS
    .map((c) => ({ ...c, value: Number(data[c.key]) || 0 }))
    .filter((c) => c.value > 0);

  const hasCapData = capSegments.some((c) => c.value > 0);

  return (
    <div className="space-y-5">
      {/* Asset class bar */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Asset Mix</p>
        <StackedBar segments={assetSegments} height="h-10" />
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {assetSegments.map((seg) => (
            <div key={seg.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="text-[11px] text-slate-600 font-medium">{seg.label}</span>
              <span className="text-[11px] font-mono tabular-nums font-bold text-slate-700">
                {seg.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Market cap bar (for equity funds) */}
      {hasCapData && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Market Cap Split</p>
          <StackedBar segments={capSegments} height="h-8" />
          <div className="flex flex-wrap gap-4 mt-3">
            {capSegments.map((seg) => (
              <div key={seg.key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                <span className="text-[11px] text-slate-600 font-medium">{seg.label}</span>
                <span className="text-[11px] font-mono tabular-nums font-bold text-slate-700">
                  {seg.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
