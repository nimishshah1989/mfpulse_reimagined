import { useState, useEffect, useCallback } from 'react';
import { fetchStrategies, fetchStrategy, fetchMarketRegime } from '../lib/api';
import StrategyRepository from '../components/strategies/StrategyRepository';
import StrategyEditor from '../components/strategies/StrategyEditor';

const QUICK_START_TEMPLATES = [
  {
    key: 'conservative',
    emoji: '\u{1F6E1}\uFE0F',
    title: 'Conservative Growth',
    description: 'Low-risk large caps with consistent track records. Focus on capital preservation with steady returns.',
    tags: [
      { label: 'Low Risk', color: 'blue' },
      { label: '12-14% CAGR', color: 'emerald' },
    ],
    iconBg: 'bg-blue-50',
    defaults: { sipAmount: 10000, lumpsumAmount: 0, mode: 'sip_topups', templateName: 'Conservative Growth' },
    nlQuery: 'low risk large cap consistent funds',
  },
  {
    key: 'alpha',
    emoji: '\u{1F3AF}',
    title: 'Alpha Hunters',
    description: 'Funds with proven manager skill. High alpha, positive info ratio, across cap sizes.',
    tags: [
      { label: 'Alpha Focus', color: 'teal' },
      { label: '16-20% CAGR', color: 'amber' },
    ],
    iconBg: 'bg-teal-50',
    defaults: { sipAmount: 10000, lumpsumAmount: 200000, mode: 'sip_topups', templateName: 'Alpha Hunters' },
    nlQuery: 'top 10 alpha machine funds',
  },
  {
    key: 'sector',
    emoji: '\u{1F504}',
    title: 'Sector Rotation',
    description: 'Leverage MarketPulse sector signals to rotate into leading sectors and out of lagging ones.',
    tags: [
      { label: 'Signal-Driven', color: 'amber' },
      { label: 'Dynamic', color: 'purple' },
    ],
    iconBg: 'bg-amber-50',
    defaults: { sipAmount: 10000, lumpsumAmount: 200000, mode: 'sip_topups', templateName: 'Sector Rotation' },
    nlQuery: 'top 10 sectoral thematic funds by return',
  },
  {
    key: 'allweather',
    emoji: '\u{26A1}',
    title: 'All-Weather',
    description: 'Resilient funds that perform across market regimes. Fortress resilience + rock-solid consistency.',
    tags: [
      { label: 'Resilient', color: 'purple' },
      { label: 'All Regimes', color: 'emerald' },
    ],
    iconBg: 'bg-purple-50',
    defaults: { sipAmount: 15000, lumpsumAmount: 300000, mode: 'sip_topups', templateName: 'All-Weather' },
    nlQuery: 'fortress rock solid resilient funds',
  },
];

const TAG_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  teal: 'bg-teal-50 text-teal-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  emerald: 'bg-emerald-50 text-emerald-600',
};

function QuickStartTemplates({ onSelectTemplate }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          Quick Start Templates
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_START_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelectTemplate({ ...t.defaults, nlQuery: t.nlQuery })}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left cursor-pointer hover:border-teal-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${t.iconBg} flex items-center justify-center text-lg`}>
                {t.emoji}
              </div>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-teal-700 transition-colors">
                {t.title}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              {t.description}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {t.tags.map((tag) => (
                <span
                  key={tag.label}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${TAG_COLORS[tag.color] || 'bg-slate-50 text-slate-600'}`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const INVESTMENT_MODES = [
  {
    key: 'pure_sip',
    label: 'Pure SIP',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-13.5L16.5 7.5m0 0L12 3m4.5 4.5V21" />
      </svg>
    ),
    description: 'Fixed monthly investment. Simple and disciplined.',
    color: 'teal',
    defaults: { sipAmount: 10000, lumpsumAmount: 0, mode: 'sip_topups' },
  },
  {
    key: 'sip_signals',
    label: 'SIP + Signal Top-ups',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    description: 'Monthly SIP with extra investments when market signals trigger.',
    color: 'emerald',
    defaults: { sipAmount: 10000, lumpsumAmount: 200000, mode: 'sip_topups' },
  },
  {
    key: 'lumpsum',
    label: 'Lumpsum',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'One-time investment deployed based on timing signals.',
    color: 'amber',
    defaults: { sipAmount: 0, lumpsumAmount: 500000, mode: 'lumpsum_events' },
  },
];

export default function StrategiesPage() {
  const [view, setView] = useState('repository'); // 'repository' | 'editor'
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [marketpulseOnline, setMarketpulseOnline] = useState(true);
  const [selectedMode, setSelectedMode] = useState(null);

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStrategies();
      setStrategies(res.data || []);
    } catch {
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
    fetchMarketRegime()
      .then(() => setMarketpulseOnline(true))
      .catch(() => setMarketpulseOnline(false));
  }, [loadStrategies]);

  const handleNewStrategy = useCallback((modeDefaults) => {
    setEditingStrategy(null);
    setSelectedMode(modeDefaults || null);
    setView('editor');
  }, []);

  const handleEditStrategy = useCallback(async (id) => {
    try {
      const res = await fetchStrategy(id);
      setEditingStrategy(res.data || res);
      setSelectedMode(null);
      setView('editor');
    } catch {
      const local = strategies.find((s) => s.id === id);
      if (local) {
        setEditingStrategy(local);
        setSelectedMode(null);
        setView('editor');
      }
    }
  }, [strategies]);

  const handleDuplicateStrategy = useCallback((strategy) => {
    setEditingStrategy({
      ...strategy,
      id: undefined,
      name: `${strategy.name} (copy)`,
    });
    setSelectedMode(null);
    setView('editor');
  }, []);

  const handleSave = useCallback(() => {
    setView('repository');
    setEditingStrategy(null);
    setSelectedMode(null);
    loadStrategies();
  }, [loadStrategies]);

  const handleCancel = useCallback(() => {
    setView('repository');
    setEditingStrategy(null);
    setSelectedMode(null);
  }, []);

  if (view === 'editor') {
    return (
      <div>
        {!marketpulseOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-amber-700">
              MarketPulse is offline. Signal conditions are available but live data may be limited.
            </p>
          </div>
        )}
        <StrategyEditor
          editingStrategy={editingStrategy}
          initialMode={selectedMode}
          onSave={handleSave}
          onCancel={handleCancel}
          marketpulseOnline={marketpulseOnline}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Visual Header */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-8 text-white">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">Strategy Workshop</h1>
          <p className="text-teal-100 mt-2 text-sm leading-relaxed">
            Design model portfolios, configure signal-based top-ups, and backtest across market cycles.
            Compare SIP, signal-enhanced, and lumpsum approaches side by side.
          </p>
        </div>
      </div>

      {/* Investment Mode Tabs */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Start by Investment Mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {INVESTMENT_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handleNewStrategy(m.defaults)}
              className="group relative bg-white rounded-xl border-2 border-slate-200 hover:border-teal-400 p-5 text-left transition-all hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  m.color === 'teal' ? 'bg-teal-100 text-teal-600' :
                  m.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {m.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">
                    {m.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{m.description}</p>
                </div>
              </div>
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Start Templates */}
      <QuickStartTemplates onSelectTemplate={handleNewStrategy} />

      {/* Strategy Repository */}
      <StrategyRepository
        strategies={strategies}
        loading={loading}
        onNewStrategy={() => handleNewStrategy(null)}
        onEditStrategy={handleEditStrategy}
        onDuplicateStrategy={handleDuplicateStrategy}
      />
    </div>
  );
}
