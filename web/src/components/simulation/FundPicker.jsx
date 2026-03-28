import { useState, useEffect, useRef } from 'react';
import { fetchFunds } from '../../lib/api';
import { formatPct } from '../../lib/format';

export default function FundPicker({ selectedFund, onFundSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

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

  if (selectedFund) {
    return (
      <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{selectedFund.fund_name}</p>
          <p className="text-xs text-slate-500">{selectedFund.amc_name}</p>
        </div>
        <button
          onClick={onClear}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-teal-100 text-teal-600 hover:bg-teal-200 text-sm"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by fund name, AMC..."
        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          Loading...
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((fund) => (
            <button
              key={fund.mstar_id}
              onClick={() => {
                onFundSelect(fund);
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{fund.fund_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{fund.amc_name}</span>
                    {fund.category_name && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {fund.category_name}
                      </span>
                    )}
                  </div>
                </div>
                {fund.return_1y != null && (
                  <span
                    className={`text-sm font-mono tabular-nums flex-shrink-0 ${
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
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-500">
          No funds found
        </div>
      )}
    </div>
  );
}
