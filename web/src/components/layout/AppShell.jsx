import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { fetchMarketRegime } from '../../lib/api';

const UniversalSearch = dynamic(() => import('../shared/UniversalSearch'), { ssr: false });

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Overview' },
  { key: 'universe', label: 'Fund Universe' },
  { key: 'fund360', label: 'Fund 360' },
  { key: 'sectors', label: 'Sectors' },
  { key: 'strategies', label: 'Strategy Builder' },
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
        {market.market_open ? 'Market Live' : 'Market Closed'}
      </span>
    </div>
  );
}

export default function AppShell({ children, activeTab, onTabChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPageLabel = [...NAV_ITEMS, ...SECONDARY_ITEMS].find(
    (n) => n.key === activeTab
  )?.label;

  return (
    <div className="min-h-screen" style={{ backgroundColor: activeTab === 'universe' ? '#ffffff' : '#f8f9fb' }}>
      {/* ===== TOP NAV BAR (matches mockups) ===== */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-full flex items-center justify-between">
          {/* Left: Logo + breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-sm font-semibold text-slate-700">MF Pulse</span>
            {currentPageLabel && currentPageLabel !== 'Overview' && (
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

          {/* Center: Universal Search (Cmd+K, NL queries, voice) */}
          <div className="hidden md:flex items-center">
            <UniversalSearch />
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
      <main className="w-full px-3 sm:px-4 lg:px-5 py-4">
        {children}
      </main>
    </div>
  );
}
