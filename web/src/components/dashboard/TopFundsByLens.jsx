import { useState, useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';
import SectionTitle from '../shared/SectionTitle';
import { formatScore, formatPct, formatAUM } from '../../lib/format';
import { lensColor } from '../../lib/lens';

const LENS_TABS = [
  { key: 'return_score', label: 'Return' },
  { key: 'risk_score', label: 'Risk' },
  { key: 'alpha_score', label: 'Alpha' },
  { key: 'consistency_score', label: 'Consistency' },
  { key: 'efficiency_score', label: 'Efficiency' },
  { key: 'resilience_score', label: 'Resilience' },
];

function ScoreBadge({ score }) {
  const s = Math.round(score || 0);
  let bg = 'bg-emerald-50';
  let text = 'text-emerald-700';
  if (s < 50) { bg = 'bg-amber-50'; text = 'text-amber-700'; }
  if (s < 30) { bg = 'bg-red-50'; text = 'text-red-700'; }
  if (s >= 80) { bg = 'bg-emerald-50'; text = 'text-emerald-700'; }
  else if (s >= 60) { bg = 'bg-teal-50'; text = 'text-teal-700'; }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {s}
    </span>
  );
}

export default function TopFundsByLens({ universe, onFundClick, loading }) {
  const [activeTab, setActiveTab] = useState('return_score');

  const topFunds = useMemo(() => {
    if (!universe || universe.length === 0) return [];
    return [...universe]
      .filter((f) => f[activeTab] != null)
      .sort((a, b) => (b[activeTab] || 0) - (a[activeTab] || 0))
      .slice(0, 5);
  }, [universe, activeTab]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-80 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Top Funds by Lens</p>
      </div>

      {/* Lens tabs -- pill-group style matching mockup */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 mb-4">
        {LENS_TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors rounded-md ${
                isActive
                  ? 'bg-white shadow-sm text-teal-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Fund table */}
      {topFunds.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-slate-400 uppercase tracking-wider">
              <th className="text-left pb-2 pl-2 w-6">#</th>
              <th className="text-left pb-2">Fund Name</th>
              <th className="text-left pb-2">Category</th>
              <th className="text-right pb-2">Score</th>
              <th className="text-right pb-2">1Y Return</th>
              <th className="text-right pb-2 pr-2">AUM (Cr)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topFunds.map((fund, idx) => {
              const return1y = fund.return_1y;
              const aum = fund.aum;
              return (
                <tr
                  key={fund.mstar_id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => onFundClick(fund.mstar_id)}
                >
                  <td className="py-2.5 pl-2 text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="py-2.5">
                    <div>
                      <p className="font-medium text-slate-800 truncate max-w-[220px]">
                        {fund.fund_name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {fund.plan_type || 'Direct Growth'}
                      </p>
                    </div>
                  </td>
                  <td className="py-2.5 text-slate-500 truncate max-w-[100px]">
                    {fund.category_name || '--'}
                  </td>
                  <td className="py-2.5 text-right">
                    <ScoreBadge score={fund[activeTab]} />
                  </td>
                  <td className={`py-2.5 text-right font-semibold tabular-nums ${return1y != null ? (return1y >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}`}>
                    {return1y != null ? formatPct(return1y) : '--'}
                  </td>
                  <td className="py-2.5 text-right pr-2 text-slate-500 tabular-nums">
                    {aum != null ? Number(aum).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-slate-400 text-center py-6">
          No fund data available for this lens.
        </p>
      )}
    </div>
  );
}
