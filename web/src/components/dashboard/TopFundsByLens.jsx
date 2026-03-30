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
      .slice(0, 10);
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

      {/* Fund rows with lens dots */}
      {topFunds.length > 0 ? (
        <div>
          {/* Header row for lens dot labels */}
          <div className="flex items-center px-0 mb-1">
            <div style={{ width: 24 }} />
            <div className="flex-1 min-w-0" />
            <div className="flex gap-[3px] mx-3">
              {LENS_DOT_KEYS.map(({ key, abbr }) => (
                <span
                  key={key}
                  className="text-slate-400 font-medium text-center"
                  style={{ width: 8, fontSize: 7, lineHeight: '10px' }}
                >
                  {abbr}
                </span>
              ))}
            </div>
            <div style={{ width: 60 }} />
            <div style={{ width: 50 }} />
          </div>

          {/* Fund rows */}
          {topFunds.map((fund, idx) => {
            const return1y = fund.return_1y;
            const aum = fund.aum;
            return (
              <div
                key={fund.mstar_id}
                className="flex items-center py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                style={{ borderBottom: '1px solid #f8fafc' }}
                onClick={() => onFundClick(fund.mstar_id)}
              >
                {/* Rank */}
                <span
                  className="text-slate-500 tabular-nums font-medium"
                  style={{ width: 24, fontSize: 12 }}
                >
                  {idx + 1}
                </span>

                {/* Fund info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium text-slate-800 truncate"
                    style={{ fontSize: 13 }}
                  >
                    {fund.fund_name}
                  </p>
                  <p className="text-slate-500 truncate" style={{ fontSize: 11 }}>
                    {fund.category_name || fund.plan_type || 'Direct Growth'}
                  </p>
                </div>

                {/* 6 Lens dots */}
                <div className="flex gap-[3px] mx-3">
                  {LENS_DOT_KEYS.map(({ key }) => {
                    const score = fund[key];
                    const color = score != null ? scoreColor(score) : '#e2e8f0';
                    return (
                      <span
                        key={key}
                        title={`${key.replace('_score', '')}: ${score != null ? Math.round(score) : '--'}`}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: color,
                          display: 'inline-block',
                        }}
                      />
                    );
                  })}
                </div>

                {/* 1Y Return */}
                <span
                  className={`font-bold tabular-nums text-right ${
                    return1y != null
                      ? return1y >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                      : 'text-slate-400'
                  }`}
                  style={{ fontSize: 12, width: 60 }}
                >
                  {return1y != null ? formatPct(return1y) : '--'}
                </span>

                {/* AUM */}
                <span
                  className="text-slate-600 tabular-nums text-right"
                  style={{ fontSize: 11, width: 50 }}
                >
                  {aum != null ? formatAUMRaw(aum) : '--'}
                </span>
              </div>
            );
          })}

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100">
            {LEGEND_ITEMS.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: color,
                    display: 'inline-block',
                  }}
                />
                <span className="text-slate-400" style={{ fontSize: 9 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
