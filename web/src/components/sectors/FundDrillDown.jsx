import { useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart,
} from 'recharts';
import SkeletonLoader from '../shared/SkeletonLoader';
import EmptyState from '../shared/EmptyState';
import { deriveDrillDownFunds, QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct } from '../../lib/format';

const ACTION_COLORS = {
  ACCUMULATE: 'text-emerald-700 bg-emerald-50',
  OVERWEIGHT: 'text-emerald-700 bg-emerald-50',
  HOLD: 'text-amber-700 bg-amber-50',
  REDUCE: 'text-orange-700 bg-orange-50',
  AVOID: 'text-red-700 bg-red-50',
};

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
        ? deriveDrillDownFunds({
            sector,
            funds: filteredByMode,
            sectorExposures,
            sort,
            categoryFilter,
          })
        : [],
    [sector, filteredByMode, sectorExposures, sort, categoryFilter]
  );

  // Stable scatter data — memoized so Math.random is never called during re-renders.
  // Uses 50 as a stable fallback for missing risk_score instead of a random value.
  const scatterData = useMemo(
    () =>
      rankedFunds.map((f) => ({
        x: Number(f.risk_score) || 50,
        y: Number(f.return_1y) || 0,
        z: sectorExposures?.[f.mstar_id]?.[sector?.sector_name] || 10,
        name: f.fund_name,
        category: f.category_name,
        mstar_id: f.mstar_id,
      })),
    [rankedFunds, sectorExposures, sector]
  );

  if (!sector) return null;

  const quadrantColors = QUADRANT_COLORS[sector.quadrant];
  const qColor = quadrantColors?.circle || '#059669';

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader />
        <SkeletonLoader className="h-[400px]" />
      </div>
    );
  }

  // RS trend sparkline data
  const trendData = buildTrendData(sector);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3">
        <StatBox label="RS Score" value={sector.rs_score} color="#1e293b" />
        <StatBox
          label="Momentum"
          value={
            sector.rs_momentum != null
              ? `${sector.rs_momentum > 0 ? '+' : ''}${Number(sector.rs_momentum).toFixed(1)}`
              : '\u2014'
          }
          color={sector.rs_momentum >= 0 ? '#059669' : '#dc2626'}
        />
        <StatBox
          label="Quadrant"
          value={sector.quadrant}
          color={qColor}
          small
        />
        <StatBox
          label="Action"
          value={sector.action || 'Hold'}
          color={qColor}
          small
        />
        <StatBox
          label="Funds Exposed"
          value={rankedFunds.length}
          color="#0d9488"
        />
      </div>

      {/* RS Trend sparkline */}
      {trendData.length > 1 && (
        <div className="flex items-center gap-4">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider flex-shrink-0">
            RS Trend (3M)
          </p>
          <div className="flex-1" style={{ height: 40 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={qColor}
                  strokeWidth={2}
                  dot={{ r: 2, fill: qColor }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Fund Quadrant Scatter Chart */}
      {scatterData.length > 0 && (
        <div className="relative rounded-xl overflow-hidden" style={{ height: 520 }}>
          {/* Quadrant backgrounds */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none z-0">
            <div className="bg-emerald-50/60 border-r border-b border-slate-200/50 flex items-start justify-start p-3">
              <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">
                High Return &middot; Low Risk
              </span>
            </div>
            <div className="bg-amber-50/40 border-b border-slate-200/50 flex items-start justify-end p-3">
              <span className="text-[10px] font-bold text-amber-500/50 uppercase tracking-widest">
                High Return &middot; High Risk
              </span>
            </div>
            <div className="bg-sky-50/40 border-r border-slate-200/50 flex items-end justify-start p-3">
              <span className="text-[10px] font-bold text-sky-500/50 uppercase tracking-widest">
                Low Return &middot; Low Risk
              </span>
            </div>
            <div className="bg-red-50/40 flex items-end justify-end p-3">
              <span className="text-[10px] font-bold text-red-400/50 uppercase tracking-widest">
                Low Return &middot; High Risk
              </span>
            </div>
          </div>

          <div className="relative z-10 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Risk Score"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  label={{
                    value: 'Risk (Std Dev %) — Lower is Better \u2192',
                    position: 'bottom',
                    style: { fontSize: 11, fontWeight: 600, fill: '#64748b' },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="1Y Return %"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  label={{
                    value: '\u2191 1Y Return %',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fontWeight: 600, fill: '#64748b' },
                  }}
                />
                <Tooltip content={<FundTooltip />} />
                <Scatter
                  data={scatterData}
                  fill={qColor}
                  fillOpacity={0.6}
                  stroke={qColor}
                  strokeWidth={2}
                  onClick={(data) => {
                    if (data?.mstar_id) {
                      router.push(`/fund360?fund=${data.mstar_id}`);
                    }
                  }}
                  cursor="pointer"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Fund drill list */}
      {rankedFunds.length === 0 ? (
        <EmptyState
          message={`No funds found with significant exposure to ${sector.sector_name}`}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {rankedFunds.slice(0, 6).map((fund) => {
            const exposure =
              sectorExposures?.[fund.mstar_id]?.[sector.sector_name] ?? null;
            const returnVal = Number(fund.return_1y) || 0;

            return (
              <button
                key={fund.mstar_id}
                type="button"
                onClick={() =>
                  router.push(`/fund360?fund=${fund.mstar_id}`)
                }
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 cursor-pointer hover:border-teal-300 transition-colors text-left w-full"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2"
                  style={{
                    backgroundColor: `${qColor}20`,
                    borderColor: qColor,
                  }}
                >
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: qColor }}
                  >
                    {exposure != null ? `${Math.round(exposure)}%` : '\u2014'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {fund.fund_name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {fund.category_name || 'Fund'}
                    {fund.risk_score != null &&
                      ` \u00B7 StdDev ${Number(fund.risk_score).toFixed(1)}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-xs font-bold tabular-nums ${
                      returnVal >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {formatPct(returnVal)}
                  </p>
                  <p className="text-[9px] text-slate-400">1Y</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Action CTAs */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            const best = rankedFunds[0];
            if (best) router.push(`/strategy?fund=${best.mstar_id}`);
          }}
          className="flex-1 py-2.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
        >
          Add Best Fund to Strategy
        </button>
        <button
          onClick={() => router.push('/simulation')}
          className="flex-1 py-2.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-200"
        >
          Simulate Sector Rotation
        </button>
        <button className="py-2.5 px-4 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
          Compare Funds
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, small = false }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-[9px] text-slate-400 uppercase">{label}</p>
      <p
        className={`font-bold tabular-nums ${small ? 'text-sm' : 'text-lg'}`}
        style={{ color }}
      >
        {value ?? '\u2014'}
      </p>
    </div>
  );
}

function FundTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-xs">
      <p className="font-bold text-slate-800">{d.name}</p>
      <p className="text-slate-500">{d.category}</p>
      <div className="mt-1 space-y-0.5 font-mono tabular-nums">
        <p>1Y Return: {formatPct(d.y)}</p>
        <p>Std Dev: {d.x?.toFixed(1)}%</p>
        <p>Sector Exp: {Math.round(d.z)}%</p>
      </div>
    </div>
  );
}

function buildTrendData(sector) {
  const data = [];
  if (sector.history?.length) {
    sector.history.forEach((h, i) => {
      data.push({ month: i, score: h.rs_score });
    });
  }
  data.push({ month: data.length, score: sector.rs_score });
  return data;
}
