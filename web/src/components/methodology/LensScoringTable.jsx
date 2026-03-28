import InfoIcon from '../shared/InfoIcon';

const LENSES = [
  {
    name: 'Return',
    measures: 'Does it make money?',
    inputs: 'Return 1Y (20%), 3Y (35%), 5Y (45%)',
    tiers: ['LEADER', 'STRONG', 'AVERAGE', 'WEAK'],
    color: 'teal',
  },
  {
    name: 'Risk',
    measures: 'How bumpy is the ride?',
    inputs: 'StdDev, MaxDrawdown, Beta, DownCapture (3Y)',
    tiers: ['LOW_RISK', 'MODERATE', 'ELEVATED', 'HIGH_RISK'],
    color: 'blue',
  },
  {
    name: 'Consistency',
    measures: 'Is it reliable?',
    inputs: 'Quartile frequency, calendar year ranks, Sortino',
    tiers: ['ROCK_SOLID', 'CONSISTENT', 'MIXED', 'ERRATIC'],
    color: 'violet',
  },
  {
    name: 'Alpha',
    measures: 'Manager skill?',
    inputs: 'Alpha 3Y/5Y, Info Ratio, excess vs category',
    tiers: ['ALPHA_MACHINE', 'POSITIVE', 'NEUTRAL', 'NEGATIVE'],
    color: 'amber',
  },
  {
    name: 'Efficiency',
    measures: 'Worth the cost?',
    inputs: 'Expense ratio, turnover, return/expense',
    tiers: ['LEAN', 'FAIR', 'EXPENSIVE', 'BLOATED'],
    color: 'emerald',
  },
  {
    name: 'Resilience',
    measures: 'Bad market behavior?',
    inputs: 'MaxDD, recovery speed, downside capture, worst year',
    tiers: ['FORTRESS', 'STURDY', 'FRAGILE', 'VULNERABLE'],
    color: 'rose',
  },
];

const TIER_COLORS = {
  0: 'bg-emerald-100 text-emerald-700',
  1: 'bg-teal-100 text-teal-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-red-100 text-red-700',
};

export default function LensScoringTable() {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500 leading-relaxed">
        Each lens produces a percentile rank (0-100) within the fund&apos;s SEBI category.
        Funds are then classified into 4 tiers. No composite score is computed -- the six
        lenses provide independent, multidimensional insight.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lens</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Measures</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Key Inputs</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  Tiers
                  <InfoIcon tip="Percentile 75+, 50-74, 25-49, 0-24 within SEBI category" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {LENSES.map((lens) => (
              <tr key={lens.name} className="border-b border-slate-50">
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-slate-800">{lens.name}</span>
                </td>
                <td className="py-2.5 px-3 text-slate-500">{lens.measures}</td>
                <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{lens.inputs}</td>
                <td className="py-2.5 px-3">
                  <div className="flex flex-wrap gap-1">
                    {lens.tiers.map((tier, j) => (
                      <span
                        key={tier}
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${TIER_COLORS[j]}`}
                      >
                        {tier}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
