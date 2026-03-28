import { useState, useReducer, useCallback, useEffect } from 'react';
import { strategyReducer, initialState } from '../../lib/strategyReducer';
import { EMPTY_RULE, DEFAULT_CONFIG, computeStartDate } from '../../lib/simulation';
import { compareModes, createStrategy, updateStrategy, fetchDefaultRules } from '../../lib/api';
import ModeToggle from './ModeToggle';
import FundSelector from './FundSelector';
import ConditionBuilder from './ConditionBuilder';
import SimulationResults from './SimulationResults';
import Pill from '../shared/Pill';

const STEPS = [
  { key: 'mode', label: 'Investment Mode' },
  { key: 'funds', label: 'Select Funds' },
  { key: 'conditions', label: 'Signal Conditions' },
  { key: 'period', label: 'Simulation Period' },
  { key: 'results', label: 'Results' },
];

const PERIODS = ['3Y', '5Y', '7Y', '10Y'];

export default function StrategyEditor({
  editingStrategy,
  onSave,
  onCancel,
  marketpulseOnline = true,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [state, dispatch] = useReducer(strategyReducer, initialState);
  const [mode, setMode] = useState('sip_topups');
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [rules, setRules] = useState([{ ...EMPTY_RULE }]);
  const [period, setPeriod] = useState('5Y');
  const [backtestOnly, setBacktestOnly] = useState(true);
  const [strategyName, setStrategyName] = useState('');
  const [results, setResults] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState(null);

  // Load defaults
  useEffect(() => {
    fetchDefaultRules()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setRules(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Hydrate from editing strategy
  useEffect(() => {
    if (!editingStrategy) return;
    setStrategyName(editingStrategy.name || '');
    setMode(editingStrategy.mode || 'sip_topups');
    if (editingStrategy.config) setConfig({ ...DEFAULT_CONFIG, ...editingStrategy.config });
    if (editingStrategy.rules) setRules(editingStrategy.rules);
    if (editingStrategy.period) setPeriod(editingStrategy.period);
    if (editingStrategy.funds) {
      dispatch({ type: 'LOAD_STRATEGY', data: editingStrategy });
    }
  }, [editingStrategy]);

  const handleAddFund = useCallback((fund) => {
    dispatch({ type: 'ADD_FUND', fund });
  }, []);

  const handleRemoveFund = useCallback((mstarId) => {
    dispatch({ type: 'REMOVE_FUND', mstar_id: mstarId });
  }, []);

  const handleSetAllocation = useCallback((mstarId, weight) => {
    dispatch({ type: 'SET_ALLOCATION', mstar_id: mstarId, weight });
  }, []);

  const handleRunSimulation = useCallback(async () => {
    if (state.funds.length === 0) return;
    setSimulating(true);
    setSimError(null);

    try {
      const payload = {
        funds: state.funds.map((f) => ({
          mstar_id: f.mstar_id,
          allocation: state.allocations[f.mstar_id] || 0,
        })),
        sip_amount: config.sipAmount,
        sip_day: config.sipDay,
        lumpsum_amount: config.lumpsumAmount,
        start_date: computeStartDate(period),
        end_date: new Date().toISOString().split('T')[0],
        signal_rules: mode !== 'sip_topups' || rules.length === 0 ? [] : rules,
      };
      const res = await compareModes(payload);
      setResults(res.data || res);
    } catch (err) {
      setSimError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  }, [state.funds, state.allocations, config, rules, period, mode]);

  const handleSave = useCallback(async () => {
    const data = {
      name: strategyName || `Strategy ${new Date().toISOString().slice(0, 10)}`,
      mode,
      config,
      rules,
      period,
      status: backtestOnly ? 'BACKTEST' : 'ACTIVE',
      funds: state.funds.map((f) => ({
        mstar_id: f.mstar_id,
        fund_name: f.fund_name,
        allocation: state.allocations[f.mstar_id] || 0,
      })),
      allocations: state.allocations,
    };

    try {
      if (editingStrategy?.id) {
        await updateStrategy(editingStrategy.id, data);
      } else {
        await createStrategy(data);
      }
      onSave();
    } catch (err) {
      setSimError(err.message || 'Failed to save strategy');
    }
  }, [strategyName, mode, config, rules, period, backtestOnly, state, editingStrategy, onSave]);

  const canAdvance = () => {
    switch (activeStep) {
      case 0: return true;
      case 1: return state.funds.length > 0;
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Back
          </button>
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder="Strategy name..."
            className="text-lg font-semibold text-slate-800 border-none bg-transparent focus:outline-none focus:ring-0 p-0"
          />
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, idx) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setActiveStep(idx)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              idx === activeStep
                ? 'bg-teal-600 text-white'
                : idx < activeStep
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full bg-white/20">
              {idx + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {activeStep === 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Choose Investment Mode</h3>
            <ModeToggle
              mode={mode}
              onModeChange={setMode}
              sipAmount={config.sipAmount}
              onSipChange={(v) => setConfig({ ...config, sipAmount: v })}
            />
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Monthly SIP</label>
                <input
                  type="number"
                  value={config.sipAmount}
                  onChange={(e) => setConfig({ ...config, sipAmount: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm font-mono tabular-nums"
                  min={0}
                  step={1000}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Lumpsum Reserve</label>
                <input
                  type="number"
                  value={config.lumpsumAmount}
                  onChange={(e) => setConfig({ ...config, lumpsumAmount: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm font-mono tabular-nums"
                  min={0}
                  step={10000}
                />
              </div>
            </div>
          </div>
        )}

        {activeStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Select Funds & Allocations</h3>
            <FundSelector
              funds={state.funds}
              allocations={state.allocations}
              onAddFund={handleAddFund}
              onRemoveFund={handleRemoveFund}
              onSetAllocation={handleSetAllocation}
            />
          </div>
        )}

        {activeStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Signal Conditions</h3>
            <ConditionBuilder
              rules={rules}
              onRulesChange={setRules}
              marketpulseOnline={marketpulseOnline}
            />
          </div>
        )}

        {activeStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Simulation Period</h3>
            <div className="flex items-center gap-2">
              {PERIODS.map((p) => (
                <Pill key={p} active={period === p} onClick={() => setPeriod(p)}>
                  {p}
                </Pill>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-4">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={backtestOnly}
                  onChange={(e) => setBacktestOnly(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Backtest only (do not activate for live tracking)
              </label>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => { handleRunSimulation(); setActiveStep(4); }}
                disabled={state.funds.length === 0 || simulating}
                className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {simulating ? 'Running...' : 'Run Simulation'}
              </button>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Simulation Results</h3>
            <SimulationResults
              results={results}
              loading={simulating}
              error={simError}
              onSave={handleSave}
            />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        {activeStep < 4 && (
          <button
            type="button"
            onClick={() => setActiveStep(Math.min(4, activeStep + 1))}
            disabled={!canAdvance()}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
