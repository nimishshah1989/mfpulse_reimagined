import InfoIcon from '../shared/InfoIcon';

function StatCard({ label, value, format, sublabel, sublabelColor, catAvg, catFormat }) {
  const displayVal = value != null ? format(value) : '\u2014';
  const isPositive = typeof displayVal === 'string' && displayVal.startsWith('+');
  const isNegative = typeof displayVal === 'string' && (displayVal.startsWith('-') || displayVal.startsWith('\u2212'));

  let valueColor = 'text-slate-800';
  if (sublabelColor) {
    // Use parent-determined color
  } else if (isPositive) {
    valueColor = 'text-emerald-600';
  } else if (isNegative && label.includes('Drawdown')) {
    valueColor = 'text-red-600';
  }

  return (
    <div className="bg-gradient-to-br from-teal-50/30 to-slate-50 rounded-xl p-3">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-lg font-bold font-mono tabular-nums ${valueColor}`}>{displayVal}</p>
      {catAvg != null && (
        <p className="text-[9px] text-slate-400 font-mono tabular-nums">Cat: {(catFormat || format)(catAvg)}</p>
      )}
      {sublabel && (
        <p className={`text-[10px] ${sublabelColor || 'text-slate-500'}`}>{sublabel}</p>
      )}
    </div>
  );
}

const fmtNum = (v) => Number(v).toFixed(2);
const fmtPct = (v) => `${Number(v).toFixed(2)}%`;
const fmtPct1 = (v) => `${Number(v).toFixed(1)}%`;
const fmtPct0 = (v) => `${Number(v).toFixed(0)}%`;

/**
 * RiskProfile -- 6-column grid of risk stats matching mockup design.
 *
 * Props:
 *   riskStats object
 */
export default function RiskProfile({ riskStats }) {
  if (!riskStats) {
    return (
      <div className="py-16 text-center">
        <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-slate-400">No risk data available</p>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Std Dev (3Y)',
      value: riskStats.std_dev_3y ?? riskStats.std_dev,
      format: fmtPct,
    },
    {
      label: 'Beta (3Y)',
      value: riskStats.beta_3y ?? riskStats.beta,
      format: fmtNum,
      sublabel: (riskStats.beta_3y ?? riskStats.beta) != null ? (Number(riskStats.beta_3y ?? riskStats.beta) < 1 ? 'Below market' : 'Above market') : null,
      sublabelColor: (riskStats.beta_3y ?? riskStats.beta) != null ? (Number(riskStats.beta_3y ?? riskStats.beta) < 1 ? 'text-emerald-600' : 'text-amber-600') : '',
    },
    {
      label: 'Alpha (3Y)',
      value: riskStats.alpha_3y ?? riskStats.alpha,
      format: (v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`,
      sublabel: 'Manager skill',
    },
    {
      label: 'Sharpe (3Y)',
      value: riskStats.sharpe_3y ?? riskStats.sharpe_ratio,
      format: fmtNum,
    },
    {
      label: 'Sortino (3Y)',
      value: riskStats.sortino_3y ?? riskStats.sortino,
      format: fmtNum,
      catAvg: riskStats.cat_sortino_3y,
      sublabel: 'Downside adjusted',
    },
    {
      label: 'Info Ratio',
      value: riskStats.info_ratio_3y ?? riskStats.info_ratio,
      format: fmtNum,
      catAvg: riskStats.cat_info_ratio_3y,
    },
    {
      label: 'Capture Up',
      value: riskStats.capture_up_3y ?? riskStats.upside_capture_3y ?? riskStats.upside_capture,
      format: fmtPct0,
      catAvg: riskStats.cat_capture_up_3y,
    },
    {
      label: 'Capture Down',
      value: riskStats.capture_down_3y ?? riskStats.downside_capture_3y ?? riskStats.downside_capture,
      format: fmtPct0,
      catAvg: riskStats.cat_capture_down_3y,
      sublabelColor: (riskStats.capture_down_3y ?? riskStats.downside_capture_3y ?? riskStats.downside_capture) != null && Number(riskStats.capture_down_3y ?? riskStats.downside_capture_3y ?? riskStats.downside_capture) < 90 ? 'text-emerald-600' : 'text-amber-600',
      sublabel: (riskStats.capture_down_3y ?? riskStats.downside_capture_3y ?? riskStats.downside_capture) != null ? (Number(riskStats.capture_down_3y ?? riskStats.downside_capture_3y ?? riskStats.downside_capture) < 90 ? 'Falls less' : null) : null,
    },
    {
      label: 'R-Squared (3Y)',
      value: riskStats.r_squared_3y ?? riskStats.r_squared,
      format: (v) => `${(Number(v) * (Number(v) > 1 ? 1 : 100)).toFixed(1)}%`,
    },
    {
      label: 'Skewness (3Y)',
      value: riskStats.skewness_3y ?? riskStats.skewness,
      format: (v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}`,
      catAvg: riskStats.cat_skewness_3y,
      sublabel: riskStats.skewness_3y != null || riskStats.skewness != null
        ? (Number(riskStats.skewness_3y ?? riskStats.skewness) >= 0 ? 'Positive skew' : 'Negative skew')
        : null,
      sublabelColor: (riskStats.skewness_3y ?? riskStats.skewness) != null && Number(riskStats.skewness_3y ?? riskStats.skewness) >= 0 ? 'text-emerald-600' : 'text-amber-600',
    },
    {
      label: 'Tracking Error',
      value: riskStats.tracking_error_3y ?? riskStats.tracking_error,
      format: fmtPct,
      catAvg: riskStats.cat_tracking_error_3y,
      sublabel: 'Active deviation',
    },
    {
      label: 'Max Drawdown (3Y)',
      value: riskStats.max_drawdown_3y ?? riskStats.max_drawdown,
      format: fmtPct1,
      sublabel: 'Worst peak-to-trough',
      sublabelColor: 'text-red-500',
    },
    {
      label: 'Kurtosis (3Y)',
      value: riskStats.kurtosis_3y ?? riskStats.kurtosis,
      format: fmtNum,
      catAvg: riskStats.cat_kurtosis_3y,
      sublabel: 'Tail risk',
    },
    {
      label: 'Mean Return (3Y)',
      value: riskStats.mean_3y ?? riskStats.mean_return_3y ?? riskStats.mean_return,
      format: fmtPct,
      sublabel: 'Monthly average',
    },
  ];

  const validMetrics = metrics.filter((m) => m.value != null);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {validMetrics.map((m) => (
        <StatCard
          key={m.label}
          label={m.label}
          value={m.value}
          format={m.format}
          sublabel={m.sublabel}
          sublabelColor={m.sublabelColor}
          catAvg={m.catAvg}
          catFormat={m.catFormat}
        />
      ))}
    </div>
  );
}
