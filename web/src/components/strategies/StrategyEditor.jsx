import { useState, useReducer, useCallback, useEffect } from 'react';
import { strategyReducer, initialState } from '../../lib/strategyReducer';
import { EMPTY_RULE, DEFAULT_CONFIG, computeStartDate } from '../../lib/simulation';
import { compareModes, createStrategy, updateStrategy, fetchDefaultRules, fetchFunds } from '../../lib/api';

import ModeToggle from './ModeToggle';
import FundSelector from './FundSelector';
import ConditionBuilder from './ConditionBuilder';
import ReviewStep from './ReviewStep';

const STEPS = [
  { key: 'name', label: 'Name & Setup', icon: '1' },
  { key: 'mode', label: 'Choose Mode', icon: '2' },
  { key: 'funds', label: 'Select Funds', icon: '3' },
  { key: 'conditions', label: 'Signal Conditions', icon: '4' },
  { key: 'review', label: 'Review & Backtest', icon: '5' },
];

const BENCHMARKS = [
  'Nifty 50 TRI',
  'Nifty 500 TRI',
  'Nifty Midcap 150 TRI',
  'S&P BSE Sensex TRI',
];

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
  const [strategyDescription, setStrategyDescription] = useState('');
  const [benchmark, setBenchmark] = useState('Nifty 50 TRI');
  const [exitRules, setExitRules] = useState([]);
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
    setStrategyDescription(editingStrategy.description || '');
    if (editingStrategy.benchmark) setBenchmark(editingStrategy.benchmark);
    setMode(editingStrategy.mode || 'sip_topups');
    if (editingStrategy.config) setConfig({ ...DEFAULT_CONFIG, ...editingStrategy.config });
    if (editingStrategy.rules) setRules(editingStrategy.rules);
    if (editingStrategy.exitRules) setExitRules(editingStrategy.exitRules);
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
      description: strategyDescription,
      benchmark,
      mode,
      config,
      rules,
      exitRules,
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
      case 0: return strategyName.trim().length > 0;
      case 1: return true;
      case 2: return state.funds.length > 0;
      case 3: return true;
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
          {strategyName && (
            <>
              <div className="h-5 w-px bg-slate-200" />
              <span className="text-lg font-semibold text-slate-800">{strategyName}</span>
            </>
          )}
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
        {/* Step 0: Name & Setup */}
        {activeStep === 0 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Name Your Strategy</h3>
              <p className="text-xs text-slate-500 mt-1">Give your strategy a name, optional description, and select a benchmark.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1.5">Strategy Name</label>
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  placeholder="e.g. All-Weather Alpha Portfolio"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-semibold text-slate-800 placeholder-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1.5">Description (optional)</label>
                <textarea
                  value={strategyDescription}
                  onChange={(e) => setStrategyDescription(e.target.value)}
                  placeholder="Describe the goal and thesis of this strategy..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1.5">Benchmark</label>
                <select
                  value={benchmark}
                  onChange={(e) => setBenchmark(e.target.value)}
                  className="w-full sm:w-72 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none bg-white"
                >
                  {BENCHMARKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Choose Mode */}
        {activeStep === 1 && (
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
        {activeStep === 2 && (
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
        {activeStep === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Signal Conditions</h3>
              <p className="text-xs text-slate-500 mt-1">Configure market signals that trigger additional investments.</p>
            </div>
            <ConditionBuilder
              rules={rules}
              onRulesChange={setRules}
              exitRules={exitRules}
              onExitRulesChange={setExitRules}
              marketpulseOnline={marketpulseOnline}
            />
          </div>
        )}

        {/* Step 4: Review & Backtest */}
        {activeStep === 4 && (
          <ReviewStep
            state={state}
            config={config}
            rules={rules}
            period={period}
            setPeriod={setPeriod}
            backtestOnly={backtestOnly}
            setBacktestOnly={setBacktestOnly}
            simulating={simulating}
            simError={simError}
            results={results}
            onRunSimulation={handleRunSimulation}
            onSave={handleSave}
          />
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
          {activeStep === 4 && results && (
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
            >
              Save Strategy
            </button>
          )}
          {activeStep < 4 && (
            <button
              type="button"
              onClick={() => setActiveStep(Math.min(4, activeStep + 1))}
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
