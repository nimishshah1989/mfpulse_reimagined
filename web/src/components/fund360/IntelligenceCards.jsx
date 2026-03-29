import { LENS_OPTIONS, LENS_CLASS_KEYS, scoreColor, scoreBgColor } from '../../lib/lens';

const LENS_INSIGHTS = {
  return_score: {
    high: (s) => `Strong return profile — outperforming ${Math.round(s)}% of category peers across weighted time horizons.`,
    mid: (s) => `Average returns — performing in line with about half of category peers.`,
    low: (s) => `Underperforming most peers — trailing ${100 - Math.round(s)}% of category on weighted returns.`,
  },
  risk_score: {
    high: (s) => `Low volatility — smoother ride than ${Math.round(s)}% of category peers with controlled drawdowns.`,
    mid: (s) => `Moderate volatility — risk profile is typical for this category.`,
    low: (s) => `Higher volatility than most peers — expect larger swings in NAV.`,
  },
  consistency_score: {
    high: (s) => `Highly reliable — consistently ranks in top quartiles across market cycles.`,
    mid: (s) => `Mixed consistency — performance varies across time periods.`,
    low: (s) => `Erratic performance — ranking fluctuates significantly quarter to quarter.`,
  },
  alpha_score: {
    high: (s) => `Skilled management — generating excess returns above benchmark after risk adjustment.`,
    mid: (s) => `Neutral alpha — returns are largely explained by market movements, not manager skill.`,
    low: (s) => `Negative alpha — the fund is destroying value relative to its benchmark.`,
  },
  efficiency_score: {
    high: (s) => `Cost-efficient — delivering strong returns relative to expenses charged.`,
    mid: (s) => `Fair value — expense ratio is reasonable for the returns delivered.`,
    low: (s) => `Expensive for its output — high fees are eating into investor returns.`,
  },
  resilience_score: {
    high: (s) => `Fortress-level protection — holds up well during market selloffs with quick recovery.`,
    mid: (s) => `Moderate resilience — some protection in downturns but not immune.`,
    low: (s) => `Fragile in downturns — suffers disproportionately during market corrections.`,
  },
};

function getInsight(lensKey, score) {
  const gen = LENS_INSIGHTS[lensKey];
  if (!gen) return '';
  const s = Number(score);
  if (s >= 65) return gen.high(s);
  if (s >= 35) return gen.mid(s);
  return gen.low(s);
}

function TrendArrow({ score }) {
  const s = Number(score);
  if (s >= 65) return <span className="text-emerald-500 text-sm">↑</span>;
  if (s >= 35) return <span className="text-amber-500 text-sm">→</span>;
  return <span className="text-red-500 text-sm">↓</span>;
}

export default function IntelligenceCards({ lensScores }) {
  if (!lensScores) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {LENS_OPTIONS.map((lens) => {
        const score = lensScores[lens.key];
        const classKey = LENS_CLASS_KEYS[lens.key];
        const tier = lensScores[classKey];
        if (score == null) return null;

        const s = Number(score);
        const color = scoreColor(s);
        const bg = scoreBgColor(s);

        return (
          <div
            key={lens.key}
            className="rounded-xl border border-slate-200 p-3 transition-all hover:shadow-sm"
            style={{ backgroundColor: bg }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {lens.label}
              </span>
              <TrendArrow score={s} />
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span
                className="text-2xl font-bold font-mono tabular-nums"
                style={{ color }}
              >
                {Math.round(s)}
              </span>
              {tier && (
                <span
                  className="text-[10px] font-semibold"
                  style={{ color }}
                >
                  {tier}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {getInsight(lens.key, s)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
