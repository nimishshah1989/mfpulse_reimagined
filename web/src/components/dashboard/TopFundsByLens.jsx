import { useState, useMemo } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatPct, formatAUMRaw } from '../../lib/format';
import { scoreColor } from '../../lib/lens';

const LENS_TABS = [
  { key: 'return_score', label: 'Return' },
  { key: 'risk_score', label: 'Risk' },
  { key: 'alpha_score', label: 'Alpha' },
  { key: 'consistency_score', label: 'Consistency' },
  { key: 'efficiency_score', label: 'Efficiency' },
  { key: 'resilience_score', label: 'Resilience' },
];

const LENS_DOT_KEYS = [
  { key: 'return_score', abbr: 'R' },
  { key: 'risk_score', abbr: 'Rk' },
  { key: 'consistency_score', abbr: 'C' },
  { key: 'alpha_score', abbr: 'A' },
  { key: 'efficiency_score', abbr: 'E' },
  { key: 'resilience_score', abbr: 'Rs' },
];

const LEGEND_ITEMS = [
  { color: '#059669', label: '80+' },
  { color: '#10b981', label: '60-79' },
  { color: '#d97706', label: '40-59' },
  { color: '#ef4444', label: '<40' },
];

export default function TopFundsByLens({ universe, onFundClick, loading }) {
  const [activeTab, setActiveTab] = useState('return_score');

  const topFunds = useMemo(() => {
    if (!universe || universe.length === 0) return [];
    return [...universe]
      .filter((f) => f[activeTab] != null)
      .sort((a, b) => (b[activeTab] || 0) - (a[activeTab] || 0))
      .slice(0, 15);
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

      {/* Fund table with lens columns */}
      {topFunds.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold" style={{ width: 24 }}>#</th>
                <th className="text-left py-2 px-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Fund</th>
                {LENS_DOT_KEYS.map(({ abbr }) => (
                  <th key={abbr} className="py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold text-center" style={{ width: 32 }}>{abbr}</th>
                ))}
                <th className="text-right py-2 px-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold" style={{ width: 64 }}>1Y</th>
                <th className="text-right py-2 pl-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold" style={{ width: 56 }}>AUM</th>
              </tr>
            </thead>
            <tbody>
              {topFunds.map((fund, idx) => {
                const return1y = fund.return_1y;
                const aum = fund.aum;
                return (
                  <tr
                    key={fund.mstar_id}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    onClick={() => onFundClick(fund.mstar_id)}
                  >
                    <td className="py-2 pr-1 text-slate-400 tabular-nums font-medium" style={{ fontSize: 11 }}>{idx + 1}</td>
                    <td className="py-2 px-1">
                      <p className="font-medium text-teal-700 truncate hover:underline" style={{ fontSize: 12, maxWidth: 200 }}>{fund.fund_name}</p>
                      <p className="text-slate-500 truncate" style={{ fontSize: 10 }}>{fund.category_name || 'Growth'}</p>
                    </td>
                    {LENS_DOT_KEYS.map(({ key }) => {
                      const score = fund[key];
                      const color = score != null ? scoreColor(score) : '#e2e8f0';
                      return (
                        <td key={key} className="py-2 text-center">
                          <span
                            title={`${key.replace('_score', '')}: ${score != null ? Math.round(score) : '--'}`}
                            style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }}
                          />
                        </td>
                      );
                    })}
                    <td className="py-2 px-1 text-right">
                      <span className={`font-bold tabular-nums ${return1y != null ? (return1y >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}`} style={{ fontSize: 12 }}>
                        {return1y != null ? formatPct(return1y) : '--'}
                      </span>
                    </td>
                    <td className="py-2 pl-1 text-right">
                      <span className="text-slate-500 tabular-nums" style={{ fontSize: 11 }}>{aum != null ? formatAUMRaw(aum) : '--'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend + count */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3">
              {LEGEND_ITEMS.map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                  <span className="text-slate-400" style={{ fontSize: 9 }}>{label}</span>
                </div>
              ))}
            </div>
            <span className="text-[10px] text-slate-400">
              Showing {topFunds.length} of {universe?.filter((f) => f[activeTab] != null).length || 0} scored funds
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
