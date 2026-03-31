import { useState } from 'react';
import SectionTitle from '../shared/SectionTitle';

const ACTION_STYLES = {
  CREATED: 'bg-emerald-100 text-emerald-700',
  HOLDING_ADDED: 'bg-teal-100 text-teal-700',
  HOLDING_REMOVED: 'bg-red-100 text-red-700',
  REBALANCED: 'bg-blue-100 text-blue-700',
  CONFIG_CHANGED: 'bg-amber-100 text-amber-700',
};

const INITIAL_ROWS = 20;

export default function ChangeTrail({ trail }) {
  const [showAll, setShowAll] = useState(false);

  if (!trail?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Change Trail</SectionTitle>
        <p className="text-sm text-slate-400">No audit trail entries.</p>
      </div>
    );
  }

  const sorted = [...trail].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
  );
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_ROWS);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Append-only audit trail of all portfolio changes">
        Change Trail
      </SectionTitle>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 border-b border-slate-100">
              <th className="text-left py-2 pr-3">Date</th>
              <th className="text-left py-2 pr-3">Action</th>
              <th className="text-left py-2 pr-3">Details</th>
              <th className="text-left py-2">Actor</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry, i) => {
              const actionClass = ACTION_STYLES[entry.action] || 'bg-slate-100 text-slate-600';
              return (
                <tr
                  key={entry.id || i}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="py-2 pr-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {entry.date || '\u2014'}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${actionClass}`}
                    >
                      {entry.action || '\u2014'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-600 max-w-xs truncate">
                    {entry.details || '\u2014'}
                  </td>
                  <td className="py-2 text-slate-500">
                    {entry.actor || '\u2014'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > INITIAL_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 text-[11px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${sorted.length} entries`}
        </button>
      )}
    </div>
  );
}
