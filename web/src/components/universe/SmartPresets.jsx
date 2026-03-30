import { useMemo } from 'react';
import InfoIcon from '../shared/InfoIcon';

const PRESETS = [
  {
    id: 'alpha',
    icon: '\u2733',
    iconColor: 'text-violet-500',
    label: 'Alpha Generators',
    desc: 'Alpha Machine + Consistent',
    countColor: 'text-violet-600',
    borderClass: 'border-slate-200',
    filter: (f) => Number(f.alpha_score) >= 70 && Number(f.return_score) >= 60,
  },
  {
    id: 'sleep',
    icon: '\u25CB',
    iconColor: 'text-emerald-500',
    label: 'Sleep Well at Night',
    desc: 'Low Risk + Fortress',
    countColor: 'text-emerald-600',
    borderClass: 'border-slate-200',
    filter: (f) =>
      f.risk_class === 'LOW_RISK' &&
      ['ROCK_SOLID', 'CONSISTENT'].includes(f.consistency_class),
  },
  {
    id: 'cost',
    icon: '\u26A1',
    iconColor: 'text-sky-500',
    label: 'Cost Killers',
    desc: 'Lean + Strong Return',
    countColor: 'text-sky-600',
    borderClass: 'border-slate-200',
    filter: (f) =>
      f.efficiency_class === 'LEAN' && Number(f.net_expense_ratio) < 0.5,
  },
  {
    id: 'smallcap',
    icon: '\u25B2',
    iconColor: 'text-teal-500',
    label: 'Small Cap Stars',
    desc: 'Leader Return + Small Cap',
    countColor: 'text-teal-600',
    borderClass: 'border-slate-200',
    filter: (f) =>
      (f.category_name || '').toLowerCase().includes('small') &&
      Number(f.return_score) >= 70,
  },
  {
    id: 'turnaround',
    icon: '\u21BB',
    iconColor: 'text-amber-500',
    label: 'Turnaround Plays',
    desc: 'Weak \u2192 Improving 3M',
    countColor: 'text-amber-600',
    borderClass: 'border-slate-200',
    filter: (f) => {
      const r1y = Number(f.return_1y) || 0;
      const r3y = Number(f.return_3y) || 0;
      return r1y > r3y + 5;
    },
  },
  {
    id: 'avoid',
    icon: '\u26A0',
    iconColor: 'text-red-400',
    label: 'Avoid Zone',
    desc: '3+ Weak lenses',
    countColor: 'text-red-500',
    borderClass: 'border-red-100',
    filter: (f) =>
      f.return_class === 'WEAK' && f.alpha_class === 'NEGATIVE',
  },
];

export default function SmartPresets({ allFunds, activePreset, onPresetClick, viewMode, onViewModeChange }) {
  const counts = useMemo(() => {
    const result = {};
    PRESETS.forEach((p) => {
      result[p.id] = allFunds.filter(p.filter).length;
    });
    return result;
  }, [allFunds]);

  return (
    <section className="animate-in">
      <div className="flex items-center gap-2 mb-2">
        <p className="section-title">Quick Screener Presets</p>
        <InfoIcon tip="One-click filters that combine multiple lenses to find specific fund profiles. Each preset applies lens + return + risk filters automatically." />
      </div>
      <div className="flex items-center gap-3">
        <div className="scroll-x flex-1 min-w-0">
          <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPresetClick(activePreset === p.id ? null : p.id)}
                className={`preset-card px-3.5 py-2 rounded-lg bg-white border ${p.borderClass} flex items-center gap-2 ${
                  activePreset === p.id ? 'ring-2 ring-teal-400 border-teal-300' : ''
                }`}
              >
                <span className={`${p.iconColor} text-sm`}>{p.icon}</span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">{p.label}</p>
                  <p className="text-[9px] text-slate-400">{p.desc}</p>
                </div>
                <span className={`text-[10px] font-bold ${p.countColor} tabular-nums ml-1`}>
                  {counts[p.id]}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPresetClick('custom')}
              className={`px-3.5 py-2 rounded-lg border border-dashed text-[11px] transition-colors ${
                activePreset === 'custom'
                  ? 'border-teal-400 text-teal-600 bg-teal-50'
                  : 'border-slate-300 text-slate-400 hover:border-teal-300 hover:text-teal-600'
              }`}
            >
              + Custom Filter
            </button>
          </div>
        </div>

        {/* View mode toggle — fixed right side */}
        {onViewModeChange && (
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
            {[
              { id: 'scatter', label: 'Scatter' },
              { id: 'heatmap', label: 'Heatmap' },
              { id: 'treemap', label: 'Treemap' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onViewModeChange(mode.id)}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === mode.id
                    ? 'bg-white shadow-sm text-teal-700 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export { PRESETS };
