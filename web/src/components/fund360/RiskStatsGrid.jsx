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
  { key: 'r_squared', label: 'R-Squared', good: null },
  { key: 'capture_down', label: 'Capture Down', good: 'low', greenBelow: 90, redAbove: 110 },
];

const TIMEFRAMES = ['1y', '3y', '5y'];

/** Map metric key to its cat_* equivalent in riskStats */
function getCatKey(metricKey, timeframe) {
  return `cat_${metricKey}_${timeframe}`;
}

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
  if (!metric.good) return '';
  if (metric.good === 'high') {
    return `Good: \u2265${metric.greenAbove}`;
  }
  return `Good: \u2264${Math.abs(metric.greenBelow)}`;
}

/**
 * Interpretive label for a metric value.
 * Returns { text, color } or null.
 */
function getInterpretation(metricKey, value) {
  if (value === null || value === undefined) return null;
  const v = Number(value);

  switch (metricKey) {
    case 'beta':
      if (v < 1) return { text: 'Below market', color: 'text-emerald-600' };
      return { text: 'Above market', color: 'text-amber-600' };

    case 'alpha':
      if (v > 0) return { text: 'Manager skill', color: 'text-emerald-600' };
      return { text: 'Underperforming', color: 'text-red-500' };

    case 'capture_down':
      if (v < 100) return { text: 'Falls less', color: 'text-emerald-600' };
      return { text: 'Falls more', color: 'text-red-500' };

    case 'sharpe':
      if (v > 1) return { text: 'Excellent', color: 'text-emerald-600' };
      if (v > 0.5) return { text: 'Good', color: 'text-teal-600' };
      return { text: 'Poor', color: 'text-red-500' };

    case 'sortino':
      if (v > 1.5) return { text: 'Excellent', color: 'text-emerald-600' };
      if (v > 0.8) return { text: 'Good', color: 'text-teal-600' };
      return { text: 'Weak', color: 'text-amber-600' };

    case 'r_squared':
      if (v < 85 || (v < 0.85 && v <= 1)) return { text: 'Active stock pick', color: 'text-teal-600' };
      return { text: 'Index-like', color: 'text-slate-500' };

    case 'info_ratio':
      if (v > 0.5) return { text: 'Top decile', color: 'text-emerald-600' };
      if (v > 0) return { text: 'Positive', color: 'text-teal-600' };
      return { text: 'Negative', color: 'text-red-500' };

    default:
      return null;
  }
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
                  {getThresholdLabel(metric) && (
                    <div className="text-[10px] text-slate-400 mt-0.5">{getThresholdLabel(metric)}</div>
                  )}
                </td>
                {TIMEFRAMES.map((tf) => {
                  const val = riskStats[`${metric.key}_${tf}`];
                  const catKey = getCatKey(metric.key, tf);
                  const catVal = riskStats[catKey] ?? categoryAvgRisk?.[catKey];
                  const color = getCellColor(metric, val);
                  const interp = getInterpretation(metric.key, val);
                  return (
                    <td
                      key={tf}
                      className={`py-2 px-3 text-right rounded ${color}`}
                    >
                      <div className="text-xs font-mono tabular-nums font-semibold">
                        {val === null || val === undefined
                          ? '\u2014'
                          : Number(val).toFixed(2)}
                      </div>
                      {catVal != null && (
                        <div className="text-[9px] text-slate-400 font-mono tabular-nums mt-0.5">
                          Cat: {Number(catVal).toFixed(2)}
                        </div>
                      )}
                      {interp && (
                        <div className={`text-[9px] font-semibold mt-0.5 ${interp.color}`}>
                          {interp.text}
                        </div>
                      )}
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
