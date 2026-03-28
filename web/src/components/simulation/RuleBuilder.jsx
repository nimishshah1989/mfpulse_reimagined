import { useCallback, useState } from 'react';
import InfoIcon from '../shared/InfoIcon';
import { fetchDefaultRules } from '../../lib/api';
import { SIGNAL_SOURCES, OPERATORS, EMPTY_RULE } from '../../lib/simulation';

const OPERATOR_LABELS = {
  BELOW: 'BELOW',
  ABOVE: 'ABOVE',
  CROSSES_BELOW: 'CROSSES BELOW',
  CROSSES_ABOVE: 'CROSSES ABOVE',
};

const SIGNAL_LABELS = {
  breadth_21ema: '% above 200 EMA',
  breadth_50ema: 'Breadth 50 EMA',
  breadth_200ema: 'Breadth 200 EMA',
  sentiment_composite: 'Sentiment',
  vix_level: 'VIX Level',
  nifty_vs_200sma: 'Nifty vs 200 SMA',
};

function describeConditions(conditions, logic) {
  if (!conditions || conditions.length === 0) return 'No conditions set';
  return conditions.map((c) => {
    const sigLabel = SIGNAL_LABELS[c.signal_name] || c.signal_name;
    const opLabel = OPERATOR_LABELS[c.operator] || c.operator;
    return `${sigLabel} ${opLabel} ${c.threshold}`;
  }).join(` ${logic || 'AND'} `);
}

function RuleCard({ rule, onToggle, onRemove }) {
  const isActive = rule.active !== false;

  return (
    <div className="rule-card p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold text-slate-700">{rule.name}</p>
        <button
          onClick={onToggle}
          className="flex items-center gap-1"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isActive ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          />
          <span className={`text-[9px] font-medium ${
            isActive ? 'text-emerald-600' : 'text-slate-400'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </button>
      </div>
      <p className="text-[9px] text-slate-500">
        {describeConditions(rule.conditions, rule.logic).split(/(CROSSES BELOW|CROSSES ABOVE|BELOW|ABOVE)/).map((part, i) => {
          if (['CROSSES BELOW', 'CROSSES ABOVE', 'BELOW', 'ABOVE'].includes(part)) {
            return <strong key={i}>{part}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
      <div className="flex gap-3 mt-1 text-[9px] text-slate-400">
        <span>Multiplier: {rule.multiplier}x</span>
        <span>Cool-off: {rule.cooloff_days} days</span>
        {rule.hit_count != null && (
          <span className="text-emerald-600 font-medium">
            Hit {rule.hit_count} times
          </span>
        )}
      </div>
    </div>
  );
}

function RuleEditor({ rule, onChange, onCancel, onSave }) {
  const [local, setLocal] = useState({ ...rule });

  function updateCondition(idx, field, value) {
    const conditions = local.conditions.map((c, i) =>
      i === idx ? { ...c, [field]: value } : c
    );
    setLocal({ ...local, conditions });
  }

  function addCondition() {
    setLocal({
      ...local,
      conditions: [...local.conditions, { signal_name: '', operator: '', threshold: 0 }],
    });
  }

  function removeCondition(idx) {
    if (local.conditions.length <= 1) return;
    setLocal({
      ...local,
      conditions: local.conditions.filter((_, i) => i !== idx),
    });
  }

  return (
    <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/30 space-y-3">
      <input
        value={local.name}
        onChange={(e) => setLocal({ ...local, name: e.target.value })}
        className="w-full text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-teal-400"
        placeholder="Rule name"
      />

      {local.conditions.map((cond, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={cond.signal_name}
            onChange={(e) => updateCondition(i, 'signal_name', e.target.value)}
            className="flex-1 text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-teal-400"
          >
            <option value="">Signal...</option>
            {SIGNAL_SOURCES.map((s) => (
              <option key={s} value={s}>{SIGNAL_LABELS[s] || s}</option>
            ))}
          </select>
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(i, 'operator', e.target.value)}
            className="w-24 text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-teal-400"
          >
            <option value="">Op...</option>
            {OPERATORS.map((op) => (
              <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
            ))}
          </select>
          <input
            type="number"
            value={cond.threshold}
            onChange={(e) => updateCondition(i, 'threshold', Number(e.target.value))}
            className="w-14 text-[10px] font-mono tabular-nums border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-teal-400"
          />
          {local.conditions.length > 1 && (
            <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600 text-[10px]">x</button>
          )}
        </div>
      ))}

      <button onClick={addCondition} className="text-[9px] text-teal-600 font-medium hover:text-teal-700">
        + Add condition
      </button>

      <div className="flex items-center gap-3 text-[10px]">
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Logic:</span>
          <select
            value={local.logic}
            onChange={(e) => setLocal({ ...local, logic: e.target.value })}
            className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-[10px]"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Mult:</span>
          <select
            value={local.multiplier}
            onChange={(e) => setLocal({ ...local, multiplier: Number(e.target.value) })}
            className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-[10px] font-mono"
          >
            {[1, 1.5, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}x</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Cool-off:</span>
          <input
            type="number"
            value={local.cooloff_days}
            onChange={(e) => setLocal({ ...local, cooloff_days: Number(e.target.value) })}
            className="w-12 border border-slate-200 rounded px-1.5 py-0.5 bg-white text-[10px] font-mono tabular-nums"
            min={1}
          />
          <span className="text-slate-400">d</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(local)}
          className="px-3 py-1 text-[10px] font-semibold text-white bg-teal-600 rounded hover:bg-teal-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function RuleBuilder({ rules, onRulesChange, disabled }) {
  const [editingIdx, setEditingIdx] = useState(null);

  const toggleRule = useCallback((idx) => {
    const next = rules.map((r, i) =>
      i === idx ? { ...r, active: r.active === false ? true : false } : r
    );
    onRulesChange(next);
  }, [rules, onRulesChange]);

  const removeRule = useCallback((idx) => {
    onRulesChange(rules.filter((_, i) => i !== idx));
  }, [rules, onRulesChange]);

  const saveRule = useCallback((idx, updated) => {
    const next = rules.map((r, i) => (i === idx ? updated : r));
    onRulesChange(next);
    setEditingIdx(null);
  }, [rules, onRulesChange]);

  const addRule = useCallback(() => {
    const newRules = [...rules, { ...EMPTY_RULE, name: `Rule ${rules.length + 1}`, active: true }];
    onRulesChange(newRules);
    setEditingIdx(newRules.length - 1);
  }, [rules, onRulesChange]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <p className="section-title">Signal Rules</p>
          <InfoIcon tip="Market signals from MarketPulse that trigger extra lumpsum deployments. When conditions are met AND logic matches, deploy % of reserve. Cool-off prevents over-deployment." />
        </div>
        <button
          onClick={addRule}
          className="text-[10px] text-teal-600 font-semibold hover:text-teal-700"
        >
          + Add Rule
        </button>
      </div>
      <div className="space-y-2">
        {rules.map((rule, i) => (
          editingIdx === i ? (
            <RuleEditor
              key={i}
              rule={rule}
              onChange={(updated) => saveRule(i, updated)}
              onCancel={() => setEditingIdx(null)}
              onSave={(updated) => saveRule(i, updated)}
            />
          ) : (
            <div key={i} onClick={() => setEditingIdx(i)} className="cursor-pointer">
              <RuleCard
                rule={rule}
                onToggle={(e) => { e?.stopPropagation?.(); toggleRule(i); }}
                onRemove={() => removeRule(i)}
              />
            </div>
          )
        ))}
        {rules.length === 0 && (
          <p className="text-[10px] text-slate-400 text-center py-3">
            No signal rules configured. Add a rule to enable signal-based deployments.
          </p>
        )}
      </div>
    </div>
  );
}
