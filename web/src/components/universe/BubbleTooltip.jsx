import { formatPct, formatScore } from '../../lib/format';
import { ALL_LENS_KEYS, LENS_LABELS, LENS_CLASS_KEYS } from '../../lib/lens';
import Badge from '../shared/Badge';

export default function BubbleTooltip({ tooltip }) {
  const { fund, x, y } = tooltip;

  const style = {
    position: 'fixed',
    left: x + 16,
    top: y - 10,
    zIndex: 50,
    maxWidth: 280,
  };

  if (typeof window !== 'undefined') {
    if (x > window.innerWidth - 320) style.left = x - 296;
    if (y > window.innerHeight - 300) style.top = y - 250;
  }

  return (
    <div
      style={style}
      className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 pointer-events-none"
    >
      <div className="text-sm font-semibold text-slate-800 truncate">
        {fund.fund_name || fund.legal_name}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{fund.amc_name}</div>
      <div className="text-xs text-slate-400 mb-2">{fund.category_name}</div>

      {/* Lens score bars */}
      <div className="space-y-1.5">
        {ALL_LENS_KEYS.map((lens) => {
          const score = Number(fund[lens]) || 0;
          const tierKey = LENS_CLASS_KEYS[lens];
          return (
            <div key={lens} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-16 text-right">
                {LENS_LABELS[lens]}
              </span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-600 w-6 text-right">
                {formatScore(score)}
              </span>
              {fund[tierKey] && (
                <Badge variant="tier" className="text-[8px] px-1 py-0">
                  {fund[tierKey]}
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Returns */}
      <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100">
        <div>
          <span className="text-[10px] text-slate-400">1Y</span>
          <span
            className={`ml-1 text-xs font-mono font-medium ${
              Number(fund.return_1y) >= 0
                ? 'text-emerald-600'
                : 'text-red-600'
            }`}
          >
            {formatPct(fund.return_1y)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400">3Y</span>
          <span
            className={`ml-1 text-xs font-mono font-medium ${
              Number(fund.return_3y) >= 0
                ? 'text-emerald-600'
                : 'text-red-600'
            }`}
          >
            {formatPct(fund.return_3y)}
          </span>
        </div>
      </div>
    </div>
  );
}
