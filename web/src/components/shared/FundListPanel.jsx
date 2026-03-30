/**
 * FundListPanel — THE standardized fund list component.
 * Used everywhere: Analytics expansions, Dashboard buckets, Sector drill-downs.
 * Consistent layout: rank, name+AMC, category, AUM, return, 6 lens bars, nav arrow.
 */
import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { formatPct, formatAUM } from '../../lib/format';
import { scoreColor, LENS_OPTIONS } from '../../lib/lens';

function LensMiniBar({ fund }) {
  return (
    <div className="flex gap-[2px] items-end h-[16px]">
      {LENS_OPTIONS.map((l) => {
        const val = Number(fund[l.key]) || 0;
        const pct = Math.max(val, 8);
        return (
          <div
            key={l.key}
            className="w-[5px] rounded-sm"
            style={{ height: `${pct}%`, background: scoreColor(val) }}
            title={`${l.label}: ${Math.round(val)}`}
          />
        );
      })}
    </div>
  );
}

function returnColor(val) {
  const n = Number(val) || 0;
  if (n >= 20) return 'text-emerald-700';
  if (n >= 10) return 'text-teal-600';
  if (n >= 0) return 'text-amber-600';
  return 'text-rose-600';
}

const RETURN_KEYS = { '1y': 'return_1y', '3y': 'return_3y', '5y': 'return_5y' };

export default function FundListPanel({
  funds,
  sortKey = 'return_1y',
  title,
  maxItems = 20,
  returnPeriod = '1y',
  showRank = true,
  className = '',
}) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  const returnKey = RETURN_KEYS[returnPeriod] || 'return_1y';

  const sorted = useMemo(() => {
    return [...funds].sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return bv - av;
    });
  }, [funds, sortKey]);

  const visible = showAll ? sorted : sorted.slice(0, maxItems);
  const hasMore = sorted.length > maxItems;

  if (funds.length === 0) return null;

  return (
    <div className={className}>
      {title && (
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
      )}
      <div className="divide-y divide-slate-100">
        {visible.map((fund, idx) => {
          const aumCr = (Number(fund.aum) || 0) / 1e7;
          const retVal = fund[returnKey];
          return (
            <div
              key={fund.mstar_id || idx}
              className="flex items-center gap-2 py-2 px-1 hover:bg-slate-50/60 cursor-pointer transition-colors group"
              onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
            >
              {/* Rank */}
              {showRank && (
                <span className="text-[10px] font-bold text-slate-300 w-5 text-right tabular-nums shrink-0">
                  {idx + 1}
                </span>
              )}

              {/* Fund Name + AMC */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                  {(fund.fund_name || fund.legal_name || '').replace(/ - Direct.*| Direct.*/, '').slice(0, 32)}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {fund.amc_name || ''}
                </p>
              </div>

              {/* Category pill */}
              <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 hidden sm:inline-block max-w-[80px] truncate">
                {fund.category_name || fund.broad_category || ''}
              </span>

              {/* AUM */}
              <span className="text-[10px] font-semibold text-slate-500 tabular-nums w-[60px] text-right shrink-0">
                {formatAUM(aumCr)}
              </span>

              {/* Return */}
              <span className={`text-[11px] font-bold tabular-nums w-[50px] text-right shrink-0 ${returnColor(retVal)}`}>
                {formatPct(retVal)}
              </span>

              {/* 6 Lens Mini-Bars */}
              <div className="w-[40px] shrink-0">
                <LensMiniBar fund={fund} />
              </div>

              {/* Nav arrow */}
              <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* Show all / Show less */}
      {hasMore && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowAll(!showAll); }}
          className="mt-2 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${sorted.length} funds`}
        </button>
      )}
    </div>
  );
}
