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

  const STRATEGY_PRESETS = [
    {
      label: 'Conservative SIP',
      desc: 'Steady monthly investment, no signals',
      icon: '\u25B2',
      iconBg: 'bg-emerald-100 text-emerald-600',
      apply: () => {
        setConfig({ ...config, sipAmount: 10000, lumpsumAmount: 0, lumpsumDeployPct: 25, sipDay: 5 });
        setRules(rules.map((r) => ({ ...r, active: false })));
        setPeriod('7Y');
      },
    },
    {
      label: 'Signal-Enhanced SIP',
      desc: 'SIP + deploy on market dips',
      icon: '\u26A1',
      iconBg: 'bg-teal-100 text-teal-600',
      apply: () => {
        setConfig({ ...config, sipAmount: 10000, lumpsumAmount: 500000, lumpsumDeployPct: 25, sipDay: 5 });
        setRules(rules.map((r) => ({ ...r, active: true })));
        setPeriod('7Y');
      },
    },
    {
      label: 'Aggressive Hybrid',
      desc: 'Max SIP + large lumpsum reserve',
      icon: '\u25C6',
      iconBg: 'bg-violet-100 text-violet-600',
      apply: () => {
        setConfig({ ...config, sipAmount: 25000, lumpsumAmount: 1000000, lumpsumDeployPct: 33, sipDay: 1 });
        setRules(rules.map((r) => ({ ...r, active: true })));
        setPeriod('10Y');
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* ===== HERO SECTION ===== */}
      <section className="gradient-hero rounded-2xl overflow-hidden animate-in">
        <div className="px-8 pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">
                Strategy Simulator
              </p>
              <p className="text-white/50 text-[11px] mt-0.5">
                Backtest SIP, lumpsum, and signal-enhanced strategies with real NAV data
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasResults && fund?.mstar_id && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      fund: fund.mstar_id,
                      period,
                      sip: String(config.sipAmount || 10000),
                    });
                    const url = `${window.location.origin}/simulation?${params}`;
                    navigator.clipboard.writeText(url).then(() => {
                      alert('Share link copied!');
                    });
                  }}
                  className="px-3 py-1.5 text-[10px] font-semibold text-white/60 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Share
                </button>
              )}
              {hasResults && (
                <button
                  onClick={runSimulation}
                  disabled={simulating || !simulationPayload}
                  className="px-4 py-1.5 text-[10px] font-semibold text-white bg-teal-500 rounded-lg hover:bg-teal-400 disabled:opacity-50 transition-colors"
                >
                  {simulating ? 'Simulating...' : 'Re-simulate'}
                </button>
              )}
              {hasResults && (
                <button
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                  className="px-3 py-1.5 text-[10px] font-semibold text-teal-300 border border-teal-500/40 rounded-lg hover:bg-teal-500/10 transition-colors"
                >
                  Save Template
                </button>
              )}
            </div>
          </div>

          {/* Strategy presets + saved templates */}
          <div className="flex items-center gap-3">
            {STRATEGY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={preset.apply}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
              >
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${preset.iconBg}`}>
                  {preset.icon}
                </span>
                <div className="text-left">
                  <p className="text-[10px] font-semibold text-white/80 group-hover:text-white">{preset.label}</p>
                  <p className="text-[9px] text-slate-500">{preset.desc}</p>
                </div>
              </button>
            ))}
            {templates.length > 0 && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
                <span className="text-[9px] text-slate-500">Saved:</span>
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <button
                      onClick={() => loadTemplate(t)}
                      className="px-2 py-1 text-[9px] font-medium text-slate-300 bg-white/5 rounded hover:bg-white/10 transition-colors"
                    >
                      {t.name}
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="text-[9px] text-slate-600 hover:text-red-400"
                    >
                      {'\u00D7'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="space-y-5">
        {/* ===== SECTION 1: Fund + Config (5:4:3 layout) ===== */}
        <div className="grid grid-cols-12 gap-4 animate-in">
          <div className="col-span-5">
            <FundPicker
              selectedFund={fundDetail || fund}
              lensScores={lensScores}
              onFundSelect={handleFundSelect}
              onClear={handleClear}
            />
          </div>
          <div className="col-span-4">
            <SimulationConfig
              config={config}
              period={period}
              onConfigChange={setConfig}
              onPeriodChange={setPeriod}
              disabled={simulating}
            />
          </div>
          <div className="col-span-3">
            <RuleBuilder
              rules={rules}
              onRulesChange={setRules}
              disabled={simulating}
            />
          </div>
        </div>

        {/* Run button */}
        {fund && !hasResults && !simulating && (
          <div className="flex justify-center">
            <button
              onClick={runSimulation}
              disabled={!simulationPayload}
              className="px-8 py-3 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-all shadow-lg shadow-teal-600/20"
            >
              Run Simulation
            </button>
          </div>
        )}

        {/* Loading */}
        {simulating && !hasResults && (
          <div className="space-y-5">
            <SkeletonLoader variant="card" className="h-64 rounded-xl" />
            <SkeletonLoader variant="chart" className="h-80 rounded-xl" />
          </div>
        )}

        {/* Warnings */}
        {!marketpulseOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
            <span className="text-amber-500">{'\u26A0'}</span>
            Signal data unavailable {'\u2014'} MarketPulse offline. Signal modes running as Pure SIP.
          </div>
        )}
        {simError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center gap-2">
            <span className="text-red-500">{'\u2716'}</span>
            Simulation error: {simError}
          </div>
        )}

        {showSaveTemplate && (
          <div className="bg-white border border-teal-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') saveTemplate(); }}
            />
            <button
              onClick={saveTemplate}
              disabled={!templateName.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveTemplate(false)}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ===== SECTION 2: Mode Comparison + Narrative + Table ===== */}
        {hasResults && (
          <section className="animate-in" style={{ animationDelay: '0.1s' }}>
            <ModeComparison
              results={compareResults}
              isLoading={simulating}
              marketpulseOnline={marketpulseOnline}
              period={period}
            />

            <div className="mt-4">
              <NarrativeSummary
                results={compareResults}
                fund={fund}
                config={config}
                period={period}
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 mt-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="section-title">Detailed Metrics</p>
                <button
                  onClick={handleExport}
                  className="text-[10px] text-teal-600 font-medium hover:text-teal-700"
                >
                  Export CSV
                </button>
              </div>
              <ComparisonTable results={compareResults} />
            </div>
          </section>
        )}

        {/* ===== SECTION 3: Equity Curve + Signal Log ===== */}
        {hasResults && (
          <div className="grid grid-cols-12 gap-4 animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="col-span-8">
              <EquityCurve
                results={compareResults}
                cashflowEvents={cashflowEvents}
                isLoading={simulating}
              />
            </div>
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
