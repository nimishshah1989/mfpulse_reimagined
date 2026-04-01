/**
 * Small layout sub-components for the Strategy Builder page.
 * Extracted to keep the main page under 300 lines.
 */

import SignalConditionCard from './SignalConditionCard';

export function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Strategy Builder</h1>
      <p className="text-sm text-slate-500 mt-1">
        Build a portfolio, configure signals, and compare SIP vs Signal-enhanced vs Lumpsum
      </p>
    </div>
  );
}

export function MarketPulseOfflineBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <p className="text-xs text-amber-700">
        MarketPulse is offline. Signal conditions are available but live data may be limited.
      </p>
    </div>
  );
}

export function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function InputField({ label, prefix, suffix, value, onChange, step, min, max }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 font-medium block mb-1.5">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full border border-slate-200 rounded-lg py-2 text-sm font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none ${
            prefix ? 'pl-9 pr-2' : 'pl-3 pr-2'
          }`}
          step={step}
          min={min}
          max={max}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

const PERIODS = ['3Y', '5Y', '7Y', '10Y'];

export function ConfigPanel({
  sipAmount, onSipChange,
  lumpsumBudget, onLumpsumChange,
  maxPctPerEvent, onMaxPctChange,
  cooldownDays, onCooldownChange,
  period, onPeriodChange,
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <InputField label="Monthly SIP" prefix="INR" value={sipAmount} onChange={onSipChange} step={1000} />
      <InputField label="Lumpsum Budget" prefix="INR" value={lumpsumBudget} onChange={onLumpsumChange} step={10000} />
      <InputField label="Max % per Event" suffix="%" value={maxPctPerEvent} onChange={onMaxPctChange} min={1} max={100} />
      <InputField label="Cooldown" suffix="days" value={cooldownDays} onChange={onCooldownChange} min={1} max={365} />
      <div>
        <label className="text-[10px] text-slate-500 font-medium block mb-1.5">Backtest Period</label>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                period === p
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SignalConditions({ rules, onAddRule, onRemoveRule, onUpdateRule }) {
  return (
    <div className="space-y-3">
      {rules.length === 0 && (
        <p className="text-xs text-slate-400 py-2">
          No signal rules configured. Add rules to enable signal-triggered top-ups.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rules.map((rule, idx) => (
          <SignalConditionCard
            key={idx}
            rule={rule}
            index={idx}
            onUpdate={(updated) => onUpdateRule(idx, updated)}
            onRemove={() => onRemoveRule(idx)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onAddRule}
        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-all flex items-center justify-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Signal Rule
      </button>
    </div>
  );
}
