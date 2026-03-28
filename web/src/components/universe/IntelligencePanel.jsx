import { useMemo } from 'react';
import { LENS_OPTIONS, lensColor, lensLabel, LENS_LABELS } from '../../lib/lens';
import { formatPct, formatAUM, formatCount } from '../../lib/format';

function QuickStatCard({ label, value, sub, color }) {
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-2 flex-1 min-w-0">
      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate">
        {label}
      </p>
      <p
        className="font-mono text-base font-bold tabular-nums mt-0.5 truncate"
        style={{ color: color || '#1e293b' }}
      >
        {value}
      </p>
      {sub && <p className="text-[9px] text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function TopFundRow({ rank, fund, lensKey, onFundClick }) {
  const score = Number(fund[lensKey]) || 0;
  const color = lensColor(score);
  const aumCr = (Number(fund.aum) || 0) / 10000000;

  return (
    <button
      type="button"
      onClick={() => onFundClick?.(fund)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left group"
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-700 truncate group-hover:text-teal-700 transition-colors">
          {fund.fund_name || fund.legal_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-slate-500 tabular-nums">
            {Math.round(score)}
          </span>
          <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden max-w-16">
            <div
              className="h-full rounded-full"
              style={{ width: `${score}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[9px] text-slate-400 font-mono tabular-nums">
            {formatAUM(aumCr)}
          </span>
        </div>
      </div>
    </button>
  );
}

function QuadrantBox({ label, count, color, total }) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
  return (
    <div className="rounded-lg border border-slate-100 px-2 py-1.5 text-center">
      <p className="text-[9px] font-medium truncate" style={{ color }}>
        {label}
      </p>
      <p className="font-mono text-sm font-bold text-slate-800 tabular-nums">{formatCount(count)}</p>
      <p className="text-[8px] text-slate-400">{pct}%</p>
    </div>
  );
}

export default function IntelligencePanel({
  funds,
  allFundsCount,
  colorLens,
  xAxis,
  yAxis,
  onFundClick,
  collapsed,
  onToggleCollapse,
}) {
  const lensKey = colorLens || 'return_score';
  const lensName = LENS_LABELS[lensKey] || 'Return';

  // Quick stats
  const stats = useMemo(() => {
    if (!funds || funds.length === 0) {
      return { count: 0, avgReturn: 0, medianAum: 0 };
    }

    const returns = funds
      .map((f) => Number(f.return_1y))
      .filter((r) => !isNaN(r));
    const avgReturn =
      returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

    const aums = funds
      .map((f) => (Number(f.aum) || 0) / 10000000)
      .filter((a) => a > 0)
      .sort((a, b) => a - b);
    const medianAum =
      aums.length > 0 ? aums[Math.floor(aums.length / 2)] : 0;

    return { count: funds.length, avgReturn, medianAum };
  }, [funds]);

  // Top 5 funds by selected lens
  const top5 = useMemo(() => {
    if (!funds || funds.length === 0) return [];
    return [...funds]
      .sort((a, b) => (Number(b[lensKey]) || 0) - (Number(a[lensKey]) || 0))
      .slice(0, 5);
  }, [funds, lensKey]);

  // Quadrant distribution
  const quadrants = useMemo(() => {
    if (!funds || funds.length === 0) {
      return { topRight: 0, topLeft: 0, bottomRight: 0, bottomLeft: 0 };
    }
    let topRight = 0;
    let topLeft = 0;
    let bottomRight = 0;
    let bottomLeft = 0;

    funds.forEach((f) => {
      const x = Number(f[xAxis]) || 0;
      const y = Number(f[yAxis]) || 0;
      if (x >= 50 && y >= 50) topRight += 1;
      else if (x < 50 && y >= 50) topLeft += 1;
      else if (x >= 50 && y < 50) bottomRight += 1;
      else bottomLeft += 1;
    });

    return { topRight, topLeft, bottomRight, bottomLeft };
  }, [funds, xAxis, yAxis]);

  // Tier breakdown for selected lens
  const tiers = useMemo(() => {
    const buckets = { Leader: 0, Strong: 0, Average: 0, Weak: 0 };
    (funds || []).forEach((f) => {
      const score = Number(f[lensKey]) || 0;
      if (score >= 75) buckets.Leader += 1;
      else if (score >= 60) buckets.Strong += 1;
      else if (score >= 30) buckets.Average += 1;
      else buckets.Weak += 1;
    });
    return buckets;
  }, [funds, lensKey]);

  const total = funds?.length || 0;

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col items-center py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
          title="Show intelligence panel"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="text-sm font-semibold text-slate-700">Intelligence</span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors lg:hidden xl:flex"
          title="Hide panel"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-4">
        {/* Quick Stats */}
        <section>
          <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Quick Stats
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            <QuickStatCard
              label="Funds"
              value={formatCount(stats.count)}
              sub={`of ${formatCount(allFundsCount)}`}
            />
            <QuickStatCard
              label="Avg 1Y"
              value={formatPct(stats.avgReturn)}
              color={stats.avgReturn >= 0 ? '#059669' : '#dc2626'}
            />
            <QuickStatCard
              label="Med AUM"
              value={formatAUM(stats.medianAum)}
            />
          </div>
        </section>

        {/* Top 5 Funds */}
        <section>
          <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Top 5 by {lensName}
          </h4>
          <div className="space-y-0.5">
            {top5.map((fund, i) => (
              <TopFundRow
                key={fund.mstar_id}
                rank={i + 1}
                fund={fund}
                lensKey={lensKey}
                onFundClick={onFundClick}
              />
            ))}
            {top5.length === 0 && (
              <p className="text-[10px] text-slate-400 text-center py-2">No funds in view</p>
            )}
          </div>
        </section>

        {/* Quadrant Distribution */}
        <section>
          <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Quadrant Distribution
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            <QuadrantBox
              label="High Risk / High Ret"
              count={quadrants.topLeft}
              color="#d97706"
              total={total}
            />
            <QuadrantBox
              label="Sweet Spot"
              count={quadrants.topRight}
              color="#059669"
              total={total}
            />
            <QuadrantBox
              label="Avoid Zone"
              count={quadrants.bottomLeft}
              color="#dc2626"
              total={total}
            />
            <QuadrantBox
              label="Steady / Low Ret"
              count={quadrants.bottomRight}
              color="#2563eb"
              total={total}
            />
          </div>
        </section>

        {/* Tier Breakdown */}
        <section>
          <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {lensName} Tier Breakdown
          </h4>

          {/* Stacked horizontal bar */}
          {total > 0 && (
            <div className="space-y-1.5">
              <div className="h-3 rounded-full overflow-hidden flex bg-slate-100">
                {[
                  { key: 'Leader', color: '#085041' },
                  { key: 'Strong', color: '#0d9488' },
                  { key: 'Average', color: '#BA7517' },
                  { key: 'Weak', color: '#E24B4A' },
                ].map(({ key, color }) => {
                  const pct = (tiers[key] / total) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={key}
                      className="h-full transition-all relative group"
                      style={{
                        width: `${Math.max(pct, 1)}%`,
                        backgroundColor: color,
                      }}
                      title={`${key}: ${tiers[key]} (${pct.toFixed(0)}%)`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {[
                  { key: 'Leader', color: '#085041' },
                  { key: 'Strong', color: '#0d9488' },
                  { key: 'Average', color: '#BA7517' },
                  { key: 'Weak', color: '#E24B4A' },
                ].map(({ key, color }) => (
                  <div key={key} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[9px] text-slate-500">
                      {key}{' '}
                      <span className="font-mono tabular-nums font-medium text-slate-700">
                        {tiers[key]}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
