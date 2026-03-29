import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { fetchMarketRegime } from '../../lib/api';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'fund360', label: 'Fund 360' },
  { key: 'universe', label: 'Universe' },
  { key: 'sectors', label: 'Sectors' },
  { key: 'simulation', label: 'Simulate' },
  { key: 'strategy', label: 'Strategy' },
];

const SECONDARY_ITEMS = [
  { key: 'methodology', label: 'Methodology' },
  { key: 'admin', label: 'System' },
];

function MarketStatusBadge() {
  const [market, setMarket] = useState(null);

  const loadMarket = useCallback(async () => {
    try {
      const res = await fetchMarketRegime();
      setMarket(res.data);
    } catch {
      setMarket({ market_open: false });
    }
  }, []);

  useEffect(() => {
    loadMarket();
    const interval = setInterval(loadMarket, 60000);
    return () => clearInterval(interval);
  }, [loadMarket]);

  if (!market) return null;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
      market.market_open
        ? 'bg-emerald-500/10 border-emerald-500/20'
        : 'bg-slate-500/10 border-slate-500/20'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        market.market_open ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
      }`} />
      <span className={`text-xs font-medium ${
        market.market_open ? 'text-emerald-600' : 'text-slate-500'
      }`}>
        {market.market_open ? 'Live' : 'Closed'}
      </span>
    </div>
  );
}

export default function AppShell({ children, activeTab, onTabChange }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentPageLabel = [...NAV_ITEMS, ...SECONDARY_ITEMS].find(
    (n) => n.key === activeTab
  )?.label;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== TOP NAV BAR (matches mockups) ===== */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Logo + breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">MF Pulse</span>
            {currentPageLabel && currentPageLabel !== 'Dashboard' && (
              <>
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-sm text-slate-500">{currentPageLabel}</span>
              </>
            )}
          </div>

          {/* Center: Nav pills (desktop) */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === item.key
                    ? 'bg-white shadow-sm text-teal-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Center: Quick search */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    onTabChange('universe');
                    router.push(`/universe?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery('');
                  }
                }}
                placeholder="Search funds..."
                className="w-48 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 outline-none placeholder:text-slate-400 transition-colors"
              />
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>

          {/* Right: Market status + secondary nav */}
          <div className="hidden md:flex items-center gap-3">
            {SECONDARY_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`text-xs font-medium transition-colors ${
                  activeTab === item.key
                    ? 'text-teal-700'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
            <MarketStatusBadge />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-slate-200/50">
            <div className="flex flex-wrap gap-1">
              {[...NAV_ITEMS, ...SECONDARY_ITEMS].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { onTabChange(item.key); setMobileOpen(false); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeTab === item.key
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-end">
              <MarketStatusBadge />
            </div>
          </div>
        )}
      </nav>

      {/* ===== CONTENT ===== */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
