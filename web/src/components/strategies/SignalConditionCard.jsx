import { useState } from 'react';

/**
 * Signal metrics from MarketPulse APIs.
 * Each maps to a real endpoint on localhost:8000.
 */
export const SIGNAL_METRICS = [
  {
    value: 'breadth_21ema',
    label: 'Breadth 21 EMA',
    source: '/api/breadth/history',
    type: 'stock_count',
    tooltip: '% of Nifty 500 stocks above 21-day EMA. Below 40% = widespread selling.',
  },
  {
    value: 'breadth_50ema',
    label: 'Breadth 50 EMA',
    source: '/api/breadth/history',
    type: 'stock_count',
    tooltip: '% of stocks above 50-day EMA. Measures medium-term market health.',
  },
  {
    value: 'breadth_200ema',
    label: 'Breadth 200 EMA',
    source: '/api/breadth/history',
    type: 'stock_count',
    tooltip: '% of stocks above 200-day EMA. Long-term structural breadth.',
  },
  {
    value: 'sentiment_composite',
    label: 'Sentiment Composite',
    source: '/api/sentiment',
    type: 'percentage',
    tooltip: 'Combined score from 26 sentiment indicators. Below 30 = extreme fear.',
  },
  {
    value: 'vix_level',
    label: 'VIX Level',
    source: '/api/sentiment',
    type: 'percentage',
    tooltip: 'India VIX. Above 25 = high fear, good for contrarian buying.',
  },
  {
    value: 'nifty_vs_200sma',
    label: 'Nifty vs 200 SMA',
    source: '/api/breadth/history',
    type: 'percentage',
    tooltip: 'Nifty distance from 200-day SMA. Below 0% = below long-term average.',
  },
  {
    value: 'sector_rs_leading',
    label: 'Sector RS Leading',
    source: '/api/compass/sectors',
    type: 'stock_count',
    tooltip: 'Sectors in "Leading" RS quadrant. More leaders = healthier market.',
  },
  {
    value: 'sector_rs_weakening',
    label: 'Sector RS Weakening',
    source: '/api/compass/sectors',
    type: 'stock_count',
    tooltip: 'Sectors losing relative strength. Rising count = deteriorating breadth.',
  },
  {
    value: 'market_regime',
    label: 'Market Regime',
    source: '/api/compass/picks',
    type: 'percentage',
    tooltip: 'Overall regime score (0-100). Below 30 = bearish, above 70 = bullish.',
  },
];

const OPERATORS = [
  { value: 'BELOW', label: 'Falls below' },
  { value: 'ABOVE', label: 'Rises above' },
  { value: 'CROSSES_BELOW', label: 'Crosses below' },
  { value: 'CROSSES_ABOVE', label: 'Crosses above' },
];

const STOCK_COUNT_THRESHOLDS = [25, 50, 75, 100, 150];

export default function SignalConditionCard({ rule, index, onUpdate, onRemove }) {
  const updateCondition = (condIdx, field, value) => {
    const conditions = rule.conditions.map((c, j) =>
      j === condIdx ? { ...c, [field]: value } : c,
    );
    onUpdate({ conditions });
  };

  const addCondition = () => {
    onUpdate({
      conditions: [
        ...rule.conditions,
        { signal_name: 'breadth_21ema', operator: 'BELOW', threshold: 40 },
      ],
    });
  };

  const removeCondition = (condIdx) => {
    if (rule.conditions.length <= 1) return;
    onUpdate({ conditions: rule.conditions.filter((_, j) => j !== condIdx) });
  };

  const toggleLogic = () => {
    onUpdate({ logic: rule.logic === 'AND' ? 'OR' : 'AND' });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">
            {index + 1}
          </span>
          <input
            type="text"
            value={rule.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="text-xs font-semibold text-slate-700 border-none bg-transparent focus:outline-none p-0 w-40"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Conditions */}
        {rule.conditions.map((cond, condIdx) => (
          <ConditionRow
            key={condIdx}
            cond={cond}
            condIdx={condIdx}
            showLogic={condIdx > 0}
            logic={rule.logic}
            onToggleLogic={toggleLogic}
            onUpdate={(field, value) => updateCondition(condIdx, field, value)}
            onRemove={() => removeCondition(condIdx)}
            canRemove={rule.conditions.length > 1}
          />
        ))}

        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-50 transition-colors"
        >
          + Add condition
        </button>

        {/* Multiplier + Cooloff */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-500 font-medium">Deploy</label>
            <input
              type="number"
              value={rule.multiplier}
              onChange={(e) => onUpdate({ multiplier: Number(e.target.value) })}
              className="w-14 text-xs border border-slate-200 rounded px-2 py-1 font-mono tabular-nums focus:border-teal-500 outline-none"
              min={0.5} max={10} step={0.5}
            />
            <span className="text-[10px] text-slate-400">x SIP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-500 font-medium">Cool-off</label>
            <input
              type="number"
              value={rule.cooloff_days}
              onChange={(e) => onUpdate({ cooloff_days: Number(e.target.value) })}
              className="w-14 text-xs border border-slate-200 rounded px-2 py-1 font-mono tabular-nums focus:border-teal-500 outline-none"
              min={1} max={365}
            />
            <span className="text-[10px] text-slate-400">days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionRow({ cond, condIdx, showLogic, logic, onToggleLogic, onUpdate, onRemove, canRemove }) {
  const metric = SIGNAL_METRICS.find((m) => m.value === cond.signal_name);
  const isStockCount = metric?.type === 'stock_count';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showLogic && (
        <button
          type="button"
          onClick={onToggleLogic}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-colors ${
            logic === 'AND'
              ? 'bg-teal-100 text-teal-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {logic}
        </button>
      )}

      {/* Metric dropdown */}
      <select
        value={cond.signal_name}
        onChange={(e) => onUpdate('signal_name', e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-teal-500 outline-none bg-white"
      >
        {SIGNAL_METRICS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={cond.operator}
        onChange={(e) => onUpdate('operator', e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-teal-500 outline-none bg-white"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Threshold: dropdown for stock_count, input for percentage */}
      {isStockCount ? (
        <select
          value={cond.threshold}
          onChange={(e) => onUpdate('threshold', Number(e.target.value))}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:border-teal-500 outline-none bg-white"
        >
          {STOCK_COUNT_THRESHOLDS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          value={cond.threshold}
          onChange={(e) => onUpdate('threshold', Number(e.target.value))}
          className="w-20 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono tabular-nums focus:border-teal-500 outline-none"
        />
      )}

      {/* Tooltip */}
      {metric?.tooltip && <MetricTooltip text={metric.tooltip} />}

      {/* Remove condition */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-5 h-5 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function MetricTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center text-[9px] font-bold transition-colors"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-lg z-50 leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}
