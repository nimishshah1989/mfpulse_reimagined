import { formatPct, formatScore, formatAUM } from '../../lib/format';
import { scoreColor } from '../../lib/lens';
import Badge from '../shared/Badge';

const ALL_LENSES = [
  { key: 'return_score', classKey: 'return_class', label: 'Return' },
  { key: 'risk_score', classKey: 'risk_class', label: 'Risk' },
  { key: 'consistency_score', classKey: 'consistency_class', label: 'Consistency' },
  { key: 'alpha_score', classKey: 'alpha_class', label: 'Alpha' },
  { key: 'efficiency_score', classKey: 'efficiency_class', label: 'Efficiency' },
  { key: 'resilience_score', classKey: 'resilience_class', label: 'Resilience' },
];

export default function FundDetailPanel({ fund, onClose, onDeepDive, onSimulate }) {
  if (!fund) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[320px] bg-white border-l border-slate-200 shadow-xl z-40 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-100">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800 leading-tight">
            {fund.fund_name || fund.legal_name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{fund.amc_name}</p>
          <Badge variant="category" className="mt-1">
            {fund.category_name}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 ml-2 text-lg leading-none"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Headline tag */}
      {fund.headline_tag && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
          <p className="text-xs italic text-slate-600">
            {'\u201C'}{fund.headline_tag}{'\u201D'}
          </p>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Lens scores */}
        <div>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Lens Scores
          </h4>
          <div className="space-y-2">
            {ALL_LENSES.map((lens) => {
              const score = Number(fund[lens.key]) || 0;
              const tier = fund[lens.classKey];
              return (
                <div key={lens.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-600">{lens.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-medium text-slate-700">
                        {formatScore(score)}
                      </span>
                      {tier && <Badge variant="tier">{tier}</Badge>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Returns table */}
        <div>
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Returns
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: '1 Year', value: fund.return_1y },
                { label: '3 Year', value: fund.return_3y },
                { label: '5 Year', value: fund.return_5y },
              ].map((row) => (
                <tr key={row.label} className="border-b border-slate-50">
                  <td className="py-1 text-slate-500">{row.label}</td>
                  <td
                    className={`py-1 text-right font-mono font-medium ${
                      Number(row.value) >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatPct(row.value)}
                  </td>
                </tr>
              ))}
              {fund.aum != null && (
                <tr className="border-b border-slate-50">
                  <td className="py-1 text-slate-500">AUM</td>
                  <td className="py-1 text-right font-mono font-medium text-slate-700">
                    {formatAUM(Number(fund.aum) / 10000000)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <button
          type="button"
          onClick={() => onDeepDive && onDeepDive(fund)}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
        >
          Deep Dive {'\u2192'}
        </button>
        <button
          type="button"
          onClick={() => onSimulate && onSimulate(fund)}
          className="w-full px-4 py-2 text-sm font-medium text-teal-600 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
        >
          Simulate {'\u2192'}
        </button>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
