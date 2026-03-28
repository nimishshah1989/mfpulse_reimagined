import { useMemo } from 'react';
import { useRouter } from 'next/router';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import Pill from '../shared/Pill';
import SkeletonLoader from '../shared/SkeletonLoader';
import EmptyState from '../shared/EmptyState';
import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
import { lensLabel } from '../../lib/lens';
import { deriveDrillDownFunds, SORT_OPTIONS, QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct } from '../../lib/format';

const CATEGORY_OPTIONS = [
  'all',
  'Large Cap',
  'Mid Cap',
  'Small Cap',
  'Flexi Cap',
  'Sectoral/Thematic',
];

const LENS_SCORE_KEYS = [
  'return_score',
  'risk_score',
  'consistency_score',
  'alpha_score',
  'efficiency_score',
  'resilience_score',
];

/** Returns the top 2 lens class values for display as TierBadges */
function topTiers(fund) {
  const tiers = [];
  if (fund.return_class) tiers.push(fund.return_class);
  if (fund.consistency_class) tiers.push(fund.consistency_class);
  if (fund.alpha_class) tiers.push(fund.alpha_class);
  if (fund.resilience_class) tiers.push(fund.resilience_class);
  if (fund.risk_class) tiers.push(fund.risk_class);
  if (fund.efficiency_class) tiers.push(fund.efficiency_class);
  return tiers.slice(0, 2);
}

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

  const quadrantColors = QUADRANT_COLORS[sector.quadrant];
  const headerLine = [
    sector.sector_name,
    sector.quadrant,
    sector.rs_score != null ? `RS: ${sector.rs_score}` : null,
    sector.rs_momentum != null
      ? `Momentum: ${sector.rs_momentum > 0 ? '+' : ''}${Number(sector.rs_momentum).toFixed(1)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (loading) {
    return (
      <Card title={headerLine}>
        <div className="space-y-4">
          <SkeletonLoader />
          <SkeletonLoader />
          <SkeletonLoader />
        </div>
      </Card>
    );
  }

  return (
    <Card title={headerLine}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-1">
          {SORT_OPTIONS.map((opt) => (
            <Pill
              key={opt.key}
              active={sort === opt.key}
              onClick={() => onSortChange(opt.key)}
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
            const tiers = topTiers(fund);

            return (
              <div
                key={fund.mstar_id}
                className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-teal-200 transition-colors bg-white"
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
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
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

                {/* Six LensCircles */}
                <div className="flex gap-1 flex-shrink-0">
                  {LENS_SCORE_KEYS.map((key) => (
                    <LensCircle
                      key={key}
                      scoreKey={key}
                      value={fund[key]}
                      size={32}
                    />
                  ))}
                </div>

                {/* Top tier badges */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {tiers.map((tier) => (
                    <TierBadge key={tier} label={tier} />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap"
                  >
                    Deep Dive &rarr;
                  </button>
                  <button
                    onClick={() => router.push(`/strategies?fund=${fund.mstar_id}`)}
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
