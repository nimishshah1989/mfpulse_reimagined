import { useMemo } from 'react';
import { useRouter } from 'next/router';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import Pill from '../shared/Pill';
import SkeletonLoader from '../shared/SkeletonLoader';
import EmptyState from '../shared/EmptyState';
import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
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
  if (fund.return_class) tiers.push({ label: fund.return_class, type: 'return' });
  if (fund.risk_class) tiers.push({ label: fund.risk_class, type: 'risk' });
  if (fund.consistency_class) tiers.push({ label: fund.consistency_class, type: 'consistency' });
  if (fund.alpha_class) tiers.push({ label: fund.alpha_class, type: 'alpha' });
  if (fund.resilience_class) tiers.push({ label: fund.resilience_class, type: 'resilience' });
  if (fund.efficiency_class) tiers.push({ label: fund.efficiency_class, type: 'efficiency' });
  return tiers.slice(0, 3);
}

const PURCHASE_MODES = ['Regular', 'Direct', 'Both'];

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
  purchaseMode = 'Regular',
  onPurchaseModeChange,
}) {
  const router = useRouter();

  const filteredByMode = useMemo(() => {
    if (purchaseMode === 'Both') return funds;
    return funds.filter((f) => f.purchase_mode === purchaseMode);
  }, [funds, purchaseMode]);

  const rankedFunds = useMemo(
    () =>
      sector
        ? deriveDrillDownFunds({ sector, funds: filteredByMode, sectorExposures, sort, categoryFilter })
        : [],
    [sector, filteredByMode, sectorExposures, sort, categoryFilter],
  );

  if (sector === null) {
    return (
      <Card>
        <EmptyState message="Click a sector on the compass to see the best funds" />
      </Card>
    );
  }

  const quadrantColors = QUADRANT_COLORS[sector.quadrant];

  if (loading) {
    return (
      <Card>
        <div className="space-y-4">
          <SkeletonLoader />
          <SkeletonLoader />
          <SkeletonLoader />
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-base font-semibold text-slate-800">
          {sector.sector_name}
        </h3>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            quadrantColors?.badge || 'bg-slate-100 text-slate-600'
          }`}
        >
          {sector.quadrant}
        </span>
        {sector.rs_score != null && (
          <span className="font-mono tabular-nums text-sm text-slate-600">
            RS: {sector.rs_score}
          </span>
        )}
        {sector.rs_momentum != null && (
          <span className="font-mono tabular-nums text-sm text-slate-600">
            Momentum: {sector.rs_momentum > 0 ? '+' : ''}{Number(sector.rs_momentum).toFixed(1)}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Purchase mode */}
        <div className="flex gap-0.5">
          {PURCHASE_MODES.map((m) => (
            <Pill
              key={m}
              active={purchaseMode === m}
              onClick={() => onPurchaseModeChange?.(m)}
            >
              {m}
            </Pill>
          ))}
        </div>

        <div className="w-px h-4 bg-slate-200" />

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

      {/* Fund grid */}
      {rankedFunds.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 py-6 text-center">
            No funds found with significant exposure to {sector.sector_name}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rankedFunds.map((fund, idx) => {
            const exposure = sectorExposures?.[fund.mstar_id]?.[sector.sector_name] ?? null;
            const tiers = topTiers(fund);

            return (
              <div
                key={fund.mstar_id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all"
              >
                {/* Top row: rank + name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{fund.fund_name}</p>
                    <p className="text-xs text-slate-500">{fund.amc_name}</p>
                  </div>
                </div>

                {/* Tier badges */}
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge>{fund.category_name}</Badge>
                  {tiers.map((tier) => (
                    <TierBadge key={tier.label} label={tier.label} />
                  ))}
                </div>

                {/* Exposure bar */}
                {exposure != null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{sector.sector_name} exposure</span>
                      <span className="font-mono tabular-nums font-medium text-slate-700">
                        {formatPct(exposure / 100)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(exposure, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Six LensCircles */}
                <div className="flex gap-1 mb-3">
                  {LENS_SCORE_KEYS.map((key) => (
                    <LensCircle
                      key={key}
                      scoreKey={key}
                      value={fund[key]}
                      size={30}
                    />
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                    className="flex-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    View Fund 360&deg;
                  </button>
                  <button
                    onClick={() => router.push(`/strategies?fund=${fund.mstar_id}`)}
                    className="flex-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Add to Strategy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
