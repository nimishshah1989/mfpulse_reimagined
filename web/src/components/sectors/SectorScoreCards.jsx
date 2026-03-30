/**
 * SectorScoreCards — At-a-glance sector intelligence grid.
 * Each card: sector name, RS score gauge, momentum arrow, quadrant badge,
 * weighted return, AUM exposed, fund count, and 1-line action.
 */
import { useMemo } from 'react';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatAUMRaw, formatPct } from '../../lib/format';

const QUADRANT_ACTIONS = {
  Leading: { text: 'Overweight', icon: '↑' },
  Improving: { text: 'Accumulate', icon: '↗' },
  Weakening: { text: 'Reduce', icon: '↘' },
  Lagging: { text: 'Avoid', icon: '↓' },
};

function RSGauge({ score, color }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SectorCard({ sector, onClick }) {
  const q = sector.quadrant || 'Lagging';
  const colors = QUADRANT_COLORS[q] || QUADRANT_COLORS.Lagging;
  const action = QUADRANT_ACTIONS[q] || QUADRANT_ACTIONS.Lagging;
  const mom = sector.rs_momentum ?? sector.momentum_1m ?? 0;
  const wRet = sector.weighted_return ?? 0;
  const aum = sector.total_aum_exposed ?? 0;

  return (
    <button
      type="button"
      onClick={() => onClick?.(sector)}
      className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-teal-300 hover:shadow-sm transition-all group w-full"
    >
      {/* Header: name + quadrant badge */}
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-bold text-slate-800 leading-tight">
          {sector.sector_name}
        </p>
        <span
          className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${colors.badge}`}
        >
          {q}
        </span>
      </div>

      {/* RS Score gauge */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-slate-400 uppercase">RS Score</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: colors.circle }}>
            {Math.round(sector.rs_score)}
          </span>
        </div>
        <RSGauge score={sector.rs_score} color={colors.circle} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
        <div>
          <span className="text-[8px] text-slate-400 uppercase">Momentum</span>
          <p className={`text-[11px] font-bold tabular-nums ${mom >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {mom > 0 ? '+' : ''}{Number(mom).toFixed(1)}
          </p>
        </div>
        <div>
          <span className="text-[8px] text-slate-400 uppercase">Wt. Return</span>
          <p className={`text-[11px] font-bold tabular-nums ${wRet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatPct(wRet)}
          </p>
        </div>
        <div>
          <span className="text-[8px] text-slate-400 uppercase">AUM Exposed</span>
          <p className="text-[11px] font-semibold text-slate-600 tabular-nums">
            {formatAUMRaw(aum)}
          </p>
        </div>
        <div>
          <span className="text-[8px] text-slate-400 uppercase">Funds</span>
          <p className="text-[11px] font-semibold text-slate-600 tabular-nums">
            {sector.fund_count ?? 0}
          </p>
        </div>
      </div>

      {/* Action */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold"
        style={{
          backgroundColor: `${colors.circle}10`,
          color: colors.circle,
        }}
      >
        <span>{action.icon}</span>
        <span>{action.text}</span>
        <span className="ml-auto text-[9px] opacity-70 group-hover:opacity-100 transition-opacity">
          Explore →
        </span>
      </div>
    </button>
  );
}

export default function SectorScoreCards({ sectors, onSectorClick }) {
  const sorted = useMemo(() => {
    if (!sectors?.length) return [];
    return [...sectors].sort((a, b) => (b.rs_score || 0) - (a.rs_score || 0));
  }, [sectors]);

  if (sorted.length === 0) return null;

  // Group by quadrant for narrative
  const leading = sorted.filter((s) => s.quadrant === 'Leading');
  const improving = sorted.filter((s) => s.quadrant === 'Improving');
  const weakening = sorted.filter((s) => s.quadrant === 'Weakening');
  const lagging = sorted.filter((s) => s.quadrant === 'Lagging');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="section-title">Sector Intelligence</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {leading.length > 0
              ? `${leading.map((s) => s.sector_name).join(', ')} leading. `
              : 'No sectors in Leading quadrant. '}
            {improving.length > 0
              ? `${improving.map((s) => s.sector_name).join(', ')} improving — early entry window.`
              : ''}
            {weakening.length > 0
              ? ` ${weakening.length} sector${weakening.length > 1 ? 's' : ''} weakening — reduce exposure.`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          {[
            { q: 'Leading', n: leading.length },
            { q: 'Improving', n: improving.length },
            { q: 'Weakening', n: weakening.length },
            { q: 'Lagging', n: lagging.length },
          ].map(({ q, n }) => (
            <span key={q} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: QUADRANT_COLORS[q]?.circle }}
              />
              <span className="text-slate-500 font-medium">{n}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
        {sorted.map((sector) => (
          <SectorCard
            key={sector.sector_name}
            sector={sector}
            onClick={onSectorClick}
          />
        ))}
      </div>
    </div>
  );
}
