import { useState, useCallback } from 'react';
import { SIGNAL_SOURCES, OPERATORS, EMPTY_RULE } from '../../lib/simulation';

const INDICATOR_OPTIONS = [
  { value: 'breadth_21ema', label: 'Breadth 21 EMA', tooltip: 'Percentage of Nifty 500 stocks above their 21-day EMA. Below 40% signals widespread selling.' },
  { value: 'breadth_50ema', label: 'Breadth 50 EMA', tooltip: 'Percentage of stocks above 50-day EMA. Measures medium-term market health.' },
  { value: 'breadth_200ema', label: 'Breadth 200 EMA', tooltip: 'Percentage of stocks above 200-day EMA. Long-term structural market breadth.' },
  { value: 'sentiment_composite', label: 'Sentiment Composite', tooltip: 'Combined score from 26 market sentiment indicators. Below 30 = extreme fear.' },
  { value: 'vix_level', label: 'VIX Level', tooltip: 'India VIX — implied volatility. Above 25 = high fear, good for contrarian buying.' },
  { value: 'nifty_vs_200sma', label: 'Nifty vs 200 SMA', tooltip: 'Nifty distance from 200-day SMA. Below 0% = trading below long-term average.' },
  { value: 'sector_rs_leading', label: 'Sector RS Leading', tooltip: 'Number of sectors in "Leading" RS quadrant. More leaders = healthier market.' },
  { value: 'sector_rs_weakening', label: 'Sector RS Weakening', tooltip: 'Number of sectors losing relative strength. Rising count = deteriorating breadth.' },
  { value: 'market_regime', label: 'Market Regime', tooltip: 'Overall market regime score (0-100). Below 30 = bearish, above 70 = bullish.' },
];

const OPERATOR_LABELS = {
  BELOW: 'Falls below',
  ABOVE: 'Rises above',
  CROSSES_BELOW: 'Crosses below',
  CROSSES_ABOVE: 'Crosses above',
};

function SignalTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center text-[9px] font-bold transition-colors"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-800 text-white text-[10px] rounded-lg shadow-lg z-50 leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-slate-800 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConditionBuilder({
  rules,
  onRulesChange,
  marketpulseOnline = true,
}) {
  const addRule = useCallback(() => {
    onRulesChange([...rules, { ...EMPTY_RULE, name: `Rule ${rules.length + 1}` }]);
  }, [rules, onRulesChange]);

  const removeRule = useCallback((idx) => {
    onRulesChange(rules.filter((_, i) => i !== idx));
  }, [rules, onRulesChange]);

  const updateRule = useCallback((idx, field, value) => {
    const updated = rules.map((r, i) =>
      i === idx ? { ...r, [field]: value } : r
    );
    onRulesChange(updated);
  }, [rules, onRulesChange]);

  const updateCondition = useCallback((ruleIdx, condIdx, field, value) => {
    const updated = rules.map((r, i) => {
      if (i !== ruleIdx) return r;
      const conditions = r.conditions.map((c, j) =>
        j === condIdx ? { ...c, [field]: value } : c
      );
      return { ...r, conditions };
    });
    onRulesChange(updated);
  }, [rules, onRulesChange]);

  const addCondition = useCallback((ruleIdx) => {
    const updated = rules.map((r, i) => {
      if (i !== ruleIdx) return r;
      return {
        ...r,
        conditions: [
          ...r.conditions,
          { signal_name: 'breadth_21ema', operator: 'BELOW', threshold: 40 },
        ],
      };
    });
    onRulesChange(updated);
  }, [rules, onRulesChange]);

  const removeCondition = useCallback((ruleIdx, condIdx) => {
    const updated = rules.map((r, i) => {
      if (i !== ruleIdx) return r;
      return {
        ...r,
        conditions: r.conditions.filter((_, j) => j !== condIdx),
      };
    });
    onRulesChange(updated);
  }, [rules, onRulesChange]);

  if (!marketpulseOnline) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm text-amber-700 font-medium">MarketPulse Offline</p>
            <p className="text-xs text-amber-600 mt-1 leading-relaxed">
              Signal conditions are available but live trigger counts cannot be shown.
              You can still configure rules -- they will activate when MarketPulse is back online.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule, ruleIdx) => (
        <div key={ruleIdx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Rule header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">
                {ruleIdx + 1}
              </div>
              <input
                type="text"
                value={rule.name}
                onChange={(e) => updateRule(ruleIdx, 'name', e.target.value)}
                className="text-sm font-semibold text-slate-700 border-none bg-transparent focus:outline-none focus:ring-0 p-0"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRule(ruleIdx)}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Remove
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Conditions */}
            {rule.conditions.map((cond, condIdx) => {
              const indicator = INDICATOR_OPTIONS.find((o) => o.value === cond.signal_name);
              return (
                <div key={condIdx} className="flex flex-wrap items-center gap-2">
                  {condIdx > 0 && (
                    <button
                      type="button"
                      onClick={() => updateRule(ruleIdx, 'logic', rule.logic === 'AND' ? 'OR' : 'AND')}
                      className={`relative w-14 h-7 rounded-full transition-colors flex items-center ${
                        rule.logic === 'AND'
                          ? 'bg-teal-600'
                          : 'bg-amber-500'
                      }`}
                    >
                      <span className={`absolute w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                        rule.logic === 'AND' ? 'translate-x-1' : 'translate-x-8'
                      }`} />
                      <span className={`absolute text-[9px] font-bold text-white ${
                        rule.logic === 'AND' ? 'right-2' : 'left-1.5'
                      }`}>
                        {rule.logic}
                      </span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <select
                        value={cond.signal_name}
                        onChange={(e) => updateCondition(ruleIdx, condIdx, 'signal_name', e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none bg-white"
                      >
                        {INDICATOR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {indicator?.tooltip && (
                        <SignalTooltip text={indicator.tooltip} />
                      )}
                    </div>

                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(ruleIdx, condIdx, 'operator', e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none bg-white"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={cond.threshold}
                      onChange={(e) => updateCondition(ruleIdx, condIdx, 'threshold', Number(e.target.value))}
                      className="w-20 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  {rule.conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCondition(ruleIdx, condIdx)}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => addCondition(ruleIdx)}
              className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add condition
            </button>

            {/* Rule config: deploy action + cooloff */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-1">Deploy action</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={rule.multiplier}
                    onChange={(e) => updateRule(ruleIdx, 'multiplier', Number(e.target.value))}
                    className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    min={1}
                    step={0.5}
                  />
                  <span className="text-[10px] text-slate-400 font-medium">x SIP</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-1">Cool-off period</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={rule.cooloff_days}
                    onChange={(e) => updateRule(ruleIdx, 'cooloff_days', Number(e.target.value))}
                    className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    min={0}
                  />
                  <span className="text-[10px] text-slate-400 font-medium">days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRule}
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
