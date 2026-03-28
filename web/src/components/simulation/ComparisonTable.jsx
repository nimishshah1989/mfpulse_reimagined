import { useMemo } from 'react';
import InfoIcon from '../shared/InfoIcon';
import { findBestMode } from '../../lib/simulation';

const MODES = ['SIP', 'SIP_SIGNAL', 'LUMPSUM', 'HYBRID'];
const MODE_HEADERS = {
  SIP: 'Pure SIP',
  SIP_SIGNAL: 'SIP + Signals',
  LUMPSUM: 'Lumpsum',
  HYBRID: 'Hybrid',
};

function formatCompact(val) {
  if (val == null) return '\u2014';
  const n = Number(val);
  if (isNaN(n)) return '\u2014';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(Math.round(n));
}

function pctStr(val, decimals = 1) {
  if (val == null) return '\u2014';
  const n = Number(val);
  if (isNaN(n)) return '\u2014';
  return `${n >= 0 ? '' : '\u2212'}${Math.abs(n).toFixed(decimals)}%`;
}

function numStr(val, decimals = 2) {
  if (val == null) return '\u2014';
  const n = Number(val);
  if (isNaN(n)) return '\u2014';
  return n.toFixed(decimals);
}

const METRICS = [
  {
    key: 'xirr',
    label: 'XIRR / CAGR',
    tip: 'Extended Internal Rate of Return \u2014 the true annualized return accounting for all cashflows.',
    extract: (s) => s?.xirr_pct ?? s?.cagr_pct,
    format: pctStr,
    winner: 'max',
    meaning: 'Your annualized return on deployed capital',
  },
  {
    key: 'invested',
    label: 'Total Invested',
    extract: (s) => s?.total_invested,
    format: formatCompact,
    winner: null,
    meaning: 'How much capital you committed',
  },
  {
    key: 'value',
    label: 'Current Value',
    extract: (s) => s?.final_value ?? s?.current_value,
    format: formatCompact,
    winner: 'max',
    meaning: 'What your portfolio is worth today',
  },
  {
    key: 'drawdown',
    label: 'Max Drawdown',
    tip: 'Largest peak-to-trough drop. Lower (closer to 0) is better.',
    extract: (s) => s?.max_drawdown_pct ?? s?.max_drawdown,
    format: pctStr,
    winner: 'min_abs',
    meaning: 'Worst peak-to-trough decline you\'d have faced',
  },
  {
    key: 'sharpe',
    label: 'Sharpe Ratio',
    tip: 'Return per unit of risk. Above 1.0 is excellent, above 0.5 is good.',
    extract: (s) => s?.sharpe_ratio,
    format: (v) => numStr(v),
    winner: 'max',
    meaning: 'Return per unit of risk. >1.0 = excellent',
  },
  {
    key: 'sortino',
    label: 'Sortino Ratio',
    tip: 'Like Sharpe but only penalizes downside volatility. Better measure for asymmetric returns.',
    extract: (s) => s?.sortino_ratio,
    format: (v) => numStr(v),
    winner: 'max',
    meaning: 'Downside-risk-adjusted return. Higher = better',
  },
  {
    key: 'hits',
    label: 'Signal Hits',
    extract: (s) => s?.num_topups ?? s?.signal_hit_count,
    format: (v) => v != null ? String(v) : null,
    winner: null,
    signalOnly: true,
    meaning: 'Times your signal rules triggered a deployment',
  },
  {
    key: 'accuracy',
    label: 'Signal Accuracy',
    extract: (s) => s?.signal_hit_rate_3m,
    format: (v) => v != null ? `${Math.round(v * 100)}%` : null,
    winner: null,
    signalOnly: true,
    meaning: '% of signals that deployed within 5% of local bottom',
  },
  {
    key: 'alpha',
    label: 'Alpha vs Benchmark',
    tip: 'Excess return over the benchmark index.',
    extract: (s) => s?.alpha_vs_benchmark,
    format: pctStr,
    winner: 'max',
    meaning: 'How much you beat (or trailed) the benchmark',
  },
];

const SIGNAL_MODES = new Set(['SIP_SIGNAL', 'HYBRID']);

function findWinner(metric, values) {
  if (!metric.winner) return null;
  let bestIdx = null;
  let bestVal = null;

  values.forEach((v, i) => {
    if (v == null || isNaN(Number(v))) return;
    const n = Number(v);
    if (metric.winner === 'max') {
      if (bestVal == null || n > bestVal) { bestVal = n; bestIdx = i; }
    } else if (metric.winner === 'min_abs') {
      const absN = Math.abs(n);
      if (bestVal == null || absN < bestVal) { bestVal = absN; bestIdx = i; }
    }
  });

  return bestIdx;
}

export default function ComparisonTable({ results }) {
  if (!results) return null;

  const summaries = useMemo(() =>
    MODES.map((mode) => {
      const data = results[mode];
      return data?.summary || data || null;
    }),
    [results]
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[9px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
            <th className="text-left py-2 pr-4 font-medium">Metric</th>
            {MODES.map((mode) => (
              <th key={mode} className="text-center py-2 px-1 font-medium">
                {MODE_HEADERS[mode]}
              </th>
            ))}
            <th className="text-left py-2 pl-4 font-medium w-44">What This Means</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {METRICS.map((metric) => {
            const values = summaries.map((s) => metric.extract(s));
            const winnerIdx = findWinner(metric, values);

            return (
              <tr key={metric.key}>
                <td className="py-2 pr-4 font-medium text-slate-600">
                  <div className="flex items-center gap-1">
                    {metric.label}
                    {metric.tip && <InfoIcon tip={metric.tip} />}
                  </div>
                </td>
                {values.map((val, i) => {
                  const isWinner = winnerIdx === i;
                  const isSignalMetric = metric.signalOnly;
                  const isSignalMode = SIGNAL_MODES.has(MODES[i]);
                  const displayVal = isSignalMetric && !isSignalMode
                    ? '\u2014'
                    : metric.format(val);

                  return (
                    <td
                      key={MODES[i]}
                      className={`text-center py-2 px-1 tabular-nums ${
                        isWinner
                          ? 'bg-teal-50 font-bold text-teal-600'
                          : displayVal === '\u2014'
                            ? 'text-slate-300'
                            : ''
                      } ${
                        metric.key === 'drawdown' && val != null && Math.abs(Number(val)) > 30
                          ? 'text-red-500'
                          : ''
                      } ${
                        isSignalMetric && isSignalMode && displayVal !== '\u2014'
                          ? 'font-semibold text-teal-600'
                          : ''
                      }`}
                    >
                      {displayVal || '\u2014'}
                    </td>
                  );
                })}
                <td className="py-2 pl-4 text-[9px] text-slate-400">
                  {metric.meaning}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
