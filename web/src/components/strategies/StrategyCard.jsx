import { formatINR, formatPct } from '../../lib/format';
import Badge from '../shared/Badge';

const MODE_LABELS = {
  sip_topups: 'SIP + Top-ups',
  lumpsum_events: 'Lumpsum',
  custom: 'Custom',
};

const TIER_ORDER = ['LEADER', 'ALPHA_MACHINE', 'FORTRESS', 'ROCK_SOLID', 'LOW_RISK', 'LEAN'];
const TIER_DISPLAY = {
  LEADER: { label: 'Leader', cls: 'bg-emerald-100 text-emerald-700' },
  STRONG: { label: 'Strong', cls: 'bg-teal-100 text-teal-700' },
  ALPHA_MACHINE: { label: 'Alpha', cls: 'bg-emerald-100 text-emerald-700' },
  FORTRESS: { label: 'Fortress', cls: 'bg-emerald-100 text-emerald-700' },
  ROCK_SOLID: { label: 'Rock Solid', cls: 'bg-emerald-100 text-emerald-700' },
  LOW_RISK: { label: 'Low Risk', cls: 'bg-emerald-100 text-emerald-700' },
  LEAN: { label: 'Lean', cls: 'bg-emerald-100 text-emerald-700' },
};

function getTierComposition(funds) {
  if (!funds || funds.length === 0) return [];
  const counts = {};
  const classKeys = ['return_class', 'alpha_class', 'resilience_class', 'consistency_class', 'risk_class', 'efficiency_class'];
  for (const fund of funds) {
    for (const key of classKeys) {
      const tier = fund[key];
      if (tier && TIER_DISPLAY[tier]) {
        counts[tier] = (counts[tier] || 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tier, count]) => ({ tier, count, ...TIER_DISPLAY[tier] }));
}

export default function StrategyCard({
  strategy,
  modeIcon,
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
  const totalAlloc = s.funds?.reduce((sum, f) => sum + (s.allocations?.[f.mstar_id] || f.allocation || 0), 0) || 0;
  const tierComp = getTierComposition(s.funds);

  return (
    <div className={`bg-white rounded-xl border transition-all hover:shadow-md ${
      selected ? 'border-teal-500 ring-2 ring-teal-100' : 'border-slate-200'
    }`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {compareMode && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelect(s.id)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 flex-shrink-0"
              />
            )}
            {modeIcon && (
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                {modeIcon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{s.name}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {MODE_LABELS[s.mode] || s.mode}
                {s.period && ` / ${s.period}`}
              </p>
            </div>
          </div>
          <Badge variant="status">
            {s.status === 'ACTIVE' ? 'active' : 'warning'}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <span className="font-mono tabular-nums">{fundCount} fund{fundCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span className="font-mono tabular-nums">{condCount} rule{condCount !== 1 ? 's' : ''}</span>
          </div>
          {totalAlloc > 0 && (
            <div className="flex items-center gap-1">
              <span className={`font-mono tabular-nums ${Math.abs(totalAlloc - 100) < 0.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {totalAlloc.toFixed(0)}% alloc
              </span>
            </div>
          )}
          {s.sip_amount && (
            <span className="font-mono tabular-nums">{formatINR(s.sip_amount, 0)}/mo</span>
          )}
        </div>

        {/* Key metrics */}
        {metrics.xirr_pct != null && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2.5 bg-slate-50 rounded-lg">
              <p className="text-[10px] text-slate-500 font-medium">XIRR</p>
              <p className="text-sm font-bold font-mono tabular-nums mt-0.5"
                 style={{ color: (metrics.xirr_pct || 0) >= 0 ? '#059669' : '#dc2626' }}>
                {formatPct(metrics.xirr_pct)}
              </p>
            </div>
            <div className="text-center p-2.5 bg-slate-50 rounded-lg">
              <p className="text-[10px] text-slate-500 font-medium">Value</p>
              <p className="text-sm font-bold font-mono tabular-nums text-slate-800 mt-0.5">
                {formatINR(metrics.final_value, 0)}
              </p>
            </div>
            <div className="text-center p-2.5 bg-slate-50 rounded-lg">
              <p className="text-[10px] text-slate-500 font-medium">Drawdown</p>
              <p className="text-sm font-bold font-mono tabular-nums text-red-600 mt-0.5">
                {metrics.max_drawdown_pct != null ? formatPct(metrics.max_drawdown_pct) : '--'}
              </p>
            </div>
          </div>
        )}

        {/* Tier composition badges */}
        {tierComp.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tierComp.map(({ tier, count, label, cls }) => (
              <span key={tier} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${cls}`}>
                {label}
                <span className="font-mono tabular-nums">{count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onEdit(s.id)}
            className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(s)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5A1.125 1.125 0 014 20.625V7.125C4 6.504 4.504 6 5.125 6H8.25m7.5 0v3.375c0 .621.504 1.125 1.125 1.125H20.25M15.75 6V3.375c0-.621-.504-1.125-1.125-1.125h-9.5C4.504 2.25 4 2.754 4 3.375v3.375" />
            </svg>
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => onToggleExpand(s.id)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
            {expanded ? 'Collapse' : 'Details'}
          </button>
          {s.portfolio_id && (
            <a
              href={`/portfolio/${s.portfolio_id}`}
              className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Portfolio
            </a>
          )}
          {!compareMode && (
            <button
              type="button"
              onClick={() => onCompare(s.id)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50 transition-colors ml-auto"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Compare
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
