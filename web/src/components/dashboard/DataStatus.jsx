import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatCount } from '../../lib/format';

function getStatusColor(dateStr) {
  if (!dateStr) return 'bg-red-500';
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (ageDays < 1) return 'bg-emerald-500';
  if (ageDays < 7) return 'bg-amber-500';
  return 'bg-red-500';
}

function StatusRow({ color, label, value }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`w-2 h-2 rounded-full inline-block ${color}`} />
      <span className="text-xs text-slate-600 flex-1">{label}</span>
      <span className="text-xs font-mono tabular-nums text-slate-900">
        {value || '—'}
      </span>
    </div>
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

  const rows = [
    { label: 'NAV', value: freshness.nav_last_date, color: getStatusColor(freshness.nav_last_date) },
    { label: 'Risk Stats', value: freshness.risk_stats_last_date, color: getStatusColor(freshness.risk_stats_last_date) },
    { label: 'Lens Computed', value: freshness.lens_computed_at, color: getStatusColor(freshness.lens_computed_at) },
    { label: 'Total Funds', value: formatCount(freshness.fund_count), color: 'bg-emerald-500' },
  ];

  return (
    <Card title="Data Status">
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <StatusRow key={row.label} color={row.color} label={row.label} value={row.value} />
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          className="text-xs border border-teal-600 text-teal-600 px-3 py-1.5 rounded hover:bg-teal-50 disabled:opacity-50"
          onClick={onRefreshNav}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
        <button
          className="text-xs border border-teal-600 text-teal-600 px-3 py-1.5 rounded hover:bg-teal-50 disabled:opacity-50"
          onClick={onRecomputeLens}
          disabled={recomputing}
        >
          {recomputing ? 'Recomputing...' : 'Recompute Lens'}
        </button>
      </div>
    </Card>
  );
}
