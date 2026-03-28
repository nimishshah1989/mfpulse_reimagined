import { useCallback } from 'react';
import Card from '../shared/Card';
import Pill from '../shared/Pill';
import { fetchDefaultRules } from '../../lib/api';
import { SIGNAL_SOURCES, OPERATORS, EMPTY_RULE } from '../../lib/simulation';

function ConditionRow({ condition, onChange, onRemove, canRemove }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <select
        value={condition.signal_name}
        onChange={(e) => onChange({ ...condition, signal_name: e.target.value })}
        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">Signal...</option>
        {SIGNAL_SOURCES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value })}
        className="w-32 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">Op...</option>
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      <input
        type="number"
        value={condition.threshold}
        onChange={(e) => onChange({ ...condition, threshold: Number(e.target.value) })}
        className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500"
        placeholder="Value"
      />

      {canRemove && (
        <button
          onClick={onRemove}
          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 text-sm"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function RuleCard({ rule, ruleIndex, onChange, onDelete, rulesValid }) {
  const updateRule = useCallback(
    (updates) => onChange({ ...rule, ...updates }),
    [rule, onChange]
  );

  const updateCondition = useCallback(
    (condIdx, updated) => {
      const conditions = rule.conditions.map((c, i) => (i === condIdx ? updated : c));
      updateRule({ conditions });
    },
    [rule.conditions, updateRule]
  );

  const removeCondition = useCallback(
    (condIdx) => {
      const conditions = rule.conditions.filter((_, i) => i !== condIdx);
      updateRule({ conditions });
    },
    [rule.conditions, updateRule]
  );

  const addCondition = useCallback(() => {
    updateRule({
      conditions: [...rule.conditions, { signal_name: '', operator: '', threshold: 0 }],
    });
  }, [rule.conditions, updateRule]);

  const hasError = rulesValid === false;

  return (
    <Card className={hasError ? 'border-2 border-red-300' : ''}>
      <div className="flex items-center justify-between mb-3">
        <input
          value={rule.name}
          onChange={(e) => updateRule({ name: e.target.value })}
          className="text-sm font-medium text-slate-800 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none px-0 py-0.5"
          placeholder="Rule name"
        />
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm"
          title="Delete rule"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-2">Conditions</p>
        {rule.conditions.map((cond, i) => (
          <ConditionRow
            key={i}
            condition={cond}
            onChange={(updated) => updateCondition(i, updated)}
            onRemove={() => removeCondition(i)}
            canRemove={rule.conditions.length > 1}
          />
        ))}
        <button
          onClick={addCondition}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1"
        >
          + Add Condition
        </button>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 mr-1">Logic:</span>
          <Pill
            active={rule.logic === 'AND'}
            onClick={() => updateRule({ logic: 'AND' })}
          >
            AND
          </Pill>
          <Pill
            active={rule.logic === 'OR'}
            onClick={() => updateRule({ logic: 'OR' })}
          >
            OR
          </Pill>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Multiplier:</span>
          <select
            value={rule.multiplier}
            onChange={(e) => updateRule({ multiplier: Number(e.target.value) })}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}x</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Cooloff:</span>
          <input
            type="number"
            value={rule.cooloff_days}
            onChange={(e) => updateRule({ cooloff_days: Number(e.target.value) })}
            min={1}
            className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-xs text-slate-400">days</span>
        </div>
      </div>

      {hasError && (
        <p className="text-xs text-red-500 mt-1">Invalid rule configuration</p>
      )}
    </Card>
  );
}

export default function RuleBuilder({ rules, onRulesChange, rulesValid, disabled }) {
  const updateRule = useCallback(
    (index, updated) => {
      const next = rules.map((r, i) => (i === index ? updated : r));
      onRulesChange(next);
    },
    [rules, onRulesChange]
  );

  const deleteRule = useCallback(
    (index) => {
      onRulesChange(rules.filter((_, i) => i !== index));
    },
    [rules, onRulesChange]
  );

  const addRule = useCallback(() => {
    onRulesChange([...rules, { ...EMPTY_RULE, name: `Rule ${rules.length + 1}` }]);
  }, [rules, onRulesChange]);

  const resetToDefaults = useCallback(() => {
    fetchDefaultRules().then((res) => onRulesChange(res.data || []));
  }, [onRulesChange]);

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <div className="space-y-4">
        {rules.map((rule, i) => (
          <RuleCard
            key={i}
            rule={rule}
            ruleIndex={i}
            onChange={(updated) => updateRule(i, updated)}
            onDelete={() => deleteRule(i)}
            rulesValid={rulesValid}
          />
        ))}
      </div>

      <button
        onClick={addRule}
        className="mt-4 w-full border border-dashed border-slate-300 rounded-lg p-3 text-sm text-slate-500 hover:border-teal-500 hover:text-teal-600 transition-colors"
      >
        + Add Rule
      </button>

      <div className="mt-2 text-center">
        <button
          onClick={resetToDefaults}
          className="text-xs text-slate-500 hover:text-teal-600 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
