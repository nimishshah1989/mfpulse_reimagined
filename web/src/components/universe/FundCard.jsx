import { useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
import { LENS_OPTIONS, scoreColor } from '../../lib/lens';
import { formatPct, formatAUM } from '../../lib/format';

/**
 * Inline popup card shown when clicking a bubble in BubbleScatter.
 * Positioned near the click point, stays within viewport bounds.
 */
export default function FundCard({ fund, x, y, onClose }) {
  const cardRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const pad = 12;

    let left = x + 16;
    let top = y - rect.height / 2;

    if (left + rect.width > window.innerWidth - pad) {
      left = x - rect.width - 16;
    }
    if (top < pad) top = pad;
    if (top + rect.height > window.innerHeight - pad) {
      top = window.innerHeight - rect.height - pad;
    }

    cardRef.current.style.left = `${left}px`;
    cardRef.current.style.top = `${top}px`;
    cardRef.current.style.opacity = '1';
    cardRef.current.style.transform = 'scale(1)';
  }, [x, y]);

  if (!fund) return null;

  const aumCr = (Number(fund.aum) || 0) / 10000000;
  const return1y = Number(fund.return_1y);
  const return1yValid = !isNaN(return1y);
  const ter = Number(fund.net_expense_ratio ?? fund.expense_ratio);
  const terValid = !isNaN(ter);

  const topLenses = LENS_OPTIONS
    .map((l) => ({ ...l, score: Number(fund[l.key]) || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div
      ref={cardRef}
      className="fixed z-50 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      style={{
        opacity: 0,
        transform: 'scale(0.95)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2 pr-6">
          {fund.fund_name || fund.legal_name || fund.mstar_id}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
          {fund.amc_name}
          {fund.category_name && (
            <span className="ml-1 text-slate-300">&middot;</span>
          )}
          {fund.category_name && (
            <span className="ml-1">{fund.category_name}</span>
          )}
        </p>
        {fund.headline_tag && (
          <p className="text-[10px] text-teal-600 italic mt-1 leading-snug line-clamp-2">
            {fund.headline_tag}
          </p>
        )}
      </div>

      {/* Six lens scores */}
      <div className="px-3.5 py-2 bg-slate-50 border-y border-slate-100">
        <div className="grid grid-cols-6 gap-1">
          {LENS_OPTIONS.map((l) => {
            const score = Number(fund[l.key]) || 0;
            const color = scoreColor(score);
            return (
              <div key={l.key} className="flex flex-col items-center gap-0.5">
                <LensCircle lensKey={l.key} score={fund[l.key]} size="sm" />
                <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${score}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-[8px] text-slate-400 font-medium">{l.label.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier badges */}
      <div className="px-3.5 py-2 flex flex-wrap gap-1">
        {topLenses.map((l) => (
          <TierBadge key={l.key} lensKey={l.key} score={l.score} />
        ))}
      </div>

      {/* Multi-period returns */}
      <div className="px-3.5 py-2 border-t border-slate-100">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: '1Y', key: 'return_1y' },
            { label: '3Y CAGR', key: 'return_3y' },
            { label: '5Y CAGR', key: 'return_5y' },
          ].map(({ label, key }) => {
            const val = Number(fund[key]);
            const valid = !isNaN(val);
            return (
              <div key={key}>
                <p className="text-[9px] text-slate-400">{label}</p>
                {valid ? (
                  <p className={`text-xs font-mono font-bold tabular-nums ${val >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPct(val)}
                  </p>
                ) : (
                  <p className="text-xs font-mono text-slate-300">&mdash;</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px]">
          <span>
            <span className="text-slate-400">AUM </span>
            <span className="font-mono text-slate-700 tabular-nums">{formatAUM(aumCr)}</span>
          </span>
          {terValid && (
            <span>
              <span className="text-slate-400">TER </span>
              <span className="font-mono text-slate-700 tabular-nums">{ter.toFixed(2)}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3.5 py-2.5 border-t border-slate-100 flex gap-2">
        <button
          type="button"
          onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
          className="flex-1 text-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
        >
          View Fund 360
        </button>
        <button
          type="button"
          onClick={() => router.push(`/simulation?fund=${fund.mstar_id}`)}
          className="flex-1 text-center px-3 py-1.5 bg-white hover:bg-slate-50 text-teal-700 text-[11px] font-semibold rounded-lg border border-teal-200 transition-colors"
        >
          Simulate SIP
        </button>
      </div>
    </div>
  );
}
