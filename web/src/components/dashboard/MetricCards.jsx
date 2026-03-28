import SkeletonLoader from '../shared/SkeletonLoader';

function metricColor(value, low, high) {
  if (value == null) return 'text-slate-400';
  if (value >= high) return 'text-emerald-600';
  if (value <= low) return 'text-red-600';
  return 'text-amber-600';
}

function metricBgColor(value, low, high) {
  if (value == null) return 'bg-slate-50';
  if (value >= high) return 'bg-emerald-50';
  if (value <= low) return 'bg-red-50';
  return 'bg-amber-50';
}

function TrendArrow({ direction, className = '' }) {
  if (direction === 'up') {
    return (
      <svg className={`w-3.5 h-3.5 text-emerald-500 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg className={`w-3.5 h-3.5 text-red-500 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    );
  }
  return (
    <svg className={`w-3.5 h-3.5 text-slate-400 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

function MetricIcon({ type }) {
  const iconClass = 'w-5 h-5 text-slate-400';
  switch (type) {
    case 'breadth':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      );
    case 'sentiment':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      );
    case 'sectors':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
        </svg>
      );
    case 'strategies':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return null;
  }
}

function EnhancedMetricCard({ label, value, subtext, color, bgColor, icon, trendDirection }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${bgColor}`}>
            <MetricIcon type={icon} />
          </div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
        </div>
        <TrendArrow direction={trendDirection} />
      </div>
      <p className={`text-3xl font-bold font-mono tabular-nums ${color || 'text-slate-800'}`}>
        {value}
      </p>
      {subtext && <p className="text-[11px] text-slate-400 mt-1.5">{subtext}</p>}
    </div>
  );
}

export default function MetricCards({ breadth, sentiment, sectors, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonLoader key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const breadthPct = breadth?.pct_above_21ema ?? breadth?.current?.pct_above_21ema;
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;
  const vix = sentiment?.vix ?? breadth?.vix;
  const leadingSectors = (sectors || []).filter((s) => s.quadrant === 'Leading');

  // Derive trend direction from data context
  const breadthTrend = breadthPct != null ? (breadthPct > 55 ? 'up' : breadthPct < 40 ? 'down' : 'flat') : 'flat';
  const sentimentTrend = sentimentScore != null ? (sentimentScore > 60 ? 'up' : sentimentScore < 35 ? 'down' : 'flat') : 'flat';
  const vixTrend = vix != null ? (vix > 20 ? 'up' : vix < 15 ? 'down' : 'flat') : 'flat';
  const sectorTrend = leadingSectors.length > 2 ? 'up' : leadingSectors.length === 0 ? 'down' : 'flat';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <EnhancedMetricCard
        label="Market Breadth"
        value={breadthPct != null ? `${Math.round(breadthPct)}%` : '--'}
        color={metricColor(breadthPct, 40, 55)}
        bgColor={metricBgColor(breadthPct, 40, 55)}
        icon="breadth"
        trendDirection={breadthTrend}
        subtext={breadthPct != null
          ? breadthPct > 55 ? 'Broad participation' : breadthPct < 40 ? 'Narrow -- caution' : 'Moderate'
          : 'Data unavailable'}
      />
      <EnhancedMetricCard
        label="Sentiment"
        value={sentimentScore != null ? `${Math.round(sentimentScore)}` : '--'}
        color={metricColor(sentimentScore, 30, 70)}
        bgColor={metricBgColor(sentimentScore, 30, 70)}
        icon="sentiment"
        trendDirection={sentimentTrend}
        subtext={sentimentScore != null
          ? sentimentScore < 30 ? 'Fear -- accumulate' : sentimentScore > 75 ? 'Euphoria -- caution' : 'Neutral range'
          : 'Data unavailable'}
      />
      <EnhancedMetricCard
        label="VIX"
        value={vix != null ? vix.toFixed(1) : '--'}
        color={vix != null ? (vix > 20 ? 'text-red-600' : vix < 15 ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-400'}
        bgColor={vix != null ? (vix > 20 ? 'bg-red-50' : vix < 15 ? 'bg-emerald-50' : 'bg-amber-50') : 'bg-slate-50'}
        icon="sectors"
        trendDirection={vixTrend}
        subtext={vix != null
          ? vix > 20 ? 'High volatility' : vix < 15 ? 'Low volatility' : 'Normal range'
          : 'Data unavailable'}
      />
      <EnhancedMetricCard
        label="Leading Sectors"
        value={String(leadingSectors.length)}
        color={leadingSectors.length > 2 ? 'text-emerald-600' : leadingSectors.length > 0 ? 'text-amber-600' : 'text-slate-400'}
        bgColor={leadingSectors.length > 2 ? 'bg-emerald-50' : leadingSectors.length > 0 ? 'bg-amber-50' : 'bg-slate-50'}
        icon="strategies"
        trendDirection={sectorTrend}
        subtext={leadingSectors.length > 0
          ? leadingSectors.slice(0, 2).map((s) => s.sector_name).join(', ')
          : 'No sectors in leading quadrant'}
      />
    </div>
  );
}
