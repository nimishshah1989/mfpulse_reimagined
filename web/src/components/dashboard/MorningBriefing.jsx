import { useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';

const REGIME_CONFIG = {
  CORRECTION: {
    color: '#d97706',
    bg: 'from-amber-900/20 to-slate-900',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
    text: 'Markets in correction mode',
  },
  BULL: {
    color: '#059669',
    bg: 'from-emerald-900/20 to-slate-900',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
    text: 'Bull market in progress',
  },
  BEAR: {
    color: '#dc2626',
    bg: 'from-red-900/20 to-slate-900',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    dot: 'bg-red-400',
    text: 'Bear market conditions',
  },
  NEUTRAL: {
    color: '#3b82f6',
    bg: 'from-blue-900/20 to-slate-900',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
    text: 'Neutral market conditions',
  },
};

function deriveBreadthPct(breadth) {
  if (!breadth) return null;
  // Try direct percentage first
  if (breadth.pct_above_ema200 != null) return breadth.pct_above_ema200;
  if (breadth.pct_above_21ema != null) return breadth.pct_above_21ema;
  // Try from indicators structure
  const indicators = breadth.indicators || breadth;
  const ema200 = indicators.ema200 || indicators.ema_200;
  if (ema200?.current) {
    const { count, total } = ema200.current;
    if (count != null && total != null && total > 0) {
      return (count / total) * 100;
    }
  }
  // Fallback to rsi_daily_40
  const rsi = indicators.rsi_daily_40;
  if (rsi?.current) {
    const { count, total } = rsi.current;
    if (count != null && total != null && total > 0) {
      return (count / total) * 100;
    }
  }
  return null;
}

function deriveSentimentZone(score) {
  if (score == null) return null;
  if (score < 20) return 'Extreme Fear';
  if (score < 40) return 'Fear';
  if (score < 60) return 'Neutral';
  if (score < 80) return 'Greed';
  return 'Extreme Greed';
}

function sentimentZoneColor(zone) {
  if (!zone) return 'text-slate-400';
  if (zone.includes('Fear')) return 'text-red-400';
  if (zone.includes('Greed')) return 'text-amber-400';
  return 'text-blue-400';
}

function StatPill({ label, value, colorClass }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`text-xs font-bold font-mono tabular-nums ${colorClass || 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

export default function MorningBriefing({ regime, breadth, sentiment, nifty, loading }) {
  if (loading) {
    return <SkeletonLoader className="h-48 rounded-2xl" />;
  }

  // No data at all — MarketPulse fully offline
  if (!regime && !nifty && !sentiment && !breadth) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
        <div className="relative z-10">
          <p className="text-[11px] font-medium text-slate-400 tracking-widest uppercase mb-1">
            Pulse Command Center
          </p>
          <p className="text-sm text-slate-400 mt-2">
            MarketPulse is offline. Market signals will appear here when the service is available.
          </p>
        </div>
      </div>
    );
  }

  const marketRegime = regime?.market_regime || regime?.regime || 'NEUTRAL';
  const config = REGIME_CONFIG[marketRegime] || REGIME_CONFIG.NEUTRAL;
  const leadingSectors = regime?.leading_sectors || [];

  const breadthPct = useMemo(() => deriveBreadthPct(breadth), [breadth]);
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;
  const sentimentZone = sentiment?.zone || deriveSentimentZone(sentimentScore);

  // Unwrap nested {index: {current_price, change_pct}, returns: {...}} structure
  const niftyIndex = nifty?.index ?? nifty;
  const niftyPrice = niftyIndex?.current_price;
  const niftyChangePct = niftyIndex?.change_pct;

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formatNiftyPrice = (price) => {
    if (price == null) return '--';
    return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${config.bg} bg-slate-900 p-6 shadow-lg overflow-hidden relative`}>
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_50%_50%,white_1px,transparent_1px)] bg-[length:20px_20px]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-medium text-slate-400 tracking-widest uppercase mb-1">
              Pulse Command Center
            </p>
            <p className="text-xs text-slate-500">{today}</p>
          </div>
          <div className="text-right">
            {niftyPrice != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Nifty 50</span>
                <span className="text-lg font-bold font-mono tabular-nums text-white">
                  {formatNiftyPrice(niftyPrice)}
                </span>
                {niftyChangePct != null && (
                  <span className={`text-sm font-bold font-mono tabular-nums ${niftyChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {niftyChangePct >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(niftyChangePct).toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Regime badge + narrative */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${config.badge}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${config.dot} animate-pulse`} />
            {marketRegime}
          </span>
        </div>
        <p className="text-sm text-slate-300 mb-5">{config.text}</p>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2">
          <StatPill
            label="Breadth"
            value={breadthPct != null ? `${Math.round(breadthPct)}%` : '--'}
            colorClass={
              breadthPct != null
                ? breadthPct > 55
                  ? 'text-emerald-400'
                  : breadthPct < 40
                    ? 'text-red-400'
                    : 'text-amber-400'
                : 'text-slate-500'
            }
          />
          <StatPill
            label="Sentiment"
            value={sentimentZone || '--'}
            colorClass={sentimentZoneColor(sentimentZone)}
          />
          {leadingSectors.length > 0 && (
            <StatPill
              label="Leading"
              value={leadingSectors.slice(0, 3).join(', ')}
              colorClass="text-teal-400"
            />
          )}
        </div>
      </div>
    </div>
  );
}
