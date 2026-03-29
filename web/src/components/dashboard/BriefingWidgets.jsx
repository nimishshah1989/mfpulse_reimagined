import { formatPct, formatCount } from '../../lib/format';

// ─── Sentiment helpers ───

export function deriveSentimentZone(score) {
  if (score == null) return null;
  if (score < 20) return 'Extreme Fear';
  if (score < 40) return 'Fear';
  if (score < 60) return 'Neutral';
  if (score < 80) return 'Greed';
  return 'Extreme Greed';
}

export function sentimentZoneColor(zone) {
  if (!zone) return 'text-slate-400';
  if (zone.includes('Fear')) return 'text-red-400';
  if (zone === 'Neutral') return 'text-amber-400';
  if (zone.includes('Greed')) return 'text-amber-400';
  return 'text-blue-400';
}

// ─── Breadth data extraction ───

function extractPct(indicator) {
  if (!indicator?.current) return null;
  if (indicator.current.pct != null) return indicator.current.pct;
  const { count, total } = indicator.current;
  if (count != null && total != null && total > 0) return (count / total) * 100;
  return null;
}

export function deriveBreadthIndicators(breadth) {
  if (!breadth) return { ema200: null, ema50: null, adRatio: null, rsi40: null, monthlyRsi50: null };
  const indicators = breadth.indicators || breadth;

  // Try EMA first, fall back to RSI-based indicators
  let ema200 = extractPct(indicators.ema200 || indicators.ema_200);
  if (ema200 == null && breadth.pct_above_ema200 != null) ema200 = breadth.pct_above_ema200;
  // Fall back to monthly RSI > 50 as a breadth proxy
  if (ema200 == null) ema200 = extractPct(indicators.monthly_rsi_50);

  let ema50 = extractPct(indicators.ema50);
  if (ema50 == null) ema50 = extractPct(indicators.ema21);
  if (ema50 == null && breadth.pct_above_21ema != null) ema50 = breadth.pct_above_21ema;
  // Fall back to RSI daily > 40 as breadth proxy
  if (ema50 == null) ema50 = extractPct(indicators.rsi_daily_40);

  let adRatio = null;
  if (breadth.advance_decline != null) adRatio = breadth.advance_decline;
  else if (indicators.advance_decline?.current?.ratio != null) {
    adRatio = indicators.advance_decline.current.ratio;
  }

  return { ema200, ema50, adRatio };
}

// ─── SVG Sentiment Gauge ───

export function SentimentGauge({ score }) {
  const safeScore = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const arcLen = 157;
  const filled = (safeScore / 100) * arcLen;
  const zone = deriveSentimentZone(safeScore);
  const zoneColor = sentimentZoneColor(zone);

  let strokeColor = '#f59e0b';
  if (safeScore < 30) strokeColor = '#ef4444';
  else if (safeScore < 45) strokeColor = '#f97316';
  else if (safeScore < 60) strokeColor = '#f59e0b';
  else if (safeScore < 75) strokeColor = '#84cc16';
  else strokeColor = '#22c55e';

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 68" className="w-20">
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeDasharray="157 314"
          strokeLinecap="round"
          transform="rotate(180 60 60)"
        />
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeDasharray={`${filled} 314`}
          strokeLinecap="round"
          transform="rotate(180 60 60)"
          className="sentiment-ring"
        />
        <text
          x="60" y="55"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
          fill="white"
        >
          {score != null ? Math.round(score) : '--'}
        </text>
      </svg>
      <div>
        <p className={`text-sm font-semibold ${zoneColor}`}>
          {zone || '--'}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {score != null ? 'Composite score' : 'No data'}
        </p>
      </div>
    </div>
  );
}

// ─── Breadth Progress Bar ───

export function BreadthBar({ label, pct, color }) {
  const safePct = pct != null ? Math.max(0, Math.min(100, Math.round(pct))) : null;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-semibold tabular-nums">
          {safePct != null ? `${safePct}%` : '--'}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full">
        {safePct != null && (
          <div
            className={`h-1.5 ${color} rounded-full transition-all`}
            style={{ width: `${safePct}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Universe Stats in Hero ───

export function UniverseHeroStats({ universe }) {
  if (!universe || universe.length === 0) {
    return (
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Universe Scored</p>
        <span className="text-2xl font-bold text-white tabular-nums">--</span>
      </div>
    );
  }

  const total = universe.length;
  const scored = universe.filter((f) => f.return_score != null).length;
  const coveragePct = total > 0 ? Math.round((scored / total) * 100) : 0;
  const leaders = universe.filter((f) => f.return_class === 'LEADER').length;
  const strong = universe.filter((f) => f.return_class === 'STRONG').length;
  const weak = universe.filter((f) => f.return_class === 'WEAK').length;

  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Universe Scored</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white tabular-nums">{formatCount(scored)}</span>
        <span className="text-slate-500 text-sm">/ {formatCount(total)}</span>
      </div>
      <p className="text-[10px] text-slate-500 mt-1">{coveragePct}% coverage</p>
      <div className="mt-2 flex gap-4">
        <div>
          <p className="text-[10px] text-slate-500">Leaders</p>
          <p className="text-xs font-semibold text-emerald-400 tabular-nums">{formatCount(leaders)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Strong</p>
          <p className="text-xs font-semibold text-teal-400 tabular-nums">{formatCount(strong)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Weak</p>
          <p className="text-xs font-semibold text-red-400 tabular-nums">{formatCount(weak)}</p>
        </div>
      </div>
    </div>
  );
}
