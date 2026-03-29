import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { findBestMode, MODE_LABELS } from '../../lib/simulation';
import { fetchSimulationExplainer } from '../../lib/api';

function formatCompact(val) {
  if (val == null) return '\u2014';
  const n = Number(val);
  if (isNaN(n)) return '\u2014';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(Math.round(n));
}

function returnColor(pct) {
  if (pct == null) return 'text-slate-500';
  if (pct >= 100) return 'text-emerald-600';
  if (pct >= 50) return 'text-teal-600';
  if (pct >= 20) return 'text-teal-600';
  if (pct >= 0) return 'text-amber-600';
  return 'text-red-600';
}

function bgColor(pct) {
  if (pct == null) return '';
  if (pct >= 100) return 'bg-emerald-50/50';
  if (pct >= 50) return 'bg-emerald-50/50';
  if (pct >= 0) return 'bg-amber-50/50';
  return 'bg-red-50/50';
}

function dotColor(pct) {
  if (pct == null) return 'bg-slate-400';
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-teal-400';
  if (pct >= 0) return 'bg-amber-500';
  return 'bg-red-500';
}

function SignalEventItem({ event, latestNav }) {
  const date = new Date(event.date);
  const dateStr = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const amount = event.amount;
  const nav = event.nav;
  const trigger = event.trigger || 'Signal';

  // Compute approximate current value if we have current NAV
  const units = nav > 0 ? amount / nav : 0;
  const currentValue = latestNav ? units * latestNav : null;
  const returnPct = currentValue && amount > 0
    ? ((currentValue - amount) / amount) * 100
    : null;

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg ${bgColor(returnPct)}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${dotColor(returnPct)}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-slate-700">
          {dateStr} {'\u2014'} {trigger}
        </p>
        <p className="text-[9px] text-slate-500 font-mono tabular-nums">
          Deployed {formatCompact(amount)} at NAV {nav != null ? Number(nav).toFixed(1) : '\u2014'}
          {currentValue != null && ` \u00B7 Now worth ${formatCompact(currentValue)}`}
        </p>
        {returnPct != null && (
          <p className={`text-[9px] font-semibold font-mono tabular-nums ${returnColor(returnPct)}`}>
            {returnPct >= 0 ? '+' : '\u2212'}{Math.abs(returnPct).toFixed(0)}% return
            {returnPct >= 100 ? ' on this deployment' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

function WhySignalsWon({ results, fund }) {
  const [aiExplainer, setAiExplainer] = useState(null);
  const bestMode = findBestMode(results);

  const sipSummary = results?.SIP?.summary || results?.SIP;
  const bestSummary = results?.[bestMode]?.summary || results?.[bestMode];

  const sipXirr = sipSummary?.xirr_pct ?? 0;
  const bestXirr = bestSummary?.xirr_pct ?? 0;
  const boost = (bestXirr - sipXirr).toFixed(1);
  const bestLabel = MODE_LABELS[bestMode] || bestMode;

  useEffect(() => {
    if (!results || !bestSummary) return;
    let cancelled = false;
    const modes = {};
    Object.entries(results).forEach(([k, v]) => {
      const s = v?.summary || v;
      if (s) modes[k] = { xirr: s.xirr_pct, cagr: s.cagr_pct, max_drawdown: s.max_drawdown_pct, total_value: s.final_value };
    });
    fetchSimulationExplainer({
      fund_name: fund?.fund_name || 'Unknown',
      period: '5Y',
      best_mode: bestMode,
      signal_hit_rate: bestSummary?.signal_hit_rate,
      modes,
    })
      .then((res) => {
        if (!cancelled) {
          const text = res?.data?.explanation;
          if (text) setAiExplainer(text);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [results, bestMode, bestSummary, fund]);

  if (!results || !sipSummary || !bestSummary) return null;
  if (Number(boost) <= 0 || bestMode === 'SIP') return null;

  return (
    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100 p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="text-teal-500 text-xs mt-0.5 flex-shrink-0">{aiExplainer ? '\u2726' : '\u2728'}</span>
        <div>
          <p className="text-[10px] font-semibold text-teal-700 mb-0.5">
            Why {bestLabel} Won
          </p>
          <p className="text-[9px] text-teal-600 leading-relaxed">
            {aiExplainer || (
              <>
                Signal rules deployed extra capital during corrections {'\u2014'} exactly when NAVs were lowest.
                +{boost}% XIRR boost over Pure SIP
                {bestSummary.max_drawdown_pct != null && sipSummary.max_drawdown_pct != null &&
                  Math.abs(bestSummary.max_drawdown_pct) < Math.abs(sipSummary.max_drawdown_pct)
                  ? ' with lower drawdown.'
                  : '.'}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignalLog({
  cashflowEvents,
  results,
  latestNav,
  fund,
  config,
  rules,
  period,
  onExport,
}) {
  const router = useRouter();

  const signalEvents = useMemo(() => {
    if (!cashflowEvents?.length) return [];
    return cashflowEvents
      .filter((e) => e.event_type === 'SIGNAL_TOPUP' || (e.trigger && e.trigger !== 'SIP'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [cashflowEvents]);

  const handleSaveStrategy = () => {
    if (!fund?.mstar_id) return;
    const template = btoa(
      JSON.stringify({ mstar_id: fund.mstar_id, config, rules, period })
    );
    router.push(`/strategy?template=${template}`);
  };

  return (
    <div className="space-y-4">
      {/* Why Signals Won — show first for context */}
      <WhySignalsWon results={results} fund={fund} />

      {/* Signal Event Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">Signal Event Log</p>
          {signalEvents.length > 0 && (
            <span className="text-[9px] text-slate-400 tabular-nums">
              {signalEvents.length} deployment{signalEvents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {signalEvents.length > 0 ? (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
            {signalEvents.map((event, i) => (
              <SignalEventItem key={i} event={event} latestNav={latestNav} />
            ))}
          </div>
        ) : (
          <div className="text-center py-5">
            <p className="text-[10px] text-slate-400">No signal deployments</p>
            <p className="text-[9px] text-slate-300 mt-0.5">Signals may not have triggered in this period</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
        <button
          onClick={handleSaveStrategy}
          className="w-full py-2.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20"
        >
          Save as Strategy
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onExport}
            className="py-2 text-[10px] font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-200"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard?.writeText(url).catch(() => {});
            }}
            className="py-2 text-[10px] font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
          >
            Share Link
          </button>
        </div>
      </div>
    </div>
  );
}
