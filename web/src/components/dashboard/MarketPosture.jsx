import { useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';

const POSTURE_CONFIG = {
  Bullish: {
    color: '#059669',
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    label: 'RISK ON',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    gaugeColor: 'text-emerald-500',
    gaugePosition: 'left-[75%]',
  },
  Cautious: {
    color: '#d97706',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    label: 'NEUTRAL',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    dotColor: 'bg-amber-500',
    gaugeColor: 'text-amber-500',
    gaugePosition: 'left-[50%]',
  },
  Bearish: {
    color: '#dc2626',
    bg: 'bg-gradient-to-br from-red-50 to-rose-50',
    border: 'border-red-200',
    label: 'RISK OFF',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    dotColor: 'bg-red-500',
    gaugeColor: 'text-red-500',
    gaugePosition: 'left-[20%]',
  },
  Neutral: {
    color: '#475569',
    bg: 'bg-gradient-to-br from-slate-50 to-gray-50',
    border: 'border-slate-200',
    label: 'NEUTRAL',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    dotColor: 'bg-slate-400',
    gaugeColor: 'text-slate-400',
    gaugePosition: 'left-[50%]',
  },
};

function generateNarrative(regime, breadth, sentiment) {
  const regimeLabel = regime?.regime_label || 'Unknown';
  const breadthPct = breadth?.pct_above_21ema ?? breadth?.current?.pct_above_21ema;
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;
  const vix = sentiment?.vix ?? breadth?.vix;

  const parts = [];

  if (regimeLabel !== 'Unknown') {
    parts.push(`Market regime is currently ${regimeLabel.toLowerCase()}.`);
  }

  if (breadthPct != null) {
    if (breadthPct > 55) {
      parts.push(`Breadth is healthy at ${Math.round(breadthPct)}% — broad participation supports equity deployment.`);
    } else if (breadthPct < 40) {
      parts.push(`Breadth is narrow at ${Math.round(breadthPct)}% — consider defensive positioning.`);
    } else {
      parts.push(`Breadth is moderate at ${Math.round(breadthPct)}% — selective participation.`);
    }
  }

  if (sentimentScore != null) {
    if (sentimentScore < 30) {
      parts.push(`Sentiment in fear territory (${Math.round(sentimentScore)}/100) — historically good for SIP accumulation.`);
    } else if (sentimentScore > 75) {
      parts.push(`Sentiment elevated at ${Math.round(sentimentScore)}/100 — exercise caution with fresh deployments.`);
    }
  }

  if (vix != null && vix > 20) {
    parts.push(`VIX at ${vix.toFixed(1)} indicates elevated volatility.`);
  }

  if (regimeLabel === 'Bullish' && breadthPct > 50) {
    parts.push('Continue regular SIPs. Consider increasing allocation to equity-oriented funds.');
  } else if (regimeLabel === 'Bearish' || (breadthPct != null && breadthPct < 35)) {
    parts.push('Reduce fresh equity deployment. Favor low-risk and resilient funds.');
  } else {
    parts.push('Maintain balanced allocation. SIPs remain the preferred deployment method.');
  }

  return parts.join(' ');
}

function RegimeGauge({ posture }) {
  return (
    <div className="relative w-full h-3 bg-gradient-to-r from-red-300 via-amber-300 to-emerald-300 rounded-full overflow-visible mt-2">
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-md ${posture.dotColor}`}
        style={{ left: posture.gaugePosition.replace('left-[', '').replace(']', '') }}
      />
    </div>
  );
}

function MiniPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-200/60">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-xs font-bold font-mono tabular-nums ${color}`}>
        {value}
      </span>
    </div>
  );
}

export default function MarketPosture({ regime, breadth, sentiment, loading }) {
  if (loading) {
    return <SkeletonLoader className="h-48 rounded-2xl" />;
  }

  const regimeLabel = regime?.regime_label || 'Neutral';
  const posture = POSTURE_CONFIG[regimeLabel] || POSTURE_CONFIG.Neutral;
  const narrative = useMemo(
    () => generateNarrative(regime, breadth, sentiment),
    [regime, breadth, sentiment]
  );

  const breadthPct = breadth?.pct_above_21ema ?? breadth?.current?.pct_above_21ema;
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;
  const leadingSectors = 0; // Sectors passed separately to MetricCards

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={`rounded-2xl border ${posture.border} ${posture.bg} p-6 shadow-sm`}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">{today}</p>
          <h2 className="text-lg font-bold text-slate-800">Morning Briefing</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${posture.badgeBg} ${posture.badgeText}`}>
          <span className={`w-2 h-2 rounded-full ${posture.dotColor} animate-pulse`} />
          {posture.label}
        </span>
      </div>

      {/* Narrative */}
      <p className="text-sm text-slate-700 leading-relaxed mb-4">{narrative}</p>

      {/* Gauge */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Risk Off</span>
          <span>Neutral</span>
          <span>Risk On</span>
        </div>
        <RegimeGauge posture={posture} />
      </div>

      {/* Mini stat pills */}
      <div className="flex flex-wrap gap-2">
        <MiniPill
          label="Breadth"
          value={breadthPct != null ? `${Math.round(breadthPct)}%` : '--'}
          color={breadthPct != null ? (breadthPct > 55 ? 'text-emerald-600' : breadthPct < 40 ? 'text-red-600' : 'text-amber-600') : 'text-slate-400'}
        />
        <MiniPill
          label="Sentiment"
          value={sentimentScore != null ? `${Math.round(sentimentScore)}/100` : '--'}
          color={sentimentScore != null ? (sentimentScore < 30 ? 'text-red-600' : sentimentScore > 75 ? 'text-red-600' : 'text-emerald-600') : 'text-slate-400'}
        />
        <MiniPill
          label="VIX"
          value={sentiment?.vix != null ? sentiment.vix.toFixed(1) : (breadth?.vix != null ? breadth.vix.toFixed(1) : '--')}
          color={(() => {
            const vix = sentiment?.vix ?? breadth?.vix;
            if (vix == null) return 'text-slate-400';
            if (vix > 20) return 'text-red-600';
            if (vix < 15) return 'text-emerald-600';
            return 'text-amber-600';
          })()}
        />
      </div>
    </div>
  );
}
