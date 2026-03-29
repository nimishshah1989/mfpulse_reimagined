import { useState, useEffect, useRef } from 'react';
import { fetchFunds } from '../../lib/api';
import { formatPct, formatAUM } from '../../lib/format';
import { LENS_OPTIONS, scoreColor } from '../../lib/lens';
import InfoIcon from '../shared/InfoIcon';

const LENS_SHORT = {
  return_score: 'Ret',
  risk_score: 'Risk',
  consistency_score: 'Con',
  alpha_score: 'Alp',
  efficiency_score: 'Eff',
  resilience_score: 'Res',
};

const LENS_TIPS = {
  return_score: 'Return percentile within SEBI category. Higher = better absolute returns.',
  risk_score: 'Risk-adjusted score. Higher = lower volatility relative to peers.',
  consistency_score: 'Consistency of performance over rolling periods.',
  alpha_score: 'Manager skill — excess returns over benchmark after adjusting for risk.',
  efficiency_score: 'Cost efficiency — how much return per unit of expense ratio.',
  resilience_score: 'How well the fund holds up during market downturns.',
};

function LensMiniBar({ score, shortLabel }) {
  const color = scoreColor(score);
  const widthPct = Math.max(10, Math.min(100, score));
  return (
    <div className="text-center">
      <div className="h-1.5 rounded-full bg-slate-100 mx-1">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[7px] text-slate-400 mt-0.5">
        {shortLabel} {Math.round(score)}
      </p>
    </div>
  );
}

function FundIdentityCard({ fund, lensScores, onClear }) {
  const name = fund.fund_name || fund.legal_name || '';
  const parts = name.split(' - ');
  const shortName = parts[0];
  const planType = parts[1] || '';

  return (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{shortName}</p>
          <p className="text-[10px] text-slate-400 truncate">
            {planType && `${planType} · `}
            {fund.category_name || ''}
            {fund.amc_name ? ` · ${fund.amc_name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`/fund360?id=${fund.mstar_id}`}
            className="text-[10px] text-teal-600 font-medium hover:underline"
          >
            360 View &rarr;
          </a>
          <button
            onClick={onClear}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 text-[10px]"
          >
            x
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[8px] text-slate-400">NAV</p>
          <p className="text-[11px] font-bold tabular-nums text-slate-700">
            {(fund.nav ?? fund.latest_nav) != null ? Number(fund.nav ?? fund.latest_nav).toFixed(2) : '\u2014'}
          </p>
        </div>
        <div>
          <p className="text-[8px] text-slate-400">1Y</p>
          <p className={`text-[11px] font-bold tabular-nums ${
            (fund.return_1y ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {fund.return_1y != null ? formatPct(fund.return_1y) : '\u2014'}
          </p>
        </div>
        <div>
          <p className="text-[8px] text-slate-400">AUM</p>
          <p className="text-[11px] font-bold tabular-nums text-slate-700">
            {fund.aum != null ? formatAUM(Number(fund.aum) / 10000000) : '\u2014'}
          </p>
        </div>
        <div>
          <p className="text-[8px] text-slate-400">Expense</p>
          <p className="text-[11px] font-bold tabular-nums text-slate-700">
            {(fund.net_expense_ratio ?? fund.expense_ratio) != null ? `${Number(fund.net_expense_ratio ?? fund.expense_ratio).toFixed(2)}%` : '\u2014'}
          </p>
        </div>
      </div>

      {lensScores && (
        <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-6 gap-1">
          {LENS_OPTIONS.map((lens) => {
            const score = lensScores[lens.key];
            if (score == null) return <div key={lens.key} />;
            return (
              <LensMiniBar
                key={lens.key}
                score={score}
                shortLabel={LENS_SHORT[lens.key]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FundPicker({
  selectedFund,
  lensScores,
  onFundSelect,
  onClear,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetchFunds({ search: query, limit: 20 })
        .then((res) => {
          setResults(res.data || []);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="section-title mb-3">Select Fund</p>

      <div ref={wrapperRef} className="relative mb-4">
        <input
          type="text"
          value={selectedFund ? '' : query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ISIN, or AMC..."
          className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
          disabled={!!selectedFund}
        />
        <svg
          className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {loading && (
          <span className="absolute right-3 top-3 text-[10px] text-slate-400">
            Searching...
          </span>
        )}

        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {results.map((fund) => (
              <button
                key={fund.mstar_id}
                onClick={() => {
                  onFundSelect(fund);
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {fund.fund_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">{fund.amc_name}</span>
                      {fund.category_name && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {fund.category_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {fund.return_1y != null && (
                    <span
                      className={`text-xs font-mono tabular-nums flex-shrink-0 ${
                        fund.return_1y >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatPct(fund.return_1y)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {open && query.length >= 2 && results.length === 0 && !loading && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-xs text-slate-500">
            No funds found
          </div>
        )}
      </div>

      {selectedFund && (
        <FundIdentityCard
          fund={selectedFund}
          lensScores={lensScores}
          onClear={onClear}
        />
      )}

      {!selectedFund && (
        <div className="p-4 text-center text-[11px] text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Search and select a fund to begin simulation
        </div>
      )}
    </div>
  );
}
