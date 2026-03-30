import SkeletonLoader from '../shared/SkeletonLoader';

function scoreColor(score) {
  if (score == null) return '#94a3b8';
  if (score < 30) return '#ef4444';
  if (score < 50) return '#f59e0b';
  if (score < 70) return '#10b981';
  return '#059669';
}

function changePctColor(pct) {
  if (pct == null) return 'text-slate-500';
  return pct >= 0 ? 'text-emerald-600' : 'text-red-600';
}

function formatPrice(num) {
  if (num == null) return '\u2014';
  return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatChangePct(pct) {
  if (pct == null) return '\u2014';
  const n = Number(pct);
  const sign = n >= 0 ? '+' : '\u2212';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* Format metric key to human-readable label */
function formatMetricLabel(key) {
  if (!key) return key;
  const LABELS = {
    above_10ema: 'Above 10 EMA',
    above_21ema: 'Above 21 EMA',
    above_50ema: 'Above 50 EMA',
    above_200ema: 'Above 200 EMA',
    above_12ema_monthly: 'Above 12 EMA (M)',
    hit_52w_high: '52W Highs',
    hit_52w_low: '52W Lows',
    macd_bull_cross: 'MACD Bull Cross',
    rsi_daily_gt60: 'RSI > 60',
    rsi_above_50: 'RSI > 50',
    golden_cross: 'Golden Cross',
    death_cross: 'Death Cross',
    above_upper_bb: 'Above Upper BB',
    below_lower_bb: 'Below Lower BB',
  };
  return LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ScoreBar({ label, score, height = 6 }) {
  const color = scoreColor(score);
  const pct = score != null ? Math.min(Math.max(score, 0), 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-600 w-[80px] shrink-0 truncate">
        {label}
      </span>
      <div className="flex-1 bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="font-mono tabular-nums text-xs font-semibold w-[28px] text-right"
        style={{ color }}
      >
        {score != null ? Math.round(score) : '\u2014'}
      </span>
    </div>
  );
}

function CardShell({ children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
      {children}
    </div>
  );
}

function NiftyCard({ nifty, allIndices }) {
  const idx = nifty?.index ?? {};
  const current = idx.current_price;
  const dayLow = idx.low;
  const dayHigh = idx.high;
  const dayPct = (dayLow != null && dayHigh != null && current != null && dayHigh > dayLow)
    ? ((current - dayLow) / (dayHigh - dayLow)) * 100
    : null;

  // Key sector indices from MarketPulse
  const SECTOR_INDICES = ['BANKNIFTY', 'NIFTYIT', 'NIFTYPHARMA', 'NIFTYFMCG'];
  const SECTOR_LABELS = { BANKNIFTY: 'Bank Nifty', NIFTYIT: 'IT', NIFTYPHARMA: 'Pharma', NIFTYFMCG: 'FMCG' };
  const sectorIndices = SECTOR_INDICES
    .map((key) => allIndices?.[key] ? { label: SECTOR_LABELS[key], ...allIndices[key] } : null)
    .filter(Boolean);

  return (
    <CardShell>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Nifty 50
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
          {formatPrice(current)}
        </span>
        <span className={`text-sm font-mono tabular-nums font-medium ${changePctColor(idx.change_pct)}`}>
          {formatChangePct(idx.change_pct)}
        </span>
      </div>

      {/* Day Range Bar */}
      {dayPct != null && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
            <span>{formatPrice(dayLow)}</span>
            <span className="text-[8px] uppercase">Day Range</span>
            <span>{formatPrice(dayHigh)}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${dayPct}%` }} />
          </div>
        </div>
      )}

      {/* Open / Prev Close */}
      <div className="flex gap-4 mt-2">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase text-slate-400">Open</span>
          <span className="text-[11px] font-mono tabular-nums text-slate-700">{formatPrice(idx.open)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase text-slate-400">Prev Close</span>
          <span className="text-[11px] font-mono tabular-nums text-slate-700">{formatPrice(idx.prev_close)}</span>
        </div>
      </div>

      {/* Sector Indices */}
      {sectorIndices.length > 0 && (
        <div className="border-t border-slate-100 mt-2 pt-2">
          <div className="space-y-1">
            {sectorIndices.map((si) => (
              <div key={si.label} className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600">{si.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tabular-nums text-slate-700">{formatPrice(si.current_price)}</span>
                  <span className={`text-[10px] font-mono tabular-nums font-semibold ${changePctColor(si.change_pct)}`}>
                    {formatChangePct(si.change_pct)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}

function RegimeCard({ regime }) {
  const label = regime?.market_regime ?? 'Unknown';
  const lower = label.toLowerCase();
  const isBear = lower.includes('bear');
  const isCorrection = lower.includes('correction');
  const badgeBg = isBear ? 'bg-red-50' : isCorrection ? 'bg-amber-50' : 'bg-emerald-50';
  const badgeText = isBear ? 'text-red-700' : isCorrection ? 'text-amber-700' : 'text-emerald-700';
  const implication = isBear
    ? 'Favour large-caps, reduce mid/small allocation'
    : isCorrection
    ? 'Defensive tilt — favour quality, reduce speculative positions'
    : 'Broad participation — all-cap strategies viable';

  const leadingSectors = (regime?.leading_sectors || []).slice(0, 3);
  const topPick = (regime?.top_etfs || [])[0];

  return (
    <CardShell>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Market Regime
      </p>
      <div className="flex items-center gap-2">
        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${badgeBg} ${badgeText}`}>
          {label}
        </span>
        {(regime?.regime_since || regime?.generated_at) && (
          <span className="text-[10px] text-slate-400">
            {regime.regime_since ? `Since ${formatDate(regime.regime_since)}` : `As of ${formatDate(regime.generated_at)}`}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-600 leading-snug mt-2">{implication}</p>

      {leadingSectors.length > 0 && (
        <div className="border-t border-slate-100 mt-2.5 pt-2">
          <p className="text-[9px] uppercase text-slate-400 font-semibold mb-1">Leading Sectors</p>
          <div className="space-y-0.5">
            {leadingSectors.map((s) => (
              <div key={s.sector} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-700">{s.sector.replace('NIFTY ', '')}</span>
                <span className={`text-[10px] font-semibold tabular-nums ${s.rs_score >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  RS {s.rs_score?.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topPick && (
        <div className="mt-2 bg-slate-50 rounded px-2 py-1.5">
          <span className="text-[9px] text-slate-400 uppercase font-semibold">Top ETF: </span>
          <span className="text-[11px] font-semibold text-teal-700">{topPick.ticker}</span>
          <span className="text-[10px] text-slate-500 ml-1">
            ({topPick.sector?.replace('NIFTY ', '')}, {topPick.action})
          </span>
        </div>
      )}
    </CardShell>
  );
}

function SentimentCard({ sentiment, sentimentRaw }) {
  const composite = sentiment?.composite_score;

  // Extract top 3 short-term and top 3 long-term indicators
  const shortTermMetrics = (sentimentRaw?.short_term_trend?.metrics || [])
    .filter((m) => m.pct != null)
    .sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50))
    .slice(0, 3);

  const longTermMetrics = (sentimentRaw?.broad_trend?.metrics || [])
    .filter((m) => m.pct != null)
    .sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50))
    .slice(0, 3);

  return (
    <CardShell>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Sentiment
        </p>
        <span
          className="text-sm font-bold font-mono tabular-nums"
          style={{ color: scoreColor(composite) }}
        >
          {composite != null ? Number(composite).toFixed(1) : '\u2014'}
        </span>
      </div>

      {/* Short Term Indicators */}
      {shortTermMetrics.length > 0 && (
        <div className="mb-2.5">
          <p className="text-[9px] uppercase text-slate-400 font-semibold mb-1">Short Term</p>
          <div className="space-y-1">
            {shortTermMetrics.map((m) => {
              const count = Math.round((Number(m.pct) / 100) * 500);
              return (
                <div key={m.key} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 truncate mr-2">{formatMetricLabel(m.key)}</span>
                  <span
                    className="text-[11px] font-mono tabular-nums font-semibold shrink-0"
                    style={{ color: scoreColor(m.pct) }}
                  >
                    {count}/500
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Long Term Indicators */}
      {longTermMetrics.length > 0 && (
        <div>
          <p className="text-[9px] uppercase text-slate-400 font-semibold mb-1">Long Term</p>
          <div className="space-y-1">
            {longTermMetrics.map((m) => {
              const count = Math.round((Number(m.pct) / 100) * 500);
              return (
                <div key={m.key} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 truncate mr-2">{formatMetricLabel(m.key)}</span>
                  <span
                    className="text-[11px] font-mono tabular-nums font-semibold shrink-0"
                    style={{ color: scoreColor(m.pct) }}
                  >
                    {count}/500
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback: layer scores if raw data not available */}
      {shortTermMetrics.length === 0 && longTermMetrics.length === 0 && (sentiment?.layers ?? []).length > 0 && (
        <div className="space-y-1.5">
          {(sentiment.layers).map((layer) => (
            <ScoreBar
              key={layer.name}
              label={layer.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              score={layer.score}
            />
          ))}
        </div>
      )}
    </CardShell>
  );
}

function BreadthCard({ breadth }) {
  const emas = [
    { label: '>10 EMA', value: breadth?.above_10ema },
    { label: '>21 EMA', value: breadth?.above_21ema },
    { label: '>50 EMA', value: breadth?.above_50ema },
    { label: '>200 EMA', value: breadth?.above_200ema },
  ];
  const extras = [
    { label: '52W Highs', value: breadth?.highs_52w },
    { label: '52W Lows', value: breadth?.lows_52w },
    { label: 'MACD Bull%', value: breadth?.macd_bull_pct },
    { label: 'RSI>50%', value: breadth?.rsi_above_50_pct },
  ];

  return (
    <CardShell>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">
        Market Breadth
      </p>
      <div className="space-y-2">
        {emas.map((ema) => (
          <ScoreBar key={ema.label} label={ema.label} score={ema.value} height={8} />
        ))}
      </div>
      <div className="border-t border-slate-100 mt-3 pt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {extras.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400">{stat.label}</span>
            <span
              className="text-[11px] font-mono tabular-nums font-semibold"
              style={{ color: scoreColor(stat.value) }}
            >
              {stat.value != null ? `${Number(stat.value).toFixed(1)}%` : '\u2014'}
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonLoader key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

export default function MarketPulseStrip({ nifty, regime, sentiment, sentimentRaw, breadth, allIndices, loading }) {
  if (loading) return <LoadingSkeleton />;

  return (
    <section>
      <h2 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">
        Market Pulse
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <NiftyCard nifty={nifty} allIndices={allIndices} />
        <RegimeCard regime={regime} />
        <SentimentCard sentiment={sentiment} sentimentRaw={sentimentRaw} />
        <BreadthCard breadth={breadth} />
      </div>
    </section>
  );
}
