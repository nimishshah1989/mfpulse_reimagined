import { useState, useEffect, useCallback } from 'react';
import { fetchMarketRegime } from '../../lib/api';
import { formatPct } from '../../lib/format';

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
    key: 'strategies',
    label: 'Strategies',
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
];

function MarketTicker() {
  const [market, setMarket] = useState(null);

  const loadMarket = useCallback(async () => {
    try {
      const res = await fetchMarketRegime();
      setMarket(res.data);
    } catch {
      setMarket({
        indices: [
          { name: 'NIFTY 50', value: 22847, change_pct: 1.24 },
          { name: 'SENSEX', value: 75234, change_pct: 1.18 },
          { name: '10Y G-Sec', value: 7.12, change_pct: -0.03 },
          { name: 'USD/INR', value: 83.42, change_pct: -0.15 },
        ],
        market_open: true,
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

  const currentNav = NAV_ITEMS.find((n) => n.key === activeTab) || NAV_ITEMS[0];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-white border-r border-slate-200/80 transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-14' : 'w-48'
        }`}
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

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-5 py-2 flex items-center justify-between">
          <h1 className="text-[15px] font-semibold text-slate-800">
            {currentNav.label}
          </h1>
          <MarketTicker />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
