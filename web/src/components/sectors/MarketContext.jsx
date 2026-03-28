import Card from '../shared/Card';
import Pill from '../shared/Pill';
import Badge from '../shared/Badge';

const REGIME_STYLES = {
  'Risk-On': 'bg-emerald-100 text-emerald-700',
  'Risk-Off': 'bg-red-100 text-red-700',
  Neutral: 'bg-amber-100 text-amber-700',
};

const PERIODS = ['3M', '6M', '1Y'];

function SentimentGauge({ score }) {
  const clamp = Math.max(0, Math.min(100, score));
  const arc = (clamp / 100) * 157; // half circumference of r=50
  const color = clamp > 60 ? '#059669' : clamp >= 30 ? '#d97706' : '#dc2626';

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
        className="font-mono tabular-nums"
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

export default function MarketContext({
  regime,
  sentiment,
  breadth,
  sectorData,
  online,
  period,
  onPeriodChange,
}) {
  const leadingCount = sectorData?.filter((s) => s.quadrant === 'Leading').length ?? 0;

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

      {/* Regime */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Market Regime</p>
        {regime ? (
          <div className="flex items-center gap-2">
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
        ) : (
          <span className="text-xs text-slate-400">No data</span>
        )}
      </Card>

      {/* Sentiment */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-1">Sentiment</p>
        {sentiment ? (
          <>
            <SentimentGauge score={sentiment.composite_score} />
            <p className="text-center text-xs text-slate-500 mt-1">{sentiment.label}</p>
          </>
        ) : (
          <span className="text-xs text-slate-400">No data</span>
        )}
      </Card>

      {/* Breadth */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-2">Market Breadth</p>
        {breadth ? (
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Above 21 EMA</span>
                <span className="font-mono tabular-nums">{breadth.pct_above_21ema}%</span>
              </div>
              <ProgressBar value={breadth.pct_above_21ema} />
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Above 200 MA</span>
                <span className="font-mono tabular-nums">{breadth.pct_above_200ma}%</span>
              </div>
              <ProgressBar value={breadth.pct_above_200ma} />
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No data</span>
        )}
      </Card>

      {/* Leading sectors */}
      <Card>
        <p className="text-xs font-medium text-slate-500 mb-1">Leading Sectors</p>
        <p className="text-2xl font-semibold font-mono tabular-nums text-teal-600">
          {leadingCount}
        </p>
        <p className="text-[11px] text-slate-400">
          of {sectorData?.length ?? 0} in top-right quadrant
        </p>
      </Card>
    </div>
  );
}
