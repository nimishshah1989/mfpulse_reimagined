import { useState, useCallback } from 'react';
import StrategyCard from './StrategyCard';
import StrategyDetail from './StrategyDetail';
import StrategyCompare from './StrategyCompare';
import SkeletonLoader from '../shared/SkeletonLoader';

const MODE_ICONS = {
  sip_topups: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  ),
  lumpsum_events: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  custom: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    </svg>
  ),
};

function EmptyStrategyState({ onNewStrategy }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Create Your First Strategy</h3>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Design a model portfolio, configure investment rules, and backtest across market cycles.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Pure SIP', desc: 'Fixed monthly', color: 'teal' },
            { label: 'SIP + Signals', desc: 'Smart top-ups', color: 'emerald' },
            { label: 'Lumpsum', desc: 'Event-driven', color: 'amber' },
          ].map((m) => (
            <div
              key={m.label}
              className={`p-3 rounded-lg border text-center ${
                m.color === 'teal' ? 'border-teal-200 bg-teal-50' :
                m.color === 'emerald' ? 'border-emerald-200 bg-emerald-50' :
                'border-amber-200 bg-amber-50'
              }`}
            >
              <p className={`text-xs font-semibold ${
                m.color === 'teal' ? 'text-teal-700' :
                m.color === 'emerald' ? 'text-emerald-700' :
                'text-amber-700'
              }`}>{m.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onNewStrategy}
          className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
        >
          + New Strategy
        </button>
      </div>
    </div>
  );
}

export default function StrategyRepository({
  strategies,
  loading,
  onNewStrategy,
  onEditStrategy,
  onDuplicateStrategy,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showCompare, setShowCompare] = useState(false);

  const handleToggleExpand = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleStartCompare = useCallback(() => {
    if (selectedIds.size >= 2) {
      setShowCompare(true);
    }
  }, [selectedIds]);

  const handleSingleCompare = useCallback((id) => {
    setCompareMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  if (showCompare) {
    const selected = strategies.filter((s) => selectedIds.has(s.id));
    return (
      <div>
        <button
          type="button"
          onClick={() => { setShowCompare(false); setCompareMode(false); setSelectedIds(new Set()); }}
          className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 mb-4 font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Repository
        </button>
        <StrategyCompare strategies={selected} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLoader className="h-8 w-40 rounded-lg" />
          <SkeletonLoader className="h-8 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!strategies || strategies.length === 0) {
    return <EmptyStrategyState onNewStrategy={onNewStrategy} />;
  }

  return (
    <div className="space-y-4">
      {/* Section header + Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Your Strategies
            <span className="ml-2 text-xs font-normal text-slate-400">({strategies.length})</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) setSelectedIds(new Set());
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              compareMode
                ? 'border-teal-600 text-teal-600 bg-teal-50'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {compareMode ? 'Cancel Compare' : 'Compare'}
          </button>
          <button
            type="button"
            onClick={onNewStrategy}
            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            + New Strategy
          </button>
        </div>
      </div>

      {compareMode && selectedIds.size >= 2 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleStartCompare}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm"
          >
            Compare {selectedIds.size} Strategies
          </button>
        </div>
      )}

      {/* Strategy grid - 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map((strat) => (
          <div key={strat.id}>
            <StrategyCard
              strategy={strat}
              modeIcon={MODE_ICONS[strat.mode]}
              expanded={expandedId === strat.id}
              onToggleExpand={handleToggleExpand}
              onEdit={onEditStrategy}
              onDuplicate={onDuplicateStrategy}
              onCompare={handleSingleCompare}
              compareMode={compareMode}
              selected={selectedIds.has(strat.id)}
              onSelect={handleSelect}
            />
            {expandedId === strat.id && <StrategyDetail strategy={strat} />}
          </div>
        ))}
      </div>
    </div>
  );
}
