import { useMemo } from 'react';
import InfoIcon from '../shared/InfoIcon';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatPct } from '../../lib/format';
import { MODE_LABELS, findBestMode } from '../../lib/simulation';

const MODES = ['SIP', 'SIP_SIGNAL', 'LUMPSUM', 'HYBRID'];

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

const MODE_DESCRIPTIONS = {
  SIP: 'Fixed amount, no signals',
  SIP_SIGNAL: 'SIP + deploy on breadth/sentiment dips',
  LUMPSUM: 'One-time deployment, Day 1',
  HYBRID: 'SIP + lumpsum reserve on signals',
};

const MODE_ICONS = {
  SIP: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M4 20h16M7 16V8m5 8V6m5 10v-4" />
    </svg>
  ),
  SIP_SIGNAL: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M13 7l5 5-5 5M6 12h12" />
    </svg>
  ),
  LUMPSUM: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="8" /><path d="M12 8v8m-3-5h6" strokeLinecap="round" />
    </svg>
  ),
  HYBRID: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M4 14l4-4 4 4 8-8" />
    </svg>
  ),
};

function ModeCard({ mode, summary, isBest, bestSipXirr }) {
  if (!summary) return null;

  const xirr = summary.xirr_pct ?? summary.cagr_pct;
  const xirrLabel = mode === 'LUMPSUM' ? 'CAGR' : 'XIRR';
  const invested = summary.total_invested;
  const value = summary.final_value ?? summary.current_value;
  const drawdown = summary.max_drawdown_pct ?? summary.max_drawdown;
  const wealthGain = invested > 0 && value > 0 ? (value / invested).toFixed(2) : '\u2014';
  const capitalEff = summary.capital_efficiency;

  const borderClass = isBest
    ? 'border-teal-500 bg-teal-50/50'
    : 'border-slate-200';
  const textColor = isBest ? 'text-teal-700' : 'text-slate-700';
  const subColor = isBest ? 'text-teal-500' : 'text-slate-400';
  const labelColor = isBest ? 'text-teal-700' : 'text-slate-400';
  const valueColor = isBest ? 'text-teal-700' : 'text-slate-600';

  const xirrBoost = mode === 'SIP_SIGNAL' && bestSipXirr != null && xirr != null
    ? (xirr - bestSipXirr).toFixed(1)
    : null;
  const topupInvested = summary.topup_invested;

  return (
    <div className={`mode-card ${isBest ? 'best' : ''} rounded-xl border-2 ${borderClass} p-4`}>
      {isBest ? (
        <div className="flex items-center justify-between mb-1">
          <p className={`text-[10px] uppercase tracking-wider font-bold ${labelColor}`}>
            {MODE_LABELS[mode]}
          </p>
          <span className="px-2 py-0.5 text-[8px] font-bold text-white bg-teal-600 rounded-full">
            BEST
          </span>
        </div>
      ) : (
        <p className={`text-[10px] uppercase tracking-wider mb-1 ${labelColor}`}>
          {MODE_LABELS[mode]}
        </p>
      )}
      <p className={`text-xs ${subColor} mb-3`}>{MODE_DESCRIPTIONS[mode]}</p>

      <div className="space-y-2">
        <div>
          <div className="flex items-center gap-1">
            <p className={`text-[9px] ${subColor}`}>{xirrLabel}</p>
            {!isBest && (
              <InfoIcon
                tip={mode === 'LUMPSUM'
                  ? 'Compound Annual Growth Rate for single lumpsum. Unlike XIRR, CAGR only works for single entry/exit.'
                  : 'Extended Internal Rate of Return \u2014 the annualized return that accounts for all your cashflows (SIP amounts, dates).'}
              />
            )}
          </div>
          <p className={`text-xl font-bold tabular-nums ${textColor}`}>
            {xirr != null ? `${xirr >= 0 ? '' : '\u2212'}${Math.abs(xirr).toFixed(1)}%` : '\u2014'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={`text-[8px] ${subColor}`}>Invested</p>
            <p className={`text-[11px] font-semibold tabular-nums ${valueColor}`}>
              {formatCompact(invested)}
            </p>
          </div>
          <div>
            <p className={`text-[8px] ${subColor}`}>Current Value</p>
            <p className={`text-[11px] font-semibold tabular-nums ${
              isBest ? 'text-teal-700' : 'text-emerald-600'
            }`}>
              {formatCompact(value)}
            </p>
          </div>
          <div>
            <p className={`text-[8px] ${subColor}`}>Max Drawdown</p>
            <p className="text-[11px] font-semibold tabular-nums text-red-500">
              {drawdown != null ? `${Number(drawdown).toFixed(1)}%` : '\u2014'}
            </p>
          </div>
          <div>
            {mode === 'HYBRID' && capitalEff != null ? (
              <>
                <div className="flex items-center gap-0.5">
                  <p className={`text-[8px] ${subColor}`}>Capital Efficiency</p>
                  <InfoIcon
                    tip="% of lumpsum reserve actually deployed. 100% means all reserve was used by signals. Low % means signals were too strict or market was calm."
                    className="!w-2.5 !h-2.5 !text-[6px]"
                  />
                </div>
                <p className={`text-[11px] font-semibold tabular-nums ${valueColor}`}>
                  {Math.round(capitalEff)}%
                </p>
              </>
            ) : (
              <>
                <p className={`text-[8px] ${subColor}`}>Wealth Gain</p>
                <p className={`text-[11px] font-semibold tabular-nums ${
                  isBest ? 'text-teal-700' : 'text-emerald-600'
                }`}>
                  {wealthGain}x
                </p>
              </>
            )}
          </div>
        </div>

        {/* SIP+Signals insight */}
        {mode === 'SIP_SIGNAL' && xirrBoost != null && Number(xirrBoost) > 0 && (
          <div className="mt-1 p-2 bg-teal-100/50 rounded-lg">
            <p className="text-[9px] text-teal-700 leading-relaxed">
              <strong>+{xirrBoost}% XIRR boost</strong> vs Pure SIP.
              {topupInvested != null && ` Signals deployed ${formatCompact(topupInvested)} extra at optimal dips.`}
            </p>
          </div>
        )}

        {/* Lumpsum drawdown note */}
        {mode === 'LUMPSUM' && drawdown != null && Math.abs(Number(drawdown)) > 30 && (
          <p className="text-[9px] text-slate-400 leading-relaxed mt-1">
            Higher absolute return but {Number(drawdown).toFixed(1)}% drawdown may be psychologically difficult to hold through.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ModeComparison({ results, isLoading, marketpulseOnline, period }) {
  const bestMode = useMemo(() => findBestMode(results), [results]);

  const sipXirr = useMemo(() => {
    const sip = results?.SIP;
    const s = sip?.summary || sip;
    return s?.xirr_pct ?? null;
  }, [results]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="section-title mb-4">Mode Comparison</p>
        <div className="grid grid-cols-4 gap-4">
          {MODES.map((m) => (
            <SkeletonLoader key={m} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="section-title mb-4">Mode Comparison</p>
        <div className="py-12 text-center text-slate-400 text-sm">
          Configure and run a simulation to see results
        </div>
      </div>
    );
  }

  const periodLabel = period === 'max' ? 'Max' : period?.replace('Y', ' Year');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="section-title">
            Mode Comparison {periodLabel ? `\u2014 ${periodLabel} Backtest` : ''}
          </p>
          <InfoIcon tip="Compares 4 investment modes over the same period and fund. 'SIP + Signals' uses your signal rules to deploy extra capital during market stress. XIRR is the true time-weighted return accounting for all cash flows." />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {MODES.map((mode) => {
          const data = results[mode];
          const summary = data?.summary || data;
          return (
            <ModeCard
              key={mode}
              mode={mode}
              summary={summary}
              isBest={mode === bestMode}
              bestSipXirr={sipXirr}
            />
          );
        })}
      </div>
    </div>
  );
}
