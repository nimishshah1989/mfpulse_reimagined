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
import NarrativeSummary from '../components/simulation/NarrativeSummary';
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

  // Templates
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mfpulse_sim_templates') || '[]');
      setTemplates(saved);
    } catch (e) { setTemplates([]); }
  }, []);

  // Read ?fund=, ?period=, ?sip= from URL
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.fund) {
      setFund({ mstar_id: router.query.fund });
    }
    if (router.query.period) {
      setPeriod(router.query.period);
    }
    if (router.query.sip) {
      const sipVal = Number(router.query.sip);
      if (sipVal > 0) setConfig((prev) => ({ ...prev, sip_amount: sipVal }));
    }
  }, [router.isReady, router.query.fund, router.query.period, router.query.sip]);

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
        // Enrich fund object with detail data if it only had mstar_id (e.g. from URL)
        if (detail && !fund.fund_name) {
          setFund((prev) => ({ ...prev, ...detail }));
        }
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

  const saveTemplate = useCallback(() => {
    if (!templateName.trim() || !fund?.mstar_id) return;
    const template = {
      id: Date.now(),
      name: templateName.trim(),
      fund_mstar_id: fund.mstar_id,
      fund_name: fund.fund_name || fund.legal_name || fund.mstar_id,
      config: { ...config },
      rules: rules.map((r) => ({ ...r })),
      period,
      created_at: new Date().toISOString(),
    };
    const updated = [...templates, template];
    localStorage.setItem('mfpulse_sim_templates', JSON.stringify(updated));
    setTemplates(updated);
    setTemplateName('');
    setShowSaveTemplate(false);
  }, [templateName, fund, config, rules, period, templates]);

  const loadTemplate = useCallback((template) => {
    setFund({ mstar_id: template.fund_mstar_id, fund_name: template.fund_name });
    setConfig(template.config);
    setRules(template.rules);
    setPeriod(template.period);
    setCompareResults(null);
  }, []);

  const deleteTemplate = useCallback((id) => {
    const updated = templates.filter((t) => t.id !== id);
    localStorage.setItem('mfpulse_sim_templates', JSON.stringify(updated));
    setTemplates(updated);
  }, [templates]);

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
    return fundDetail?.nav ?? fundDetail?.latest_nav ?? null;
  }, [fundDetail]);

  const hasResults = compareResults != null;

  return (
    <div className="space-y-5">
      {/* Minimal top bar context */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500">
              Backtest investment strategies with real market data
            </p>
            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Templates:</span>
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <button
                      onClick={() => loadTemplate(t)}
                      className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                    >
                      {t.name}
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="text-[10px] text-slate-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasResults && fund?.mstar_id && (
              <button
                onClick={() => {
                  const params = new URLSearchParams({
                    fund: fund.mstar_id,
                    period,
                    sip: String(config.sip_amount || 25000),
                  });
                  const url = `${window.location.origin}/simulation?${params}`;
                  navigator.clipboard.writeText(url).then(() => {
                    alert('Share link copied to clipboard!');
                  });
                }}
                className="px-3 py-1.5 text-[10px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Share
              </button>
            )}
            {hasResults && (
              <button
                onClick={runSimulation}
                disabled={simulating || !simulationPayload}
                className="px-3 py-1.5 text-[10px] font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {simulating ? 'Simulating...' : 'Re-simulate'}
              </button>
            )}
            {hasResults && (
              <button
                onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                className="px-3 py-1.5 text-[10px] font-semibold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
              >
                Save Template
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="space-y-5">
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

        {showSaveTemplate && (
          <div className="bg-white border border-teal-200 rounded-lg p-4 flex items-center gap-3">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') saveTemplate(); }}
            />
            <button
              onClick={saveTemplate}
              disabled={!templateName.trim()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveTemplate(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
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

            {/* Narrative Summary */}
            <div className="mt-5">
              <NarrativeSummary
                results={compareResults}
                fund={fund}
                config={config}
                period={period}
              />
            </div>

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
