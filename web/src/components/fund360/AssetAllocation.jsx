import { useState, useEffect } from 'react';
import { fetchAssetAllocation } from '../../lib/api';

const ASSET_CLASSES = [
  { key: 'equity_net', label: 'Equity', color: '#0d9488', textColor: 'text-teal-700' },
  { key: 'bond_net', label: 'Bond', color: '#60a5fa', textColor: 'text-blue-600' },
  { key: 'cash_net', label: 'Cash', color: '#fbbf24', textColor: 'text-amber-600' },
  { key: 'other_net', label: 'Other', color: '#94a3b8', textColor: 'text-slate-600' },
];

/**
 * AssetAllocation -- stacked bar + legend + cap size, matching mockup.
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
        <div className="h-4 bg-slate-100 rounded-full" />
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

  const segments = ASSET_CLASSES
    .map((a) => ({ ...a, value: Number(data[a.key]) || 0 }))
    .filter((a) => a.value > 0);

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-4 flex rounded-full overflow-hidden">
        {segments.map((seg) => {
          const width = total > 0 ? (seg.value / total) * 100 : 0;
          return (
            <div
              key={seg.key}
              className="h-full"
              style={{ width: `${width}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${seg.value.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-between text-[10px]">
        {segments.map((seg) => (
          <span key={seg.key} className={`font-semibold ${seg.textColor}`}>
            {seg.label} {seg.value.toFixed(1)}%
          </span>
        ))}
      </div>

      {/* Market cap split if equity heavy */}
      {data.india_large_cap_pct != null || data.india_mid_cap_pct != null || data.india_small_cap_pct != null ? (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 mb-2">Market Cap Split</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {data.india_large_cap_pct != null && (
              <div>
                <span className="text-slate-400">Large:</span>{' '}
                <span className="font-semibold font-mono tabular-nums">{Number(data.india_large_cap_pct).toFixed(1)}%</span>
              </div>
            )}
            {data.india_mid_cap_pct != null && (
              <div>
                <span className="text-slate-400">Mid:</span>{' '}
                <span className="font-semibold font-mono tabular-nums">{Number(data.india_mid_cap_pct).toFixed(1)}%</span>
              </div>
            )}
            {data.india_small_cap_pct != null && (
              <div>
                <span className="text-slate-400">Small:</span>{' '}
                <span className="font-semibold font-mono tabular-nums">{Number(data.india_small_cap_pct).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
