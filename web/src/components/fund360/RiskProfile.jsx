function HeroMetric({ label, value, sublabel, format, interpretation, icon }) {
  const displayVal = value != null ? format(value) : '\u2014';

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-3xl font-mono tabular-nums font-bold text-slate-800">{displayVal}</span>
      {interpretation && (
        <span className={`text-[11px] font-medium ${interpretation.color}`}>
          {interpretation.text}
        </span>
      )}
      {sublabel && (
        <span className="text-[10px] text-slate-400">{sublabel}</span>
      )}
    </div>
  );
}

function DetailRow({ label, values, format, isLowerBetter }) {
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
      <td className="text-xs text-slate-600 py-2.5 pr-4 font-medium">{label}</td>
      {values.map((val, idx) => {
        const display = val != null ? format(val) : '\u2014';
        return (
          <td key={idx} className="text-xs font-mono tabular-nums font-semibold text-slate-700 py-2.5 text-right px-3">
            {display}
          </td>
        );
      })}
    </tr>
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

function alphaInterpretation(val) {
  if (val == null) return null;
  const n = Number(val);
  if (n > 2) return { text: 'Strong manager outperformance', color: 'text-emerald-600' };
  if (n > 0) return { text: 'Positive alpha -- manager adding value', color: 'text-emerald-600' };
  if (n === 0) return { text: 'Neutral -- matching benchmark', color: 'text-slate-500' };
  return { text: 'Negative alpha -- underperforming benchmark', color: 'text-red-600' };
}

function betaInterpretation(val) {
  if (val == null) return null;
  const n = Number(val);
  if (n < 0.8) return { text: 'Defensive -- less volatile than market', color: 'text-emerald-600' };
  if (n <= 1.1) return { text: 'Market-aligned volatility', color: 'text-slate-500' };
  return { text: 'Aggressive -- more volatile than market', color: 'text-amber-600' };
}

/**
 * RiskProfile -- 3 hero metric cards + full multi-period stats table.
 *
 * Props:
 *   riskStats object -- { sharpe_1y, sharpe_3y, sharpe_5y, alpha_3y, alpha_5y, beta_3y, etc. }
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

  // Use 3Y as primary hero metrics (most reliable)
  const sharpe3y = riskStats.sharpe_3y ?? riskStats.sharpe_ratio;
  const alpha3y = riskStats.alpha_3y ?? riskStats.alpha;
  const beta3y = riskStats.beta_3y ?? riskStats.beta;

  return (
    <div className="space-y-6">
      {/* Hero metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HeroMetric
          label="Sharpe Ratio (3Y)"
          value={sharpe3y}
          format={fmtNum}
          interpretation={sharpeInterpretation(sharpe3y)}
          icon={
            <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <HeroMetric
          label="Alpha (3Y)"
          value={alpha3y}
          format={fmtNum}
          interpretation={alphaInterpretation(alpha3y)}
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <HeroMetric
          label="Beta (3Y)"
          value={beta3y}
          format={fmtNum}
          interpretation={betaInterpretation(beta3y)}
          icon={
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
          }
        />
      </div>

      {/* Full stats table across periods */}
      <div className="bg-slate-50 rounded-xl p-5">
        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
          All Risk Metrics
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-[10px] font-semibold text-slate-400 uppercase py-2 text-left">Metric</th>
                <th className="text-[10px] font-semibold text-slate-400 uppercase py-2 text-right px-3">1Y</th>
                <th className="text-[10px] font-semibold text-slate-400 uppercase py-2 text-right px-3">3Y</th>
                <th className="text-[10px] font-semibold text-slate-400 uppercase py-2 text-right px-3">5Y</th>
              </tr>
            </thead>
            <tbody>
              <DetailRow label="Sharpe Ratio" values={[riskStats.sharpe_1y, sharpe3y, riskStats.sharpe_5y]} format={fmtNum} />
              <DetailRow label="Std Deviation" values={[riskStats.std_dev_1y, riskStats.std_dev_3y, riskStats.std_dev_5y]} format={fmtPct} isLowerBetter />
              <DetailRow label="Alpha" values={[null, alpha3y, riskStats.alpha_5y]} format={fmtNum} />
              <DetailRow label="Beta" values={[null, beta3y, riskStats.beta_5y]} format={fmtNum} isLowerBetter />
              <DetailRow label="Sortino Ratio" values={[riskStats.sortino_1y, riskStats.sortino_3y, riskStats.sortino_5y]} format={fmtNum} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
