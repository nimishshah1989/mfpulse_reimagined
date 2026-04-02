import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { parseNLQuery, applyNLFilters } from '../../lib/nl-search';

export default function DashboardSearchStrip({ universe }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Try NL parse first, then fall back to name substring search
  const { results, isNL, nlLabel } = useMemo(() => {
    if (!universe || query.length < 2) return { results: [], isNL: false, nlLabel: null };

    const nlFilters = parseNLQuery(query);
    // Only treat as NL if there are actual structured filters (not just textSearch fallback)
    const hasStructuredFilters = nlFilters && (
      nlFilters.categories.length > 0 ||
      nlFilters.sectors.length > 0 ||
      nlFilters.tierFilters.length > 0 ||
      nlFilters.lensFilters.length > 0 ||
      nlFilters.numericFilters.length > 0 ||
      nlFilters.quadrants.length > 0
    );

    if (hasStructuredFilters) {
      const filtered = applyNLFilters(universe, nlFilters);
      const sorted = [...filtered].sort((a, b) => (b.aum || 0) - (a.aum || 0)).slice(0, 8);
      const parts = [];
      if (nlFilters.categories.length > 0) parts.push(nlFilters.categories.join(', '));
      if (nlFilters.sectors.length > 0) parts.push(nlFilters.sectors.join(', '));
      if (nlFilters.tierFilters.length > 0) parts.push(nlFilters.tierFilters.map((t) => t.value).join(', '));
      const label = parts.length > 0 ? `NL: ${parts.join(' + ')} — ${filtered.length} matches` : `NL: ${filtered.length} matches`;
      return { results: sorted, isNL: true, nlLabel: label };
    }

    // Plain text: substring match on fund name
    const q = query.toLowerCase();
    const matches = universe
      .filter((f) => f.fund_name?.toLowerCase().includes(q))
      .sort((a, b) => (b.aum || 0) - (a.aum || 0))
      .slice(0, 8);
    return { results: matches, isNL: false, nlLabel: null };
  }, [universe, query]);

  useEffect(() => { setSelectedIdx(-1); }, [results]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function navigateToFund(mstarId) {
    setQuery('');
    setFocused(false);
    router.push(`/fund360?fund=${mstarId}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIdx >= 0 && results[selectedIdx]) {
        // Arrow-selected fund — go directly to it
        navigateToFund(results[selectedIdx].mstar_id);
      } else if (isNL && query.trim()) {
        // Structured NL query with no selection — search in universe
        router.push(`/universe?q=${encodeURIComponent(query.trim())}`);
        setQuery('');
        setFocused(false);
      } else if (!isNL && results.length > 0) {
        // Plain text search — go to first matching fund
        navigateToFund(results[0].mstar_id);
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = focused && (results.length > 0 || isNL);

  return (
    <div ref={containerRef} className="relative mb-1">
      <div className="bg-gradient-to-r from-teal-50/80 to-slate-50 rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 shrink-0">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search funds — try 'HDFC Flexi Cap' or 'high alpha large cap' or 'fortress funds'"
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* NL indicator */}
          {isNL && nlLabel && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
              <p className="text-[10px] text-indigo-600 font-medium">{nlLabel}</p>
            </div>
          )}

          {results.length > 0 ? results.map((fund, idx) => (
            <div
              key={fund.mstar_id}
              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                idx === selectedIdx ? 'bg-teal-50' : 'hover:bg-slate-50'
              }`}
              onClick={() => navigateToFund(fund.mstar_id)}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 truncate">{fund.fund_name}</p>
                <p className="text-[10px] text-slate-500">{fund.category_name}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {fund.return_1y != null && (
                  <span className={`text-[11px] font-semibold tabular-nums ${fund.return_1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fund.return_1y >= 0 ? '+' : ''}{Number(fund.return_1y).toFixed(1)}%
                  </span>
                )}
                {fund.aum != null && (
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {(Number(fund.aum) / 1e7).toFixed(0)} Cr
                  </span>
                )}
              </div>
            </div>
          )) : isNL ? (
            <div className="px-4 py-3 text-xs text-slate-400">
              No funds match this query. Press Enter to search in Universe.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
