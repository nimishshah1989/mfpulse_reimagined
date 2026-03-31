import { useState, useCallback } from 'react';
import { SIGNAL_SOURCES, OPERATORS, EMPTY_RULE } from '../../lib/simulation';
import RuleCard from './RuleCard';

const RULE_TEMPLATES = [
  {
    key: 'mild_correction',
    label: 'Mild Correction',
    description: 'Breadth 21 EMA < 30%, 1x, 30d cooloff',
    rule: {
      name: 'Mild Correction',
      conditions: [{ signal_name: 'breadth_21ema', operator: 'BELOW', threshold: 30 }],
      logic: 'AND',
      multiplier: 1,
      cooloff_days: 30,
    },
  },
  {
    key: 'moderate_panic',
    label: 'Moderate Panic',
    description: 'Breadth 200 EMA < 40% AND Sentiment < 35',
    rule: {
      name: 'Moderate Panic',
      conditions: [
        { signal_name: 'breadth_200ema', operator: 'BELOW', threshold: 40 },
        { signal_name: 'sentiment_composite', operator: 'BELOW', threshold: 35 },
      ],
      logic: 'AND',
      multiplier: 2,
      cooloff_days: 21,
    },
  },
  {
    key: 'deep_panic',
    label: 'Deep Panic',
    description: 'Breadth 200 EMA < 25% AND Sentiment < 20',
    rule: {
      name: 'Deep Panic',
      conditions: [
        { signal_name: 'breadth_200ema', operator: 'BELOW', threshold: 25 },
        { signal_name: 'sentiment_composite', operator: 'BELOW', threshold: 20 },
      ],
      logic: 'AND',
      multiplier: 3,
      cooloff_days: 14,
    },
  },
  {
    key: 'trend_recovery',
    label: 'Trend Recovery',
    description: 'Nifty above 200 SMA AND Breadth 50 EMA > 60%',
    rule: {
      name: 'Trend Recovery',
      conditions: [
        { signal_name: 'nifty_vs_200sma', operator: 'ABOVE', threshold: 0 },
        { signal_name: 'breadth_50ema', operator: 'ABOVE', threshold: 60 },
      ],
      logic: 'AND',
      multiplier: 1.5,
      cooloff_days: 45,
    },
  },
];

export default function ConditionBuilder({
  rules,
  onRulesChange,
  exitRules = [],
  onExitRulesChange,
  marketpulseOnline = true,
}) {
  const [showExitRules, setShowExitRules] = useState(exitRules.length > 0);

  const addRule = useCallback(() => {
    onRulesChange([...rules, { ...EMPTY_RULE, name: `Rule ${rules.length + 1}` }]);
  }, [rules, onRulesChange]);

  const removeRule = useCallback((idx) => {
    onRulesChange(rules.filter((_, i) => i !== idx));
  }, [rules, onRulesChange]);

  const updateRule = useCallback((idx, field, value) => {
    onRulesChange(rules.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, [rules, onRulesChange]);

  const updateCondition = useCallback((ruleIdx, condIdx, field, value) => {
    onRulesChange(rules.map((r, i) => {
      if (i !== ruleIdx) return r;
      const conditions = r.conditions.map((c, j) => j === condIdx ? { ...c, [field]: value } : c);
      return { ...r, conditions };
    }));
  }, [rules, onRulesChange]);

  const addCondition = useCallback((ruleIdx) => {
    onRulesChange(rules.map((r, i) => {
      if (i !== ruleIdx) return r;
      return { ...r, conditions: [...r.conditions, { signal_name: 'breadth_21ema', operator: 'BELOW', threshold: 40 }] };
    }));
  }, [rules, onRulesChange]);

  const removeCondition = useCallback((ruleIdx, condIdx) => {
    onRulesChange(rules.map((r, i) => {
      if (i !== ruleIdx) return r;
      return { ...r, conditions: r.conditions.filter((_, j) => j !== condIdx) };
    }));
  }, [rules, onRulesChange]);

  const handleApplyTemplate = useCallback((template) => {
    onRulesChange([...rules, { ...template.rule, conditions: template.rule.conditions.map((c) => ({ ...c })) }]);
  }, [rules, onRulesChange]);

  // Exit rule handlers
  const addExitRule = useCallback(() => {
    if (!onExitRulesChange) return;
    onExitRulesChange([...exitRules, {
      name: `Exit Rule ${exitRules.length + 1}`,
      conditions: [{ signal_name: 'breadth_21ema', operator: 'ABOVE', threshold: 70 }],
      logic: 'AND',
      action: 'REDUCE',
      reduce_pct: 25,
      cooloff_days: 30,
    }]);
  }, [exitRules, onExitRulesChange]);

  const removeExitRule = useCallback((idx) => {
    if (!onExitRulesChange) return;
    onExitRulesChange(exitRules.filter((_, i) => i !== idx));
  }, [exitRules, onExitRulesChange]);

  const updateExitRule = useCallback((idx, field, value) => {
    if (!onExitRulesChange) return;
    onExitRulesChange(exitRules.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, [exitRules, onExitRulesChange]);

  const updateExitCondition = useCallback((ruleIdx, condIdx, field, value) => {
    if (!onExitRulesChange) return;
    onExitRulesChange(exitRules.map((r, i) => {
      if (i !== ruleIdx) return r;
      const conditions = r.conditions.map((c, j) => j === condIdx ? { ...c, [field]: value } : c);
      return { ...r, conditions };
    }));
  }, [exitRules, onExitRulesChange]);

  const addExitCondition = useCallback((ruleIdx) => {
    if (!onExitRulesChange) return;
    onExitRulesChange(exitRules.map((r, i) => {
      if (i !== ruleIdx) return r;
      return { ...r, conditions: [...r.conditions, { signal_name: 'breadth_21ema', operator: 'ABOVE', threshold: 70 }] };
    }));
  }, [exitRules, onExitRulesChange]);

  const removeExitCondition = useCallback((ruleIdx, condIdx) => {
    if (!onExitRulesChange) return;
    onExitRulesChange(exitRules.map((r, i) => {
      if (i !== ruleIdx) return r;
      return { ...r, conditions: r.conditions.filter((_, j) => j !== condIdx) };
    }));
  }, [exitRules, onExitRulesChange]);

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
      {/* Rule Templates */}
      <div>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">Quick Templates</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RULE_TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => handleApplyTemplate(tpl)}
              className="p-2.5 rounded-lg border border-slate-200 text-left hover:border-teal-300 hover:bg-teal-50/50 transition-all"
            >
              <p className="text-xs font-semibold text-slate-700">{tpl.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Entry Rules */}
      <p className="text-xs font-semibold text-slate-600">Entry Rules</p>
      {rules.map((rule, ruleIdx) => (
        <RuleCard
          key={ruleIdx}
          rule={rule}
          ruleIdx={ruleIdx}
          onUpdateRule={updateRule}
          onRemoveRule={removeRule}
          onUpdateCondition={updateCondition}
          onAddCondition={addCondition}
          onRemoveCondition={removeCondition}
          ruleType="entry"
        />
      ))}

      <button
        type="button"
        onClick={addRule}
        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-all flex items-center justify-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Entry Rule
      </button>

      {/* Exit Rules Section */}
      {onExitRulesChange && (
        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowExitRules(!showExitRules)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showExitRules ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Configure Exit Rules (Optional)
          </button>

          {showExitRules && (
            <div className="mt-3 space-y-3">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Exit rules trigger position reductions when conditions are met.
              </p>
              {exitRules.map((rule, ruleIdx) => (
                <RuleCard
                  key={ruleIdx}
                  rule={rule}
                  ruleIdx={ruleIdx}
                  onUpdateRule={updateExitRule}
                  onRemoveRule={removeExitRule}
                  onUpdateCondition={updateExitCondition}
                  onAddCondition={addExitCondition}
                  onRemoveCondition={removeExitCondition}
                  ruleType="exit"
                />
              ))}
              <button
                type="button"
                onClick={addExitRule}
                className="w-full py-3 border-2 border-dashed border-amber-200 rounded-xl text-xs text-amber-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/50 transition-all flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Exit Rule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
