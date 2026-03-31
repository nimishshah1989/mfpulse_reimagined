import { formatINR, formatPct } from '../../lib/format';

const METRIC_DEFS = [
  { key: 'portfolio_value', label: 'Portfolio Value', fmt: 'inr' },
  { key: 'xirr', label: 'XIRR', fmt: 'pct' },
  { key: 'cagr', label: 'CAGR', fmt: 'pct' },
  { key: 'alpha_vs_benchmark', label: 'Alpha vs Benchmark', fmt: 'pct' },
  { key: 'sharpe_ratio', label: 'Sharpe Ratio', fmt: 'num2' },
  { key: 'max_drawdown', label: 'Max Drawdown', fmt: 'pctNeg' },
  { key: 'signal_hits', label: 'Signal Hits', fmt: 'int' },
  { key: 'total_invested', label: 'Total Invested', fmt: 'inr' },
];

function fmtMetric(value, fmt) {
  if (value == null) return '\u2014';
  switch (fmt) {
    case 'inr':
      return formatINR(value);
    case 'pct':
      return formatPct(value);
    case 'pctNeg':
      return formatPct(value);
    case 'num2':
      return Number(value).toFixed(2);
    case 'int':
      return String(Math.round(Number(value)));
    default:
      return String(value);
  }
}

function metricColor(value, fmt) {
  if (value == null) return 'text-white';
  const n = Number(value);
  if (fmt === 'pctNeg') return 'text-red-400';
  if (fmt === 'pct') return n >= 0 ? 'text-emerald-400' : 'text-red-400';
  return 'text-white';
}

export default function PortfolioHero({ data }) {
  if (!data) return null;

  const {
    name,
    description,
    status,
    investment_mode,
    fund_count,
    inception_date,
    created_by,
    benchmark_name,
    metrics = {},
    benchmark_comparison = {},
  } = data;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-teal-900 to-teal-700 rounded-xl p-6 text-white">
      {/* Badge row */}
      <div className="flex items-center gap-2 mb-3">
        {status && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            {status}
          </span>
        )}
        {investment_mode && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/10 text-white/70 uppercase tracking-wider">
            {investment_mode}
          </span>
        )}
        {fund_count != null && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/10 text-white/70">
            {fund_count} fund{fund_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Name + description */}
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">{name || 'Portfolio'}</h1>
      {description && (
        <p className="text-sm text-white/60 mb-3 max-w-2xl">{description}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-4 text-[11px] text-white/50 mb-5">
        {inception_date && <span>Inception: {inception_date}</span>}
        {created_by && <span>Created by: {created_by}</span>}
        {benchmark_name && <span>Benchmark: {benchmark_name}</span>}
      </div>

      {/* 8 metric boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {METRIC_DEFS.map((def) => {
          const val = metrics[def.key];
          const bench = benchmark_comparison[def.key];
          return (
            <div
              key={def.key}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-3"
            >
              <p className="text-[9px] uppercase tracking-wider text-white/50 mb-1">
                {def.label}
              </p>
              <p className={`text-lg font-bold font-mono tabular-nums ${metricColor(val, def.fmt)}`}>
                {fmtMetric(val, def.fmt)}
              </p>
              {bench != null && (
                <p className="text-[9px] text-white/40 font-mono tabular-nums mt-0.5">
                  vs {fmtMetric(bench, def.fmt)} benchmark
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
