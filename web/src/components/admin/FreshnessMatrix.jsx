import InfoIcon from '../shared/InfoIcon';
import { formatCount } from '../../lib/format';

const DOMAINS = [
  { domain: 'NAV & Returns', table: 'nav_daily', expected: 'Daily', threshold: { amber: 1, red: 3 } },
  { domain: 'Fund Master', table: 'fund_master', expected: 'Weekly', threshold: { amber: 8, red: 14 } },
  { domain: 'Risk Statistics', table: 'risk_stats_monthly', expected: 'Monthly', threshold: { amber: 35, red: 60 } },
  { domain: 'Rankings', table: 'rank_monthly', expected: 'Monthly', threshold: { amber: 35, red: 60 } },
  { domain: 'Holdings', table: 'fund_holdings_snapshot', expected: 'Monthly', threshold: { amber: 35, red: 60 } },
  { domain: 'Category Returns', table: 'category_returns_daily', expected: 'Daily', threshold: { amber: 1, red: 3 } },
  { domain: 'Lens Scores', table: 'fund_lens_scores', expected: 'Post-ingestion', threshold: { amber: 35, red: 60 } },
];

function getStatus(lastUpdated, thresholds) {
  if (!lastUpdated) return 'unknown';
  const now = new Date();
  const updated = new Date(lastUpdated);
  const daysDiff = (now - updated) / (1000 * 60 * 60 * 24);
  if (daysDiff > thresholds.red) return 'critical';
  if (daysDiff > thresholds.amber) return 'stale';
  return 'fresh';
}

const STATUS_STYLES = {
  fresh: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'FRESH' },
  stale: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', label: 'STALE' },
  critical: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'CRITICAL' },
  unknown: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-500', label: 'UNKNOWN' },
};

export default function FreshnessMatrix({ freshness }) {
  const freshnessMap = {};
  if (Array.isArray(freshness)) {
    for (const item of freshness) {
      freshnessMap[item.table || item.domain] = item;
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Data Freshness Matrix</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Real-time status of each data domain</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
        {DOMAINS.map((d) => {
          const data = freshnessMap[d.table] || {};
          const status = data.last_updated
            ? getStatus(data.last_updated, d.threshold)
            : 'unknown';
          const styles = STATUS_STYLES[status];

          return (
            <div
              key={d.domain}
              className={`rounded-lg border p-3 ${styles.bg} border-slate-200/50`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-slate-700">{d.domain}</span>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                  <span className={`text-[9px] font-bold ${styles.text}`}>{styles.label}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Expected</span>
                  <span className="text-slate-600 font-medium">{d.expected}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Last Updated</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {data.last_updated || '\u2014'}
                  </span>
                </div>
                {data.record_count != null && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Records</span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {formatCount(data.record_count)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
