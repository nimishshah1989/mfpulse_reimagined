/**
 * Detailed lens calculation formulas for the methodology page.
 * Shows exact inputs, weights, formulas, and tier thresholds for all 6 lenses.
 */

const LENS_DETAILS = [
  {
    name: 'Return',
    question: 'Does it make money?',
    tiers: ['LEADER', 'STRONG', 'AVERAGE', 'WEAK'],
    tierThresholds: '75+ / 50-74 / 25-49 / <25 percentile',
    description: 'Measures absolute return performance across multiple horizons, weighted toward long-term.',
    inputs: [
      { name: 'Return 1Y', source: 'ReturnM12', weight: '20%' },
      { name: 'Return 3Y', source: 'ReturnM36', weight: '35%' },
      { name: 'Return 5Y', source: 'ReturnM60', weight: '45%' },
    ],
    formula: 'weighted_return = 0.20 \u00d7 R1Y + 0.35 \u00d7 R3Y + 0.45 \u00d7 R5Y',
    notes: 'If a horizon is missing (e.g., fund < 5 years old), weights are redistributed proportionally among available horizons. The weighted return is then ranked against all funds in the same SEBI category to produce a 0-100 percentile.',
  },
  {
    name: 'Risk',
    question: 'How bumpy is the ride?',
    tiers: ['LOW_RISK', 'MODERATE', 'ELEVATED', 'HIGH_RISK'],
    tierThresholds: '75+ / 50-74 / 25-49 / <25 percentile',
    description: 'Measures volatility and downside exposure. All metrics are inverted: lower risk = higher score.',
    inputs: [
      { name: 'Std Deviation 3Y', source: 'StandardDeviationM36', weight: '25%' },
      { name: 'Max Drawdown 3Y', source: 'MaxDrawdownM36', weight: '25%' },
      { name: 'Beta 3Y', source: 'BetaM36', weight: '25%' },
      { name: 'Down Capture 3Y', source: 'DownCaptureRatioM36', weight: '25%' },
    ],
    formula: 'risk_score = mean(StdDev_pctile, DD_pctile, Beta_pctile, DC_pctile)',
    notes: 'StdDev, Beta, and Down Capture use inverted ranking (lower raw value = higher percentile). Max Drawdown uses direct ranking since values are negative (less negative = better = higher percentile).',
  },
  {
    name: 'Consistency',
    question: 'Can you count on it?',
    tiers: ['ROCK_SOLID', 'CONSISTENT', 'MIXED', 'ERRATIC'],
    tierThresholds: '75+ / 50-74 / 25-49 / <25 percentile',
    description: 'Measures how reliably the fund performs across different time periods and market conditions.',
    inputs: [
      { name: 'Quartile Consistency', source: 'Quartile 1Y/3Y/5Y', weight: '40%' },
      { name: 'Calendar Year Ranks', source: '10 CY percentile ranks', weight: '30%' },
      { name: 'Sortino Ratio', source: 'SortinoM36', weight: '30%' },
    ],
    formula: 'consistency = 0.40 \u00d7 quartile_pctile + 0.30 \u00d7 cal_year_pctile + 0.30 \u00d7 sortino_pctile',
    notes: 'Quartile consistency = percentage of periods where fund ranked in Q1 or Q2. Calendar year consistency = percentage of years where fund was in the top half. Both are percentile-ranked within category before weighting.',
  },
  {
    name: 'Alpha',
    question: 'Is the manager adding value?',
    tiers: ['ALPHA_MACHINE', 'POSITIVE', 'NEUTRAL', 'NEGATIVE'],
    tierThresholds: '75+ / 50-74 / 25-49 / <25 percentile',
    description: 'Measures manager skill by comparing risk-adjusted returns against category peers.',
    inputs: [
      { name: 'Alpha 3Y', source: 'AlphaM36', weight: '3Y group: 40%' },
      { name: 'Info Ratio 3Y', source: 'InformationRatioM36', weight: '3Y group: 40%' },
      { name: 'Excess Return 3Y', source: 'Fund R3Y \u2212 Category Avg R3Y', weight: '3Y group: 40%' },
      { name: 'Alpha 5Y', source: 'AlphaM60', weight: '5Y group: 60%' },
      { name: 'Info Ratio 5Y', source: 'InformationRatioM60', weight: '5Y group: 60%' },
      { name: 'Excess Return 5Y', source: 'Fund R5Y \u2212 Category Avg R5Y', weight: '5Y group: 60%' },
    ],
    formula: 'alpha = 0.40 \u00d7 avg(3Y metrics) + 0.60 \u00d7 avg(5Y metrics)',
    notes: 'Excess return is computed as fund return minus the average return of all funds in the same SEBI category. If only one time period is available, that period gets 100% weight.',
  },
  {
    name: 'Efficiency',
    question: 'Is it worth the cost?',
    tiers: ['LEAN', 'FAIR', 'EXPENSIVE', 'BLOATED'],
    tierThresholds: '75+ / 50-74 / 25-49 / <25 percentile',
    description: 'Measures cost-effectiveness: how much return you get per rupee of expense.',
    inputs: [
      { name: 'Net Expense Ratio', source: 'OngoingCharge', weight: '40% (inverted)' },
      { name: 'Turnover Ratio', source: 'TurnoverRatio', weight: '20% (inverted)' },
      { name: 'Return-per-Expense', source: 'Return3Y / ExpenseRatio', weight: '40%' },
    ],
    formula: 'efficiency = 0.40 \u00d7 expense_pctile + 0.20 \u00d7 turnover_pctile + 0.40 \u00d7 RPE_pctile',
    notes: 'Expense ratio and turnover are inverted (lower = better). Return-per-expense (RPE) is a derived ratio: 3Y return divided by expense ratio. Higher RPE means better value for money.',
  },
  {
    name: 'Resilience',
    question: 'How does it behave in bad markets?',
    tiers: ['FORTRESS', 'STURDY', 'FRAGILE', 'VULNERABLE'],
    tierThresholds: '75+ / 50-74 / 25-49 / <25 percentile',
    description: 'Measures downside protection and recovery ability during market stress.',
    inputs: [
      { name: 'Max Drawdown', source: 'MaxDrawdown (3Y\u21925Y\u219210Y)', weight: 'Equal' },
      { name: 'Down Capture', source: 'DownCaptureRatio (3Y\u21925Y)', weight: 'Equal' },
      { name: 'Up/Down Ratio', source: 'UpCapture / DownCapture', weight: 'Equal' },
      { name: 'Worst Calendar Year', source: 'Min of 10 CY returns', weight: 'Equal' },
    ],
    formula: 'resilience = mean(DD_pctile, DC_pctile, UD_pctile, worst_CY_pctile)',
    notes: 'Uses a fallback chain for each metric: tries 3Y first, then 5Y, 10Y, 1Y. Up/Down ratio = Up Capture / Down Capture (higher is better). If no calendar year data exists, Max Drawdown is used as proxy for worst year.',
  },
];

const TIER_COLORS = [
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-red-100 text-red-700 border-red-200',
];

export default function LensFormulaDetails() {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-slate-500 leading-relaxed">
        Each lens produces a <span className="font-semibold text-slate-700">percentile rank (0-100)</span> within
        the fund&apos;s SEBI category. Funds are classified into 4 tiers at the 25th, 50th, and 75th percentile
        boundaries. No composite score is computed &mdash; the six lenses provide independent, multidimensional insight.
      </p>

      {LENS_DETAILS.map((lens) => (
        <div key={lens.name} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">{lens.name} Lens</h4>
                <p className="text-[11px] text-slate-500">{lens.question} &mdash; {lens.description}</p>
              </div>
              <div className="flex gap-1">
                {lens.tiers.map((tier, j) => (
                  <span key={tier} className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${TIER_COLORS[j]}`}>
                    {tier}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Inputs table */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Inputs</p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1 text-slate-400 font-medium">Metric</th>
                    <th className="text-left py-1 text-slate-400 font-medium">Source</th>
                    <th className="text-left py-1 text-slate-400 font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {lens.inputs.map((inp) => (
                    <tr key={inp.name} className="border-b border-slate-50">
                      <td className="py-1 text-slate-700 font-medium">{inp.name}</td>
                      <td className="py-1 text-slate-500 font-mono text-[10px]">{inp.source}</td>
                      <td className="py-1 text-slate-600">{inp.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Formula */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Formula</p>
              <code className="block bg-slate-50 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-700 border border-slate-200">
                {lens.formula}
              </code>
            </div>

            {/* Notes */}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {lens.notes}
            </p>

            {/* Tier thresholds */}
            <p className="text-[10px] text-slate-400">
              Tier thresholds: {lens.tierThresholds}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
