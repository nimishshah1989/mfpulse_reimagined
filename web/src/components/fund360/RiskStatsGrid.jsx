import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

const METRIC_CONFIG = [
  { key: 'sharpe', label: 'Sharpe', good: 'high', greenAbove: 1.0, redBelow: 0.5 },
  { key: 'sortino', label: 'Sortino', good: 'high', greenAbove: 1.2, redBelow: 0.6 },
  { key: 'alpha', label: 'Alpha', good: 'high', greenAbove: 2.0, redBelow: 0.0 },
  { key: 'beta', label: 'Beta', good: 'low', greenBelow: 0.9, redAbove: 1.1 },
  { key: 'std_dev', label: 'Std Dev', good: 'low', greenBelow: 12, redAbove: 20 },
  { key: 'max_drawdown', label: 'Max DD', good: 'low', greenBelow: -10, redAbove: -20 },
  { key: 'treynor', label: 'Treynor', good: 'high', greenAbove: 8, redBelow: 3 },
  { key: 'info_ratio', label: 'Info Ratio', good: 'high', greenAbove: 0.5, redBelow: 0.0 },
];

const TIMEFRAMES = ['1y', '3y', '5y'];

function getCellColor(metric, value) {
  if (value === null || value === undefined) return '';

  if (metric.good === 'high') {
    if (value >= metric.greenAbove) return 'bg-emerald-50 text-emerald-700';
    if (value <= metric.redBelow) return 'bg-red-50 text-red-700';
    return 'text-slate-700';
  }

  if (metric.good === 'low') {
    if (value <= metric.greenBelow) return 'bg-emerald-50 text-emerald-700';
    if (value >= metric.redAbove) return 'bg-red-50 text-red-700';
    return 'text-slate-700';
  }

  return 'text-slate-700';
}

function getThresholdLabel(metric) {
  if (metric.good === 'high') {
    return `Good: ≥${metric.greenAbove}`;
  }
  return `Good: ≤${Math.abs(metric.greenBelow)}`;
}

export default function RiskStatsGrid({ riskStats, categoryAvgRisk }) {
  if (!riskStats) {
    return (
      <Card title="Risk Statistics">
        <SkeletonLoader />
      </Card>
    );
  }

  return (
    <Card title="Risk Statistics">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">
                Metric
              </th>
              {TIMEFRAMES.map((tf) => (
                <th
                  key={tf}
                  className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase"
                >
                  {tf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_CONFIG.map((metric) => (
              <tr key={metric.key} className="border-b border-slate-100">
                <td className="py-2 pr-4">
                  <div className="text-xs font-medium text-slate-600">{metric.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{getThresholdLabel(metric)}</div>
                </td>
                {TIMEFRAMES.map((tf) => {
                  const val = riskStats[`${metric.key}_${tf}`];
                  const color = getCellColor(metric, val);
                  return (
                    <td
                      key={tf}
                      className={`py-2 px-3 text-right text-xs font-mono tabular-nums rounded ${color}`}
                    >
                      {val === null || val === undefined
                        ? '\u2014'
                        : Number(val).toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
