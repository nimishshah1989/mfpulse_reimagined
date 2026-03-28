import { formatINR, formatPct } from '../../lib/format';
import { lensColor } from '../../lib/lens';
import Badge from '../shared/Badge';

export default function StrategyCard({
  strategy,
  expanded,
  onToggleExpand,
  onEdit,
  onDuplicate,
  onCompare,
  compareMode,
  selected,
  onSelect,
}) {
  const s = strategy;
  const metrics = s.latest_backtest || s.metrics || {};
  const fundCount = s.funds?.length || s.fund_count || 0;
  const condCount = s.rules?.length || s.condition_count || 0;

  return (
    <div className={`bg-white rounded-xl border transition-all ${
      selected ? 'border-teal-500 ring-2 ring-teal-100' : 'border-slate-200'
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {compareMode && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelect(s.id)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
            )}
            <h3 className="text-sm font-semibold text-slate-800 truncate">{s.name}</h3>
          </div>
          <Badge variant="status">
            {s.status === 'ACTIVE' ? 'active' : 'warning'}
          </Badge>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
          <span>{fundCount} fund{fundCount !== 1 ? 's' : ''}</span>
          <span className="text-slate-300">|</span>
          <span>{condCount} condition{condCount !== 1 ? 's' : ''}</span>
          {s.sip_amount && (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-mono tabular-nums">{formatINR(s.sip_amount, 0)}/mo</span>
            </>
          )}
          {s.period && (
            <>
              <span className="text-slate-300">|</span>
              <span>{s.period}</span>
            </>
          )}
        </div>

        {/* Key metrics */}
        {metrics.xirr_pct != null && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-slate-50 rounded-lg">
              <p className="text-[10px] text-slate-500">XIRR</p>
              <p className="text-sm font-bold font-mono tabular-nums"
                 style={{ color: lensColor(Math.min(100, Math.max(0, (metrics.xirr_pct || 0) * 4))) }}>
                {formatPct(metrics.xirr_pct)}
              </p>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded-lg">
              <p className="text-[10px] text-slate-500">Value</p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-800">
                {formatINR(metrics.final_value, 0)}
              </p>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded-lg">
              <p className="text-[10px] text-slate-500">Invested</p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-500">
                {formatINR(metrics.total_invested, 0)}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleExpand(s.id)}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(s.id)}
            className="text-xs text-slate-600 hover:text-slate-800"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(s)}
            className="text-xs text-slate-600 hover:text-slate-800"
          >
            Duplicate
          </button>
          {!compareMode && (
            <button
              type="button"
              onClick={() => onCompare(s.id)}
              className="text-xs text-slate-600 hover:text-slate-800"
            >
              Compare
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
