import { useState, useReducer, useCallback, useEffect } from 'react';
import { strategyReducer, initialState } from '../lib/strategyReducer';
import { EMPTY_RULE, computeStartDate } from '../lib/simulation';
import {
  compareModes, createStrategy, fetchDefaultRules, fetchMarketRegime,
} from '../lib/api';
import FundSelector from '../components/strategies/FundSelector';
import SimulationResults from '../components/strategies/SimulationResults';
import {
  PageHeader, MarketPulseOfflineBanner, Section,
  ConfigPanel, SignalConditions,
} from '../components/strategies/StrategyParts';

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function fiveYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return toDateStr(d);
}

export default function StrategiesPage() {
  const [state, dispatch] = useReducer(strategyReducer, initialState);
  const [sipAmount, setSipAmount] = useState(10000);
  const [lumpsumBudget, setLumpsumBudget] = useState(120000);
  const [maxPctPerEvent, setMaxPctPerEvent] = useState(25);
  const [cooldownDays, setCooldownDays] = useState(30);
  const [period, setPeriod] = useState('5Y');
  const [startDate, setStartDate] = useState(fiveYearsAgo);
  const [endDate, setEndDate] = useState(() => toDateStr(new Date()));
  const [tillPresent, setTillPresent] = useState(true);
  const [rules, setRules] = useState([]);
  const [results, setResults] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState(null);
  const [mpOnline, setMpOnline] = useState(true);

  // Auto-set lumpsum = 12x SIP when SIP changes (unless user edited)
  const [lumpsumUserEdited, setLumpsumUserEdited] = useState(false);
  useEffect(() => {
    if (!lumpsumUserEdited) setLumpsumBudget(sipAmount * 12);
  }, [sipAmount, lumpsumUserEdited]);

  // Sync period preset with startDate
  useEffect(() => {
    setStartDate(computeStartDate(period));
  }, [period]);

  // Keep endDate as today when tillPresent is on
  useEffect(() => {
    if (tillPresent) setEndDate(toDateStr(new Date()));
  }, [tillPresent]);

  // Check MarketPulse + load default rules
  useEffect(() => {
    fetchMarketRegime()
      .then(() => setMpOnline(true))
      .catch(() => setMpOnline(false));
    fetchDefaultRules()
      .then((res) => { if (res.data?.length > 0) setRules(res.data); })
      .catch(() => {});
  }, []);

  const handleAddFund = useCallback((fund) => {
    dispatch({ type: 'ADD_FUND', fund });
  }, []);

  const handleRemoveFund = useCallback((mstarId) => {
    dispatch({ type: 'REMOVE_FUND', mstar_id: mstarId });
  }, []);

  const handleSetAllocation = useCallback((mstarId, weight) => {
    dispatch({ type: 'SET_ALLOCATION', mstar_id: mstarId, weight });
  }, []);

  const addRule = useCallback(() => {
    setRules((prev) => [...prev, { ...EMPTY_RULE, name: `Rule ${prev.length + 1}` }]);
  }, []);

  const removeRule = useCallback((idx) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateRule = useCallback((idx, updated) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updated } : r)));
  }, []);

  const handleSimulate = useCallback(async () => {
    if (state.funds.length === 0) return;
    setSimulating(true);
    setSimError(null);
    try {
      const sorted = [...state.funds].sort(
        (a, b) => (state.allocations[b.mstar_id] || 0) - (state.allocations[a.mstar_id] || 0),
      );
      const primary = sorted[0];
      const payload = {
        mstar_id: primary.mstar_id,
        sip_amount: sipAmount,
        start_date: startDate,
        end_date: tillPresent ? toDateStr(new Date()) : endDate,
        signal_rules: rules.length > 0 ? rules : [],
      };
      const res = await compareModes(payload);
      const data = res.data || res;
      const modes = Object.keys(data).filter((k) => data[k]?.summary);
      if (modes.length === 0) {
        setSimError(`No results for "${primary.fund_name}". Try a different period or fund.`);
        setResults(null);
      } else {
        const allNearZero = modes.every((m) => (data[m]?.summary?.final_value || 0) < 100);
        if (allNearZero) {
          setSimError(`Near-zero values for "${primary.fund_name}". NAV history may be sparse.`);
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
  }, [state.funds, state.allocations, sipAmount, startDate, endDate, tillPresent, rules]);

  const handleSave = useCallback(async () => {
    const data = {
      name: `Strategy ${new Date().toISOString().slice(0, 10)}`,
      mode: 'sip_topups',
      config: { sipAmount, lumpsumAmount: lumpsumBudget, lumpsumDeployPct: maxPctPerEvent },
      rules,
      period,
      status: 'BACKTEST',
      funds: state.funds.map((f) => ({
        mstar_id: f.mstar_id,
        fund_name: f.fund_name,
        allocation: state.allocations[f.mstar_id] || 0,
      })),
      allocations: state.allocations,
    };
    try {
      await createStrategy(data);
    } catch (err) {
      setSimError(err.message || 'Failed to save');
    }
  }, [sipAmount, lumpsumBudget, maxPctPerEvent, rules, period, state]);

  const totalAlloc = Object.values(state.allocations).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader />
      {!mpOnline && <MarketPulseOfflineBanner />}

      <Section title="Select Funds" subtitle="Regular plans only">
        <FundSelector
          funds={state.funds}
          allocations={state.allocations}
          onAddFund={handleAddFund}
          onRemoveFund={handleRemoveFund}
          onSetAllocation={handleSetAllocation}
          sipAmount={sipAmount}
          lumpsumAmount={lumpsumBudget}
        />
      </Section>

      <Section title="Configuration" subtitle="Investment amounts, deployment rules, and backtest period">
        <ConfigPanel
          sipAmount={sipAmount}
          onSipChange={(v) => { setSipAmount(v); setLumpsumUserEdited(false); }}
          lumpsumBudget={lumpsumBudget}
          onLumpsumChange={(v) => { setLumpsumBudget(v); setLumpsumUserEdited(true); }}
          maxPctPerEvent={maxPctPerEvent}
          onMaxPctChange={setMaxPctPerEvent}
          cooldownDays={cooldownDays}
          onCooldownChange={setCooldownDays}
          period={period}
          onPeriodChange={setPeriod}
        />
        {/* Date range */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 mt-3">
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setTillPresent(false); }}
              disabled={tillPresent}
              className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tillPresent}
                onChange={(e) => setTillPresent(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs text-slate-600 font-medium">Till Present</span>
            </label>
          </div>
        </div>
      </Section>

      <Section
        title="Signal Conditions"
        subtitle={`${rules.length} rule${rules.length !== 1 ? 's' : ''} -- triggers extra investment when market conditions are met`}
      >
        <SignalConditions
          rules={rules}
          onAddRule={addRule}
          onRemoveRule={removeRule}
          onUpdateRule={updateRule}
        />
      </Section>

      <Section title="Results" subtitle="Auto-compares SIP, SIP + Topups, and Lumpsum">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSimulate}
              disabled={state.funds.length === 0 || simulating}
              className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {simulating ? 'Simulating...' : 'Run Simulation'}
            </button>
            {state.funds.length === 0 && (
              <p className="text-xs text-amber-600">Add at least one fund above</p>
            )}
            {state.funds.length > 0 && !results && !simulating && (
              <p className="text-xs text-slate-400">
                {state.funds.length} fund{state.funds.length > 1 ? 's' : ''},{' '}
                {totalAlloc.toFixed(0)}% allocated, {startDate} to {tillPresent ? 'present' : endDate}
              </p>
            )}
          </div>
          <SimulationResults
            results={results}
            loading={simulating}
            error={simError}
            onSave={handleSave}
          />
        </div>
      </Section>
    </div>
  );
}
