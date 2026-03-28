function HeroMetric({ label, value, sublabel, format, interpretation, icon, categoryAvg, comparisonText }) {
  const displayVal = value != null ? format(value) : '\u2014';

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-1.5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-mono tabular-nums font-bold text-slate-800">{displayVal}</span>
      {categoryAvg != null && (
        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
          Category avg: {format(categoryAvg)}
        </span>
      )}
      {comparisonText && (
        <span className={`text-[10px] font-semibold ${comparisonText.color}`}>
          {comparisonText.text}
        </span>
      )}
      {interpretation && !comparisonText && (
        <span className={`text-[10px] font-medium ${interpretation.color}`}>
          {interpretation.text}
        </span>
      )}
      {sublabel && (
        <span className="text-[10px] text-slate-400">{sublabel}</span>
      )}
    </div>
  );
}

const fmtNum = (v) => Number(v).toFixed(2);
const fmtPct = (v) => `${Number(v).toFixed(2)}%`;

function sharpeInterpretation(val) {
  if (val == null) return null;
  const n = Number(val);
  if (n >= 1.5) return { text: 'Excellent risk-adjusted returns', color: 'text-emerald-600' };
  if (n >= 1.0) return { text: 'Good risk-adjusted returns', color: 'text-emerald-600' };
  if (n >= 0.5) return { text: 'Adequate risk-adjusted returns', color: 'text-amber-600' };
  return { text: 'Poor risk-adjusted returns', color: 'text-red-600' };
}

function buildComparison(fundVal, catVal, metric, isLowerBetter) {
  if (fundVal == null || catVal == null || Number(catVal) === 0) return null;
  const f = Number(fundVal);
  const c = Number(catVal);
  const diff = Math.abs(((f - c) / Math.abs(c)) * 100).toFixed(0);

  if (metric === 'maxdd') {
    // Max drawdown: less negative is better
    const isBetter = f > c; // e.g. -12% > -18% means less damage
    return {
      text: isBetter ? `${diff}% less damage than category` : `${diff}% more damage than category`,
      color: isBetter ? 'text-emerald-600' : 'text-red-600',
    };
  }
  if (metric === 'downside_capture') {
    const isBetter = f < c;
    return {
      text: `Captures ${f.toFixed(0)}% of falls`,
      color: isBetter ? 'text-emerald-600' : 'text-amber-600',
    };
  }
  if (isLowerBetter) {
    const isBetter = f < c;
    return {
      text: isBetter ? `${diff}% better than category` : `${diff}% worse than category`,
      color: isBetter ? 'text-emerald-600' : 'text-red-600',
    };
  }
  const isBetter = f > c;
  return {
    text: isBetter ? `${diff}% better risk-adj returns` : `${diff}% below category`,
    color: isBetter ? 'text-emerald-600' : 'text-red-600',
  };
}

function buildNarrative(riskStats) {
  const parts = [];
  const upCap = Number(riskStats.upside_capture_3y || riskStats.upside_capture) || null;
  const downCap = Number(riskStats.downside_capture_3y || riskStats.downside_capture) || null;
  const sharpe = Number(riskStats.sharpe_3y || riskStats.sharpe_ratio) || null;
  const maxDD = Number(riskStats.max_drawdown_3y || riskStats.max_drawdown) || null;

  if (upCap && downCap) {
    if (upCap > downCap + 5) {
      parts.push(
        `Asymmetric profile: captures ${upCap.toFixed(0)}% of upside but only ${downCap.toFixed(0)}% of downside, indicating strong risk management.`
      );
    } else if (downCap > upCap + 5) {
      parts.push(
        `Skewed risk profile: captures ${downCap.toFixed(0)}% of downside but only ${upCap.toFixed(0)}% of upside.`
      );
    }
  }
  if (sharpe && sharpe >= 1.0) {
    parts.push(`Sharpe ratio of ${sharpe.toFixed(2)} indicates efficient compensation for risk taken.`);
  }
  if (maxDD && maxDD > -10) {
    parts.push(`Shallow max drawdown suggests resilience during market corrections.`);
  } else if (maxDD && maxDD < -25) {
    parts.push(`Deep max drawdown of ${maxDD.toFixed(1)}% warrants caution for risk-averse investors.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * RiskProfile -- 3 hero metric cards with category comparison + compact secondary metrics + narrative.
 *
 * Props:
 *   riskStats      object -- { sharpe_1y, sharpe_3y, max_drawdown, downside_capture_3y, ... }
 *   categoryStats  object -- category average risk stats for comparison (optional)
 */
export default function RiskProfile({ riskStats, categoryStats }) {
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

  const catStats = categoryStats || {};

  // Primary hero metrics
  const maxDD = riskStats.max_drawdown_3y ?? riskStats.max_drawdown ?? null;
  const sharpe3y = riskStats.sharpe_3y ?? riskStats.sharpe_ratio;
  const downCap = riskStats.downside_capture_3y ?? riskStats.downside_capture ?? null;

  const catMaxDD = catStats.max_drawdown_3y ?? catStats.max_drawdown ?? null;
  const catSharpe = catStats.sharpe_3y ?? catStats.sharpe_ratio ?? null;
  const catDownCap = catStats.downside_capture_3y ?? catStats.downside_capture ?? null;

  // Secondary metrics
  const stdDev3y = riskStats.std_dev_3y ?? riskStats.std_dev ?? null;
  const beta3y = riskStats.beta_3y ?? riskStats.beta ?? null;
  const sortino3y = riskStats.sortino_3y ?? riskStats.sortino ?? null;
  const upCap = riskStats.upside_capture_3y ?? riskStats.upside_capture ?? null;
  const alpha3y = riskStats.alpha_3y ?? riskStats.alpha ?? null;

  const narrative = buildNarrative(riskStats);

  const secondaryMetrics = [
    { label: 'Std Dev (3Y)', value: stdDev3y, fmt: fmtPct },
    { label: 'Beta (3Y)', value: beta3y, fmt: fmtNum },
    { label: 'Alpha (3Y)', value: alpha3y, fmt: fmtNum },
    { label: 'Sortino (3Y)', value: sortino3y, fmt: fmtNum },
    { label: 'Upside Capture', value: upCap, fmt: (v) => `${Number(v).toFixed(0)}%` },
  ];

  return (
    <div className="space-y-4">
      {/* Hero metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HeroMetric
          label="Max Drawdown"
          value={maxDD}
          format={(v) => `${Number(v).toFixed(1)}%`}
          categoryAvg={catMaxDD}
          comparisonText={buildComparison(maxDD, catMaxDD, 'maxdd')}
          icon={
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          }
        />
        <HeroMetric
          label="Sharpe Ratio (3Y)"
          value={sharpe3y}
          format={fmtNum}
          categoryAvg={catSharpe}
          comparisonText={buildComparison(sharpe3y, catSharpe, 'sharpe')}
          interpretation={sharpeInterpretation(sharpe3y)}
          icon={
            <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <HeroMetric
          label="Downside Capture"
          value={downCap}
          format={(v) => `${Number(v).toFixed(0)}%`}
          categoryAvg={catDownCap}
          comparisonText={buildComparison(downCap, catDownCap, 'downside_capture', true)}
          icon={
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
          }
        />
      </div>

      {/* Secondary metrics -- compact single row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-slate-50 rounded-lg px-4 py-2.5">
        {secondaryMetrics.map(({ label, value, fmt }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-medium">{label}</span>
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
              {value != null ? fmt(value) : '\u2014'}
            </span>
          </div>
        ))}
      </div>

      {/* Narrative insight */}
      {narrative && (
        <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2.5">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-[11px] text-blue-700 font-medium leading-relaxed">{narrative}</p>
        </div>
      )}
    </div>
  );
}
