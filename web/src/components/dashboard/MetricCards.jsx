import { useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatPct } from '../../lib/format';

function deriveBreadthPct(breadth) {
  if (!breadth) return null;
  // Direct percentage fields
  if (breadth.pct_above_ema200 != null) return breadth.pct_above_ema200;
  if (breadth.pct_above_21ema != null) return breadth.pct_above_21ema;
  // Nested indicators structure from MarketPulse: { indicators: { ema200: { current: { count, total, pct } } } }
  const indicators = breadth.indicators || breadth;
  // Try ema200 first (most meaningful), then ema21, then any indicator with current.pct
  for (const key of ['ema200', 'ema_200', 'ema21', 'ema50']) {
    const ind = indicators[key];
    if (ind?.current?.pct != null) return ind.current.pct;
    if (ind?.current) {
      const { count, total } = ind.current;
      if (count != null && total != null && total > 0) return (count / total) * 100;
    }
  }
  // Fallback: try rsi_daily_40
  const rsi = indicators.rsi_daily_40;
  if (rsi?.current) {
    const { count, total } = rsi.current;
    if (count != null && total != null && total > 0) return (count / total) * 100;
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

function TrendArrow({ direction }) {
  if (direction === 'up') {
    return (
      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

function MetricCard({ icon, label, value, valueColor, trend, subtext }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs font-medium text-slate-500">{label}</span>
        </div>
        <TrendArrow direction={trend} />
      </div>
      <p className={`text-2xl font-bold font-mono tabular-nums ${valueColor || 'text-slate-800'}`}>
        {value}
      </p>
      {subtext && (
        <p className="text-[11px] text-slate-400 mt-1">{subtext}</p>
      )}
    </div>
  );
}

function SentimentZoneBadge({ zone }) {
  if (!zone) return null;
  const zoneColors = {
    'Extreme Fear': 'bg-red-100 text-red-700',
    Fear: 'bg-red-50 text-red-600',
    Bear: 'bg-red-50 text-red-600',
    Neutral: 'bg-blue-50 text-blue-600',
    Greed: 'bg-amber-50 text-amber-700',
    Bull: 'bg-emerald-50 text-emerald-700',
    'Extreme Greed': 'bg-amber-100 text-amber-700',
  };
  const colors = zoneColors[zone] || 'bg-slate-100 text-slate-600';

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors}`}>
      {zone}
    </span>
  );
}

export default function MetricCards({ nifty, sentiment, breadth, universeStats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonLoader key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  // Nifty 50 — unwrap nested {index: {current_price, change_pct}, returns: {...}} structure
  const niftyIndex = nifty?.index ?? nifty;
  const niftyPrice = niftyIndex?.current_price;
  const niftyChangePct = niftyIndex?.change_pct;
  const niftyReturns = nifty?.returns ?? niftyIndex?.returns;
  const nifty1m = niftyReturns?.['1m'] ?? niftyReturns?.['1M'];
  const niftyTrend = niftyChangePct != null ? (niftyChangePct >= 0 ? 'up' : 'down') : 'flat';
  const niftyColor = niftyChangePct != null
    ? niftyChangePct >= 0 ? 'text-emerald-600' : 'text-red-600'
    : 'text-slate-800';

  // Sentiment
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;
  const sentimentZone = sentiment?.zone || deriveSentimentZone(sentimentScore);
  const adRatio = sentiment?.advance_decline;
  const sentimentTrend = sentimentScore != null
    ? sentimentScore > 60 ? 'up' : sentimentScore < 35 ? 'down' : 'flat'
    : 'flat';
  const sentimentColor = sentimentScore != null
    ? sentimentScore >= 60 ? 'text-emerald-600' : sentimentScore < 40 ? 'text-red-600' : 'text-amber-600'
    : 'text-slate-400';

  // Breadth
  const breadthPct = useMemo(() => deriveBreadthPct(breadth), [breadth]);
  const breadthTrend = breadthPct != null
    ? breadthPct > 55 ? 'up' : breadthPct < 40 ? 'down' : 'flat'
    : 'flat';
  const breadthColor = breadthPct != null
    ? breadthPct > 55 ? 'text-emerald-600' : breadthPct < 40 ? 'text-red-600' : 'text-amber-600'
    : 'text-slate-400';

  // Universe
  const scored = universeStats?.scored || 0;
  const total = universeStats?.total || 0;
  const scoredPct = total > 0 ? ((scored / total) * 100).toFixed(0) : '--';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Nifty 50 */}
      <MetricCard
        icon={<svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2 12l5-5 4 4 6-6 5 5" /></svg>}
        label="Nifty 50"
        value={niftyPrice != null
          ? Number(niftyPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })
          : '--'}
        valueColor={niftyColor}
        trend={niftyTrend}
        subtext={nifty1m != null ? `1M: ${formatPct(nifty1m)}` : 'Data unavailable'}
      />

      {/* Sentiment */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
            <span className="text-xs font-medium text-slate-500">Sentiment</span>
          </div>
          <TrendArrow direction={sentimentTrend} />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <p className={`text-2xl font-bold font-mono tabular-nums ${sentimentColor}`}>
            {sentimentScore != null ? Math.round(sentimentScore) : '--'}
          </p>
          <SentimentZoneBadge zone={sentimentZone} />
        </div>
        <p className="text-[11px] text-slate-400">
          {adRatio != null ? `A/D: ${adRatio}` : sentimentScore != null ? `Score: ${Math.round(sentimentScore)}/100` : 'Data unavailable'}
        </p>
      </div>

      {/* Market Breadth */}
      <MetricCard
        icon={<svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
        label="Market Breadth"
        value={breadthPct != null ? `${Math.round(breadthPct)}%` : '--'}
        valueColor={breadthColor}
        trend={breadthTrend}
        subtext={breadthPct != null
          ? breadthPct > 55 ? 'Broad participation' : breadthPct < 40 ? 'Narrow -- caution' : 'Moderate participation'
          : 'Data unavailable'}
      />

      {/* Universe Coverage */}
      <MetricCard
        icon={<svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>}
        label="Universe Coverage"
        value={total > 0 ? `${scored.toLocaleString('en-IN')}` : '--'}
        valueColor="text-teal-600"
        trend="flat"
        subtext={total > 0 ? `${scoredPct}% scored of ${total.toLocaleString('en-IN')} funds` : 'Loading universe data...'}
      />
    </div>
  );
}
