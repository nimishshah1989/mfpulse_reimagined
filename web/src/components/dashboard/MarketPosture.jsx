import { useMemo } from 'react';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';

const POSTURE_CONFIG = {
  Bullish: { color: '#059669', bg: '#ecfdf5', label: 'Bullish', icon: '🟢' },
  Cautious: { color: '#d97706', bg: '#fffbeb', label: 'Cautious', icon: '🟡' },
  Bearish: { color: '#dc2626', bg: '#fef2f2', label: 'Defensive', icon: '🔴' },
  Neutral: { color: '#475569', bg: '#f8fafc', label: 'Neutral', icon: '⚪' },
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
      parts.push(`Breadth is healthy at ${Math.round(breadthPct)}% — broad market participation supports equity deployment.`);
    } else if (breadthPct < 40) {
      parts.push(`Breadth is narrow at ${Math.round(breadthPct)}% — only a handful of stocks driving returns. Consider defensive positioning.`);
    } else {
      parts.push(`Breadth is moderate at ${Math.round(breadthPct)}% — selective stock participation.`);
    }
  }

  if (sentimentScore != null) {
    if (sentimentScore < 30) {
      parts.push(`Sentiment is in fear territory (${Math.round(sentimentScore)}/100) — historically a good time to accumulate through SIPs.`);
    } else if (sentimentScore > 75) {
      parts.push(`Sentiment is elevated at ${Math.round(sentimentScore)}/100 — exercise caution with fresh deployments.`);
    }
  }

  if (vix != null && vix > 20) {
    parts.push(`VIX at ${vix.toFixed(1)} indicates elevated volatility.`);
  }

  // MF allocation action
  if (regimeLabel === 'Bullish' && breadthPct > 50) {
    parts.push('Continue regular SIPs. Consider increasing allocation to equity-oriented funds.');
  } else if (regimeLabel === 'Bearish' || (breadthPct != null && breadthPct < 35)) {
    parts.push('Reduce fresh equity deployment. Favor low-risk and resilient funds. Maintain SIPs but avoid lump-sum entries.');
  } else {
    parts.push('Maintain balanced allocation. SIPs remain the preferred deployment method.');
  }

  return parts.join(' ');
}

export default function MarketPosture({ regime, breadth, sentiment, loading }) {
  if (loading) {
    return <SkeletonLoader className="h-40 rounded-xl" />;
  }

  const regimeLabel = regime?.regime_label || 'Neutral';
  const posture = POSTURE_CONFIG[regimeLabel] || POSTURE_CONFIG.Neutral;
  const narrative = useMemo(
    () => generateNarrative(regime, breadth, sentiment),
    [regime, breadth, sentiment]
  );

  return (
    <div className="rounded-xl border-2 p-5" style={{ borderColor: posture.color, backgroundColor: posture.bg }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{posture.icon}</span>
        <h3 className="text-sm font-bold" style={{ color: posture.color }}>
          Market Posture: {posture.label}
        </h3>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{narrative}</p>
    </div>
  );
}
