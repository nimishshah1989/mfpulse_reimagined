import InfoIcon from '../shared/InfoIcon';

const REGIME_STYLES = {
  'Risk-On': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  BULL: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Risk-Off': 'bg-red-100 text-red-700 border-red-200',
  BEAR: 'bg-red-100 text-red-700 border-red-200',
  Neutral: 'bg-amber-100 text-amber-700 border-amber-200',
  CORRECTION: 'bg-amber-100 text-amber-700 border-amber-200',
  NEUTRAL: 'bg-blue-100 text-blue-700 border-blue-200',
};

const REGIME_ICONS = {
  'Risk-On': '\u2191',
  BULL: '\u2191',
  'Risk-Off': '\u2193',
  BEAR: '\u2193',
  Neutral: '\u2194',
  CORRECTION: '\u2193',
  NEUTRAL: '\u2194',
};

function sentimentLabel(score) {
  if (score >= 70) return 'Greedy';
  if (score >= 40) return 'Neutral';
  return 'Fearful';
}

function sentimentColor(score) {
  if (score >= 70) return '#059669';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function breadthLabel(pct) {
  if (pct >= 60) return 'Healthy';
  if (pct >= 40) return 'Mixed';
  return 'Weak';
}

function breadthColor(pct) {
  if (pct >= 60) return '#059669';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

function derivePct(breadthData, key) {
  if (!breadthData) return null;
  if (breadthData[`pct_above_${key}`] != null)
    return breadthData[`pct_above_${key}`];
  const ind = breadthData?.indicators?.[key];
  if (ind?.current) {
    if (ind.current.pct != null) return ind.current.pct;
    const { count, total } = ind.current;
    if (count != null && total != null && total > 0)
      return (count / total) * 100;
  }
  return null;
}

export default function MarketContextPanel({
  regime,
  sentiment,
  breadth,
  sectorData,
  online,
  onRetry,
}) {
  const leadingCount =
    sectorData?.filter((s) => s.quadrant === 'Leading').length ?? 0;
  const totalSectors = sectorData?.length ?? 0;

  const improvingSectors = sectorData
    ? [...sectorData]
        .filter((s) => s.quadrant === 'Improving')
        .sort((a, b) => (b.rs_momentum ?? 0) - (a.rs_momentum ?? 0))
    : [];
  const topImproving = improvingSectors[0] ?? null;

  const pctAbove200 = derivePct(breadth, 'ema200');
  const pctAbove21 = derivePct(breadth, 'ema21');
  const breadthPct = pctAbove200 ?? pctAbove21 ?? null;

  const sentimentScore =
    sentiment?.composite_score ?? sentiment?.score ?? null;
  const sentimentText =
    sentimentScore != null ? sentimentLabel(sentimentScore) : null;

  const regimeKey =
    regime?.market_regime || regime?.regime_label || 'Neutral';
  const regimeSince = regime?.regime_start_date || regime?.since || null;

  if (!online) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
        MarketPulse offline — showing cached data
      </div>
    );
  }

  return (
    <section className="grid grid-cols-4 gap-4 animate-in">
      {/* Regime */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            Market Regime
          </p>
          <InfoIcon tip="Current market regime based on breadth, trend, and volatility signals from MarketPulse" />
        </div>
        {regime ? (
          <div className="space-y-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${
                REGIME_STYLES[regimeKey] || REGIME_STYLES.Neutral
              }`}
            >
              <span className="text-sm">
                {REGIME_ICONS[regimeKey] || '\u2194'}
              </span>
              {regimeKey}
            </span>
            {regimeSince && (
              <p className="text-[11px] text-slate-500">
                Since {regimeSince}
              </p>
            )}
            <p className="text-[11px] text-slate-500 leading-snug">
              {leadingCount} of {totalSectors} sectors leading
            </p>
          </div>
        ) : (
          <NoData onRetry={onRetry} />
        )}
      </div>

      {/* Sentiment */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            Sentiment
          </p>
          <InfoIcon tip="Composite sentiment score (0-100) from 26 market indicators via MarketPulse" />
        </div>
        {sentimentScore != null ? (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: sentimentColor(sentimentScore) }}
              >
                {Math.round(sentimentScore)}
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: sentimentColor(sentimentScore) }}
              >
                {sentiment?.zone || sentiment?.label || sentimentText}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              {sentimentText === 'Fearful'
                ? 'Good for SIP accumulation'
                : sentimentText === 'Greedy'
                  ? 'Caution advised'
                  : 'Mixed signals — watch breadth'}
            </p>
          </div>
        ) : (
          <NoData onRetry={onRetry} />
        )}
      </div>

      {/* Breadth */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            Breadth (200 EMA)
          </p>
          <InfoIcon tip="Percentage of Nifty 500 stocks trading above their 200-day EMA — a broad market health indicator" />
        </div>
        {breadthPct != null ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: breadthColor(breadthPct) }}
              >
                {Math.round(breadthPct)}%
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: breadthColor(breadthPct) }}
              >
                {breadthLabel(breadthPct)}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full">
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(breadthPct, 100)}%`,
                  backgroundColor: breadthColor(breadthPct),
                }}
              />
            </div>
          </div>
        ) : (
          <NoData onRetry={onRetry} />
        )}
      </div>

      {/* Rotation Signal */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            Strongest Rotation
          </p>
          <InfoIcon tip="Sector with the highest positive RS momentum — likely transitioning from Improving to Leading" />
        </div>
        {topImproving ? (
          <div className="space-y-1">
            <p className="text-sm font-bold text-teal-700 truncate">
              {topImproving.sector_name}
            </p>
            <p className="text-[11px] text-slate-500">
              Improving &rarr; Leading
            </p>
            <p className="text-xs font-semibold text-emerald-600 tabular-nums">
              RS Momentum:{' '}
              {topImproving.rs_momentum > 0 ? '+' : ''}
              {topImproving.rs_momentum?.toFixed(1)}
            </p>
          </div>
        ) : leadingCount > 0 ? (
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono tabular-nums text-teal-600">
              {leadingCount}
            </p>
            <p className="text-[11px] text-slate-500">
              of {totalSectors} in Leading quadrant
            </p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No rotation signals</span>
        )}
      </div>
    </section>
  );
}

function NoData({ onRetry }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">No data</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[10px] text-teal-600 hover:text-teal-700 underline underline-offset-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
