import { useState, useCallback } from 'react';
import StrategyCard from './StrategyCard';
import StrategyDetail from './StrategyDetail';
import StrategyCompare from './StrategyCompare';
import EmptyState from '../shared/EmptyState';
import SkeletonLoader from '../shared/SkeletonLoader';

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
          className="text-xs text-teal-600 hover:text-teal-700 mb-4"
        >
          Back to Repository
        </button>
        <StrategyCompare strategies={selected} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonLoader key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!strategies || strategies.length === 0) {
    return (
      <EmptyState
        icon="📐"
        message="No strategies yet. Create your first strategy to simulate and backtest."
        action="+ New Strategy"
        onAction={onNewStrategy}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNewStrategy}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            + New Strategy
          </button>
          <button
            type="button"
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) setSelectedIds(new Set());
            }}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              compareMode
                ? 'border-teal-600 text-teal-600 bg-teal-50'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {compareMode ? 'Cancel Compare' : 'Compare'}
          </button>
        </div>
        {compareMode && selectedIds.size >= 2 && (
          <button
            type="button"
            onClick={handleStartCompare}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
          >
            Compare {selectedIds.size} Strategies
          </button>
        )}
      </div>

      {/* Strategy grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map((strat) => (
          <div key={strat.id}>
            <StrategyCard
              strategy={strat}
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
