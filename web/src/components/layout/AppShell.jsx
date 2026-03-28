import { useState, useEffect, useCallback } from 'react';
import { fetchMarketRegime } from '../../lib/api';
import { formatPct } from '../../lib/format';
import UniversalSearch from '../shared/UniversalSearch';

const NAV_ITEMS = [
  {
    key: 'universe',
    label: 'Universe',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
  {
    key: 'fund360',
    label: 'Fund 360',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    key: 'sectors',
    label: 'Sectors',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  {
    key: 'simulation',
    label: 'Simulate',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    key: 'strategy',
    label: 'Strategy',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'methodology',
    label: 'Methodology',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    key: 'admin',
    label: 'System',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function MarketTicker() {
  const [market, setMarket] = useState(null);

  const loadMarket = useCallback(async () => {
    try {
      const res = await fetchMarketRegime();
      setMarket(res.data);
    } catch {
      // Fallback when MarketPulse is offline — show stale placeholders, market closed
      setMarket({
        indices: [],
        market_open: false,
      });
    }
  }, []);

  useEffect(() => {
    loadMarket();
    const interval = setInterval(loadMarket, 60000);
    return () => clearInterval(interval);
  }, [loadMarket]);

  if (!market) return null;

  const indices = market.indices || [];

  return (
    <div className="flex items-center gap-4 text-[11px]">
      {indices.map((idx) => (
        <div key={idx.name} className="flex items-center gap-1">
          <span className="text-slate-400 font-medium">{idx.name}</span>
          <span className="font-mono font-semibold text-slate-600 tabular-nums">
            {typeof idx.value === 'number' && idx.value > 1000
              ? idx.value.toLocaleString('en-IN')
              : idx.value}
          </span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              idx.change_pct >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatPct(idx.change_pct)}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            market.market_open ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
        <span className="text-slate-400">
          {market.market_open ? 'Open' : 'Closed'}
        </span>
      </div>
    </div>
  );
}

export default function AppShell({ children, activeTab, onTabChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.key === activeTab) || NAV_ITEMS[0];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, slide-out drawer when mobileOpen */}
      <aside
        className={`flex flex-col bg-white border-r border-slate-200/80 transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-14' : 'w-48'
        } hidden md:flex`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100">
          <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            J
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 tracking-wide leading-none">
                JHAVERI
              </div>
              <div className="text-[8px] font-medium text-slate-400 uppercase tracking-[0.15em] leading-tight mt-0.5">
                MF Pulse
              </div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 border-r-2 border-teal-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-2.5 border-t border-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </aside>

      {/* Mobile drawer sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-48 flex flex-col bg-white border-r border-slate-200/80 transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              J
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 tracking-wide leading-none">JHAVERI</div>
              <div className="text-[8px] font-medium text-slate-400 uppercase tracking-[0.15em] leading-tight mt-0.5">MF Pulse</div>
            </div>
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 py-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { onTabChange(item.key); setMobileOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 border-r-2 border-teal-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-5 py-2 flex items-center justify-between">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1 mr-2 text-slate-500 hover:text-slate-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-slate-800">
            {currentNav.label}
          </h1>
          <div className="flex items-center gap-3">
            <UniversalSearch />
            <MarketTicker />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
