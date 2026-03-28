import Card from '../shared/Card';
import Pill from '../shared/Pill';

const REGIME_STYLES = {
  'Risk-On': 'bg-emerald-100 text-emerald-700',
  'Risk-Off': 'bg-red-100 text-red-700',
  Neutral: 'bg-amber-100 text-amber-700',
};

const PERIODS = ['3M', '6M', '1Y'];

function sentimentLabel(score) {
  if (score >= 70) return 'Greedy';
  if (score >= 40) return 'Neutral';
  return 'Fearful';
}

function SentimentGauge({ score }) {
  const clamp = Math.max(0, Math.min(100, score));
  const arc = (clamp / 100) * 157; // half circumference of r=50
  const color = clamp >= 70 ? '#059669' : clamp >= 40 ? '#d97706' : '#dc2626';

  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-[160px] mx-auto">
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
        y="58"
        textAnchor="middle"
        fontSize="18"
        fontWeight="600"
        fill="#1e293b"
      >
        {clamp}
      </text>
    </svg>
  );
}

function ProgressBar({ value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full rounded bg-slate-100">
      <div
        className="h-2 rounded bg-teal-500 transition-all duration-300"
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
  period,
  onPeriodChange,
}) {
  const leadingCount = sectorData?.filter((s) => s.quadrant === 'Leading').length ?? 0;
  const totalSectors = sectorData?.length ?? 0;

  // Find the strongest improving sector (highest positive momentum not already Leading)
  const improvingSectors = sectorData
    ? [...sectorData]
        .filter((s) => s.quadrant === 'Improving')
        .sort((a, b) => (b.rs_momentum ?? 0) - (a.rs_momentum ?? 0))
    : [];
  const topImproving = improvingSectors[0] ?? null;

  // Breadth trend label: compare pct_above_50ma if available, else pct_above_21ema
  const breadthPct = breadth?.pct_above_50ma ?? breadth?.pct_above_21ema ?? null;
  const breadthTrend = breadth?.pct_above_50ma_prev
    ? breadthPct >= breadth.pct_above_50ma_prev
      ? 'Rising'
      : 'Fading'
    : null;

  const sentimentScore = sentiment?.composite_score ?? null;
  const sentimentText = sentimentScore != null ? sentimentLabel(sentimentScore) : null;

  return (
    <div className="flex flex-col gap-4">
      {!online && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          MarketPulse offline — showing cached data
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <Pill key={p} active={period === p} onClick={() => onPeriodChange(p)}>
            {p}
          </Pill>
        ))}
      </div>

      {/* Regime card */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Market Regime</p>
        {regime ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  REGIME_STYLES[regime.regime_label] || REGIME_STYLES.Neutral
                }`}
              >
                {regime.regime_label}
              </span>
              <span className="font-mono tabular-nums text-sm text-slate-600">
                {regime.score}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Broad market favoring equities.{' '}
              {leadingCount} of {totalSectors} sectors leading.
            </p>
          </>
        ) : (
          <span className="text-xs text-slate-400">No data</span>
        )}
      </Card>

      {/* Breadth card */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-2">Market Breadth</p>
        {breadth ? (
          <>
            <div className="space-y-2.5 mb-2">
              {breadth.pct_above_50ma != null && (
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Above 50d avg</span>
                    <span className="font-mono tabular-nums">{breadth.pct_above_50ma}%</span>
                  </div>
                  <ProgressBar value={breadth.pct_above_50ma} />
                </div>
              )}
              {breadth.pct_above_21ema != null && (
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Above 21 EMA</span>
                    <span className="font-mono tabular-nums">{breadth.pct_above_21ema}%</span>
                  </div>
                  <ProgressBar value={breadth.pct_above_21ema} />
                </div>
              )}
              {breadth.pct_above_200ma != null && (
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Above 200 MA</span>
                    <span className="font-mono tabular-nums">{breadth.pct_above_200ma}%</span>
                  </div>
                  <ProgressBar value={breadth.pct_above_200ma} />
                </div>
              )}
            </div>
            {breadthPct != null && (
              <p className="text-[11px] text-slate-500 leading-snug">
                {breadthPct}% of Nifty 500 above 50d avg.
                {breadthTrend ? ` ${breadthTrend} from last week.` : ''}
              </p>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-400">No data</span>
        )}
      </Card>

      {/* Sentiment card */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-1">Sentiment</p>
        {sentimentScore != null ? (
          <>
            <SentimentGauge score={sentimentScore} />
            <p className="text-center text-xs text-slate-500 mt-1">{sentiment.label || sentimentText}</p>
            <p className="text-[11px] text-slate-500 text-center mt-1 leading-snug">
              {sentimentText}. Good for SIP continuation.
            </p>
          </>
        ) : (
          <span className="text-xs text-slate-400">No data</span>
        )}
      </Card>

      {/* Rotation signal card */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-1">Rotation Signal</p>
        {topImproving ? (
          <>
            <p className="text-sm font-semibold text-teal-700 truncate">{topImproving.sector_name}</p>
            <p className="font-mono tabular-nums text-xs text-slate-600 mb-1">
              Momentum: {topImproving.rs_momentum > 0 ? '+' : ''}{topImproving.rs_momentum?.toFixed(1)}
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              Strongest improving sector by RS momentum.
            </p>
          </>
        ) : leadingCount > 0 ? (
          <>
            <p className="text-2xl font-semibold font-mono tabular-nums text-teal-600">
              {leadingCount}
            </p>
            <p className="text-[11px] text-slate-400">
              of {totalSectors} in top-right quadrant
            </p>
          </>
        ) : (
          <span className="text-xs text-slate-400">No rotation signals</span>
        )}
      </Card>
    </div>
  );
}
