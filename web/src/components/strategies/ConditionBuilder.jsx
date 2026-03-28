import { useState, useCallback } from 'react';
import { SIGNAL_SOURCES, OPERATORS, EMPTY_RULE } from '../../lib/simulation';

const INDICATOR_OPTIONS = [
  { value: 'breadth_21ema', label: 'Breadth 21 EMA' },
  { value: 'breadth_50ema', label: 'Breadth 50 EMA' },
  { value: 'breadth_200ema', label: 'Breadth 200 EMA' },
  { value: 'sentiment_composite', label: 'Sentiment Composite' },
  { value: 'vix_level', label: 'VIX Level' },
  { value: 'nifty_vs_200sma', label: 'Nifty vs 200 SMA' },
  { value: 'sector_rs_leading', label: 'Sector RS Leading Count' },
  { value: 'sector_rs_weakening', label: 'Sector RS Weakening Count' },
  { value: 'market_regime', label: 'Market Regime Score' },
];

const OPERATOR_LABELS = {
  BELOW: 'Falls below',
  ABOVE: 'Rises above',
  CROSSES_BELOW: 'Crosses below',
  CROSSES_ABOVE: 'Crosses above',
};

const DEPLOY_ACTIONS = [
  { value: 'multiplier', label: 'Nx SIP amount' },
  { value: 'fixed', label: 'Fixed amount' },
];

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
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-700 font-medium">MarketPulse Offline</p>
        <p className="text-xs text-amber-600 mt-1">
          Signal conditions are available but live trigger counts cannot be shown.
          You can still configure rules — they will activate when MarketPulse is back online.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule, ruleIdx) => (
        <div key={ruleIdx} className="border border-slate-200 rounded-lg p-4 space-y-3">
          {/* Rule header */}
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={rule.name}
              onChange={(e) => updateRule(ruleIdx, 'name', e.target.value)}
              className="text-sm font-semibold text-slate-700 border-none bg-transparent focus:outline-none focus:ring-0 p-0"
            />
            <button
              type="button"
              onClick={() => removeRule(ruleIdx)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>

          {/* Conditions */}
          {rule.conditions.map((cond, condIdx) => (
            <div key={condIdx} className="flex flex-wrap items-center gap-2">
              {condIdx > 0 && (
                <button
                  type="button"
                  onClick={() => updateRule(ruleIdx, 'logic', rule.logic === 'AND' ? 'OR' : 'AND')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    rule.logic === 'AND'
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {rule.logic}
                </button>
              )}

              <select
                value={cond.signal_name}
                onChange={(e) => updateCondition(ruleIdx, condIdx, 'signal_name', e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1"
              >
                {INDICATOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <select
                value={cond.operator}
                onChange={(e) => updateCondition(ruleIdx, condIdx, 'operator', e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1"
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
                ))}
              </select>

              <input
                type="number"
                value={cond.threshold}
                onChange={(e) => updateCondition(ruleIdx, condIdx, 'threshold', Number(e.target.value))}
                className="w-20 text-xs border border-slate-200 rounded px-2 py-1 font-mono tabular-nums"
              />

              {rule.conditions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCondition(ruleIdx, condIdx)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  x
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => addCondition(ruleIdx)}
            className="text-xs text-teal-600 hover:text-teal-700"
          >
            + Add condition
          </button>

          {/* Rule config: deploy action + cooloff */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[10px] text-slate-500 block">Deploy action</label>
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="number"
                  value={rule.multiplier}
                  onChange={(e) => updateRule(ruleIdx, 'multiplier', Number(e.target.value))}
                  className="w-14 text-xs border border-slate-200 rounded px-1.5 py-0.5 font-mono tabular-nums"
                  min={1}
                  step={0.5}
                />
                <span className="text-[10px] text-slate-400">x SIP</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block">Cool-off</label>
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="number"
                  value={rule.cooloff_days}
                  onChange={(e) => updateRule(ruleIdx, 'cooloff_days', Number(e.target.value))}
                  className="w-14 text-xs border border-slate-200 rounded px-1.5 py-0.5 font-mono tabular-nums"
                  min={0}
                />
                <span className="text-[10px] text-slate-400">days</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRule}
        className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors"
      >
        + Add Signal Rule
      </button>
    </div>
  );
}
