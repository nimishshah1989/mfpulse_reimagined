import { useState, useReducer, useCallback, useEffect } from 'react';
import { strategyReducer, initialState } from '../../lib/strategyReducer';
import { EMPTY_RULE, DEFAULT_CONFIG, computeStartDate } from '../../lib/simulation';
import { compareModes, createStrategy, updateStrategy, fetchDefaultRules, fetchFunds } from '../../lib/api';
import { formatINR } from '../../lib/format';
import ModeToggle from './ModeToggle';
import FundSelector from './FundSelector';
import ConditionBuilder from './ConditionBuilder';
import SimulationResults from './SimulationResults';
import Pill from '../shared/Pill';

const STEPS = [
  { key: 'mode', label: 'Choose Mode', icon: '1' },
  { key: 'funds', label: 'Select Funds', icon: '2' },
  { key: 'conditions', label: 'Signal Conditions', icon: '3' },
  { key: 'review', label: 'Review & Backtest', icon: '4' },
];

const PERIODS = ['3Y', '5Y', '7Y', '10Y'];

const SMART_PRESETS = [
  {
    key: 'top_alpha',
    label: 'Top 5 by Alpha',
    description: 'Highest alpha-generating funds',
    params: { sort: 'alpha_score', order: 'desc', limit: 5 },
    color: 'emerald',
  },
  {
    key: 'large_cap_leaders',
    label: 'Large Cap Leaders',
    description: 'Large cap + LEADER return class',
    params: { broad_category: 'Equity', search: 'large cap', sort: 'return_score', order: 'desc', limit: 5 },
    color: 'teal',
  },
  {
    key: 'low_risk_consistent',
    label: 'Low-Risk Consistent',
    description: 'LOW_RISK + ROCK_SOLID/CONSISTENT',
    params: { sort: 'consistency_score', order: 'desc', limit: 5 },
    color: 'blue',
  },
  {
    key: 'best_sharpe',
    label: 'Best Risk-Adjusted',
    description: 'Top efficiency (Sharpe ratio)',
    params: { sort: 'efficiency_score', order: 'desc', limit: 5 },
    color: 'violet',
  },
];

export default function StrategyEditor({
  editingStrategy,
  initialMode,
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
  const [presetLoading, setPresetLoading] = useState(null);

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

  // Apply initial mode from parent
  useEffect(() => {
    if (!initialMode) return;
    if (initialMode.mode) setMode(initialMode.mode);
    if (initialMode.sipAmount != null) setConfig((c) => ({ ...c, sipAmount: initialMode.sipAmount }));
    if (initialMode.lumpsumAmount != null) setConfig((c) => ({ ...c, lumpsumAmount: initialMode.lumpsumAmount }));
  }, [initialMode]);

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

  const handleSmartPreset = useCallback(async (preset) => {
    setPresetLoading(preset.key);
    try {
      const res = await fetchFunds({ ...preset.params });
      const funds = res.data || [];
      // Clear existing and add preset funds
      dispatch({ type: 'RESET' });
      for (const fund of funds) {
        dispatch({ type: 'ADD_FUND', fund });
      }
    } catch {
      // Silently fail — user can still search manually
    } finally {
      setPresetLoading(null);
    }
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
      default: return false;
    }
  };

  const totalAlloc = Object.values(state.allocations).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder="Name your strategy..."
            className="text-lg font-semibold text-slate-800 border-none bg-transparent focus:outline-none focus:ring-0 p-0 placeholder-slate-300"
          />
        </div>
        {state.funds.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono tabular-nums">{state.funds.length} funds</span>
            <span className="text-slate-300">|</span>
            <span className={`font-mono tabular-nums ${Math.abs(totalAlloc - 100) < 0.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {totalAlloc.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;
          const isDisabled = idx > activeStep + 1;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => !isDisabled && setActiveStep(idx)}
              disabled={isDisabled}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : isCompleted
                    ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                    : 'bg-slate-100 text-slate-400'
              } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full ${
                isActive ? 'bg-white/20' :
                isCompleted ? 'bg-teal-200 text-teal-800' :
                'bg-slate-200 text-slate-500'
              }`}>
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : step.icon}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Step 1: Choose Mode */}
        {activeStep === 0 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Choose Investment Mode</h3>
              <p className="text-xs text-slate-500 mt-1">Select how you want to deploy capital into this strategy.</p>
            </div>
            <ModeToggle
              mode={mode}
              onModeChange={setMode}
              sipAmount={config.sipAmount}
              onSipChange={(v) => setConfig({ ...config, sipAmount: v })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1.5">Monthly SIP Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">INR</span>
                  <input
                    type="number"
                    value={config.sipAmount}
                    onChange={(e) => setConfig({ ...config, sipAmount: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-sm font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    min={0}
                    step={1000}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1.5">Lumpsum Reserve</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">INR</span>
                  <input
                    type="number"
                    value={config.lumpsumAmount}
                    onChange={(e) => setConfig({ ...config, lumpsumAmount: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-sm font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    min={0}
                    step={10000}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Funds */}
        {activeStep === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Select Funds & Allocations</h3>
              <p className="text-xs text-slate-500 mt-1">Use smart presets or search to build your portfolio.</p>
            </div>

            {/* Smart Presets */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Smart Presets</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SMART_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleSmartPreset(preset)}
                    disabled={presetLoading === preset.key}
                    className={`p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                      preset.color === 'emerald' ? 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50' :
                      preset.color === 'teal' ? 'border-teal-200 hover:border-teal-400 hover:bg-teal-50' :
                      preset.color === 'blue' ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' :
                      'border-violet-200 hover:border-violet-400 hover:bg-violet-50'
                    } ${presetLoading === preset.key ? 'opacity-50' : ''}`}
                  >
                    <p className="text-xs font-semibold text-slate-700">{preset.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{preset.description}</p>
                    {presetLoading === preset.key && (
                      <p className="text-[10px] text-teal-600 mt-1 font-medium">Loading...</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <FundSelector
                funds={state.funds}
                allocations={state.allocations}
                onAddFund={handleAddFund}
                onRemoveFund={handleRemoveFund}
                onSetAllocation={handleSetAllocation}
                totalInvestment={config.sipAmount + config.lumpsumAmount}
              />
            </div>
          </div>
        )}

        {/* Step 3: Signal Conditions */}
        {activeStep === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Signal Conditions</h3>
              <p className="text-xs text-slate-500 mt-1">Configure market signals that trigger additional investments.</p>
            </div>
            <ConditionBuilder
              rules={rules}
              onRulesChange={setRules}
              marketpulseOnline={marketpulseOnline}
            />
          </div>
        )}

        {/* Step 4: Review & Backtest */}
        {activeStep === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Review & Backtest</h3>
              <p className="text-xs text-slate-500 mt-1">Verify your configuration and run the simulation.</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-500 font-medium">Funds</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{state.funds.length}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-500 font-medium">Monthly SIP</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{formatINR(config.sipAmount, 0)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-500 font-medium">Lumpsum</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{formatINR(config.lumpsumAmount, 0)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-500 font-medium">Signal Rules</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{rules.length}</p>
              </div>
            </div>

            {/* Fund list summary */}
            {state.funds.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Fund</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-medium">Allocation</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-medium">SIP Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.funds.map((fund) => {
                      const alloc = state.allocations[fund.mstar_id] || 0;
                      const sipShare = (alloc / 100) * config.sipAmount;
                      return (
                        <tr key={fund.mstar_id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{fund.fund_name}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{alloc.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{formatINR(sipShare, 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Period selection */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600">Simulation Period</p>
              <div className="flex items-center gap-2">
                {PERIODS.map((p) => (
                  <Pill key={p} active={period === p} onClick={() => setPeriod(p)}>
                    {p}
                  </Pill>
                ))}
              </div>
            </div>

            {/* Backtest toggle */}
            <div className="flex items-center gap-3">
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

            {/* Run simulation button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={state.funds.length === 0 || simulating}
                className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                {simulating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running Simulation...
                  </span>
                ) : 'Run Backtest'}
              </button>
              {state.funds.length === 0 && (
                <p className="text-xs text-amber-600">Add at least one fund to run simulation</p>
              )}
            </div>

            {/* Results */}
            {(results || simError) && (
              <div className="pt-4 border-t border-slate-100">
                <SimulationResults
                  results={results}
                  loading={simulating}
                  error={simError}
                  onSave={handleSave}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Previous
        </button>
        <div className="flex items-center gap-2">
          {activeStep === 3 && results && (
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
            >
              Save Strategy
            </button>
          )}
          {activeStep < 3 && (
            <button
              type="button"
              onClick={() => setActiveStep(Math.min(3, activeStep + 1))}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
