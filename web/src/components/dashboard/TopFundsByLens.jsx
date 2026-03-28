import { useState } from 'react';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatScore } from '../../lib/format';
import { lensColor, lensLabel, lensBgColor } from '../../lib/lens';

const LENS_TABS = [
  { key: 'return_score', label: 'Return', shortLabel: 'Ret' },
  { key: 'risk_score', label: 'Risk', shortLabel: 'Rsk' },
  { key: 'consistency_score', label: 'Consistency', shortLabel: 'Con' },
  { key: 'alpha_score', label: 'Alpha', shortLabel: 'Alp' },
  { key: 'efficiency_score', label: 'Efficiency', shortLabel: 'Eff' },
  { key: 'resilience_score', label: 'Resilience', shortLabel: 'Res' },
];

function TierBadge({ score }) {
  const tier = lensLabel(score);
  const bg = lensBgColor(score);
  const color = lensColor(score);

  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color }}
    >
      {tier}
    </span>
  );
}

function FundCard({ fund, rank, scoreKey, onFundClick }) {
  const score = fund.score || fund[scoreKey] || 0;
  const color = lensColor(score);

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
      onClick={() => onFundClick(fund.mstar_id)}
    >
      {/* Rank */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {rank}
      </div>

      {/* Fund info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate group-hover:text-teal-600 transition-colors">
          {fund.fund_name}
        </p>
        <p className="text-[10px] text-slate-400 truncate">
          {fund.amc_name || fund.category_name || ''}
        </p>
      </div>

      {/* Score + tier */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <TierBadge score={score} />
        <span
          className="text-sm font-bold font-mono tabular-nums"
          style={{ color }}
        >
          {formatScore(score)}
        </span>
      </div>
    </div>
  );
}

export default function TopFundsByLens({ fundsByLens, onFundClick, loading }) {
  const [activeTab, setActiveTab] = useState('return_score');

  if (loading || !fundsByLens) {
    return <SkeletonLoader className="h-64 rounded-xl" />;
  }

  const activeFunds = fundsByLens[activeTab] || [];

  return (
    <Card>
      {/* Tab selector */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {LENS_TABS.map(({ key, label, shortLabel }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Fund list */}
      {activeFunds.length > 0 ? (
        <div className="space-y-0.5">
          {activeFunds.slice(0, 5).map((fund, idx) => (
            <FundCard
              key={fund.mstar_id}
              fund={fund}
              rank={idx + 1}
              scoreKey={activeTab}
              onFundClick={onFundClick}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-6">
          No fund data available for this lens.
        </p>
      )}
    </Card>
  );
}
