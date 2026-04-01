import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import InfoIcon from '../shared/InfoIcon';

const METRIC_CONFIG = [
  { key: 'sharpe', label: 'Sharpe', good: 'high', greenAbove: 1.0, redBelow: 0.5,
    tip: 'Risk-adjusted return. Higher = better return per unit of risk taken.',
    formula: '(Return - Risk Free) / Std Dev', action: 'Above 1.0 is good. Above 1.5 is excellent.' },
  { key: 'sortino', label: 'Sortino', good: 'high', greenAbove: 1.2, redBelow: 0.6,
    tip: 'Like Sharpe but only penalizes downside volatility. Better for asymmetric returns.',
    formula: '(Return - Risk Free) / Downside Dev', action: 'Above 1.2 is good. Prefers funds that protect on the downside.' },
  { key: 'alpha', label: 'Alpha', good: 'high', greenAbove: 2.0, redBelow: 0.0,
    tip: 'Manager skill — excess return above what the benchmark delivered.',
    formula: 'Fund Return - (Beta × Benchmark Return)', action: 'Positive = manager adding value. >2% is strong.' },
  { key: 'beta', label: 'Beta', good: 'low', greenBelow: 0.9, redAbove: 1.1,
    tip: 'Market sensitivity. Beta 1.0 = moves with market. <1 = less volatile than market.',
    formula: 'Covariance(Fund, Benchmark) / Variance(Benchmark)', action: 'Lower beta = less market risk. >1.1 = amplifies market moves.' },
  { key: 'std_dev', label: 'Std Dev', good: 'low', greenBelow: 12, redAbove: 20,
    tip: 'Total volatility — how much the fund\'s returns swing around the average.',
    formula: 'Annualized standard deviation of monthly returns', action: 'Lower = smoother ride. <12% is low volatility for equity.' },
  { key: 'max_drawdown', label: 'Max DD', good: 'low', greenBelow: -10, redAbove: -20,
    tip: 'Worst peak-to-trough decline. Shows the maximum pain an investor experienced.',
    action: 'Smaller (closer to 0) = better downside protection. >-20% is concerning.' },
  { key: 'treynor', label: 'Treynor', good: 'high', greenAbove: 8, redBelow: 3,
    tip: 'Return per unit of systematic (market) risk.',
    formula: '(Return - Risk Free) / Beta', action: 'Higher = better compensation for market risk taken.' },
  { key: 'info_ratio', label: 'Info Ratio', good: 'high', greenAbove: 0.5, redBelow: 0.0,
    tip: 'Consistency of outperformance vs benchmark. Measures skill reliability.',
    formula: 'Alpha / Tracking Error', action: 'Above 0.5 = consistently beating benchmark. Above 1.0 = exceptional.' },
  { key: 'r_squared', label: 'R-Squared', good: null,
    tip: 'How closely fund tracks its benchmark. 100 = perfect correlation.',
    action: 'High R² means beta/alpha are reliable. Low R² = fund diverges from benchmark.' },
  { key: 'capture_down', label: 'Capture Down', good: 'low', greenBelow: 90, redAbove: 110,
    tip: 'How much of market decline the fund captures. Lower = better protection.',
    formula: 'Fund downside return / Benchmark downside return × 100', action: '<90% = fund falls less than market. >110% = falls more.' },
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
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-slate-600">{metric.label}</span>
                    <InfoIcon tip={metric.tip} formula={metric.formula} action={metric.action} />
                  </div>
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
