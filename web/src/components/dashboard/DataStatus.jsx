import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

function getStatusConfig(dateStr) {
  if (!dateStr) return { dot: 'bg-red-500', label: 'No data', ring: 'ring-red-200' };
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (ageDays < 1) return { dot: 'bg-emerald-500', label: 'Fresh', ring: 'ring-emerald-200' };
  if (ageDays < 3) return { dot: 'bg-amber-500', label: 'Stale', ring: 'ring-amber-200' };
  return { dot: 'bg-red-500', label: 'Very stale', ring: 'ring-red-200' };
}

function formatTimestamp(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StatusRow({ label, dateStr }) {
  const config = getStatusConfig(dateStr);
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        <div className={`w-2.5 h-2.5 rounded-full ${config.dot} ring-2 ${config.ring}`} />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400">{config.label}</span>
        <span className="text-xs font-mono tabular-nums text-slate-700">
          {formatTimestamp(dateStr)}
        </span>
      </div>
    </div>
  );
}

function ActionButton({ onClick, disabled, loading, label, loadingLabel }) {
  return (
    <button
      type="button"
      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-teal-600 text-teal-600 px-3 py-2 rounded-lg hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {loadingLabel}
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

export default function DataStatus({
  freshness,
  onRefreshNav,
  onRecomputeLens,
  refreshing,
  recomputing,
}) {
  if (!freshness) {
    return <SkeletonLoader className="h-48 rounded-xl" />;
  }

  return (
    <Card>
      <div className="divide-y divide-slate-100">
        <StatusRow label="NAV Data" dateStr={freshness.nav_last_date} />
        <StatusRow label="Lens Scores" dateStr={freshness.lens_computed_at} />
        <StatusRow label="Holdings" dateStr={freshness.holdings_last_date || freshness.risk_stats_last_date} />
      </div>

      <div className="flex gap-2 mt-4">
        <ActionButton
          onClick={onRefreshNav}
          disabled={refreshing}
          loading={refreshing}
          label="Refresh NAV"
          loadingLabel="Refreshing..."
        />
        <ActionButton
          onClick={onRecomputeLens}
          disabled={recomputing}
          loading={recomputing}
          label="Recompute Lens"
          loadingLabel="Computing..."
        />
      </div>
    </Card>
  );
}
