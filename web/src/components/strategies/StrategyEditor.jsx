import { useState, useReducer, useCallback, useEffect } from 'react';
import { strategyReducer, initialState } from '../../lib/strategyReducer';
import { EMPTY_RULE, DEFAULT_CONFIG, computeStartDate, MODE_LABELS } from '../../lib/simulation';
import { compareModes, createStrategy, updateStrategy, fetchDefaultRules, fetchFunds } from '../../lib/api';

import ModeToggle from './ModeToggle';
import FundSelector from './FundSelector';
import ConditionBuilder from './ConditionBuilder';
import SimulationResults from './SimulationResults';
import Pill from '../shared/Pill';
import { formatINR } from '../../lib/format';

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
    params: { sort_by: 'alpha_score', sort_dir: 'desc', limit: 5 },
    color: 'emerald',
  },
  {
    key: 'large_cap_leaders',
    label: 'Large Cap Leaders',
    description: 'Large cap + LEADER return class',
    params: { category: 'Large Cap', sort_by: 'return_score', sort_dir: 'desc', limit: 5 },
    color: 'teal',
  },
  {
    key: 'low_risk_consistent',
    label: 'Low-Risk Consistent',
    description: 'LOW_RISK + ROCK_SOLID/CONSISTENT',
    params: { sort_by: 'consistency_score', sort_dir: 'desc', limit: 5 },
    color: 'blue',
  },
  {
    key: 'best_sharpe',
    label: 'Best Risk-Adjusted',
    description: 'Top efficiency (Sharpe ratio)',
    params: { sort_by: 'efficiency_score', sort_dir: 'desc', limit: 5 },
    color: 'violet',
  },
];

const PERIODS = ['3Y', '5Y', '7Y', '10Y'];

export default function StrategyEditor({
  editingStrategy,
  initialMode,
  onSave,
  onCancel,
  marketpulseOnline = true,
}) {
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
  const [showConditions, setShowConditions] = useState(false);

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
    if (initialMode.templateName) setStrategyName(initialMode.templateName);
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
      const res = await fetchFunds({ ...preset.params, min_nav_count: 1250 });
      const funds = res.data || [];
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
      const sortedFunds = [...state.funds].sort(
        (a, b) => (state.allocations[b.mstar_id] || 0) - (state.allocations[a.mstar_id] || 0)
      );
      const primaryFund = sortedFunds[0];
      const payload = {
        mstar_id: primaryFund.mstar_id,
        sip_amount: config.sipAmount,
        start_date: computeStartDate(period),
        end_date: new Date().toISOString().split('T')[0],
        signal_rules: mode !== 'sip_topups' || rules.length === 0 ? [] : rules,
      };
      const res = await compareModes(payload);
      const data = res.data || res;

      // Check if results are meaningful (not all zeros)
      const modes = Object.keys(data).filter((k) => data[k]?.summary);
      if (modes.length === 0) {
        setSimError(
          `No simulation results for "${primaryFund.fund_name}". This fund may have insufficient NAV history for the selected period. Try a shorter period or a different fund.`
        );
        setResults(null);
      } else {
        // Check if all final values are near-zero (sparse NAV data)
        const allNearZero = modes.every((m) => {
          const fv = data[m]?.summary?.final_value || 0;
          const ti = data[m]?.summary?.total_invested || 0;
          return fv < 100 && ti < 100;
        });
        if (allNearZero) {
          setSimError(
            `Simulation returned near-zero values for "${primaryFund.fund_name}". This typically means the fund has very few NAV data points. Historical NAV backfill is in progress — please try again later or select a fund with longer history.`
          );
          setResults(null);
        } else {
          setResults(data);
        }
      }
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
  }, [strategyName, strategyDescription, benchmark, mode, config, rules, exitRules, period, backtestOnly, state, editingStrategy, onSave]);

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

      {/* Section 1: Strategy Name + Mode (compact row) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1.5">Strategy Name</label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="e.g. All-Weather Alpha Portfolio"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 placeholder-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1.5">Benchmark</label>
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none bg-white"
            >
              {BENCHMARKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode + Config */}
        <div className="border-t border-slate-100 pt-4">
          <ModeToggle
            mode={mode}
            onModeChange={setMode}
            sipAmount={config.sipAmount}
            onSipChange={(v) => setConfig({ ...config, sipAmount: v })}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Monthly SIP</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">INR</span>
              <input
                type="number"
                value={config.sipAmount}
                onChange={(e) => setConfig({ ...config, sipAmount: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg pl-9 pr-2 py-2 text-sm font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                min={0}
                step={1000}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Lumpsum Reserve</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">INR</span>
              <input
                type="number"
                value={config.lumpsumAmount}
                onChange={(e) => setConfig({ ...config, lumpsumAmount: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg pl-9 pr-2 py-2 text-sm font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                min={0}
                step={10000}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Backtest Period</label>
            <div className="flex items-center gap-1.5">
              {PERIODS.map((p) => (
                <Pill key={p} active={period === p} onClick={() => setPeriod(p)}>
                  {p}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Fund Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Select Funds</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Use smart presets or search to build your portfolio.</p>
          </div>
        </div>

        {/* Smart Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SMART_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleSmartPreset(preset)}
              disabled={presetLoading === preset.key}
              className={`p-2.5 rounded-lg border text-left transition-all hover:shadow-sm ${
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

        <FundSelector
          funds={state.funds}
          allocations={state.allocations}
          onAddFund={handleAddFund}
          onRemoveFund={handleRemoveFund}
          onSetAllocation={handleSetAllocation}
          sipAmount={config.sipAmount}
          lumpsumAmount={config.lumpsumAmount}
          initialNlQuery={initialMode?.nlQuery || null}
        />
      </div>

      {/* Section 3: Signal Conditions (collapsible) */}
      <div className="bg-white rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setShowConditions(!showConditions)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Signal Conditions</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} configured — market signals that trigger additional investments
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${showConditions ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {showConditions && (
          <div className="px-5 pb-5 border-t border-slate-100 pt-4">
            <ConditionBuilder
              rules={rules}
              onRulesChange={setRules}
              exitRules={exitRules}
              onExitRulesChange={setExitRules}
              marketpulseOnline={marketpulseOnline}
            />
          </div>
        )}
      </div>

      {/* Section 4: Run Simulation */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
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
                  Running...
                </span>
              ) : 'Run Backtest'}
            </button>
            {state.funds.length === 0 && (
              <p className="text-xs text-amber-600">Add at least one fund to run simulation</p>
            )}
            {state.funds.length > 0 && !results && !simulating && !simError && (
              <p className="text-xs text-slate-400">
                Comparing {state.funds.length} fund{state.funds.length > 1 ? 's' : ''} across 4 modes over {period}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <input
                type="checkbox"
                checked={backtestOnly}
                onChange={(e) => setBacktestOnly(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
              />
              Backtest only
            </label>
            {results && (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 text-xs font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
              >
                Save Strategy
              </button>
            )}
          </div>
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
    </div>
  );
}
