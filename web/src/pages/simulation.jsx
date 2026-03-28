import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  fetchFundDetail,
  fetchFundLensScores,
  fetchNAVHistory,
  fetchDefaultRules,
  compareModes,
} from '../lib/api';
import { DEFAULT_CONFIG, assemblePayload, computeStartDate } from '../lib/simulation';
import { formatPct, formatAUM } from '../lib/format';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../lib/lens';
import Badge from '../components/shared/Badge';
import Pill from '../components/shared/Pill';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';
import FundPicker from '../components/simulation/FundPicker';
import SimulationConfig from '../components/simulation/SimulationConfig';
import RuleBuilder from '../components/simulation/RuleBuilder';
import dynamic from 'next/dynamic';
const SignalTimeline = dynamic(() => import('../components/simulation/SignalTimeline'), { ssr: false });
import ModeComparison from '../components/simulation/ModeComparison';
import ResultsExport from '../components/simulation/ResultsExport';

const PERIODS = ['5Y', '7Y', '10Y', 'max'];

export default function SimulationPage() {
  const router = useRouter();

  // Fund state
  const [fund, setFund] = useState(null);
  const [fundDetail, setFundDetail] = useState(null);
  const [lensScores, setLensScores] = useState(null);
  const [navHistory, setNavHistory] = useState([]);

  // Config state
  const [period, setPeriod] = useState('5Y');
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [rules, setRules] = useState([]);
  const [rulesValid, setRulesValid] = useState(null);

  // Results
  const [compareResults, setCompareResults] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState(null);
  const [marketpulseOnline, setMarketpulseOnline] = useState(true);

  // Loading
  const [fundLoading, setFundLoading] = useState(false);

  // Width for timeline
  const timelineRef = useRef(null);
  const [timelineWidth, setTimelineWidth] = useState(700);

  useEffect(() => {
    if (!timelineRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTimelineWidth(Math.max(400, entry.contentRect.width));
      }
    });
    observer.observe(timelineRef.current);
    return () => observer.disconnect();
  }, []);

  // Read ?fund= from URL
  useEffect(() => {
    if (router.isReady && router.query.fund) {
      setFund({ mstar_id: router.query.fund });
    }
  }, [router.isReady, router.query.fund]);

  // Load default rules on mount
  useEffect(() => {
    async function loadDefaults() {
      try {
        const res = await fetchDefaultRules();
        setRules(res.data || []);
      } catch {
        // No defaults available, empty rules is fine
      }
    }
    loadDefaults();
  }, []);

  // Load fund data when fund changes
  useEffect(() => {
    if (!fund?.mstar_id) return;
    let cancelled = false;
    async function loadFund() {
      setFundLoading(true);
      try {
        const [detail, lens, nav] = await Promise.all([
          fetchFundDetail(fund.mstar_id).then((r) => r.data),
          fetchFundLensScores(fund.mstar_id).then((r) => r.data).catch(() => null),
          fetchNAVHistory(fund.mstar_id, 'max').then((r) => r.data || []),
        ]);
        if (cancelled) return;
        setFundDetail(detail);
        setLensScores(lens);
        setNavHistory(nav);
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
    return assemblePayload(fund, config, rules, period);
  }, [fund, config, rules, period]);

  // Auto-simulate debounce (500ms)
  useEffect(() => {
    if (!simulationPayload || !config.autoSimulate) return;
    const timer = setTimeout(async () => {
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
          // Retry without signals
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
    }, 500);
    return () => clearTimeout(timer);
  }, [simulationPayload, config.autoSimulate]);

  // Manual run
  const runNow = useCallback(async () => {
    if (!simulationPayload) return;
    setSimulating(true);
    setSimError(null);
    try {
      const res = await compareModes(simulationPayload);
      setCompareResults(res.data);
    } catch (err) {
      setSimError(err.message);
    } finally {
      setSimulating(false);
    }
  }, [simulationPayload]);

  const handleFundSelect = useCallback((f) => {
    setFund(f);
    setCompareResults(null);
  }, []);

  const handleClear = useCallback(() => {
    setFund(null);
    setFundDetail(null);
    setLensScores(null);
    setNavHistory([]);
    setCompareResults(null);
  }, []);

  // Cashflow events from SIP_SIGNAL result
  const cashflowEvents = useMemo(() => {
    const sipSig = compareResults?.SIP_SIGNAL;
    return sipSig?.cashflow_events || sipSig?.events || [];
  }, [compareResults]);

  return (
    <div className="space-y-6 -m-6">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Backtest investment strategies with real data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Period:</span>
            {PERIODS.map((p) => (
              <Pill key={p} active={period === p} onClick={() => setPeriod(p)}>
                {p}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Fund picker + context */}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <FundPicker
              selectedFund={fundDetail || fund}
              onFundSelect={handleFundSelect}
              onClear={handleClear}
            />
          </div>
          {fundDetail && lensScores && (
            <div className="flex gap-1.5 flex-wrap">
              {LENS_OPTIONS.map((lens) => {
                const tier = lensScores[LENS_CLASS_KEYS[lens.key]];
                return tier ? <Badge key={lens.key} variant="tier">{tier}</Badge> : null;
              })}
            </div>
          )}
        </div>

        {fundLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <SkeletonLoader variant="card" className="h-[400px]" />
            <SkeletonLoader variant="chart" className="h-[400px]" />
          </div>
        )}

        {!marketpulseOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
            Signal data unavailable — MarketPulse is offline. SIP+Signal and Hybrid modes running as Pure SIP.
          </div>
        )}

        {simError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            Simulation error: {simError}
          </div>
        )}

        {/* Main content: Rules + Timeline */}
        {fund && !fundLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* Left: Config + Rules */}
            <div className="space-y-4">
              <SimulationConfig
                config={config}
                onConfigChange={setConfig}
                disabled={simulating}
              />
              <RuleBuilder
                rules={rules}
                onRulesChange={setRules}
                rulesValid={rulesValid}
                disabled={simulating}
              />
              {!config.autoSimulate && (
                <button
                  type="button"
                  onClick={runNow}
                  disabled={simulating}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {simulating ? 'Running...' : 'Run Simulation'}
                </button>
              )}
            </div>

            {/* Right: Timeline */}
            <div ref={timelineRef} className="min-w-0">
              <SignalTimeline
                navHistory={navHistory}
                cashflowEvents={cashflowEvents}
                period={period}
                width={timelineWidth - 42}
                height={340}
              />
            </div>
          </div>
        )}

        {/* Mode Comparison */}
        {fund && (
          <ModeComparison
            results={compareResults}
            isLoading={simulating}
            marketpulseOnline={marketpulseOnline}
          />
        )}

        {/* Footer actions */}
        {compareResults && fund && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const template = btoa(JSON.stringify({
                  mstar_id: fund.mstar_id,
                  config,
                  rules,
                  period,
                }));
                router.push(`/strategy?template=${template}`);
              }}
              className="px-4 py-2 text-sm font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50"
            >
              Save as Strategy Template
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Try Another Fund
            </button>
            <ResultsExport
              fund={fundDetail}
              config={config}
              rules={rules}
              results={compareResults}
              period={period}
            />
          </div>
        )}
      </div>
    </div>
  );
}
