import { useState } from 'react';
import { lensColor, lensBgColor, lensLabel } from '../../lib/lens';

const LENS_DESCRIPTIONS = {
  return_score: 'Measures absolute return generation across 1Y, 3Y, and 5Y periods, weighted 20/35/45.',
  risk_score: 'Evaluates volatility via StdDev, MaxDrawdown, Beta, and Downside Capture. High score = low risk.',
  consistency_score: 'Tracks quartile frequency, calendar year ranks, and Sortino ratio for reliability.',
  alpha_score: 'Captures manager skill through Alpha (3Y/5Y), Information Ratio, and excess vs category.',
  efficiency_score: 'Rates cost-effectiveness via expense ratio, turnover, and return per unit of cost.',
  resilience_score: 'Assesses downside behavior: max drawdown, recovery speed, worst year, and downside capture.',
};

const LENS_SUB_METRICS = {
  return_score: [
    { key: 'return_1y', label: '1Y Return', format: 'pct' },
    { key: 'return_3y', label: '3Y Return', format: 'pct' },
    { key: 'return_5y', label: '5Y Return', format: 'pct' },
  ],
  risk_score: [
    { key: 'std_dev_3y', label: 'Std Dev (3Y)', format: 'pct' },
    { key: 'beta_3y', label: 'Beta (3Y)', format: 'num' },
    { key: 'sortino_3y', label: 'Sortino (3Y)', format: 'num' },
  ],
  consistency_score: [
    { key: 'sortino_3y', label: 'Sortino (3Y)', format: 'num' },
    { key: 'sortino_5y', label: 'Sortino (5Y)', format: 'num' },
  ],
  alpha_score: [
    { key: 'alpha_3y', label: 'Alpha (3Y)', format: 'num' },
    { key: 'alpha_5y', label: 'Alpha (5Y)', format: 'num' },
  ],
  efficiency_score: [
    { key: 'expense_ratio', label: 'Expense Ratio', format: 'pct' },
  ],
  resilience_score: [
    { key: 'std_dev_3y', label: 'Std Dev (3Y)', format: 'pct' },
    { key: 'beta_3y', label: 'Beta (3Y)', format: 'num' },
  ],
};

function formatMetric(value, format) {
  if (value == null) return '\u2014';
  const n = Number(value);
  if (isNaN(n)) return '\u2014';
  if (format === 'pct') return `${n.toFixed(2)}%`;
  return n.toFixed(2);
}

/**
 * Circular progress SVG arc for lens score.
 */
function CircularScore({ score, color, size = 72 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score != null ? Math.min(Math.max(Number(score), 0), 100) : 0;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700 ease-out"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono tabular-nums font-bold"
        style={{ fill: color, fontSize: size * 0.28 }}
      >
        {score != null ? Math.round(Number(score)) : '--'}
      </text>
    </svg>
  );
}

/**
 * LensCard -- clickable card with circular score, expandable inline detail.
 *
 * Props:
 *   name          string
 *   lensKey       string
 *   score         number  -- 0-100
 *   tier          string
 *   categoryName  string
 *   riskStats     object  -- sub-metric data
 *   fundDetail    object  -- for return data
 */
export default function LensCard({ name, lensKey, score, tier, categoryName, riskStats, fundDetail }) {
  const [expanded, setExpanded] = useState(false);
  const color = lensColor(score);
  const bgColor = lensBgColor(score);
  const displayScore = score != null ? Math.round(Number(score)) : null;
  const tierLabel = tier || (displayScore != null ? lensLabel(displayScore) : null);
  const isPending = score == null && lensKey === 'resilience_score';

  const peerContext = () => {
    if (displayScore == null) return null;
    if (displayScore > 50) {
      return `Better than ${displayScore}% of ${categoryName || 'category'} funds`;
    }
    return `Bottom ${100 - displayScore}% among peers`;
  };

  // Get sub-metric values from riskStats or fundDetail
  const subMetrics = LENS_SUB_METRICS[lensKey] || [];
  const metricSource = { ...fundDetail, ...riskStats };

  if (isPending) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4 opacity-60">
        <CircularScore score={null} color="#94a3b8" size={64} />
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{name}</span>
          <p className="text-[11px] text-slate-400 mt-1">Pending -- insufficient data</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg ${
        expanded ? 'border-slate-300 shadow-md' : 'border-slate-200 hover:border-slate-300'
      }`}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
    >
      {/* Collapsed state */}
      <div className="p-4 flex items-center gap-4" style={{ backgroundColor: bgColor }}>
        <CircularScore score={score} color={color} size={68} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{name}</span>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {tierLabel && (
            <span
              className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
              style={{ backgroundColor: `${color}18`, color }}
            >
              {tierLabel}
            </span>
          )}
          {displayScore != null && categoryName && (
            <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">{peerContext()}</p>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          expanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-3">
          {/* Description */}
          {LENS_DESCRIPTIONS[lensKey] && (
            <p className="text-xs text-slate-500 leading-relaxed">
              {LENS_DESCRIPTIONS[lensKey]}
            </p>
          )}

          {/* Percentile bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Percentile within category</span>
              <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-600">
                {displayScore != null ? `${displayScore}/100` : '--'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
              {/* Category range indicator */}
              <div className="absolute inset-y-0 left-[25%] right-[25%] bg-slate-200/50 rounded-full" />
              <div
                className="h-full rounded-full transition-all duration-700 ease-out relative z-10"
                style={{
                  width: `${Math.min(displayScore ?? 0, 100)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-slate-300">0</span>
              <span className="text-[9px] text-slate-300">25</span>
              <span className="text-[9px] text-slate-300">50</span>
              <span className="text-[9px] text-slate-300">75</span>
              <span className="text-[9px] text-slate-300">100</span>
            </div>
          </div>

          {/* Sub-metrics */}
          {subMetrics.length > 0 && metricSource && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Key Components</p>
              <div className="space-y-1.5">
                {subMetrics.map((m) => {
                  const val = metricSource[m.key];
                  return (
                    <div key={m.key} className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">{m.label}</span>
                      <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-700">
                        {formatMetric(val, m.format)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
