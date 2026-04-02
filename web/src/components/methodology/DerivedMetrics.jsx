/**
 * Derived metrics documentation — simulation metrics, sector rotation,
 * signal engine, smart buckets, archetypes, portfolio computations.
 */

const SECTIONS = [
  {
    title: 'Simulation Metrics',
    subtitle: 'Portfolio performance calculations for SIP/Lumpsum/Hybrid simulations',
    metrics: [
      {
        name: 'XIRR (Extended Internal Rate of Return)',
        formula: 'Solve: \u03a3(amount\u1d62 / (1+r)^t\u1d62) = 0',
        method: 'Newton-Raphson iteration (max 100 iter, tolerance 1e-9)',
        inputs: 'All cashflows with dates (negative = invested, positive = redeemed)',
        output: 'Annualized return % (-99% to 1000%)',
        notes: 'Float arithmetic used for the iterative solver, converted back to Decimal via Decimal(str(rate)) before multiplying by 100.',
      },
      {
        name: 'CAGR (Compound Annual Growth Rate)',
        formula: 'CAGR = (final / initial)^(1/years) \u2212 1',
        inputs: 'Initial invested amount, final portfolio value, investment period in years',
        output: 'Annualized return %',
        notes: 'Returns None if initial \u2264 0 or years \u2264 0. For single lumpsum investments, XIRR \u2248 CAGR.',
      },
      {
        name: 'Max Drawdown',
        formula: 'For each day: DD = (peak \u2212 current) / peak \u00d7 100',
        inputs: 'Daily portfolio value timeline',
        output: 'Peak-to-trough percentage with start/end dates',
        notes: 'Tracks running peak. Reports the largest percentage decline from any peak to subsequent trough.',
      },
      {
        name: 'Sharpe Ratio',
        formula: 'Sharpe = (avg_monthly_return \u2212 rf_monthly) / \u03c3_monthly \u00d7 \u221a12',
        inputs: 'Monthly portfolio returns, risk-free rate (default 6% annual, configurable)',
        output: 'Annualized ratio (higher = better risk-adjusted return)',
        notes: 'Uses sample standard deviation (n-1). If volatility is near zero, returns 99.99 (constant positive returns) or 0.',
      },
      {
        name: 'Sortino Ratio',
        formula: 'Sortino = (avg_monthly_return \u2212 rf_monthly) / downside_\u03c3 \u00d7 \u221a12',
        inputs: 'Monthly portfolio returns, risk-free rate (default 6% annual)',
        output: 'Annualized ratio (focuses only on downside volatility)',
        notes: 'Downside deviation uses only negative excess returns: \u221a(mean(min(r \u2212 rf, 0)\u00b2)). Better than Sharpe for asymmetric return distributions.',
      },
      {
        name: 'Monthly Returns (Modified Dietz)',
        formula: 'Return = (end \u2212 start \u2212 flows) / (start + \u03a3(flow\u1d62 \u00d7 W\u1d62))',
        inputs: 'Monthly snapshots, cashflows with dates. W\u1d62 = (CD \u2212 D\u1d62) / CD',
        output: 'Time-weighted monthly return % per month',
        notes: 'W\u1d62 is the day-weight: calendar days remaining / total calendar days in month. A SIP on day 1 gets weight ~1.0, day 28 gets ~0.1. This prevents SIP inflows from being counted as returns.',
      },
      {
        name: 'Signal Hit Rate',
        formula: 'Hit rate = profitable_topups / total_topups \u00d7 100',
        inputs: 'Top-up events triggered by signal rules, NAV at trigger + 3M/6M/12M later',
        output: 'Percentage at 3-month, 6-month, 12-month horizons',
        notes: 'A top-up is profitable if the NAV after the specified period exceeds the NAV at the time of investment.',
      },
    ],
  },
  {
    title: 'Sector Rotation',
    subtitle: 'Relative Strength scores and quadrant classification for 11 Morningstar sectors',
    metrics: [
      {
        name: 'RS Score (Relative Strength)',
        formula: 'RS = 50 + z_score \u00d7 16.67, clamped to [0, 100]',
        inputs: 'AUM-weighted sector returns across all funds. z_score = (sector_return \u2212 mean) / stdev',
        output: '0-100 score per sector (50 = average)',
        notes: 'The constant 16.67 = 100/6, which maps \u00b13 standard deviations to the 0-100 range. Sector return is AUM-weighted: \u03a3(fund_AUM \u00d7 sector_exposure% \u00d7 fund_return) / \u03a3(fund_AUM \u00d7 sector_exposure%).',
      },
      {
        name: 'Momentum (1M & 3M)',
        formula: 'Momentum = current_RS \u2212 previous_RS',
        inputs: 'RS score at current date vs 1 month / 3 months ago',
        output: 'Positive = improving, negative = deteriorating',
        notes: 'Uses the closest available historical snapshot within a 30-50 day search window.',
      },
      {
        name: 'Quadrant Assignment',
        formula: 'RS \u2265 50 + Momentum > 0 \u2192 Leading | RS \u2265 50 + Momentum \u2264 0 \u2192 Weakening | RS < 50 + Momentum > 0 \u2192 Improving | RS < 50 + Momentum \u2264 0 \u2192 Lagging',
        inputs: 'RS score (threshold: 50) and momentum (threshold: 0)',
        output: 'One of: Leading, Weakening, Improving, Lagging',
        notes: 'Mirrors the classic relative rotation graph (RRG) methodology used by institutional investors.',
      },
    ],
  },
  {
    title: 'Signal Engine',
    subtitle: 'Market breadth and sentiment signals for SIP top-up timing',
    metrics: [
      {
        name: 'Mild Correction',
        formula: 'breadth_pct_above_21ema < 30%',
        inputs: 'MarketPulse breadth data (% of Nifty 500 stocks above 21-day EMA)',
        output: 'Top-up multiplier: 1.0\u00d7, cooloff: 30 days',
        notes: 'Fires when fewer than 30% of stocks are above their short-term trend. Signals mild market weakness.',
      },
      {
        name: 'Moderate Panic',
        formula: 'breadth_200ema < 40% AND sentiment_composite < 35%',
        inputs: 'Breadth (% above 200-day EMA) + sentiment composite score',
        output: 'Top-up multiplier: 2.0\u00d7, cooloff: 21 days',
        notes: 'Both conditions must be true (AND logic). Indicates meaningful market stress.',
      },
      {
        name: 'Deep Panic \u2014 Max Deploy',
        formula: 'breadth_200ema < 25% AND sentiment_composite < 20%',
        inputs: 'Breadth (% above 200-day EMA) + sentiment composite score',
        output: 'Top-up multiplier: 3.0\u00d7, cooloff: 14 days',
        notes: 'Aggressive deployment signal during extreme fear. Shortest cooloff period for maximum opportunity capture.',
      },
      {
        name: 'Trend Recovery',
        formula: 'nifty_above_200sma > 0 AND breadth_50ema > 60%',
        inputs: 'Nifty 50 vs 200-day SMA + breadth (% above 50-day EMA)',
        output: 'Top-up multiplier: 1.5\u00d7, cooloff: 45 days',
        notes: 'Fires when the market confirms a recovery: Nifty back above long-term trend and majority of stocks trending up.',
      },
    ],
  },
  {
    title: 'Smart Buckets',
    subtitle: '6 pre-built fund filters based on lens classification combinations',
    metrics: [
      {
        name: 'Consistent Alpha',
        formula: 'alpha_class = "ALPHA_MACHINE" AND consistency_class \u2208 {"ROCK_SOLID", "CONSISTENT"}',
        inputs: 'Lens classifications (latest computed date)',
        output: 'Funds that generate alpha reliably. Sorted by alpha_score.',
      },
      {
        name: 'Low-Risk Leaders',
        formula: 'risk_score \u2265 80 AND return_score \u2265 60',
        inputs: 'Lens scores',
        output: 'Top returners with controlled volatility. Sorted by return_score.',
      },
      {
        name: 'High Efficiency',
        formula: 'efficiency_score \u2265 80 AND return_score \u2265 60',
        inputs: 'Lens scores',
        output: 'Best return per rupee of expense. Sorted by efficiency_score.',
      },
      {
        name: 'Fortress Funds',
        formula: 'resilience_class \u2208 {"FORTRESS", "STURDY"} AND consistency_score \u2265 60',
        inputs: 'Lens classifications + scores',
        output: 'Downside-protected and consistent. Sorted by resilience_score.',
      },
      {
        name: 'Turnaround Watch',
        formula: 'return_score \u2208 [40, 65) AND alpha_score \u2265 50',
        inputs: 'Lens scores',
        output: 'Average returns but improving alpha \u2014 manager may be turning the corner.',
      },
      {
        name: 'Avoid Zone',
        formula: '3+ lenses with score < 30',
        inputs: 'All 6 lens scores',
        output: 'Underperforming on multiple dimensions. Review or exit.',
      },
    ],
  },
  {
    title: 'Fund Archetypes',
    subtitle: '9 behavioral clusters based on 6-lens tier patterns',
    metrics: [
      { name: 'All-Rounder', formula: '5+ lenses in top tiers', output: 'Elite across all dimensions' },
      { name: 'Alpha but Fragile', formula: 'Strong return/alpha + weak risk/resilience', output: 'Great in bull runs, painful in corrections' },
      { name: 'Consistent Compounder', formula: 'Rock-solid consistency + good return', output: 'Reliable SIP candidates' },
      { name: 'Defensive Anchor', formula: 'Low risk + high resilience + moderate return', output: 'Portfolio stabilizers' },
      { name: 'High Return High Risk', formula: 'Strong returns but volatile', output: 'High-risk-appetite only' },
      { name: 'Efficient Mid-Tier', formula: 'Average across board, decent efficiency', output: 'Middle of pack' },
      { name: 'Watch', formula: 'Safe on risk but eroding alpha', output: 'Review position' },
      { name: 'Turnaround Potential', formula: 'Weak returns but improving alpha', output: 'Manager may be turning corner' },
      { name: 'Trouble Zone', formula: '3+ weak tiers', output: 'Avoid or exit' },
    ],
  },
  {
    title: 'Portfolio Computations',
    subtitle: 'Blended metrics for strategy portfolios with multiple funds',
    metrics: [
      {
        name: 'Blended Sector Exposure',
        formula: 'blended_pct = \u03a3(fund_weight \u00d7 fund_sector_pct) / total_weight',
        inputs: 'Holdings with weights, sector exposures per fund',
        output: 'Effective sector allocation across the portfolio',
      },
      {
        name: 'Market Cap Split',
        formula: 'blended_large = \u03a3(weight \u00d7 large_cap_pct) / total_weight',
        inputs: 'Holdings weights, asset allocation per fund (large/mid/small cap %)',
        output: 'Portfolio-level large/mid/small cap allocation',
      },
      {
        name: 'Weighted Lens Scores',
        formula: 'weighted_score = \u03a3(weight \u00d7 fund_lens_score) / total_weight',
        inputs: 'Holdings weights, 6 lens scores per fund',
        output: 'Portfolio-level score for each of the 6 lenses',
      },
      {
        name: 'Return Contribution',
        formula: 'contribution = (weight \u00d7 fund_return) / portfolio_return \u00d7 100',
        inputs: 'Holdings weights, 1Y returns',
        output: 'Each fund\'s percentage contribution to total portfolio return',
      },
    ],
  },
];

export default function DerivedMetrics() {
  return (
    <div className="space-y-5">
      {SECTIONS.map((section) => (
        <div key={section.title} className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">{section.title}</h4>
            <p className="text-[11px] text-slate-500">{section.subtitle}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {section.metrics.map((m) => (
              <div key={m.name} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-slate-800">{m.name}</p>
                    <code className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {m.formula}
                    </code>
                  </div>
                  {m.output && (
                    <span className="text-[10px] text-slate-500 shrink-0 max-w-[200px] text-right">
                      {m.output}
                    </span>
                  )}
                </div>
                {m.inputs && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    <span className="font-medium text-slate-600">Inputs:</span> {m.inputs}
                  </p>
                )}
                {m.method && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    <span className="font-medium text-slate-600">Method:</span> {m.method}
                  </p>
                )}
                {m.notes && (
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{m.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
