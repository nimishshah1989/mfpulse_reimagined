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

const SENTIMENT_LABELS = {
  short_term_trend: 'Short-term',
  broad_trend: 'Broad Trend',
  advance_decline: 'A/D',
  momentum: 'Momentum',
  extremes: 'Extremes',
};

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

function NiftyCard({ nifty }) {
  const idx = nifty?.index ?? {};
  return (
    <CardShell>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Nifty 50
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
          {formatPrice(idx.current_price)}
        </span>
        <span className={`text-sm font-mono tabular-nums font-medium ${changePctColor(idx.change_pct)}`}>
          {formatChangePct(idx.change_pct)}
        </span>
      </div>
      <div className="flex gap-3 mt-3">
        {[
          { key: 'open', label: 'Open' },
          { key: 'high', label: 'High' },
          { key: 'low', label: 'Low' },
          { key: 'prev_close', label: 'Prev Close' },
        ].map(({ key, label }) => (
          <div key={key} className="flex flex-col">
            <span className="text-[9px] uppercase text-slate-400">{label}</span>
            <span className="text-[11px] font-mono tabular-nums text-slate-700">
              {formatPrice(idx[key])}
            </span>
          </div>
        ))}
      </div>
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

function SentimentCard({ sentiment }) {
  const layers = sentiment?.layers ?? [];
  return (
    <CardShell>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Sentiment
        </p>
        <span
          className="text-sm font-bold font-mono tabular-nums"
          style={{ color: scoreColor(sentiment?.composite_score) }}
        >
          {sentiment?.composite_score != null
            ? Number(sentiment.composite_score).toFixed(1)
            : '\u2014'}
        </span>
      </div>
      <div className="space-y-1.5">
        {layers.map((layer) => (
          <ScoreBar
            key={layer.name}
            label={SENTIMENT_LABELS[layer.name] ?? layer.name}
            score={layer.score}
          />
        ))}
      </div>
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

export default function MarketPulseStrip({ nifty, regime, sentiment, breadth, loading }) {
  if (loading) return <LoadingSkeleton />;

  return (
    <section>
      <h2 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">
        Market Pulse
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <NiftyCard nifty={nifty} />
        <RegimeCard regime={regime} />
        <SentimentCard sentiment={sentiment} />
        <BreadthCard breadth={breadth} />
      </div>
    </section>
  );
}
