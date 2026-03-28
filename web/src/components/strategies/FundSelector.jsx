import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchFunds } from '../../lib/api';
import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
import { formatPct } from '../../lib/format';
import { lensColor } from '../../lib/lens';

const QUICK_FILTERS = [
  { label: 'Top 5 by Alpha', params: { sort: 'alpha_score', order: 'desc', limit: 5 } },
  { label: 'Large Cap Leaders', params: { broad_category: 'Equity', search: 'large cap', sort: 'return_score', order: 'desc', limit: 5 } },
  { label: 'Best Sharpe', params: { sort: 'efficiency_score', order: 'desc', limit: 5 } },
];

export default function FundSelector({ funds, allocations, onAddFund, onRemoveFund, onSetAllocation }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (params) => {
    setSearching(true);
    try {
      const res = await fetchFunds({ ...params, limit: params.limit || 20 });
      setResults(res.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch({ search });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, doSearch]);

  const handleQuickFilter = useCallback((params) => {
    setSearch('');
    doSearch(params);
  }, [doSearch]);

  const totalAlloc = Object.values(allocations).reduce((s, v) => s + (v || 0), 0);
  const allocPct = Math.min(100, totalAlloc);

  const isAdded = (mstarId) => funds.some((f) => f.mstar_id === mstarId);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search funds by name, AMC, or ISIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
        />
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => handleQuickFilter(f.params)}
            className="px-2.5 py-1 text-xs font-medium text-teal-600 border border-teal-200 rounded-full hover:bg-teal-50 transition-colors"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
          {results.map((fund) => (
            <div key={fund.mstar_id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{fund.fund_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {fund.return_score != null && <LensCircle scoreKey="return_score" score={fund.return_score} size="sm" />}
                  {fund.alpha_score != null && <LensCircle scoreKey="alpha_score" score={fund.alpha_score} size="sm" />}
                  {fund.resilience_score != null && <LensCircle scoreKey="resilience_score" score={fund.resilience_score} size="sm" />}
                  {fund.category_name && <span className="text-[10px] text-slate-400 truncate">{fund.category_name}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => isAdded(fund.mstar_id) ? onRemoveFund(fund.mstar_id) : onAddFund(fund)}
                className={`text-xs px-2 py-1 rounded ${
                  isAdded(fund.mstar_id)
                    ? 'text-red-600 border border-red-200 hover:bg-red-50'
                    : 'text-teal-600 border border-teal-200 hover:bg-teal-50'
                }`}
              >
                {isAdded(fund.mstar_id) ? 'Remove' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      )}
      {searching && <p className="text-xs text-slate-400">Searching...</p>}

      {/* Selected funds with allocations */}
      {funds.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-600">
            Selected Funds ({funds.length})
          </h4>

          {/* Allocation progress bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${allocPct}%`,
                backgroundColor: Math.abs(totalAlloc - 100) < 0.5 ? '#059669' : totalAlloc > 100 ? '#dc2626' : '#f59e0b',
              }}
            />
          </div>
          <p className={`text-xs font-mono tabular-nums ${
            Math.abs(totalAlloc - 100) < 0.5 ? 'text-emerald-600' : totalAlloc > 100 ? 'text-red-600' : 'text-amber-600'
          }`}>
            Total: {totalAlloc.toFixed(1)}% {Math.abs(totalAlloc - 100) < 0.5 ? '' : totalAlloc > 100 ? '(over)' : '(under)'}
          </p>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {funds.map((fund) => (
              <div key={fund.mstar_id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{fund.fund_name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {fund.return_score != null && <LensCircle scoreKey="return_score" score={fund.return_score} size="sm" />}
                    {fund.alpha_score != null && <LensCircle scoreKey="alpha_score" score={fund.alpha_score} size="sm" />}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={allocations[fund.mstar_id] || 0}
                    onChange={(e) => onSetAllocation(fund.mstar_id, Number(e.target.value))}
                    className="w-16 text-right border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono tabular-nums"
                    min={0}
                    max={100}
                    step={0.1}
                  />
                  <span className="text-xs text-slate-400">%</span>
                  <button
                    type="button"
                    onClick={() => onRemoveFund(fund.mstar_id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
