import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { searchFundsNL, fetchFunds } from '../../lib/api';
import { formatPct } from '../../lib/format';
import { LENS_OPTIONS, scoreColor } from '../../lib/lens';

/* ────────── Navigation commands ────────── */
const NAV_COMMANDS = [
  { phrases: ['show sectors', 'go to sectors', 'sector rotation'], tab: 'sectors' },
  { phrases: ['show dashboard', 'go to dashboard', 'home'], tab: 'dashboard' },
  { phrases: ['show universe', 'go to universe', 'all funds'], tab: 'universe' },
  { phrases: ['simulate', 'simulation', 'backtest'], tab: 'simulation' },
  { phrases: ['strategy', 'strategies', 'model portfolio'], tab: 'strategy' },
  { phrases: ['methodology', 'data source'], tab: 'methodology' },
  { phrases: ['admin', 'system', 'system status'], tab: 'admin' },
];

function detectNavCommand(query) {
  const lower = query.toLowerCase().trim();
  for (const cmd of NAV_COMMANDS) {
    if (cmd.phrases.some((p) => lower.includes(p))) return cmd.tab;
  }
  return null;
}

/* ────────── Mini Lens Bars ────────── */
function LensBars({ fund }) {
  return (
    <div className="flex items-center gap-0.5">
      {LENS_OPTIONS.map(({ key, label }) => {
        const score = fund[key] ?? 0;
        return (
          <div
            key={key}
            title={`${label}: ${Math.round(score)}`}
            className="w-4 h-1.5 rounded-sm"
            style={{
              backgroundColor: scoreColor(score),
              opacity: score > 0 ? 1 : 0.2,
            }}
          />
        );
      })}
    </div>
  );
}

/* ────────── Result Card ────────── */
function ResultCard({ fund, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-teal-50/50 transition-colors text-left rounded-lg group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-teal-700 transition-colors">
          {fund.fund_name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-400 truncate">{fund.amc_name}</span>
          <span className="text-[10px] px-1.5 py-0 rounded bg-slate-100 text-slate-500 font-medium whitespace-nowrap">
            {fund.category_name}
          </span>
        </div>
      </div>
      <LensBars fund={fund} />
      <div className="text-right flex-shrink-0 w-14">
        <span
          className={`text-xs font-mono font-semibold tabular-nums ${
            (fund.return_1y ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {formatPct(fund.return_1y)}
        </span>
        <div className="text-[9px] text-slate-400">1Y</div>
      </div>
      <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/* ────────── Main Component ────────── */
export default function UniversalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [listening, setListening] = useState(false);
  const [navHint, setNavHint] = useState(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced backend NL search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setNavHint(null);
      setSearching(false);
      return;
    }
    const nav = detectNavCommand(query);
    if (nav) {
      setNavHint(nav);
      setResults([]);
      setSearching(false);
      return;
    }
    setNavHint(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchFundsNL(query);
        // Backend returns {success, data: {parsed, funds, count}}
        const funds = res?.data?.funds || res?.funds || [];
        setResults(Array.isArray(funds) ? funds : []);
      } catch {
        // Fallback to basic search on error
        try {
          const fallback = await fetchFunds({ search: query, limit: 10 });
          setResults(fallback.data || []);
        } catch {
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
      setNavHint(null);
      stopListening();
    }
  }, [open]);

  // Voice recognition setup
  const startListening = useCallback(() => {
    const SR = typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setQuery(transcript);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone in browser settings.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const toggleVoice = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  const handleNav = useCallback(
    (tab) => {
      setOpen(false);
      const route = tab === 'universe' ? '/' : `/${tab}`;
      router.push(route);
    },
    [router]
  );

  const handleFundClick = useCallback(
    (mstarId) => {
      setOpen(false);
      router.push(`/fund360?fund=${mstarId}`);
    },
    [router]
  );

  return (
    <>
      {/* Trigger button in header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-400 hover:text-slate-600 transition-colors"
        title="Search (Cmd+K)"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-[11px] font-medium hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline text-[9px] bg-white border border-slate-200 rounded px-1 py-0.5 font-mono text-slate-400">
          {'\u2318'}K
        </kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "large cap alpha above 70" or "show sectors"'
                className="flex-1 text-lg text-slate-800 placeholder:text-slate-300 outline-none bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && navHint) {
                    handleNav(navHint);
                  }
                }}
              />
              {/* Voice button */}
              <button
                type="button"
                onClick={toggleVoice}
                className={`p-2 rounded-full transition-all flex-shrink-0 ${
                  listening
                    ? 'bg-red-50 text-red-500 animate-pulse'
                    : 'text-slate-400 hover:text-teal-600 hover:bg-teal-50'
                }`}
                title={listening ? 'Stop listening' : 'Voice search'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              {/* Close */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              >
                <kbd className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono">
                  ESC
                </kbd>
              </button>
            </div>

            {/* Nav hint */}
            {navHint && (
              <button
                type="button"
                onClick={() => handleNav(navHint)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-teal-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Navigate to {navHint.charAt(0).toUpperCase() + navHint.slice(1)}
                  </div>
                  <div className="text-[11px] text-slate-400">Press Enter or click</div>
                </div>
              </button>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="max-h-[50vh] overflow-y-auto py-1">
                <div className="px-5 py-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {results.length} fund{results.length !== 1 ? 's' : ''} found
                  </span>
                </div>
                {results.map((fund) => (
                  <ResultCard
                    key={fund.mstar_id}
                    fund={fund}
                    onClick={() => handleFundClick(fund.mstar_id)}
                  />
                ))}
              </div>
            )}

            {/* Loading state */}
            {searching && (
              <div className="px-5 py-6 text-center">
                <svg className="animate-spin h-5 w-5 mx-auto text-teal-600 mb-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div className="text-xs text-slate-400">Searching...</div>
              </div>
            )}

            {/* Empty state */}
            {query.trim() && !navHint && !searching && results.length === 0 && (
              <div className="px-5 py-8 text-center">
                <div className="text-slate-300 text-3xl mb-2">
                  <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-sm text-slate-400">No funds match your query</div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Try: &quot;hdfc large cap&quot;, &quot;alpha above 80&quot;, or &quot;fortress resilience&quot;
                </div>
              </div>
            )}

            {/* Hints when empty */}
            {!query.trim() && (
              <div className="px-5 py-4">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Try saying or typing
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Large cap alpha above 70',
                    'HDFC funds',
                    'Low risk fortress',
                    'Show sectors',
                    'ELSS leader funds',
                    'SBI mid cap',
                  ].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => setQuery(hint)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 hover:bg-teal-50 hover:text-teal-700 transition-colors border border-slate-100"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <kbd className="bg-white border border-slate-200 rounded px-1 py-0.5 font-mono">
                    {'\u2191\u2193'}
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-white border border-slate-200 rounded px-1 py-0.5 font-mono">
                    {'\u21B5'}
                  </kbd>
                  Open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-white border border-slate-200 rounded px-1 py-0.5 font-mono">
                    esc
                  </kbd>
                  Close
                </span>
              </div>
              {listening && (
                <span className="flex items-center gap-1.5 text-[10px] text-red-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Listening...
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
