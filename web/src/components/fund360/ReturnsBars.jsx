import Card from '../shared/Card';

const PERIODS = [
  { key: 'return_1y', label: '1Y' },
  { key: 'return_3y', label: '3Y' },
  { key: 'return_5y', label: '5Y' },
];

const MAX_BAR_WIDTH = 100; // percentage

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

  const gapLabel =
    gap != null
      ? gap >= 0
        ? `+${gap.toFixed(1)}% ahead`
        : `${gap.toFixed(1)}% behind`
      : null;

  const fColor = fundVal != null && fundVal >= 0 ? '#0d9488' : '#dc2626';
  const cColor = '#94a3b8';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600 w-8">{label}</span>
        {gapLabel && (
          <span
            className={`text-[11px] font-mono tabular-nums font-medium ${
              gap >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {gapLabel}
          </span>
        )}
      </div>

      {/* Fund bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 w-10 text-right">Fund</span>
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full"
            style={{ width: `${fPct}%`, backgroundColor: fColor }}
          />
        </div>
        <span className="text-[11px] font-mono tabular-nums text-slate-700 w-14 text-right">
          {fundVal != null
            ? `${fundVal >= 0 ? '+' : ''}${Number(fundVal).toFixed(1)}%`
            : '—'}
        </span>
      </div>

      {/* Category avg bar */}
      {catVal != null && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 w-10 text-right">Avg</span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full"
              style={{ width: `${cPct}%`, backgroundColor: cColor }}
            />
          </div>
          <span className="text-[11px] font-mono tabular-nums text-slate-500 w-14 text-right">
            {`${catVal >= 0 ? '+' : ''}${Number(catVal).toFixed(1)}%`}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * ReturnsBars — visual bars for 1Y, 3Y, 5Y comparing fund vs category avg.
 *
 * Props:
 *   fundReturns     object — { return_1y, return_3y, return_5y }
 *   categoryReturns object — optional, same shape
 */
export default function ReturnsBars({ fundReturns, categoryReturns }) {
  if (!fundReturns) return null;

  const maxAbs = calcMaxAbs(fundReturns, categoryReturns);

  return (
    <Card title="Returns vs Peers">
      <div className="space-y-4">
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 rounded-full inline-block bg-teal-500" />
            Fund
          </span>
          {categoryReturns && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-1.5 rounded-full inline-block bg-slate-400" />
              Category avg
            </span>
          )}
        </div>
        {PERIODS.map(({ key, label }) => {
          const fundVal = fundReturns[key] != null ? Number(fundReturns[key]) : null;
          const catVal = categoryReturns?.[key] != null ? Number(categoryReturns[key]) : null;
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
    </Card>
  );
}
