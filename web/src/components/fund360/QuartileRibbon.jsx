import InfoIcon from '../shared/InfoIcon';

const QUARTILE_COLORS = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-teal-100 text-teal-800',
  3: 'bg-amber-100 text-amber-800',
  4: 'bg-red-100 text-red-800',
};

const RANK_PERIODS = [
  { key: 'abs_rank_1m', qKey: 'quartile_1m', label: '1M' },
  { key: 'abs_rank_3m', qKey: 'quartile_3m', label: '3M' },
  { key: 'abs_rank_6m', qKey: 'quartile_6m', label: '6M' },
  { key: 'abs_rank_ytd', qKey: 'quartile_ytd', label: 'YTD' },
  { key: 'abs_rank_1y', qKey: 'quartile_1y', label: '1Y' },
  { key: 'abs_rank_2y', qKey: 'quartile_2y', label: '2Y' },
  { key: 'abs_rank_3y', qKey: 'quartile_3y', label: '3Y' },
  { key: 'abs_rank_4y', qKey: 'quartile_4y', label: '4Y' },
  { key: 'abs_rank_5y', qKey: 'quartile_5y', label: '5Y' },
  { key: 'abs_rank_7y', qKey: 'quartile_7y', label: '7Y' },
  { key: 'abs_rank_10y', qKey: 'quartile_10y', label: '10Y' },
];

// Calendar year percentiles — "10y ago" through "YTD", labels computed dynamically
const currentYear = new Date().getFullYear();
const CALENDAR_YEARS = [
  { key: 'cal_year_pctile_10y', label: String(currentYear - 10) },
  { key: 'cal_year_pctile_9y', label: String(currentYear - 9) },
  { key: 'cal_year_pctile_8y', label: String(currentYear - 8) },
  { key: 'cal_year_pctile_7y', label: String(currentYear - 7) },
  { key: 'cal_year_pctile_6y', label: String(currentYear - 6) },
  { key: 'cal_year_pctile_5y', label: String(currentYear - 5) },
  { key: 'cal_year_pctile_4y', label: String(currentYear - 4) },
  { key: 'cal_year_pctile_3y', label: String(currentYear - 3) },
  { key: 'cal_year_pctile_2y', label: String(currentYear - 2) },
  { key: 'cal_year_pctile_1y', label: String(currentYear - 1) },
  { key: 'cal_year_pctile_ytd', label: 'YTD' },
];

function percentileColor(pctile) {
  if (pctile == null) return { bg: '#f1f5f9', text: '#64748b' };
  const n = Number(pctile);
  if (n <= 25) return { bg: '#dcfce7', text: '#166534' };
  if (n <= 50) return { bg: '#d5f5f6', text: '#115e59' };
  if (n <= 75) return { bg: '#fef3c7', text: '#92400e' };
  return { bg: '#fee2e2', text: '#991b1b' };
}

/**
 * QuartileRibbon -- period quartile ribbon + calendar year percentiles.
 * Matches the mockup section 4 exactly.
 *
 * Props:
 *   ranks          object -- quartile and rank data from fund detail
 *   categoryName   string
 */
export default function QuartileRibbon({ ranks, categoryName }) {
  if (!ranks) return null;

  // Count Q1s
  const q1Count = RANK_PERIODS.filter(({ qKey }) => {
    const q = ranks[qKey];
    return q != null && Number(q) === 1;
  }).length;
  const totalPeriods = RANK_PERIODS.filter(({ qKey }) => ranks[qKey] != null).length;

  const hasQuartileData = totalPeriods > 0;

  // Calendar year percentiles
  const calYearData = CALENDAR_YEARS.map(({ key, label }) => ({
    label,
    value: ranks[key],
  })).filter((d) => d.value != null);

  if (!hasQuartileData && calYearData.length === 0) return null;

  return (
    <div className="space-y-4">
      {hasQuartileData && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Rank within {categoryName || 'category'} over time -- lower is better
            </p>
            {q1Count > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {q1Count} of {totalPeriods} periods in Q1
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr>
                  <th className="text-left text-[10px] text-slate-400 font-medium pb-2 pr-4 w-20">Period</th>
                  {RANK_PERIODS.map(({ label, qKey }) => {
                    if (ranks[qKey] == null) return null;
                    return (
                      <th key={label} className="text-[10px] text-slate-400 font-medium pb-2 px-1">
                        {label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Quartile row */}
                <tr>
                  <td className="text-left text-xs text-slate-600 font-medium pr-4 py-1">Quartile</td>
                  {RANK_PERIODS.map(({ label, qKey }) => {
                    const q = ranks[qKey];
                    if (q == null) return null;
                    const n = Number(q);
                    const colorCls = QUARTILE_COLORS[n] || 'bg-slate-100 text-slate-600';
                    return (
                      <td key={label} className="py-1">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-bold mx-auto ${colorCls}`}>
                          {n}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* Rank row */}
                <tr>
                  <td className="text-left text-xs text-slate-600 font-medium pr-4 py-1">Rank</td>
                  {RANK_PERIODS.map(({ label, key, qKey }) => {
                    if (ranks[qKey] == null) return null;
                    const rank = ranks[key];
                    const q = Number(ranks[qKey]);
                    return (
                      <td key={label} className="py-1">
                        <span className={`text-xs font-mono tabular-nums ${q <= 2 ? 'text-emerald-600' : 'text-slate-600'}`}>
                          {rank != null ? `#${rank}` : '\u2014'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Calendar Year Percentiles */}
      {calYearData.length > 0 && (
        <div className={hasQuartileData ? 'pt-4 border-t border-slate-100' : ''}>
          <p className="text-[10px] text-slate-400 mb-2">
            Calendar Year Percentile Rank (lower = better)
          </p>
          <div className="flex gap-2 overflow-x-auto">
            {calYearData.map(({ label, value }, i) => {
              const n = Number(value);
              const colors = percentileColor(n);
              const isLatest = i === calYearData.length - 1;
              return (
                <div key={label} className="text-center min-w-[48px]">
                  <p className={`text-[9px] text-slate-400 ${isLatest ? 'font-semibold' : ''}`}>{label}</p>
                  <div
                    className={`h-8 w-8 mx-auto rounded-lg flex items-center justify-center text-[10px] font-bold ${isLatest ? 'ring-2 ring-teal-400' : ''}`}
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    P{Math.round(n)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
