import { formatPct } from '../../lib/format';

const PERIODS = [
  { key: 'return_1m', label: '1M' },
  { key: 'return_3m', label: '3M' },
  { key: 'return_6m', label: '6M' },
  { key: 'return_1y', label: '1Y' },
  { key: 'return_2y', label: '2Y' },
  { key: 'return_3y', label: '3Y' },
  { key: 'return_5y', label: '5Y' },
  { key: 'return_7y', label: '7Y' },
  { key: 'return_10y', label: '10Y' },
];

const MAX_BAR_WIDTH = 100;

function calcMaxAbs(fundReturns, categoryReturns) {
  let max = 1;
  for (const { key } of PERIODS) {
    const f = Math.abs(Number(fundReturns?.[key]) || 0);
    const c = Math.abs(Number(categoryReturns?.[key]) || 0);
    if (f > max) max = f;
    if (c > max) max = c;
  }
  return max;
}

function BarRow({ label, fundVal, catVal, maxAbs }) {
  const fPct = fundVal != null ? (Math.abs(fundVal) / maxAbs) * MAX_BAR_WIDTH : 0;
  const cPct = catVal != null ? (Math.abs(catVal) / maxAbs) * MAX_BAR_WIDTH : 0;
  const gap = fundVal != null && catVal != null ? fundVal - catVal : null;
  const fColor = fundVal != null && fundVal >= 0 ? '#0d9488' : '#dc2626';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 w-8">{label}</span>
        {gap != null && (
          <span
            className={`text-[10px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md ${
              gap >= 0
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : 'text-red-700 bg-red-50 border border-red-200'
            }`}
          >
            {gap >= 0 ? '+' : ''}{gap.toFixed(1)}% {gap >= 0 ? 'ahead' : 'behind'}
          </span>
        )}
      </div>

      {/* Fund bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 w-10 text-right font-medium">Fund</span>
        <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${fPct}%`, backgroundColor: fColor }}
          />
        </div>
        <span
          className={`text-xs font-mono tabular-nums font-bold w-16 text-right ${
            fundVal != null && fundVal >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {fundVal != null ? formatPct(fundVal) : '\u2014'}
        </span>
      </div>

      {/* Category bar */}
      {catVal != null && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 w-10 text-right font-medium">Cat</span>
          <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${cPct}%`, backgroundColor: '#94a3b8' }}
            />
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 w-16 text-right">
            {formatPct(catVal)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * ReturnsBars -- visual bars comparing fund vs category returns.
 *
 * Props:
 *   fundReturns     object
 *   categoryReturns object
 */
export default function ReturnsBars({ fundReturns, categoryReturns }) {
  if (!fundReturns) return null;

  const maxAbs = calcMaxAbs(fundReturns, categoryReturns);
  const hasAnyData = PERIODS.some(({ key }) => fundReturns[key] != null);

  if (!hasAnyData) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        No return data available
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex items-center gap-5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-2.5 rounded-full inline-block bg-teal-500" />
          Fund return
        </span>
        {categoryReturns && (
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-2.5 rounded-full inline-block bg-slate-400" />
            Category average
          </span>
        )}
      </div>
      {PERIODS.map(({ key, label }) => {
        const fundVal = fundReturns[key] != null ? Number(fundReturns[key]) : null;
        const catVal = categoryReturns?.[key] != null ? Number(categoryReturns[key]) : null;
        if (fundVal == null) return null;
        return (
          <BarRow
            key={key}
            label={label}
            fundVal={fundVal}
            catVal={catVal}
            maxAbs={maxAbs}
          />
        );
      })}
    </div>
  );
}
