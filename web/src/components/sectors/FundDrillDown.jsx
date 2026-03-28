import { useMemo } from 'react';
import { useRouter } from 'next/router';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import Pill from '../shared/Pill';
import SkeletonLoader from '../shared/SkeletonLoader';
import EmptyState from '../shared/EmptyState';
import MiniRadar from './MiniRadar';
import { deriveDrillDownFunds, SORT_OPTIONS, QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct, formatScore } from '../../lib/format';

const CATEGORY_OPTIONS = [
  'all',
  'Large Cap',
  'Mid Cap',
  'Small Cap',
  'Flexi Cap',
  'Sectoral/Thematic',
];

export default function FundDrillDown({
  sector,
  funds,
  sectorExposures,
  exposureAvailable,
  loading,
  sort,
  onSortChange,
  categoryFilter,
  onCategoryFilterChange,
}) {
  const router = useRouter();

  const rankedFunds = useMemo(
    () =>
      sector
        ? deriveDrillDownFunds({ sector, funds, sectorExposures, sort, categoryFilter })
        : [],
    [sector, funds, sectorExposures, sort, categoryFilter],
  );

  if (sector === null) {
    return (
      <Card>
        <EmptyState message="Click a sector on the compass to see the best funds" />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card title={`Top Funds — ${sector.sector_name}`}>
        <div className="space-y-4">
          <SkeletonLoader />
          <SkeletonLoader />
          <SkeletonLoader />
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Top Funds — ${sector.sector_name}`}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <Pill
              key={opt.value}
              active={sort === opt.value}
              onClick={() => onSortChange(opt.value)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      {/* Exposure notice */}
      {exposureAvailable === false && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
          Sector exposure data will appear after the next data refresh
        </div>
      )}

      {/* Fund list */}
      {rankedFunds.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          No funds found with significant exposure to {sector.sector_name}
        </p>
      ) : (
        <div className="space-y-3">
          {rankedFunds.map((fund, idx) => {
            const exposure = sectorExposures?.[fund.mstar_id]?.[sector.sector_name] ?? null;
            const ret1y = fund.return_1y;
            const isPositive = ret1y != null && ret1y >= 0;

            return (
              <div
                key={fund.mstar_id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-teal-200 transition-colors bg-white"
              >
                {/* Rank */}
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {idx + 1}
                </div>

                {/* Fund info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fund.fund_name}</p>
                  <p className="text-xs text-slate-500">{fund.amc_name}</p>
                  <Badge>{fund.category_name}</Badge>

                  {/* Exposure bar */}
                  {exposure != null ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        {formatPct(exposure / 100)}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${Math.min(exposure, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">&mdash;</p>
                  )}
                </div>

                {/* Return */}
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-sm font-mono tabular-nums font-semibold ${
                      isPositive ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {ret1y != null ? formatPct(ret1y) : '—'}
                  </p>
                  <p className="text-xs text-slate-400">1Y Return</p>
                </div>

                {/* Radar */}
                <MiniRadar
                  scores={{
                    return_score: fund.return_score,
                    risk_score: fund.risk_score,
                    consistency_score: fund.consistency_score,
                    alpha_score: fund.alpha_score,
                    efficiency_score: fund.efficiency_score,
                    resilience_score: fund.resilience_score,
                  }}
                />

                {/* Return class */}
                <Badge>{fund.return_class}</Badge>

                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap"
                  >
                    Deep Dive &rarr;
                  </button>
                  <button
                    onClick={() => router.push(`/simulation?fund=${fund.mstar_id}`)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap"
                  >
                    Simulate &rarr;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
