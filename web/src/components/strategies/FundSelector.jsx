import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchFunds, searchFundsNL } from '../../lib/api';
import LensCircle from '../shared/LensCircle';
import TierBadge from '../shared/TierBadge';
import { formatPct, formatINR } from '../../lib/format';
import { parseNLQuery, tokensToSearchParams, TOKEN_COLORS } from '../../lib/nlParser';

const QUICK_FILTERS = [
  { label: 'Top 5 by Alpha', params: { sort_by: 'alpha_score', sort_dir: 'desc', limit: 5 } },
  { label: 'Large Cap Leaders', params: { category: 'Large Cap', sort_by: 'return_score', sort_dir: 'desc', limit: 10 } },
  { label: 'Best Sharpe', params: { sort_by: 'efficiency_score', sort_dir: 'desc', limit: 5 } },
  { label: 'Browse All', params: { sort_by: 'return_score', sort_dir: 'desc', limit: 50 } },
];

const TIER_FILTERS = [
  { label: 'Leader', value: 'LEADER', cls: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  { label: 'Strong', value: 'STRONG', cls: 'border-teal-200 text-teal-700 hover:bg-teal-50' },
  { label: 'Low Risk', value: 'LOW_RISK', cls: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  { label: 'Consistent', value: 'CONSISTENT', cls: 'border-violet-200 text-violet-700 hover:bg-violet-50' },
];

const LENS_KEYS = [
  { key: 'return_score', label: 'Ret' },
  { key: 'risk_score', label: 'Rsk' },
  { key: 'consistency_score', label: 'Con' },
  { key: 'alpha_score', label: 'Alp' },
  { key: 'efficiency_score', label: 'Eff' },
  { key: 'resilience_score', label: 'Res' },
];

const PURCHASE_MODES = ['Regular', 'Direct'];

export default function FundSelector({ funds, allocations, onAddFund, onRemoveFund, onSetAllocation, totalInvestment, initialNlQuery }) {
  const [search, setSearch] = useState('');
  const [nlQuery, setNlQuery] = useState('');
  const [nlTokens, setNlTokens] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeTierFilter, setActiveTierFilter] = useState(null);
  const [purchaseMode, setPurchaseMode] = useState('Regular');
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
      const modeVal = purchaseMode === 'Regular' ? 1 : 2;
      doSearch({ search, purchase_mode: modeVal });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, doSearch, purchaseMode]);

  const handleQuickFilter = useCallback((params) => {
    setSearch('');
    setActiveTierFilter(null);
    const modeVal = purchaseMode === 'Regular' ? 1 : 2;
    doSearch({ ...params, purchase_mode: modeVal });
  }, [doSearch, purchaseMode]);

  const handleTierFilter = useCallback((tier) => {
    if (activeTierFilter === tier) {
      setActiveTierFilter(null);
      setResults([]);
      return;
    }
    setActiveTierFilter(tier);
    setSearch('');
    const modeVal = purchaseMode === 'Regular' ? 1 : 2;
    doSearch({ return_class: tier, sort_by: 'return_score', sort_dir: 'desc', limit: 20, purchase_mode: modeVal });
  }, [activeTierFilter, doSearch]);

  const handleNlSearch = useCallback(async (e) => {
    if (e.key !== 'Enter' || !nlQuery.trim()) return;
    // Use backend authoritative NL search
    setSearching(true);
    setSearch('');
    setActiveTierFilter(null);
    try {
      const res = await searchFundsNL(nlQuery.trim());
      const data = res.data || res;
      const funds = data.funds || [];
      setResults(funds);
      // Show parsed tokens for visual feedback
      const tokens = parseNLQuery(nlQuery);
      setNlTokens(tokens.length > 0 ? tokens : [{ type: 'query', label: nlQuery.trim(), value: nlQuery.trim(), color: 'slate' }]);
    } catch {
      // Fallback to client-side parser + GET /funds
      const tokens = parseNLQuery(nlQuery);
      setNlTokens(tokens);
      if (tokens.length > 0) {
        const params = tokensToSearchParams(tokens);
        const modeVal = purchaseMode === 'Regular' ? 1 : 2;
        doSearch({ ...params, purchase_mode: modeVal });
      } else {
        setResults([]);
      }
    } finally {
      setSearching(false);
    }
  }, [nlQuery, doSearch, purchaseMode]);

  const removeNlToken = useCallback((idx) => {
    const updated = nlTokens.filter((_, i) => i !== idx);
    setNlTokens(updated);
    if (updated.length > 0) {
      const params = tokensToSearchParams(updated);
      const modeVal = purchaseMode === 'Regular' ? 1 : 2;
      doSearch({ ...params, purchase_mode: modeVal });
    } else {
      setResults([]);
      setNlQuery('');
    }
  }, [nlTokens, doSearch, purchaseMode]);

  const clearNlSearch = useCallback(() => {
    setNlTokens([]);
    setNlQuery('');
    setResults([]);
  }, []);

  // Auto-trigger NL search when template provides an initial query
  const initialSearchDone = useRef(false);
  useEffect(() => {
    if (initialNlQuery && !initialSearchDone.current) {
      initialSearchDone.current = true;
      setNlQuery(initialNlQuery);
      setSearching(true);
      searchFundsNL(initialNlQuery)
        .then((res) => {
          const data = res.data || res;
          setResults(data.funds || []);
          const tokens = parseNLQuery(initialNlQuery);
          setNlTokens(tokens.length > 0 ? tokens : [{ type: 'query', label: initialNlQuery, value: initialNlQuery, color: 'slate' }]);
        })
        .catch(() => {
          // Fallback to client-side
          const tokens = parseNLQuery(initialNlQuery);
          setNlTokens(tokens);
          if (tokens.length > 0) {
            const params = tokensToSearchParams(tokens);
            doSearch(params);
          }
        })
        .finally(() => setSearching(false));
    }
  }, [initialNlQuery, doSearch]);

  const totalAlloc = Object.values(allocations).reduce((s, v) => s + (v || 0), 0);
  const allocPct = Math.min(100, totalAlloc);

  const isAdded = (mstarId) => funds.some((f) => f.mstar_id === mstarId);

  return (
    <div className="space-y-4">
      {/* NL Search */}
      <div className="space-y-2">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <input
            type="text"
            placeholder="Try: top 5 alpha large cap funds with sharpe > 1.5"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            onKeyDown={handleNlSearch}
            className="w-full border border-slate-200 rounded-xl pl-11 pr-3 py-3 text-base text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
          {nlQuery && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">Press Enter</span>
          )}
        </div>
        {nlTokens.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {nlTokens.map((token, idx) => {
              const colors = TOKEN_COLORS[token.color] || TOKEN_COLORS.slate;
              return (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors}`}
                >
                  {token.label}
                  <button
                    type="button"
                    onClick={() => removeNlToken(idx)}
                    className="ml-0.5 hover:opacity-70 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={clearNlSearch}
              className="px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Text Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Or search by name, AMC, or ISIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
        />
      </div>

      {/* Purchase mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Plan:</span>
        {PURCHASE_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPurchaseMode(m)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
              purchaseMode === m
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Filter pills row */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider self-center mr-1">Quick:</span>
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
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider self-center mr-1">Tier:</span>
          {TIER_FILTERS.map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => handleTierFilter(tf.value)}
              className={`px-2.5 py-1 text-xs font-medium border rounded-full transition-colors ${
                activeTierFilter === tf.value
                  ? 'bg-teal-600 text-white border-teal-600'
                  : tf.cls
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
          {results.map((fund) => (
            <div key={fund.mstar_id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{fund.fund_name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {/* Lens score circles */}
                  {LENS_KEYS.map(({ key }) => (
                    fund[key] != null && (
                      <LensCircle key={key} scoreKey={key} score={fund[key]} size="sm" />
                    )
                  ))}
                  {fund.category_name && (
                    <span className="text-[10px] text-slate-400 truncate ml-1">{fund.category_name}</span>
                  )}
                </div>
                {/* Tier badges */}
                <div className="flex items-center gap-1 mt-1">
                  {fund.return_class && <TierBadge tier={fund.return_class} score={fund.return_score} />}
                  {fund.alpha_class && <TierBadge tier={fund.alpha_class} score={fund.alpha_score} />}
                  {fund.resilience_class && <TierBadge tier={fund.resilience_class} score={fund.resilience_score} />}
                </div>
              </div>
              <button
                type="button"
                onClick={() => isAdded(fund.mstar_id) ? onRemoveFund(fund.mstar_id) : onAddFund(fund)}
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
      )}
      {searching && (
        <div className="flex items-center gap-2 py-2">
          <svg className="animate-spin h-3.5 w-3.5 text-teal-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xs text-slate-500">Searching...</p>
        </div>
      )}

      {/* Selected funds with allocations */}
      {funds.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-600">
              Selected Funds ({funds.length})
            </h4>
            <p className={`text-xs font-mono tabular-nums font-medium ${
              Math.abs(totalAlloc - 100) < 0.5 ? 'text-emerald-600' : totalAlloc > 100 ? 'text-red-600' : 'text-amber-600'
            }`}>
              {totalAlloc.toFixed(1)}% allocated {Math.abs(totalAlloc - 100) < 0.5 ? '' : totalAlloc > 100 ? '(over)' : '(under)'}
            </p>
          </div>

          {/* Allocation progress bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${allocPct}%`,
                backgroundColor: Math.abs(totalAlloc - 100) < 0.5 ? '#059669' : totalAlloc > 100 ? '#dc2626' : '#f59e0b',
              }}
            />
          </div>

          {/* Fund allocation table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Fund</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium w-20">Lenses</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium w-24">Allocation</th>
                  {totalInvestment > 0 && (
                    <th className="text-right px-3 py-2 text-slate-500 font-medium w-24">INR Amount</th>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {funds.map((fund) => {
                  const alloc = allocations[fund.mstar_id] || 0;
                  const inrAmount = totalInvestment > 0 ? (alloc / 100) * totalInvestment : 0;
                  return (
                    <tr key={fund.mstar_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-slate-800 truncate max-w-[180px]">{fund.fund_name}</p>
                        {fund.return_class && (
                          <div className="mt-0.5">
                            <TierBadge tier={fund.return_class} score={fund.return_score} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          {fund.return_score != null && <LensCircle scoreKey="return_score" score={fund.return_score} size="sm" />}
                          {fund.alpha_score != null && <LensCircle scoreKey="alpha_score" score={fund.alpha_score} size="sm" />}
                          {fund.resilience_score != null && <LensCircle scoreKey="resilience_score" score={fund.resilience_score} size="sm" />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {/* Allocation slider */}
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={alloc}
                            onChange={(e) => onSetAllocation(fund.mstar_id, Number(e.target.value))}
                            className="w-16 h-1 accent-teal-600 cursor-pointer"
                          />
                          <input
                            type="number"
                            value={alloc}
                            onChange={(e) => onSetAllocation(fund.mstar_id, Number(e.target.value))}
                            className="w-14 text-right border border-slate-200 rounded px-1.5 py-1 text-xs font-mono tabular-nums focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                            min={0}
                            max={100}
                            step={0.1}
                          />
                          <span className="text-[10px] text-slate-400">%</span>
                        </div>
                      </td>
                      {totalInvestment > 0 && (
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                          {formatINR(inrAmount, 0)}
                        </td>
                      )}
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => onRemoveFund(fund.mstar_id)}
                          className="w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
