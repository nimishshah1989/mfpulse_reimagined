import { useState } from 'react';
import { lensColor } from '../../lib/lens';
import { formatPct } from '../../lib/format';
import InfoIcon from '../shared/InfoIcon';

const LENS_META = {
  return_score: {
    subtitle: 'Makes money?',
    barGradient: 'from-emerald-400 to-emerald-500',
    detailTitle: 'Return Breakdown -- Weighted 20/35/45 (1Y/3Y/5Y)',
  },
  risk_score: {
    subtitle: 'How bumpy?',
    barGradient: 'from-blue-400 to-blue-500',
    detailTitle: 'Risk Profile -- 3Y Metrics',
  },
  consistency_score: {
    subtitle: 'Reliable?',
    barGradient: 'from-emerald-400 to-emerald-500',
    detailTitle: 'Consistency Profile',
  },
  alpha_score: {
    subtitle: 'Manager skill?',
    barGradient: 'from-teal-400 to-teal-500',
    detailTitle: 'Alpha Generation -- Manager Skill Metrics',
  },
  efficiency_score: {
    subtitle: 'Worth the cost?',
    barGradient: 'from-emerald-400 to-emerald-500',
    detailTitle: 'Cost Efficiency Analysis',
  },
  resilience_score: {
    subtitle: 'Bad market?',
    barGradient: 'from-emerald-400 to-emerald-500',
    detailTitle: 'Resilience -- Drawdown & Recovery',
  },
};

function tierColor(score) {
  if (score == null) return 'text-slate-400';
  const n = Number(score);
  if (n >= 70) return 'text-emerald-600';
  if (n >= 50) return 'text-teal-600';
  if (n >= 30) return 'text-amber-600';
  return 'text-red-600';
}

function DetailStat({ label, value, catValue, comparison, tip }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-slate-600">{label}</span>
        {tip && <InfoIcon tip={tip} />}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold font-mono tabular-nums text-slate-800">{value}</span>
        {catValue != null && (
          <span className="text-[9px] text-slate-400">{catValue}</span>
        )}
        {comparison && (
          <span className={`text-[9px] font-semibold ${
            comparison === 'Better' || comparison === 'Lower' ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {comparison}
          </span>
        )}
      </div>
    </div>
  );
}

function ReturnBreakdown({ fundDetail }) {
  const periods = [
    { key: 'return_1y', label: '1Y Return', catKey: 'return_1y' },
    { key: 'return_3y', label: '3Y CAGR', catKey: 'return_3y' },
    { key: 'return_5y', label: '5Y CAGR', catKey: 'return_5y' },
  ];
  const catReturns = fundDetail?.category_returns || fundDetail?.returns?.category || {};
  const fundReturns = fundDetail?.returns || fundDetail || {};

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-3">
        {periods.map(({ key, label, catKey }) => {
          const val = fundReturns[key];
          const catVal = catReturns[catKey];
          if (val == null) return null;
          const n = Number(val);
          return (
            <div key={key} className="text-center p-2 bg-white rounded-lg">
              <p className="text-[9px] text-slate-400">{label}</p>
              <p className={`text-base font-bold font-mono tabular-nums ${n >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPct(n)}
              </p>
              {catVal != null && (
                <p className="text-[9px] text-slate-400 mt-0.5">Cat: {formatPct(Number(catVal))}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { key: 'return_1m', label: '1M' },
          { key: 'return_3m', label: '3M' },
          { key: 'return_6m', label: '6M' },
          { key: 'return_ytd', label: 'YTD' },
        ].map(({ key, label }) => {
          const val = fundReturns[key];
          if (val == null) return null;
          const n = Number(val);
          return (
            <div key={key} className="p-1.5 bg-white rounded-lg">
              <p className="text-[8px] text-slate-400">{label}</p>
              <p className={`text-[11px] font-bold font-mono tabular-nums ${n >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPct(n)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskBreakdown({ riskStats }) {
  if (!riskStats) return null;
  const stats = [
    { label: 'Std Dev (3Y)', key: 'std_dev_3y', alt: 'std_dev', fmt: 'pct', lowerBetter: true, tip: 'Standard deviation of returns over 3 years' },
    { label: 'Max Drawdown', key: 'max_drawdown_3y', alt: 'max_drawdown', fmt: 'pct', lowerBetter: true, tip: 'Largest peak-to-trough decline' },
    { label: 'Beta (3Y)', key: 'beta_3y', alt: 'beta', fmt: 'num', lowerBetter: true, tip: 'Sensitivity to market movements' },
    { label: 'Downside Capture', key: 'downside_capture_3y', alt: 'downside_capture', fmt: 'pct0', lowerBetter: true, tip: 'How much of market falls the fund captures' },
    { label: 'Upside Capture', key: 'upside_capture_3y', alt: 'upside_capture', fmt: 'pct0', lowerBetter: false, tip: 'How much of market gains the fund captures' },
    { label: 'R-Squared', key: 'r_squared_3y', alt: 'r_squared', fmt: 'num', tip: 'How closely fund tracks benchmark' },
    { label: 'Skewness (3Y)', key: 'skewness_3y', alt: 'skewness', fmt: 'num', tip: 'Return distribution asymmetry' },
    { label: 'Kurtosis (3Y)', key: 'kurtosis_3y', alt: 'kurtosis', fmt: 'num', tip: 'Tail risk -- extreme event frequency' },
  ];

  return (
    <div className="space-y-0">
      {stats.map(({ label, key, alt, fmt, lowerBetter, tip }) => {
        const val = riskStats[key] ?? riskStats[alt];
        if (val == null) return null;
        const n = Number(val);
        let formatted;
        if (fmt === 'pct') formatted = `${n.toFixed(1)}%`;
        else if (fmt === 'pct0') formatted = `${n.toFixed(1)}%`;
        else formatted = n.toFixed(2);
        return (
          <DetailStat
            key={key}
            label={label}
            value={formatted}
            tip={tip}
          />
        );
      })}
    </div>
  );
}

function ConsistencyBreakdown({ riskStats, fundDetail }) {
  if (!riskStats) return null;
  const sortino3y = riskStats.sortino_3y ?? riskStats.sortino;
  return (
    <div className="space-y-0">
      {sortino3y != null && (
        <DetailStat label="Sortino Ratio (3Y)" value={Number(sortino3y).toFixed(2)} tip="Returns per unit of downside risk" />
      )}
    </div>
  );
}

function AlphaBreakdown({ riskStats }) {
  if (!riskStats) return null;
  const stats = [
    { label: 'Alpha (3Y)', key: 'alpha_3y', alt: 'alpha', fmt: 'sign', tip: 'Excess return vs benchmark after risk adjustment' },
    { label: 'Alpha (5Y)', key: 'alpha_5y', fmt: 'sign' },
    { label: 'Information Ratio (3Y)', key: 'info_ratio_3y', alt: 'info_ratio', fmt: 'num', tip: 'Alpha per unit of active risk' },
    { label: 'Tracking Error (3Y)', key: 'tracking_error_3y', alt: 'tracking_error', fmt: 'pct', tip: 'Deviation from benchmark returns' },
    { label: 'Treynor Ratio (3Y)', key: 'treynor_3y', alt: 'treynor', fmt: 'num', tip: 'Return per unit of systematic risk' },
  ];

  return (
    <div className="space-y-0">
      {stats.map(({ label, key, alt, fmt, tip }) => {
        const val = riskStats[key] ?? (alt ? riskStats[alt] : undefined);
        if (val == null) return null;
        const n = Number(val);
        let formatted;
        if (fmt === 'sign') formatted = `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
        else if (fmt === 'pct') formatted = `${n.toFixed(2)}%`;
        else formatted = n.toFixed(2);
        return <DetailStat key={key} label={label} value={formatted} tip={tip} />;
      })}
    </div>
  );
}

function EfficiencyBreakdown({ fundDetail, riskStats }) {
  const expense = fundDetail?.net_expense_ratio ?? fundDetail?.expense_ratio;
  const sharpe = riskStats?.sharpe_3y ?? riskStats?.sharpe_ratio;
  const returnPerCost = expense != null && fundDetail?.return_1y != null
    ? (Math.abs(Number(fundDetail.return_1y)) / Number(expense)).toFixed(1)
    : null;

  return (
    <div className="space-y-0">
      {expense != null && (
        <DetailStat label="Expense Ratio" value={`${Number(expense).toFixed(2)}%`} tip="Annual fee charged by the fund" />
      )}
      {returnPerCost != null && (
        <DetailStat label="Return per Unit Cost" value={`${returnPerCost}x`} tip="1Y return divided by expense ratio" />
      )}
      {sharpe != null && (
        <DetailStat label="Sharpe Ratio (3Y)" value={Number(sharpe).toFixed(2)} tip="Risk-adjusted return measure" />
      )}
    </div>
  );
}

function ResilienceBreakdown({ riskStats }) {
  if (!riskStats) return null;
  const stats = [
    { label: 'Max Drawdown (3Y)', key: 'max_drawdown_3y', alt: 'max_drawdown', fmt: 'pct' },
    { label: 'Downside Capture', key: 'downside_capture_3y', alt: 'downside_capture', fmt: 'pct0' },
  ];
  return (
    <div className="space-y-0">
      {stats.map(({ label, key, alt, fmt }) => {
        const val = riskStats[key] ?? (alt ? riskStats[alt] : undefined);
        if (val == null) return null;
        const n = Number(val);
        let formatted;
        if (fmt === 'pct') formatted = `${n.toFixed(1)}%`;
        else if (fmt === 'pct0') formatted = `${n.toFixed(1)}%`;
        else formatted = n.toFixed(2);
        return <DetailStat key={key} label={label} value={formatted} />;
      })}
    </div>
  );
}

function getBreakdownComponent(lensKey, riskStats, fundDetail) {
  switch (lensKey) {
    case 'return_score': return <ReturnBreakdown fundDetail={fundDetail} />;
    case 'risk_score': return <RiskBreakdown riskStats={riskStats} />;
    case 'consistency_score': return <ConsistencyBreakdown riskStats={riskStats} fundDetail={fundDetail} />;
    case 'alpha_score': return <AlphaBreakdown riskStats={riskStats} />;
    case 'efficiency_score': return <EfficiencyBreakdown fundDetail={fundDetail} riskStats={riskStats} />;
    case 'resilience_score': return <ResilienceBreakdown riskStats={riskStats} />;
    default: return null;
  }
}

/**
 * LensCard -- horizontal row with score bar and expandable detail panel.
 * Matches the mockup's expandable lens breakdown design.
 *
 * Props:
 *   name          string
 *   lensKey       string
 *   score         number  -- 0-100
 *   tier          string
 *   categoryName  string
 *   riskStats     object
 *   fundDetail    object
 */
export default function LensCard({ name, lensKey, score, tier, categoryName, riskStats, fundDetail, rankInfo }) {
  const [expanded, setExpanded] = useState(false);
  const meta = LENS_META[lensKey] || {};
  const displayScore = score != null ? Math.round(Number(score)) : null;
  const color = tierColor(score);
  const barPct = displayScore != null ? Math.min(displayScore, 100) : 0;

  const isPending = score == null;

  if (isPending) {
    return (
      <div className="opacity-50">
        <div className="flex items-center gap-3 rounded-xl py-1.5 px-2">
          <span className="text-[10px] text-slate-400">{'\u25B6'}</span>
          <div className="w-24 flex-shrink-0">
            <p className="text-xs font-semibold text-slate-500">{name}</p>
            <p className="text-[10px] text-slate-400">{meta.subtitle}</p>
          </div>
          <div className="flex-1">
            <div className="h-6 bg-slate-100 rounded-full" />
          </div>
          <div className="w-20 text-right flex-shrink-0">
            <span className="text-sm font-bold font-mono tabular-nums text-slate-400">{'\u2014'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 rounded-xl py-1.5 px-2 -mx-2 cursor-pointer transition-colors hover:bg-slate-50"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
      >
        <span className={`text-[10px] text-slate-400 transition-transform duration-300 inline-block ${expanded ? 'rotate-90' : ''}`}>
          {'\u25B6'}
        </span>
        <div className="w-24 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-700">{name}</p>
          <p className="text-[10px] text-slate-400">{meta.subtitle}</p>
        </div>
        <div className="flex-1">
          <div className="h-6 bg-slate-100 rounded-full relative overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${meta.barGradient || 'from-teal-400 to-teal-500'} transition-all duration-700 ease-out`}
              style={{ width: `${barPct}%` }}
            />
            <div className="absolute top-0 left-1/2 h-full w-px bg-slate-300 opacity-50" />
          </div>
        </div>
        <div className="w-24 text-right flex-shrink-0">
          <span className={`text-sm font-bold font-mono tabular-nums ${color}`}>{displayScore}</span>
          {tier && (
            <span className={`text-[10px] font-semibold block ${color}`}>{tier}</span>
          )}
          {rankInfo && (
            <span className="text-[9px] text-slate-400 block">
              Rank {rankInfo.rank} of {rankInfo.total}
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      <div
        className={`overflow-hidden transition-all duration-400 ${
          expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="mt-3 ml-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
            {meta.detailTitle || `${name} Breakdown`}
          </p>
          {getBreakdownComponent(lensKey, riskStats, fundDetail)}
        </div>
      </div>
    </div>
  );
}
