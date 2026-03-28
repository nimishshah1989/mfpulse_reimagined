import StatCard from '../shared/StatCard';
import SkeletonLoader from '../shared/SkeletonLoader';
import { lensColor } from '../../lib/lens';

function metricColor(value, low, high) {
  if (value == null) return 'text-slate-800';
  if (value >= high) return 'text-emerald-600';
  if (value <= low) return 'text-red-600';
  return 'text-amber-600';
}

export default function MetricCards({ breadth, sentiment, sectors, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonLoader key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const breadthPct = breadth?.pct_above_21ema ?? breadth?.current?.pct_above_21ema;
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;
  const vix = sentiment?.vix ?? breadth?.vix;
  const leadingSectors = (sectors || []).filter((s) => s.quadrant === 'Leading');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Market Breadth"
        value={breadthPct != null ? `${Math.round(breadthPct)}%` : '—'}
        color={metricColor(breadthPct, 40, 55)}
        subtext={breadthPct != null
          ? breadthPct > 55 ? 'Broad participation' : breadthPct < 40 ? 'Narrow — caution' : 'Moderate'
          : 'Data unavailable'}
      />
      <StatCard
        label="Sentiment"
        value={sentimentScore != null ? `${Math.round(sentimentScore)}/100` : '—'}
        color={metricColor(sentimentScore, 30, 70)}
        subtext={sentimentScore != null
          ? sentimentScore < 30 ? 'Fear — accumulate' : sentimentScore > 75 ? 'Euphoria — caution' : 'Neutral range'
          : 'Data unavailable'}
      />
      <StatCard
        label="VIX"
        value={vix != null ? vix.toFixed(1) : '—'}
        color={vix != null ? (vix > 20 ? 'text-red-600' : vix < 15 ? 'text-emerald-600' : 'text-amber-600') : 'text-slate-800'}
        subtext={vix != null
          ? vix > 20 ? 'High volatility' : vix < 15 ? 'Low volatility' : 'Normal range'
          : 'Data unavailable'}
      />
      <StatCard
        label="Leading Sectors"
        value={leadingSectors.length}
        color={leadingSectors.length > 2 ? 'text-emerald-600' : leadingSectors.length > 0 ? 'text-amber-600' : 'text-slate-600'}
        subtext={leadingSectors.length > 0
          ? leadingSectors.slice(0, 2).map((s) => s.sector_name).join(', ')
          : 'No sectors in leading quadrant'}
      />
    </div>
  );
}
