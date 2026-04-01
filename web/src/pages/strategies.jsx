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

export default function StrategiesPage() {
  const [state, dispatch] = useReducer(strategyReducer, initialState);
  const [sipAmount, setSipAmount] = useState(10000);
  const [lumpsumBudget, setLumpsumBudget] = useState(120000);
  const [maxPctPerEvent, setMaxPctPerEvent] = useState(25);
  const [cooldownDays, setCooldownDays] = useState(30);
  const [period, setPeriod] = useState('5Y');
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
        start_date: computeStartDate(period),
        end_date: new Date().toISOString().split('T')[0],
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
  }, [state.funds, state.allocations, sipAmount, period, rules]);

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

      <Section title="Configuration" subtitle="Investment amounts and deployment rules">
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
                {totalAlloc.toFixed(0)}% allocated, {period} backtest
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
