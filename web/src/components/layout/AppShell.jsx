import { useState, useEffect, useCallback } from 'react';
import { fetchMarketRegime } from '../../lib/api';
import { formatPct } from '../../lib/format';

const NAV_ITEMS = [
  { key: 'universe', emoji: '\uD83C\uDF10', label: 'Universe Explorer' },
  { key: 'fund360', emoji: '\uD83D\uDD0D', label: 'Fund 360\u00B0' },
  { key: 'sectors', emoji: '\uD83E\uDDED', label: 'Sector Intelligence' },
  { key: 'strategies', emoji: '\uD83D\uDCD0', label: 'Strategies' },
  { key: 'dashboard', emoji: '\uD83D\uDCCA', label: 'Pulse Dashboard' },
];

const COMING_SOON = {};

function MarketTicker() {
  const [market, setMarket] = useState(null);

  const loadMarket = useCallback(async () => {
    try {
      const res = await fetchMarketRegime();
      setMarket(res.data);
    } catch {
      // MarketPulse may not be running — use mock data
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
    <div className="flex items-center gap-4 text-xs">
      {indices.map((idx) => (
        <div key={idx.name} className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">{idx.name}</span>
          <span className="font-mono font-medium text-slate-700">
            {typeof idx.value === 'number' && idx.value > 1000
              ? idx.value.toLocaleString('en-IN')
              : idx.value}
          </span>
          <span
            className={`font-mono font-medium ${
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
          {market.market_open ? 'Market Open' : 'Market Closed'}
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
        className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            J
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800 leading-none">
                JHAVERI
              </div>
              <div className="text-[9px] font-medium text-slate-400 uppercase tracking-widest leading-tight mt-0.5">
                Intelligence Platform
              </div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            const comingSoon = COMING_SOON[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-base flex-shrink-0">{item.emoji}</span>
                {!collapsed && (
                  <span className="truncate">
                    {item.label}
                    {comingSoon && !isActive && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        ({comingSoon})
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-3 border-t border-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentNav.emoji}</span>
            <h1 className="text-lg font-semibold text-slate-800">
              {currentNav.label}
            </h1>
          </div>
          <MarketTicker />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
