import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { formatAUM, formatPct } from '../../lib/format';
import { fetchFundVerdict } from '../../lib/api';
import { LENS_OPTIONS, LENS_CLASS_KEYS } from '../../lib/lens';
import InfoIcon from '../shared/InfoIcon';

function inceptionAge(inceptionDate) {
  if (!inceptionDate) return null;
  const start = new Date(inceptionDate);
  const now = new Date();
  const years = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 365.25));
  if (years < 1) return '< 1 yr';
  return `${years} yr${years !== 1 ? 's' : ''}`;
}

function inceptionFormatted(inceptionDate) {
  if (!inceptionDate) return null;
  const d = new Date(inceptionDate);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function tierBadgeStyle(tier) {
  if (!tier) return null;
  const t = tier.toUpperCase();
  if (t.includes('LEADER') || t.includes('FORTRESS') || t.includes('ROCK') || t.includes('ALPHA_MACHINE') || t.includes('LEAN'))
    return 'bg-emerald-400/20 text-emerald-100 border-emerald-400/30';
  if (t.includes('LOW_RISK') || t.includes('POSITIVE') || t.includes('STURDY') || t.includes('CONSISTENT') || t.includes('FAIR') || t.includes('STRONG'))
    return 'bg-blue-400/20 text-blue-100 border-blue-400/30';
  if (t.includes('MODERATE') || t.includes('MIXED') || t.includes('AVERAGE') || t.includes('NEUTRAL') || t.includes('ADEQUATE'))
    return 'bg-amber-400/20 text-amber-100 border-amber-400/30';
  return 'bg-red-400/20 text-red-100 border-red-400/30';
}

const RETURN_PERIODS = [
  { key: 'return_1d', label: '1D' },
  { key: 'return_1w', label: '1W' },
  { key: 'return_1m', label: '1M' },
  { key: 'return_3m', label: '3M' },
  { key: 'return_6m', label: '6M' },
  { key: 'return_1y', label: '1Y', highlight: true },
  { key: 'return_3y', label: '3Y' },
  { key: 'return_5y', label: '5Y' },
];

/**
 * HeroSection -- full-width fund identity card with teal top bar, NAV price, returns strip.
 *
 * Props:
 *   fundDetail   object
 *   lensScores   object
 *   mstarId      string
 *   onCompare    func
 */
export default function HeroSection({ fundDetail, lensScores, mstarId, onCompare }) {
  const router = useRouter();
  const fundName = fundDetail.fund_name || fundDetail.legal_name;
  const fundReturns = fundDetail.returns || fundDetail;
  const riskStats = fundDetail.risk_stats;

  // AUM
  const aumRaw = fundDetail.aum;
  const aumCr = aumRaw != null ? Number(aumRaw) / 10000000 : null;

  // NAV
  const nav = fundReturns.nav ?? fundDetail.nav ?? fundDetail.latest_nav;
  const navDate = fundReturns.nav_date ?? fundDetail.nav_date;
  const navChange = fundReturns.return_1d ?? fundDetail.return_1d;
  const nav52High = fundReturns.nav_52wk_high ?? fundDetail.nav_52wk_high;
  const nav52Low = fundReturns.nav_52wk_low ?? fundDetail.nav_52wk_low;

  // 52W range percentage
  let rangePct = null;
  if (nav != null && nav52High != null && nav52Low != null) {
    const high = Number(nav52High);
    const low = Number(nav52Low);
    if (high > low) {
      rangePct = ((Number(nav) - low) / (high - low)) * 100;
    }
  }

  // Top tier badges (pick top 2 lenses)
  const topTiers = [];
  if (lensScores) {
    LENS_OPTIONS.forEach((lens) => {
      const score = lensScores[lens.key];
      const classKey = LENS_CLASS_KEYS[lens.key];
      const tier = lensScores[classKey];
      if (score != null && Number(score) >= 70 && tier) {
        topTiers.push({ label: lens.label, tier, score: Number(score) });
      }
    });
    topTiers.sort((a, b) => b.score - a.score);
  }

  // Category returns for comparison
  const categoryReturns = fundDetail.category_returns || fundDetail.returns?.category || null;

  return (
    <div className="animate-in">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Teal top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            {fundDetail.category_name && (
              <span className="text-white/90 text-xs font-medium">
                SEBI: {fundDetail.category_name}
              </span>
            )}
            {fundDetail.purchase_mode && (
              <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {fundDetail.purchase_mode === 2 || fundDetail.purchase_mode === 'Direct' ? 'Direct' : fundDetail.purchase_mode === 1 || fundDetail.purchase_mode === 'Regular' ? 'Regular' : fundDetail.purchase_mode || ''} {'\u2022'} Growth
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {topTiers.slice(0, 2).map((t) => (
              <span
                key={t.label}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${tierBadgeStyle(t.tier)}`}
              >
                {t.tier.includes('LEADER') || t.tier.includes('FORTRESS') ? '\u2605 ' : ''}
                {t.tier} on {t.label}
              </span>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Left: Identity */}
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 leading-tight tracking-tight">
                  {fundName}
                </h1>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">{mstarId}</span>
              </div>
              <p className="text-sm text-slate-500">{fundDetail.amc_name}</p>

              {/* AI Verdict / Headline tag */}
              <AiVerdict mstarId={mstarId} fallback={lensScores?.headline_tag} />

              {/* Meta row */}
              <div className="flex items-center gap-4 pt-1 flex-wrap">
                {fundDetail.inception_date && (
                  <span className="text-[11px] text-slate-400">
                    Inception: {inceptionFormatted(fundDetail.inception_date)}
                  </span>
                )}
                {aumCr != null && (
                  <span className="text-[11px] text-slate-400">
                    AUM: {formatAUM(aumCr)}
                  </span>
                )}
                {(fundDetail.net_expense_ratio ?? fundDetail.expense_ratio) != null && (
                  <span className="text-[11px] text-slate-400">
                    Expense: {Number(fundDetail.net_expense_ratio ?? fundDetail.expense_ratio).toFixed(2)}%
                  </span>
                )}
                {fundDetail.indian_risk_level && (
                  <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
                    {fundDetail.indian_risk_level}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => router.push(`/simulation?fund=${mstarId}`)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
                >
                  Simulate SIP
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onCompare}
                  className="px-4 py-2 text-xs font-semibold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  Compare
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/fund360')}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Back to Explorer
                </button>
              </div>
            </div>

            {/* Right: NAV price card */}
            <div className="flex-shrink-0 text-right space-y-1">
              {nav != null && (
                <>
                  <div className="flex items-baseline gap-2 justify-end">
                    <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                      {'\u20B9'}{Number(nav).toFixed(2)}
                    </span>
                    {navChange != null && (
                      <span className={`text-sm font-bold font-mono tabular-nums ${Number(navChange) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatPct(navChange)}
                      </span>
                    )}
                  </div>
                  {navDate && (
                    <p className="text-xs text-slate-400">
                      NAV as of {new Date(navDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </>
              )}

              {/* 52W range */}
              {nav52High != null && nav52Low != null && (
                <>
                  <div className="flex items-center gap-3 justify-end text-xs text-slate-500">
                    <span>52W High: <span className="font-semibold text-emerald-600 font-mono tabular-nums">{'\u20B9'}{Number(nav52High).toFixed(2)}</span></span>
                    <span>52W Low: <span className="font-semibold text-red-600 font-mono tabular-nums">{'\u20B9'}{Number(nav52Low).toFixed(2)}</span></span>
                  </div>
                  {rangePct != null && (
                    <>
                      <div className="mt-2 h-1.5 w-48 bg-slate-100 rounded-full relative ml-auto">
                        <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400" style={{ width: '100%' }} />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-teal-600 rounded-full shadow"
                          style={{ left: `${Math.min(Math.max(rangePct, 0), 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">{Math.round(rangePct)}% of 52-week range</p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quick Returns Strip */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {RETURN_PERIODS.map(({ key, label, highlight }) => {
                const val = fundReturns[key];
                if (val == null) return (
                  <div key={key} className="text-center">
                    <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-300">{'\u2014'}</p>
                  </div>
                );
                const n = Number(val);
                const positive = n >= 0;
                const catKey = key;
                const catVal = categoryReturns?.[catKey];
                return (
                  <div
                    key={key}
                    className={`text-center ${highlight ? 'bg-teal-50/50 rounded-lg py-1' : ''}`}
                  >
                    <p className={`text-[10px] mb-0.5 ${highlight ? 'text-teal-600 font-semibold' : 'text-slate-400'}`}>
                      {label}
                    </p>
                    <p className={`text-sm font-bold font-mono tabular-nums ${
                      highlight ? (positive ? 'text-teal-700' : 'text-red-700')
                        : (positive ? 'text-emerald-600' : 'text-red-600')
                    }`}>
                      {formatPct(n)}
                    </p>
                    {catVal != null && (
                      <p className="text-[9px] text-slate-400">Cat: {formatPct(Number(catVal))}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiVerdict({ mstarId, fallback }) {
  const [verdict, setVerdict] = useState(null);

  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    fetchFundVerdict(mstarId)
      .then((res) => {
        if (!cancelled) {
          const text = res?.data?.verdict;
          if (text) setVerdict(text);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mstarId]);

  const text = verdict || fallback;
  if (!text) return null;

  return (
    <p className="text-xs text-slate-400 italic leading-relaxed max-w-xl">
      {verdict ? (
        <><span className="text-teal-500 not-italic">{'\u2726'}</span> {verdict}</>
      ) : (
        <>&ldquo;{fallback}&rdquo;</>
      )}
    </p>
  );
}
