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
    { label: 'Std Dev', key3: 'std_dev_3y', key5: 'std_dev_5y', fmt: 'pct', tip: 'Standard deviation of returns' },
    { label: 'Max Drawdown', key3: 'max_drawdown_3y', key5: 'max_drawdown_5y', fmt: 'pct', tip: 'Largest peak-to-trough decline' },
    { label: 'Beta', key3: 'beta_3y', key5: 'beta_5y', fmt: 'num', tip: 'Sensitivity to market movements' },
    { label: 'Downside Capture', key3: 'capture_down_3y', key5: 'capture_down_5y', fmt: 'pct0', tip: 'How much of market falls the fund captures' },
    { label: 'Upside Capture', key3: 'capture_up_3y', key5: 'capture_up_5y', fmt: 'pct0', tip: 'How much of market gains the fund captures' },
    { label: 'R-Squared', key3: 'r_squared_3y', key5: 'r_squared_5y', fmt: 'num', tip: 'How closely fund tracks benchmark' },
    { label: 'Correlation', key3: 'correlation_3y', key5: 'correlation_5y', fmt: 'num', tip: 'Correlation with benchmark' },
    { label: 'Skewness', key3: 'skewness_3y', key5: 'skewness_5y', fmt: 'num', tip: 'Return distribution asymmetry' },
    { label: 'Kurtosis', key3: 'kurtosis_3y', key5: 'kurtosis_5y', fmt: 'num', tip: 'Tail risk -- extreme event frequency' },
  ];

  const fmtVal = (v, fmt) => {
    if (v == null) return null;
    const n = Number(v);
    if (fmt === 'pct') return `${n.toFixed(1)}%`;
    if (fmt === 'pct0') return `${n.toFixed(1)}%`;
    return n.toFixed(2);
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1">
        <span className="text-[10px] text-slate-400 font-semibold">Metric</span>
        <div className="flex gap-6">
          <span className="text-[10px] text-slate-400 font-semibold w-16 text-right">3Y</span>
          <span className="text-[10px] text-slate-400 font-semibold w-16 text-right">5Y</span>
        </div>
      </div>
      {stats.map(({ label, key3, key5, fmt, tip }) => {
        const v3 = riskStats[key3];
        const v5 = riskStats[key5];
        if (v3 == null && v5 == null) return null;
        return (
          <div key={key3} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-600">{label}</span>
              {tip && <InfoIcon tip={tip} />}
            </div>
            <div className="flex gap-6">
              <span className="text-[11px] font-bold font-mono tabular-nums text-slate-800 w-16 text-right">
                {fmtVal(v3, fmt) ?? '\u2014'}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 w-16 text-right">
                {fmtVal(v5, fmt) ?? '\u2014'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConsistencyBreakdown({ riskStats, fundDetail }) {
  if (!riskStats) return null;
  const sortino3y = riskStats.sortino_3y ?? riskStats.sortino;
  const sortino5y = riskStats.sortino_5y;
  const captureUp3y = riskStats.capture_up_3y;
  const captureUp5y = riskStats.capture_up_5y;
  return (
    <div className="space-y-0">
      {(sortino3y != null || sortino5y != null) && (
        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-600">Sortino Ratio</span>
            <InfoIcon tip="Returns per unit of downside risk" />
          </div>
          <div className="flex items-center gap-3">
            {sortino3y != null && <span className="text-[11px] font-bold font-mono tabular-nums text-slate-800">3Y: {Number(sortino3y).toFixed(2)}</span>}
            {sortino5y != null && <span className="text-[11px] font-mono tabular-nums text-slate-500">5Y: {Number(sortino5y).toFixed(2)}</span>}
          </div>
        </div>
      )}
      {(captureUp3y != null || captureUp5y != null) && (
        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-600">Upside Capture</span>
            <InfoIcon tip="How much of market gains the fund captures" />
          </div>
          <div className="flex items-center gap-3">
            {captureUp3y != null && <span className="text-[11px] font-bold font-mono tabular-nums text-slate-800">3Y: {Number(captureUp3y).toFixed(1)}%</span>}
            {captureUp5y != null && <span className="text-[11px] font-mono tabular-nums text-slate-500">5Y: {Number(captureUp5y).toFixed(1)}%</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function AlphaBreakdown({ riskStats }) {
  if (!riskStats) return null;
  const stats = [
    { label: 'Alpha', key3: 'alpha_3y', key5: 'alpha_5y', fmt: 'sign', tip: 'Excess return vs benchmark after risk adjustment' },
    { label: 'Info Ratio', key3: 'info_ratio_3y', key5: 'info_ratio_5y', fmt: 'num', tip: 'Alpha per unit of active risk' },
    { label: 'Tracking Error', key3: 'tracking_error_3y', key5: 'tracking_error_5y', fmt: 'pct', tip: 'Deviation from benchmark returns' },
    { label: 'Treynor Ratio', key3: 'treynor_3y', key5: 'treynor_5y', fmt: 'num', tip: 'Return per unit of systematic risk' },
  ];

  const fmtVal = (v, fmt) => {
    if (v == null) return null;
    const n = Number(v);
    if (fmt === 'sign') return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
    if (fmt === 'pct') return `${n.toFixed(2)}%`;
    return n.toFixed(2);
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1">
        <span className="text-[10px] text-slate-400 font-semibold">Metric</span>
        <div className="flex gap-6">
          <span className="text-[10px] text-slate-400 font-semibold w-16 text-right">3Y</span>
          <span className="text-[10px] text-slate-400 font-semibold w-16 text-right">5Y</span>
        </div>
      </div>
      {stats.map(({ label, key3, key5, fmt, tip }) => {
        const v3 = riskStats[key3];
        const v5 = riskStats[key5];
        if (v3 == null && v5 == null) return null;
        return (
          <div key={key3} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-600">{label}</span>
              {tip && <InfoIcon tip={tip} />}
            </div>
            <div className="flex gap-6">
              <span className="text-[11px] font-bold font-mono tabular-nums text-slate-800 w-16 text-right">
                {fmtVal(v3, fmt) ?? '\u2014'}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 w-16 text-right">
                {fmtVal(v5, fmt) ?? '\u2014'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EfficiencyBreakdown({ fundDetail, riskStats }) {
  const expense = fundDetail?.net_expense_ratio ?? fundDetail?.expense_ratio;
  const grossExpense = fundDetail?.gross_expense_ratio;
  const turnover = fundDetail?.turnover_ratio ?? riskStats?.turnover_ratio;
  const sharpe3y = riskStats?.sharpe_3y ?? riskStats?.sharpe_ratio;
  const sharpe5y = riskStats?.sharpe_5y;
  const returnPerCost = expense != null && fundDetail?.return_1y != null && Number(expense) > 0
    ? (Math.abs(Number(fundDetail.return_1y)) / Number(expense)).toFixed(1)
    : null;

  return (
    <div className="space-y-0">
      {expense != null && (
        <DetailStat
          label="Expense Ratio (Net)"
          value={`${Number(expense).toFixed(2)}%`}
          catValue={grossExpense != null ? `Gross: ${Number(grossExpense).toFixed(2)}%` : null}
          tip="Annual fee charged by the fund"
        />
      )}
      {turnover != null && (
        <DetailStat label="Turnover Ratio" value={`${Number(turnover).toFixed(0)}%`} tip="How often the fund manager trades — high turnover = hidden costs" />
      )}
      {returnPerCost != null && (
        <DetailStat label="Return per Unit Cost" value={`${returnPerCost}x`} tip="1Y return divided by expense ratio" />
      )}
      {(sharpe3y != null || sharpe5y != null) && (
        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-600">Sharpe Ratio</span>
            <InfoIcon tip="Risk-adjusted return measure" />
          </div>
          <div className="flex items-center gap-3">
            {sharpe3y != null && (
              <span className="text-[11px] font-bold font-mono tabular-nums text-slate-800">3Y: {Number(sharpe3y).toFixed(2)}</span>
            )}
            {sharpe5y != null && (
              <span className="text-[11px] font-mono tabular-nums text-slate-500">5Y: {Number(sharpe5y).toFixed(2)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResilienceBreakdown({ riskStats }) {
  if (!riskStats) return null;
  const fmtVal = (v, fmt) => {
    if (v == null) return '\u2014';
    const n = Number(v);
    if (fmt === 'pct') return `${n.toFixed(1)}%`;
    if (fmt === 'pct0') return `${n.toFixed(1)}%`;
    return n.toFixed(2);
  };
  const rows = [
    { label: 'Max Drawdown', key3: 'max_drawdown_3y', key5: 'max_drawdown_5y', fmt: 'pct' },
    { label: 'Downside Capture', key3: 'capture_down_3y', key5: 'capture_down_5y', fmt: 'pct0' },
    { label: 'Sortino', key3: 'sortino_3y', key5: 'sortino_5y', fmt: 'num' },
  ];
  return (
    <div>
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1">
        <span className="text-[10px] text-slate-400 font-semibold">Metric</span>
        <div className="flex gap-6">
          <span className="text-[10px] text-slate-400 font-semibold w-16 text-right">3Y</span>
          <span className="text-[10px] text-slate-400 font-semibold w-16 text-right">5Y</span>
        </div>
      </div>
      {rows.map(({ label, key3, key5, fmt }) => {
        const v3 = riskStats[key3];
        const v5 = riskStats[key5];
        if (v3 == null && v5 == null) return null;
        return (
          <div key={key3} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <span className="text-[11px] text-slate-600">{label}</span>
            <div className="flex gap-6">
              <span className="text-[11px] font-bold font-mono tabular-nums text-slate-800 w-16 text-right">
                {fmtVal(v3, fmt)}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 w-16 text-right">
                {fmtVal(v5, fmt)}
              </span>
            </div>
          </div>
        );
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
