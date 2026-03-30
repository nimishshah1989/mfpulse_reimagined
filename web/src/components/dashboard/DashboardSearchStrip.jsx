import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';

export default function DashboardSearchStrip({ universe }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const results = useMemo(() => {
    if (!universe || query.length < 2) return [];
    const q = query.toLowerCase();
    return universe
      .filter((f) => f.fund_name?.toLowerCase().includes(q))
      .sort((a, b) => (b.aum || 0) - (a.aum || 0))
      .slice(0, 8);
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
    } else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) {
      navigateToFund(results[selectedIdx].mstar_id);
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = focused && results.length > 0;

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
            placeholder="Search funds by name — e.g. HDFC Flexi Cap, Parag Parikh..."
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
          {results.map((fund, idx) => (
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
                <p className="text-[10px] text-slate-400">{fund.category_name}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {fund.return_1y != null && (
                  <span className={`text-[11px] font-semibold tabular-nums ${fund.return_1y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fund.return_1y >= 0 ? '+' : ''}{Number(fund.return_1y).toFixed(1)}%
                  </span>
                )}
                {fund.aum != null && (
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {(Number(fund.aum) / 1e7).toFixed(0)} Cr
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
