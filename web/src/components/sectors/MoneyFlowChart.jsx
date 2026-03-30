/**
 * MoneyFlowChart — Real AUM change between sector rotation snapshots.
 *
 * Calculation: For each sector, computes (current_AUM - previous_snapshot_AUM).
 * This is REAL money movement — not a proxy or estimate.
 *
 * If no previous snapshot exists, falls back to directional estimate
 * (momentum direction × AUM × small factor) and labels it clearly.
 *
 * Lookback: 1 month (latest snapshot vs prior snapshot).
 */
import { useMemo } from 'react';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatAUMRaw } from '../../lib/format';
import InfoBulb from '../shared/InfoBulb';

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
      <div className="w-28 flex-shrink-0 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: qColor }} />
        <span className="text-[11px] font-medium text-slate-700 truncate">{sector.sector_name}</span>
      </div>
      <div className="flex-1 flex items-center">
        <div className="flex-1 flex justify-end">
          {!isInflow && (
            <div className="h-4 rounded-l transition-all"
              style={{ width: `${barWidth}%`, backgroundColor: 'rgba(220, 38, 38, 0.7)' }}
            />
          )}
        </div>
        <div className="w-px h-5 bg-slate-300 flex-shrink-0" />
        <div className="flex-1">
          {isInflow && (
            <div className="h-4 rounded-r transition-all"
              style={{ width: `${barWidth}%`, backgroundColor: 'rgba(5, 150, 105, 0.7)' }}
            />
          )}
        </div>
      </div>
      <span className={`w-20 text-right text-[10px] font-bold tabular-nums flex-shrink-0 ${isInflow ? 'text-emerald-600' : 'text-red-500'}`}>
        {isInflow ? '+' : ''}{formatAUMRaw(flow)}
      </span>
    </button>
  );
}

export default function MoneyFlowChart({ sectorData, onSectorClick }) {
  const { flowData, method, dateRange } = useMemo(() => {
    if (!sectorData?.length) return { flowData: [], method: 'none', dateRange: '' };

    // Try real AUM delta: current total_aum_exposed vs last history entry's AUM
    let hasRealDelta = false;
    const computed = sectorData.map((s) => {
      const currentAUM = s.total_aum_exposed ?? 0;
      let prevAUM = null;
      let prevDate = null;

      // History is sorted ascending (oldest first)
      // Each history entry has: rs_score, rs_momentum, quadrant, snapshot_date
      // AND total_aum_exposed + weighted_return (from _row_to_dict)
      if (s.history?.length > 0) {
        const lastH = s.history[s.history.length - 1];
        if (lastH.total_aum_exposed != null && lastH.total_aum_exposed > 0) {
          prevAUM = lastH.total_aum_exposed;
          prevDate = lastH.snapshot_date;
          hasRealDelta = true;
        }
      }

      let flow;
      if (prevAUM != null && currentAUM > 0) {
        // Real delta
        flow = currentAUM - prevAUM;
      } else {
        // Fallback: momentum-weighted estimate
        const mom = s.rs_momentum ?? s.momentum_1m ?? 0;
        flow = mom * (currentAUM > 0 ? currentAUM * 0.005 : 1);
      }

      return { ...s, flow, currentAUM, prevAUM, prevDate };
    });

    const sorted = computed.sort((a, b) => b.flow - a.flow);

    // Determine date range label
    const dates = computed.filter((s) => s.prevDate).map((s) => s.prevDate);
    const prevDateLabel = dates.length > 0
      ? dates[0]
      : null;
    const currentDate = sectorData[0]?.snapshot_date || 'latest';
    const range = prevDateLabel ? `${prevDateLabel} → ${currentDate}` : currentDate;

    return {
      flowData: sorted,
      method: hasRealDelta ? 'real' : 'estimated',
      dateRange: range,
    };
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
          <FlowBar key={sector.sector_name} sector={sector} maxAbs={maxAbs} onClick={onSectorClick} />
        ))}
      </div>

      {/* Methodology note */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[9px] text-slate-400">
          {method === 'real'
            ? `AUM change: ${dateRange}`
            : `Estimated from momentum direction (${dateRange})`
          }
        </span>
        {method !== 'real' && (
          <span className="text-[9px] text-amber-500 font-medium">
            ≈ Directional estimate — insufficient history for exact delta
          </span>
        )}
      </div>

      <InfoBulb title="Money Flow" items={[
        { icon: '💰', label: 'Calculation', text: method === 'real'
          ? `Real AUM change between snapshots: (current sector AUM) minus (previous snapshot AUM). Period: ${dateRange}. Sector AUM = sum of (fund_AUM × sector_exposure%) across all funds.`
          : 'Estimated: momentum direction × current AUM × scale factor. This is directional only — more history snapshots needed for precise calculation.'
        },
        { icon: '📊', label: 'How to read', text: 'Green bars (right) = net AUM increase in that sector. Red bars (left) = net AUM decrease. Longer bar = larger absolute change.' },
        { icon: '🎯', label: 'Insight', text: 'Money flowing INTO Leading sectors confirms the rotation signal. Money leaving Lagging sectors shows consensus. Divergence (money flowing into Lagging) may signal contrarian opportunities.' },
        { icon: '⏱️', label: 'Lookback', text: '1 snapshot period (~1 month). Based on the last two sector rotation computation dates.' },
      ]} />
    </div>
  );
}
