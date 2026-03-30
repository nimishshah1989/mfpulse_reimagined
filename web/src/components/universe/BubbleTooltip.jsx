import { formatPct, formatScore, formatAUM } from '../../lib/format';
import { ALL_LENS_KEYS, LENS_LABELS, LENS_CLASS_KEYS, scoreColor } from '../../lib/lens';
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
      <div className="text-xs text-slate-400 mb-2">
        {fund.category_name}
        {fund.aum != null && (
          <span className="ml-2 font-medium text-slate-500">
            AUM {formatAUM((Number(fund.aum) || 0) / 1e7)}
          </span>
        )}
      </div>

      {/* 6 lens mini-pills */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-2">
        {ALL_LENS_KEYS.map((lens) => {
          const score = Number(fund[lens]) || 0;
          return (
            <div key={lens} className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: scoreColor(score) }}
              />
              <span className="text-[9px] text-slate-500">{LENS_LABELS[lens]}</span>
              <span className="text-[9px] font-mono font-medium text-slate-700 ml-auto">{Math.round(score)}</span>
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
      <p className="text-[8px] text-teal-500 mt-1.5 text-center font-medium">Click for details &middot; Double-click for Fund 360</p>
    </div>
  );
}
