import { useState } from 'react';
import { lensColor, lensBgColor, lensLabel, LENS_CLASS_KEYS } from '../../lib/lens';

const LENS_DESCRIPTIONS = {
  return_score: 'Measures absolute return generation across 1Y, 3Y, and 5Y periods, weighted 20/35/45.',
  risk_score: 'Evaluates volatility via StdDev, MaxDrawdown, Beta, and Downside Capture. High score = low risk.',
  consistency_score: 'Tracks quartile frequency, calendar year ranks, and Sortino ratio for reliability.',
  alpha_score: 'Captures manager skill through Alpha (3Y/5Y), Information Ratio, and excess vs category.',
  efficiency_score: 'Rates cost-effectiveness via expense ratio, turnover, and return per unit of cost.',
  resilience_score: 'Assesses downside behavior: max drawdown, recovery speed, worst year, and downside capture.',
};

/**
 * Circular progress SVG arc for lens score.
 */
function CircularScore({ score, color, size = 64 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score != null ? Math.min(Math.max(Number(score), 0), 100) : 0;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={5}
      />
      {/* Score arc */}
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
        className="transition-all duration-500"
      />
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono tabular-nums font-bold"
        style={{ fill: color, fontSize: size * 0.3 }}
      >
        {score != null ? Math.round(Number(score)) : '--'}
      </text>
    </svg>
  );
}

/**
 * LensCard — clickable card with circular score and inline expansion.
 *
 * Props:
 *   name         string  — e.g. "Return"
 *   lensKey      string  — e.g. "return_score"
 *   score        number  — 0-100 percentile
 *   tier         string  — e.g. "LEADER", "WEAK"
 *   categoryName string  — e.g. "Flexi Cap"
 *   peerStats    object  — optional { avg, best, rank, total }
 */
export default function LensCard({ name, lensKey, score, tier, categoryName, peerStats }) {
  const [expanded, setExpanded] = useState(false);
  const color = lensColor(score);
  const bgColor = lensBgColor(score);
  const displayScore = score != null ? Math.round(Number(score)) : null;
  const tierLabel = tier || (displayScore != null ? lensLabel(displayScore) : null);

  const peerContext = () => {
    if (displayScore == null) return null;
    if (displayScore > 50) {
      return `Top ${100 - displayScore}% in ${categoryName || 'category'}`;
    }
    return `Bottom ${displayScore}% of peers`;
  };

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-300"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
    >
      {/* Collapsed state */}
      <div className="p-4 flex items-center gap-4" style={{ backgroundColor: bgColor }}>
        <CircularScore score={score} color={color} size={60} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {name}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {tierLabel && (
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {tierLabel}
            </span>
          )}
          {displayScore != null && categoryName && (
            <p className="text-[11px] text-slate-500 mt-1 leading-tight">{peerContext()}</p>
          )}
        </div>
      </div>

      {/* Expanded state */}
      <div
        className={`transition-all duration-300 overflow-hidden ${expanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-3">
          {/* Description */}
          {lensKey && LENS_DESCRIPTIONS[lensKey] && (
            <p className="text-xs text-slate-500 leading-relaxed">
              {LENS_DESCRIPTIONS[lensKey]}
            </p>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400">Percentile within category</span>
              <span className="text-[10px] font-mono tabular-nums text-slate-500">
                {displayScore != null ? `${displayScore}/100` : '--'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(displayScore ?? 0, 100)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>

          {/* Peer stats */}
          {peerStats && (
            <div className="text-[11px] font-mono text-slate-400 flex gap-3 flex-wrap">
              {peerStats.avg != null && <span>Avg: {Math.round(peerStats.avg)}</span>}
              {peerStats.best != null && <span>Best: {Math.round(peerStats.best)}</span>}
              {peerStats.rank != null && peerStats.total != null && (
                <span>Rank: {peerStats.rank} of {peerStats.total}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
