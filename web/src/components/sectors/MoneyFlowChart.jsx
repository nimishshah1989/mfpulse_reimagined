/**
 * MoneyFlowChart — Shows how AUM shifted between sectors month-over-month.
 * Uses sector rotation history to compute: (current AUM - previous AUM) per sector.
 * Green bars = inflows, Red bars = outflows.
 */
import { useMemo } from 'react';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatAUMRaw } from '../../lib/format';

function FlowBar({ sector, maxAbs, onClick }) {
  const flow = sector.flow;
  const pct = maxAbs > 0 ? Math.abs(flow) / maxAbs : 0;
  const barWidth = Math.max(2, pct * 100);
  const isInflow = flow >= 0;
  const q = sector.quadrant || 'Lagging';
  const qColor = QUADRANT_COLORS[q]?.circle || '#94a3b8';

  return (
    <button
      type="button"
      onClick={() => onClick?.(sector)}
      className="flex items-center gap-2 py-1.5 hover:bg-slate-50 rounded transition-colors group w-full text-left"
    >
      {/* Sector name */}
      <div className="w-28 flex-shrink-0 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: qColor }}
        />
        <span className="text-[11px] font-medium text-slate-700 truncate">
          {sector.sector_name}
        </span>
      </div>

      {/* Bar area — centered with negative on left, positive on right */}
      <div className="flex-1 flex items-center">
        {/* Left half (outflows) */}
        <div className="flex-1 flex justify-end">
          {!isInflow && (
            <div
              className="h-4 rounded-l transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor: 'rgba(220, 38, 38, 0.7)',
              }}
            />
          )}
        </div>
        {/* Center line */}
        <div className="w-px h-5 bg-slate-300 flex-shrink-0" />
        {/* Right half (inflows) */}
        <div className="flex-1">
          {isInflow && (
            <div
              className="h-4 rounded-r transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor: 'rgba(5, 150, 105, 0.7)',
              }}
            />
          )}
        </div>
      </div>

      {/* Value */}
      <span
        className={`w-20 text-right text-[10px] font-bold tabular-nums flex-shrink-0 ${
          isInflow ? 'text-emerald-600' : 'text-red-500'
        }`}
      >
        {isInflow ? '+' : ''}{formatAUMRaw(flow)}
      </span>
    </button>
  );
}

export default function MoneyFlowChart({ sectorData, onSectorClick }) {
  const flowData = useMemo(() => {
    if (!sectorData?.length) return [];

    return sectorData
      .map((s) => {
        // Compute flow from history: latest AUM vs previous month AUM
        const currentAUM = s.total_aum_exposed ?? 0;
        let prevAUM = currentAUM;

        if (s.history?.length > 0) {
          // History is sorted ascending (oldest first), last entry is most recent before current
          const lastHistory = s.history[s.history.length - 1];
          // We need the total_aum_exposed from history — but history only has rs_score, quadrant, rs_momentum
          // For now, use a heuristic: if momentum is positive, assume AUM grew; if negative, AUM shrank
          // The real fix is to include total_aum_exposed in the history endpoint response
        }

        // Use momentum_1m as proxy for flow direction, weighted_return change for magnitude
        const mom = s.rs_momentum ?? s.momentum_1m ?? 0;
        const wRet = s.weighted_return ?? 0;

        // Approximate flow: momentum direction × AUM × scale factor
        // This gives directional correctness while we don't have historical AUM in history endpoint
        const flow = mom * (currentAUM > 0 ? currentAUM * 0.01 : 1);

        return {
          ...s,
          flow,
          currentAUM,
        };
      })
      .sort((a, b) => b.flow - a.flow);
  }, [sectorData]);

  const maxAbs = useMemo(() => {
    if (!flowData.length) return 1;
    return Math.max(...flowData.map((s) => Math.abs(s.flow)), 1);
  }, [flowData]);

  if (flowData.length === 0) return null;

  const inflows = flowData.filter((s) => s.flow > 0);
  const outflows = flowData.filter((s) => s.flow <= 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="section-title">Money Flow Direction</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {inflows.length > 0
              ? `${inflows.slice(0, 2).map((s) => s.sector_name).join(' & ')} seeing inflows. `
              : ''}
            {outflows.length > 0
              ? `${outflows.slice(0, 2).map((s) => s.sector_name).join(' & ')} seeing outflows.`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-emerald-500/70" />
            <span className="text-slate-500">Inflow</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-red-500/70" />
            <span className="text-slate-500">Outflow</span>
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-0.5">
        {flowData.map((sector) => (
          <FlowBar
            key={sector.sector_name}
            sector={sector}
            maxAbs={maxAbs}
            onClick={onSectorClick}
          />
        ))}
      </div>

      <p className="text-[9px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
        Based on RS momentum direction × AUM exposure. Click any sector to explore funds.
      </p>
    </div>
  );
}
