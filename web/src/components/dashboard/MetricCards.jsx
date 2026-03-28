import { useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatPct } from '../../lib/format';

function deriveBreadthPct(breadth) {
  if (!breadth) return null;
  if (breadth.pct_above_ema200 != null) return breadth.pct_above_ema200;
  if (breadth.pct_above_21ema != null) return breadth.pct_above_21ema;
  const indicators = breadth.indicators || breadth;
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
    Neutral: 'bg-blue-50 text-blue-600',
    Greed: 'bg-amber-50 text-amber-700',
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

  // Nifty 50
  const niftyPrice = nifty?.current_price;
  const niftyChangePct = nifty?.change_pct;
  const nifty1m = nifty?.returns?.['1m'] ?? nifty?.returns?.['1M'];
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
        icon={'\uD83D\uDCC8'}
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
            <span className="text-lg">{'\uD83E\uDDE0'}</span>
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
        icon={'\uD83D\uDCCA'}
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
        icon={'\uD83C\uDF10'}
        label="Universe Coverage"
        value={total > 0 ? `${scored.toLocaleString('en-IN')}` : '--'}
        valueColor="text-teal-600"
        trend="flat"
        subtext={total > 0 ? `${scoredPct}% scored of ${total.toLocaleString('en-IN')} funds` : 'Loading universe data...'}
      />
    </div>
  );
}
