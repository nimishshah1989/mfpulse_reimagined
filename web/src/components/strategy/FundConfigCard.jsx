import { useState } from 'react';
import InfoIcon from '../shared/InfoIcon';
import { formatAUM, formatPct } from '../../lib/format';
import { LENS_OPTIONS } from '../../lib/lens';

const LENS_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-purple-500',
  'bg-teal-500', 'bg-amber-500', 'bg-red-400',
];

const INVESTMENT_TYPES = [
  { value: 'SIP', label: 'Pure SIP' },
  { value: 'SIP_SIGNAL', label: 'SIP + Signal Top-ups' },
  { value: 'LUMPSUM', label: 'Pure Lumpsum' },
  { value: 'HYBRID', label: 'Hybrid' },
];

export default function FundConfigCard({
  fund,
  selected,
  config,
  onToggleSelect,
  onConfigChange,
  expanded,
  onToggleExpand,
}) {
  const [newEntryTrigger, setNewEntryTrigger] = useState('');
  const [newExitTrigger, setNewExitTrigger] = useState('');

  const lensScores = LENS_OPTIONS.map((l) => fund[l.key] ?? 0);

  const handleConfigField = (field, value) => {
    onConfigChange({ ...config, [field]: value });
  };

  const addEntryTrigger = () => {
    if (!newEntryTrigger.trim()) return;
    const triggers = [...(config.entry_triggers || []), { description: newEntryTrigger, multiplier: '1.5x' }];
    handleConfigField('entry_triggers', triggers);
    setNewEntryTrigger('');
  };

  const addExitTrigger = () => {
    if (!newExitTrigger.trim()) return;
    const triggers = [...(config.exit_triggers || []), { description: newExitTrigger, action: 'Sell 50%' }];
    handleConfigField('exit_triggers', triggers);
    setNewExitTrigger('');
  };

  const removeEntryTrigger = (idx) => {
    const triggers = (config.entry_triggers || []).filter((_, i) => i !== idx);
    handleConfigField('entry_triggers', triggers);
  };

  const removeExitTrigger = (idx) => {
    const triggers = (config.exit_triggers || []).filter((_, i) => i !== idx);
    handleConfigField('exit_triggers', triggers);
  };

  const topClass = fund.return_class || fund.alpha_class || '';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      selected ? 'border-teal-300 bg-teal-50/30' : 'border-slate-200'
    } ${!selected ? 'opacity-50' : ''}`}>
      {/* Header Row */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 accent-teal-600 rounded"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{fund.fund_name}</span>
              {fund.category_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                  {fund.category_name}
                </span>
              )}
              {topClass && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">
                  {topClass.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="text-xs text-slate-400">AUM {formatAUM(fund.aum_cr)}</span>
              {fund.expense_ratio != null && (
                <span className="text-xs text-slate-400">ER {fund.expense_ratio}%</span>
              )}
              {fund.return_1y != null && (
                <span className={`text-xs font-medium ${fund.return_1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  1Y: {formatPct(fund.return_1y)}
                </span>
              )}
              {fund.return_3y != null && (
                <span className={`text-xs font-medium ${fund.return_3y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  3Y: {formatPct(fund.return_3y)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Mini lens bars */}
          <div className="flex items-center gap-1">
            {lensScores.map((score, i) => (
              <div key={i} className="w-10" title={`${LENS_OPTIONS[i].label}: ${score}`}>
                <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${LENS_COLORS[i]} transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <svg
            width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </div>

      {/* Expanded Config Panel */}
      {expanded && selected && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-5">
          <div className="grid grid-cols-3 gap-6">
            {/* Investment Config */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1">
                INVESTMENT
                <InfoIcon tip="Choose how money flows into this fund. SIP invests a fixed amount monthly. Lumpsum deploys a one-time amount. Hybrid does both." />
              </p>
              <div className="space-y-2.5">
                <select
                  value={config.investment_type || 'SIP'}
                  onChange={(e) => handleConfigField('investment_type', e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-teal-400 w-full"
                >
                  {INVESTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20">SIP Amount</span>
                  <input
                    type="text"
                    value={config.sip_amount || ''}
                    onChange={(e) => handleConfigField('sip_amount', e.target.value)}
                    placeholder="\u20B930,000"
                    className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-28 tabular-nums focus:outline-none focus:border-teal-400"
                  />
                  <span className="text-xs text-slate-400">/month</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20">Reserve</span>
                  <input
                    type="text"
                    value={config.lumpsum_amount || ''}
                    onChange={(e) => handleConfigField('lumpsum_amount', e.target.value)}
                    placeholder="\u20B92,00,000"
                    className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-28 tabular-nums focus:outline-none focus:border-teal-400"
                  />
                  <InfoIcon tip="Lumpsum reserve deployed when entry signals fire." />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20">Allocation</span>
                  <input
                    type="text"
                    value={config.allocation_pct != null ? `${config.allocation_pct}%` : ''}
                    onChange={(e) => handleConfigField('allocation_pct', parseFloat(e.target.value) || 0)}
                    placeholder="20%"
                    className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-16 tabular-nums focus:outline-none focus:border-teal-400"
                  />
                  <span className="text-xs text-slate-400">of portfolio</span>
                </div>
              </div>
            </div>

            {/* Entry Triggers */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1">
                ENTRY TRIGGERS
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400 ml-1">Optional</span>
                <InfoIcon tip="Conditions that trigger additional investment (top-ups) from the reserve. When these signals fire, extra capital is deployed." />
              </p>
              <div className="space-y-2">
                {(config.entry_triggers || []).map((trigger, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-100 group">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 flex-1">{trigger.description}</span>
                    <span className="text-[10px] text-slate-400">{trigger.multiplier}</span>
                    <button
                      onClick={() => removeEntryTrigger(idx)}
                      className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  onClick={addEntryTrigger}
                  className="text-xs text-teal-600 font-medium hover:underline flex items-center gap-1 mt-1"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8" /></svg>
                  Add trigger
                </button>
              </div>
            </div>

            {/* Exit Triggers */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1">
                EXIT TRIGGERS
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400 ml-1">Optional</span>
                <InfoIcon tip="Conditions that trigger selling. Profit booking takes partial profits. Stop-loss exits fully if losses exceed a limit." />
              </p>
              <div className="space-y-2">
                {(config.exit_triggers || []).map((trigger, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-100 group">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${trigger.action?.includes('100') ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <span className="text-xs text-slate-600 flex-1">{trigger.description}</span>
                    <span className="text-[10px] text-slate-400">{trigger.action}</span>
                    <button
                      onClick={() => removeExitTrigger(idx)}
                      className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  onClick={addExitTrigger}
                  className="text-xs text-teal-600 font-medium hover:underline flex items-center gap-1 mt-1"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v8M2 6h8" /></svg>
                  Add trigger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
