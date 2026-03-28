import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  fetchFundDetail,
  fetchFundLensScores,
  fetchDefaultRules,
  compareModes,
} from '../lib/api';
import { DEFAULT_CONFIG, assemblePayload } from '../lib/simulation';
import FundPicker from '../components/simulation/FundPicker';
import SimulationConfig from '../components/simulation/SimulationConfig';
import RuleBuilder from '../components/simulation/RuleBuilder';
import ModeComparison from '../components/simulation/ModeComparison';
import ComparisonTable from '../components/simulation/ComparisonTable';
import SignalLog from '../components/simulation/SignalLog';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import dynamic from 'next/dynamic';

const EquityCurve = dynamic(
  () => import('../components/simulation/EquityCurve'),
  { ssr: false }
);

export default function SimulationPage() {
  const router = useRouter();

  // Fund state
  const [fund, setFund] = useState(null);
  const [fundDetail, setFundDetail] = useState(null);
  const [lensScores, setLensScores] = useState(null);

  // Config state
  const [period, setPeriod] = useState('7Y');
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [rules, setRules] = useState([]);

  // Results
  const [compareResults, setCompareResults] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState(null);
  const [marketpulseOnline, setMarketpulseOnline] = useState(true);

  // Loading
  const [fundLoading, setFundLoading] = useState(false);

  // Read ?fund= from URL
  useEffect(() => {
    if (router.isReady && router.query.fund) {
      setFund({ mstar_id: router.query.fund });
    }
  }, [router.isReady, router.query.fund]);

  // Load default rules on mount
  useEffect(() => {
    fetchDefaultRules()
      .then((res) => setRules((res.data || []).map((r) => ({ ...r, active: true }))))
      .catch(() => {});
  }, []);

  // Load fund data when fund changes
  useEffect(() => {
    if (!fund?.mstar_id) return;
    let cancelled = false;
    async function loadFund() {
      setFundLoading(true);
      try {
        const [detail, lens] = await Promise.all([
          fetchFundDetail(fund.mstar_id).then((r) => r.data),
          fetchFundLensScores(fund.mstar_id).then((r) => r.data).catch(() => null),
        ]);
        if (cancelled) return;
        setFundDetail(detail);
        setLensScores(lens);
      } catch (err) {
        if (!cancelled) setSimError(err.message);
      } finally {
        if (!cancelled) setFundLoading(false);
      }
    }
    loadFund();
    return () => { cancelled = true; };
  }, [fund?.mstar_id]);

  // Simulation payload
  const simulationPayload = useMemo(() => {
    if (!fund?.mstar_id) return null;
    const activeRules = rules.filter((r) => r.active !== false);
    return assemblePayload(fund, config, activeRules, period);
  }, [fund, config, rules, period]);

  // Run simulation
  const runSimulation = useCallback(async () => {
    if (!simulationPayload) return;
    setSimulating(true);
    setSimError(null);
    try {
      const res = await compareModes(simulationPayload);
      setCompareResults(res.data);
      setMarketpulseOnline(true);
    } catch (err) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('marketpulse') || msg.includes('signal') || msg.includes('8000')) {
        setMarketpulseOnline(false);
        try {
          const fallback = await compareModes({ ...simulationPayload, signal_rules: [] });
          setCompareResults(fallback.data);
        } catch (e2) {
          setSimError(e2.message);
        }
      } else {
        setSimError(err.message);
      }
    } finally {
      setSimulating(false);
    }
  }, [simulationPayload]);

  const handleFundSelect = useCallback((f) => {
    setFund(f);
    setFundDetail(f);
    setCompareResults(null);
  }, []);

  const handleClear = useCallback(() => {
    setFund(null);
    setFundDetail(null);
    setLensScores(null);
    setCompareResults(null);
  }, []);

  // CSV export
  const handleExport = useCallback(() => {
    if (!compareResults) return;
    const modes = ['SIP', 'SIP_SIGNAL', 'LUMPSUM', 'HYBRID'];
    const headers = ['Metric', 'Pure SIP', 'SIP + Signals', 'Lumpsum', 'Hybrid'];
    const metrics = ['xirr_pct', 'total_invested', 'final_value', 'max_drawdown_pct', 'sharpe_ratio', 'sortino_ratio'];
    const rows = metrics.map((m) => {
      return [m, ...modes.map((mode) => {
        const s = compareResults[mode]?.summary || compareResults[mode];
        return s?.[m] ?? '';
      })];
    });
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation_${fund?.mstar_id || 'results'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [compareResults, fund]);

  // Cashflow events from SIP_SIGNAL result
  const cashflowEvents = useMemo(() => {
    const sipSig = compareResults?.SIP_SIGNAL;
    return sipSig?.cashflow_events || sipSig?.events || [];
  }, [compareResults]);

  // Latest NAV for signal log return calculations
  const latestNav = useMemo(() => {
    return fundDetail?.nav ?? null;
  }, [fundDetail]);

  const hasResults = compareResults != null;

  return (
    <div className="space-y-5 -m-6">
      {/* Minimal top bar context */}
      <div className="bg-white border-b border-slate-200/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Backtest investment strategies with real market data
          </p>
          <div className="flex items-center gap-2">
            {hasResults && (
              <button
                onClick={runSimulation}
                disabled={simulating || !simulationPayload}
                className="px-3 py-1.5 text-[10px] font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {simulating ? 'Simulating...' : 'Re-simulate'}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="px-6 space-y-5">
        {/* ==================== SECTION 1: Fund + Config (3-column top) ==================== */}
        <div className="grid grid-cols-12 gap-5 animate-in">
          {/* Fund Picker (col-span-4) */}
          <div className="col-span-4">
            <FundPicker
              selectedFund={fundDetail || fund}
              lensScores={lensScores}
              onFundSelect={handleFundSelect}
              onClear={handleClear}
            />
          </div>

          {/* Simulation Config (col-span-4) */}
          <div className="col-span-4">
            <SimulationConfig
              config={config}
              period={period}
              onConfigChange={setConfig}
              onPeriodChange={setPeriod}
              disabled={simulating}
            />
          </div>

          {/* Signal Rules (col-span-4) */}
          <div className="col-span-4">
            <RuleBuilder
              rules={rules}
              onRulesChange={setRules}
              disabled={simulating}
            />
          </div>
        </div>

        {/* Run button when no results yet */}
        {fund && !hasResults && !simulating && (
          <div className="flex justify-center">
            <button
              onClick={runSimulation}
              disabled={!simulationPayload}
              className="px-6 py-3 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              Run Simulation
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {simulating && !hasResults && (
          <div className="space-y-5">
            <SkeletonLoader variant="card" className="h-64 rounded-xl" />
            <SkeletonLoader variant="chart" className="h-80 rounded-xl" />
          </div>
        )}

        {/* Warnings */}
        {!marketpulseOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800">
            Signal data unavailable {'\u2014'} MarketPulse is offline. SIP+Signal and Hybrid modes running as Pure SIP.
          </div>
        )}
        {simError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-xs text-red-700">
            Simulation error: {simError}
          </div>
        )}

        {/* ==================== SECTION 2: 4 Mode Comparison Cards + Table ==================== */}
        {hasResults && (
          <section className="animate-in" style={{ animationDelay: '0.1s' }}>
            <ModeComparison
              results={compareResults}
              isLoading={simulating}
              marketpulseOnline={marketpulseOnline}
              period={period}
            />

            {/* Detailed Comparison Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 mt-5">
              <ComparisonTable results={compareResults} />
            </div>
          </section>
        )}

        {/* ==================== SECTION 3: Equity Curve + Signal Log (8:4 layout) ==================== */}
        {hasResults && (
          <div className="grid grid-cols-12 gap-5 animate-in" style={{ animationDelay: '0.2s' }}>
            {/* Main chart (8 cols) */}
            <div className="col-span-8">
              <EquityCurve
                results={compareResults}
                cashflowEvents={cashflowEvents}
                isLoading={simulating}
              />
            </div>

            {/* Signal Log + Actions (4 cols) */}
            <div className="col-span-4">
              <SignalLog
                cashflowEvents={cashflowEvents}
                results={compareResults}
                latestNav={latestNav}
                fund={fund}
                config={config}
                rules={rules}
                period={period}
                onExport={handleExport}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
