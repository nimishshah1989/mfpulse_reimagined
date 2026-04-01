import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchFunds } from '../../lib/api';
import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
import { formatINR, formatPct, formatAUMRaw } from '../../lib/format';

const LENS_KEYS = [
  { key: 'return_score', label: 'Ret' },
  { key: 'risk_score', label: 'Rsk' },
  { key: 'consistency_score', label: 'Con' },
  { key: 'alpha_score', label: 'Alp' },
  { key: 'efficiency_score', label: 'Eff' },
  { key: 'resilience_score', label: 'Res' },
];

export default function FundSelector({
  funds, allocations, onAddFund, onRemoveFund, onSetAllocation,
  sipAmount = 0, lumpsumAmount = 0,
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  // Debounced search - Regular plans only, 5Y+ NAV history
  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetchFunds({
          search,
          purchase_mode: 1,
          min_nav_count: 1250,
          limit: 15,
        });
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const isAdded = (mstarId) => funds.some((f) => f.mstar_id === mstarId);

  const totalAlloc = Object.values(allocations).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search by fund name, AMC, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-teal-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Empty state */}
      {search.length >= 2 && !searching && results.length === 0 && (
        <div className="border border-slate-200 rounded-xl px-4 py-5 text-center">
          <p className="text-xs text-slate-400">No funds found matching &quot;{search}&quot;</p>
          <p className="text-[10px] text-slate-300 mt-1">Try a different fund name, AMC, or category</p>
        </div>
      )}

      {/* Search results dropdown */}
      <SearchResults results={results} isAdded={isAdded} onAdd={onAddFund} onRemove={onRemoveFund} />

      {/* Selected funds */}
      {funds.length > 0 && (
        <SelectedFunds
          funds={funds}
          allocations={allocations}
          totalAlloc={totalAlloc}
          sipAmount={sipAmount}
          lumpsumAmount={lumpsumAmount}
          onSetAllocation={onSetAllocation}
          onRemove={onRemoveFund}
        />
      )}
    </div>
  );
}

function SearchResults({ results, isAdded, onAdd, onRemove }) {
  if (results.length === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
      {results.map((fund) => (
        <div key={fund.mstar_id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-800 truncate">{fund.fund_name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {fund.category_name && (
                <span className="text-[10px] text-slate-400">{fund.category_name}</span>
              )}
              {fund.aum != null && (
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                  {formatAUMRaw(fund.aum)}
                </span>
              )}
              {fund.return_1y != null && (
                <span className={`text-[10px] font-mono tabular-nums font-medium ${
                  fund.return_1y >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  1Y: {formatPct(fund.return_1y)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {LENS_KEYS.map(({ key }) => (
                fund[key] != null && (
                  <LensCircle key={key} scoreKey={key} score={fund[key]} size="sm" />
                )
              ))}
              {fund.return_class && <TierBadge tier={fund.return_class} score={fund.return_score} />}
            </div>
          </div>
          <button
            type="button"
            onClick={() => isAdded(fund.mstar_id) ? onRemove(fund.mstar_id) : onAdd(fund)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isAdded(fund.mstar_id)
                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                : 'text-teal-600 bg-teal-50 hover:bg-teal-100'
            }`}
          >
            {isAdded(fund.mstar_id) ? 'Remove' : '+ Add'}
          </button>
        </div>
      ))}
    </div>
  );
}

function SelectedFunds({
  funds, allocations, totalAlloc,
  sipAmount, lumpsumAmount,
  onSetAllocation, onRemove,
}) {
  const hasSip = sipAmount > 0;
  const hasLump = lumpsumAmount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-600">
          Selected Funds ({funds.length})
        </h4>
        <span className={`text-xs font-mono tabular-nums font-medium ${
          Math.abs(totalAlloc - 100) < 0.5 ? 'text-emerald-600' : totalAlloc > 100 ? 'text-red-600' : 'text-amber-600'
        }`}>
          {totalAlloc.toFixed(1)}% allocated
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, totalAlloc)}%`,
            backgroundColor: Math.abs(totalAlloc - 100) < 0.5 ? '#059669' : totalAlloc > 100 ? '#dc2626' : '#f59e0b',
          }}
        />
      </div>

      {/* Fund cards */}
      <div className="space-y-2">
        {funds.map((fund) => {
          const alloc = allocations[fund.mstar_id] || 0;
          return (
            <FundCard
              key={fund.mstar_id}
              fund={fund}
              alloc={alloc}
              sipAmount={hasSip ? (alloc / 100) * sipAmount : 0}
              lumpsumAmount={hasLump ? (alloc / 100) * lumpsumAmount : 0}
              hasSip={hasSip}
              hasLump={hasLump}
              onAllocChange={(v) => onSetAllocation(fund.mstar_id, v)}
              onRemove={() => onRemove(fund.mstar_id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FundCard({ fund, alloc, sipAmount, lumpsumAmount, hasSip, hasLump, onAllocChange, onRemove }) {
  return (
    <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{fund.fund_name}</p>
        <div className="flex items-center gap-1 mt-1">
          {fund.return_score != null && <LensCircle scoreKey="return_score" score={fund.return_score} size="sm" />}
          {fund.alpha_score != null && <LensCircle scoreKey="alpha_score" score={fund.alpha_score} size="sm" />}
          {fund.resilience_score != null && <LensCircle scoreKey="resilience_score" score={fund.resilience_score} size="sm" />}
          {fund.category_name && (
            <span className="text-[10px] text-slate-400 ml-1">{fund.category_name}</span>
          )}
        </div>
      </div>

      {/* Allocation control */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="range"
          min={0} max={100} step={1}
          value={alloc}
          onChange={(e) => onAllocChange(Number(e.target.value))}
          className="w-16 h-1 accent-teal-600 cursor-pointer"
        />
        <input
          type="number"
          value={alloc}
          onChange={(e) => onAllocChange(Number(e.target.value))}
          className="w-14 text-right border border-slate-200 rounded px-1.5 py-1 text-xs font-mono tabular-nums focus:border-teal-500 outline-none"
          min={0} max={100}
        />
        <span className="text-[10px] text-slate-400">%</span>
      </div>

      {/* Computed amounts */}
      {(hasSip || hasLump) && (
        <div className="flex-shrink-0 text-right space-y-0.5">
          {hasSip && sipAmount > 0 && (
            <p className="text-[10px] font-mono tabular-nums text-slate-500">{formatINR(sipAmount, 0)}/mo</p>
          )}
          {hasLump && lumpsumAmount > 0 && (
            <p className="text-[10px] font-mono tabular-nums text-teal-600">{formatINR(lumpsumAmount, 0)} lump</p>
          )}
        </div>
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
