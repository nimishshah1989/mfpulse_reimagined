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

function SentimentGauge({ score }) {
  const clamp = Math.max(0, Math.min(100, score));
  const arc = (clamp / 100) * 157;
  const color = sentimentColor(clamp);

  return (
    <svg viewBox="0 0 120 68" className="w-24 mx-auto">
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="8"
        strokeDasharray="157 314"
        strokeLinecap="round"
        transform="rotate(180 60 60)"
      />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${arc} 314`}
        strokeLinecap="round"
        transform="rotate(180 60 60)"
      />
      <text
        x="60"
        y="55"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        fill="#1e293b"
      >
        {clamp}
      </text>
    </svg>
  );
}

function ProgressBar({ value, max = 100, color = 'bg-teal-500' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full rounded bg-slate-100">
      <div
        className={`h-2 rounded ${color} transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function MarketContextPanel({
  regime,
  sentiment,
  breadth,
  sectorData,
  online,
  onRetry,
}) {
  const leadingCount = sectorData?.filter((s) => s.quadrant === 'Leading').length ?? 0;
  const totalSectors = sectorData?.length ?? 0;

  const improvingSectors = sectorData
    ? [...sectorData]
        .filter((s) => s.quadrant === 'Improving')
        .sort((a, b) => (b.rs_momentum ?? 0) - (a.rs_momentum ?? 0))
    : [];
  const topImproving = improvingSectors[0] ?? null;

  // Derive breadth percentages from nested indicators structure
  function derivePct(breadthData, key) {
    if (!breadthData) return null;
    // Direct field
    if (breadthData[`pct_above_${key}`] != null) return breadthData[`pct_above_${key}`];
    // Nested indicators
    const ind = breadthData?.indicators?.[key];
    if (ind?.current) {
      if (ind.current.pct != null) return ind.current.pct;
      const { count, total } = ind.current;
      if (count != null && total != null && total > 0) return (count / total) * 100;
    }
    return null;
  }

  const pctAbove200 = derivePct(breadth, 'ema200');
  const pctAbove50 = derivePct(breadth, 'ema50');
  const pctAbove21 = derivePct(breadth, 'ema21');
  const breadthPct = pctAbove200 ?? pctAbove21 ?? null;
  const breadthTrend = null; // No previous data available in current API

  const sentimentScore = sentiment?.composite_score ?? sentiment?.score ?? null;
  const sentimentText = sentimentScore != null ? sentimentLabel(sentimentScore) : null;

  const advDecline = breadth?.advance_decline_ratio ?? null;

  if (!online) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
        MarketPulse offline — showing cached data
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Market Regime card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Market Regime</p>
        {regime ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold border ${
                  REGIME_STYLES[regime.market_regime] || REGIME_STYLES[regime.regime_label] || REGIME_STYLES.Neutral
                }`}
              >
                <span className="text-base">{REGIME_ICONS[regime.market_regime] || REGIME_ICONS[regime.regime_label] || REGIME_ICONS.Neutral}</span>
                {regime.market_regime || regime.regime_label || 'Unknown'}
              </span>
            </div>
            {regime.sectors_scanned && (
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono tabular-nums text-slate-800">
                  {regime.sectors_scanned}
                </span>
                <span className="text-xs text-slate-400">sectors</span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 leading-snug">
              {leadingCount} of {totalSectors} sectors leading
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">No data</span>
            {onRetry && (
              <button onClick={onRetry} className="text-[10px] text-teal-600 hover:text-teal-700 underline underline-offset-2">Retry</button>
            )}
          </div>
        )}
      </div>

      {/* Sentiment Score card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Sentiment</p>
        {sentimentScore != null ? (
          <div className="space-y-1">
            <SentimentGauge score={sentimentScore} />
            <p className="text-center text-xs font-semibold" style={{ color: sentimentColor(sentimentScore) }}>
              {sentiment.zone || sentiment.label || sentimentText}
            </p>
            <p className="text-[11px] text-slate-500 text-center leading-snug">
              {sentimentText === 'Fearful' ? 'Good for SIP accumulation' : sentimentText === 'Greedy' ? 'Caution advised' : 'Neutral zone'}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">No data</span>
            {onRetry && (
              <button onClick={onRetry} className="text-[10px] text-teal-600 hover:text-teal-700 underline underline-offset-2">Retry</button>
            )}
          </div>
        )}
      </div>

      {/* Breadth Indicator card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Market Breadth</p>
        {breadth ? (
          <div className="space-y-2">
            {advDecline != null && (
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                  <span>A/D Ratio</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {Number(advDecline).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {pctAbove21 != null && (
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                  <span>Above 21 EMA</span>
                  <span className="font-mono tabular-nums">{Math.round(pctAbove21)}%</span>
                </div>
                <ProgressBar value={pctAbove21} />
              </div>
            )}
            {pctAbove200 != null && (
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                  <span>Above 200 EMA</span>
                  <span className="font-mono tabular-nums">{Math.round(pctAbove200)}%</span>
                </div>
                <ProgressBar value={pctAbove200} />
              </div>
            )}
            {breadthTrend && (
              <p className="text-[11px] text-slate-500">
                Trend: <span className={breadthTrend === 'Rising' ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{breadthTrend}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">No data</span>
            {onRetry && (
              <button onClick={onRetry} className="text-[10px] text-teal-600 hover:text-teal-700 underline underline-offset-2">Retry</button>
            )}
          </div>
        )}
      </div>

      {/* Rotation Signal card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-500 mb-2">Rotation Signal</p>
        {topImproving ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-teal-700 truncate">{topImproving.sector_name}</p>
            <p className="font-mono tabular-nums text-lg font-bold text-slate-800">
              {topImproving.rs_momentum > 0 ? '+' : ''}{topImproving.rs_momentum?.toFixed(1)}
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              Strongest improving sector
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
    </div>
  );
}
