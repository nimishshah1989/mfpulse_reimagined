import { useMemo, useState, useEffect } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatPct, formatCount } from '../../lib/format';
import { fetchMorningBriefing } from '../../lib/api';
import { cachedFetch } from '../../lib/cache';
import {
  deriveBreadthIndicators,
  SentimentGauge,
  BreadthBar,
  UniverseHeroStats,
} from './BriefingWidgets';

const REGIME_CONFIG = {
  'RISK-ON': {
    arrow: '\u2191',
    badge: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'regime-glow',
    label: 'Risk-On',
  },
  BULL: {
    arrow: '\u2191',
    badge: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'regime-glow',
    label: 'Bull',
  },
  CORRECTION: {
    arrow: '\u2193',
    badge: 'bg-amber-500/15 border-amber-500/30',
    text: 'text-amber-400',
    glow: '',
    label: 'Correction',
  },
  BEAR: {
    arrow: '\u2193',
    badge: 'bg-red-500/15 border-red-500/30',
    text: 'text-red-400',
    glow: '',
    label: 'Bear',
  },
  NEUTRAL: {
    arrow: '\u2194',
    badge: 'bg-blue-500/15 border-blue-500/30',
    text: 'text-blue-400',
    glow: '',
    label: 'Neutral',
  },
  'RISK-OFF': {
    arrow: '\u2193',
    badge: 'bg-red-500/15 border-red-500/30',
    text: 'text-red-400',
    glow: '',
    label: 'Risk-Off',
  },
};

export default function MorningBriefing({ regime, breadth, sentiment, nifty, universe, loading }) {
  if (loading) {
    return <SkeletonLoader className="h-64 rounded-2xl" />;
  }

  // No data at all -- MarketPulse fully offline
  if (!regime && !nifty && !sentiment && !breadth) {
    return (
      <section className="gradient-hero rounded-2xl overflow-hidden animate-in">
        <div className="px-8 pt-7 pb-6">
          <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">
            Morning Briefing
          </p>
          <p className="text-sm text-slate-400 mt-3">
            MarketPulse is offline. Market signals will appear here when the service is available.
          </p>
        </div>
      </section>
    );
  }

  const marketRegime = regime?.market_regime || regime?.regime || 'NEUTRAL';
  const regimeKey = marketRegime.toUpperCase().replace(/\s+/g, '-');
  const config = REGIME_CONFIG[regimeKey] || REGIME_CONFIG.NEUTRAL;

  const regimeSince = regime?.regime_since || regime?.since;
  const regimeSinceFormatted = regimeSince
    ? new Date(regimeSince).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const rawLeading = regime?.leading_sectors || [];
  const leadingSectors = rawLeading.map((s) =>
    typeof s === 'string' ? s : s.sector || s.name || ''
  );

  const breadthData = useMemo(() => deriveBreadthIndicators(breadth), [breadth]);
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;

  // Nifty data
  const niftyIndex = nifty?.index ?? nifty;
  const niftyPrice = niftyIndex?.current_price;
  const niftyChangePct = niftyIndex?.change_pct;
  const niftyReturns = nifty?.returns ?? niftyIndex?.returns;
  const nifty1m = niftyReturns?.return_1m ?? niftyReturns?.['1m'] ?? niftyReturns?.['1M'];
  const nifty3m = niftyReturns?.return_3m ?? niftyReturns?.['3m'] ?? niftyReturns?.['3M'];
  const nifty1y = niftyReturns?.return_1y ?? niftyReturns?.['1y'] ?? niftyReturns?.['1Y'];

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formatNiftyPrice = (price) => {
    if (price == null) return '--';
    return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  return (
    <section className="gradient-hero rounded-2xl overflow-hidden animate-in">
      <div className="px-8 pt-7 pb-6">
        {/* Top row: Date + Regime badge */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">
              Morning Briefing
            </p>
            <p className="text-white/50 text-[11px] mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full border ${config.badge} ${config.glow}`}
            >
              <span className={`text-base ${config.text}`}>{config.arrow}</span>
              <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
            </div>
            {regimeSinceFormatted && (
              <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Regime Since</p>
                <p className="text-white text-xs font-semibold tabular-nums">
                  {regimeSinceFormatted}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 4-stat hero grid */}
        <div className="grid grid-cols-4 gap-6 stat-grid">
          {/* Nifty 50 */}
          <div className="pr-6">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Nifty 50</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white tabular-nums">
                {formatNiftyPrice(niftyPrice)}
              </span>
              {niftyChangePct != null && (
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    niftyChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {niftyChangePct >= 0 ? '+' : ''}
                  {Number(niftyChangePct).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-3">
              {[
                { label: '1M', val: nifty1m },
                { label: '3M', val: nifty3m },
                { label: '1Y', val: nifty1y },
              ].map(({ label, val }) => (
                <div key={label}>
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p
                    className={`text-xs font-medium tabular-nums ${
                      val != null
                        ? val >= 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {val != null ? formatPct(val) : '--'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Gauge */}
          <div className="pr-6">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Market Sentiment
            </p>
            <SentimentGauge score={sentimentScore} />
          </div>

          {/* Market Breadth */}
          <div className="pr-6">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              Market Breadth
            </p>
            <div className="space-y-2 mt-1">
              <BreadthBar label="Above 200 EMA" pct={breadthData.ema200} color="bg-emerald-500" />
              <BreadthBar label="Above 50 EMA" pct={breadthData.ema50} color="bg-sky-500" />
              {breadthData.adRatio != null && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">A/D Ratio</span>
                  <span className="text-white font-semibold tabular-nums">
                    {Number(breadthData.adRatio).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Universe Coverage */}
          <UniverseHeroStats universe={universe} />
        </div>

        {/* AI-powered briefing insight */}
        <AiBriefingInsight
          config={config}
          breadthData={breadthData}
          leadingSectors={leadingSectors}
        />
      </div>
    </section>
  );
}

function AiBriefingInsight({ config, breadthData, leadingSectors }) {
  const [aiBriefing, setAiBriefing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    cachedFetch('morning-briefing', fetchMorningBriefing, 3600)
      .then((res) => {
        if (!cancelled) {
          const text = res?.data?.briefing || res?.briefing;
          if (text) setAiBriefing(text);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // AI briefing available — show it
  if (aiBriefing) {
    return (
      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="flex items-start gap-2">
          <span className="text-teal-400 text-xs mt-0.5 flex-shrink-0">{'\u2726'}</span>
          <p className="text-slate-300 text-sm leading-relaxed">{aiBriefing}</p>
        </div>
        <p className="text-white/20 text-[9px] mt-2">AI-generated briefing</p>
      </div>
    );
  }

  // Fallback — static insight from data
  return (
    <div className="mt-5 pt-4 border-t border-white/10">
      <p className="text-slate-300 text-sm leading-relaxed">
        <span className={`font-semibold ${config.text}`}>{config.label} regime</span>
        {breadthData.ema200 != null ? (
          <>
            {' '}with{' '}
            {breadthData.ema200 > 55 ? 'improving' : breadthData.ema200 < 40 ? 'narrow' : 'moderate'}{' '}
            breadth. {Math.round(breadthData.ema200)}% of stocks above 200 EMA
            {breadthData.ema200 > 55 ? ' \u2014 SIP accumulation zone.' : breadthData.ema200 < 40 ? ' \u2014 proceed with caution.' : '.'}
          </>
        ) : (
          <>. Breadth data unavailable.</>
        )}
        {leadingSectors.length > 0 && (
          <>
            {' '}<span className="text-sky-400">{leadingSectors[0]}</span>
            {leadingSectors.length > 1 && <>{' '}and <span className="text-sky-400">{leadingSectors[1]}</span></>}
            {' '}leading sector rotation.
          </>
        )}
      </p>
    </div>
  );
}
