import SectionTitle from '../shared/SectionTitle';

const RISK_METRICS = [
  { key: 'std_dev_3y', label: 'Std Dev (3Y)', unit: '%', lower: true },
  { key: 'max_drawdown_3y', label: 'Max Drawdown (3Y)', unit: '%', lower: true },
  { key: 'sharpe_ratio_3y', label: 'Sharpe Ratio (3Y)', unit: '', lower: false },
  { key: 'sortino_ratio_3y', label: 'Sortino Ratio (3Y)', unit: '', lower: false },
  { key: 'beta_3y', label: 'Beta (3Y)', unit: '', lower: true },
  { key: 'upside_capture_3y', label: 'Upside Capture (3Y)', unit: '%', lower: false },
  { key: 'downside_capture_3y', label: 'Downside Capture (3Y)', unit: '%', lower: true },
];

function fmtVal(val, unit) {
  if (val == null) return '\u2014';
  const n = Number(val);
  if (isNaN(n)) return '\u2014';
  return `${n.toFixed(2)}${unit}`;
}

function compColor(portfolioVal, benchVal, lower) {
  if (portfolioVal == null || benchVal == null) return 'text-slate-800';
  const p = Number(portfolioVal);
  const b = Number(benchVal);
  if (isNaN(p) || isNaN(b)) return 'text-slate-800';
  const better = lower ? p < b : p > b;
  return better ? 'text-emerald-600' : 'text-red-600';
}

export default function RiskProfile({ portfolio, benchmark }) {
  const hasAny = portfolio && RISK_METRICS.some((m) => portfolio[m.key] != null);

  if (!hasAny) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Risk Profile</SectionTitle>
        <p className="text-sm text-slate-400">No risk data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Portfolio-level risk metrics compared against the benchmark">
        Risk Profile
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
        {/* Column headers */}
        <div className="hidden md:grid grid-cols-3 gap-2 text-[10px] font-semibold tracking-wider uppercase text-slate-400 pb-1 border-b border-slate-100">
          <span>Metric</span>
          <span className="text-right">Portfolio</span>
          <span className="text-right">Benchmark</span>
        </div>
        <div className="hidden md:grid grid-cols-3 gap-2 text-[10px] font-semibold tracking-wider uppercase text-slate-400 pb-1 border-b border-slate-100">
          <span>Metric</span>
          <span className="text-right">Portfolio</span>
          <span className="text-right">Benchmark</span>
        </div>

        {RISK_METRICS.map((m) => {
          const pVal = portfolio?.[m.key];
          const bVal = benchmark?.[m.key];
          return (
            <div
              key={m.key}
              className="grid grid-cols-3 gap-2 py-2 items-center border-b border-slate-50"
            >
              <span className="text-xs text-slate-600">{m.label}</span>
              <span
                className={`text-right text-xs font-bold font-mono tabular-nums ${compColor(pVal, bVal, m.lower)}`}
              >
                {fmtVal(pVal, m.unit)}
              </span>
              <span className="text-right text-xs font-mono tabular-nums text-slate-400">
                {fmtVal(bVal, m.unit)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
