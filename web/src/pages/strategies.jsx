import { useState, useEffect, useCallback } from 'react';
import { fetchStrategies, fetchStrategy, fetchMarketRegime } from '../lib/api';
import StrategyRepository from '../components/strategies/StrategyRepository';
import StrategyEditor from '../components/strategies/StrategyEditor';

export default function StrategiesPage() {
  const [view, setView] = useState('repository'); // 'repository' | 'editor'
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [marketpulseOnline, setMarketpulseOnline] = useState(true);

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
    // Check MarketPulse availability
    fetchMarketRegime()
      .then(() => setMarketpulseOnline(true))
      .catch(() => setMarketpulseOnline(false));
  }, [loadStrategies]);

  const handleNewStrategy = useCallback(() => {
    setEditingStrategy(null);
    setView('editor');
  }, []);

  const handleEditStrategy = useCallback(async (id) => {
    try {
      const res = await fetchStrategy(id);
      setEditingStrategy(res.data || res);
      setView('editor');
    } catch {
      // Fall back to local data
      const local = strategies.find((s) => s.id === id);
      if (local) {
        setEditingStrategy(local);
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
    setView('editor');
  }, []);

  const handleSave = useCallback(() => {
    setView('repository');
    setEditingStrategy(null);
    loadStrategies();
  }, [loadStrategies]);

  const handleCancel = useCallback(() => {
    setView('repository');
    setEditingStrategy(null);
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
          onSave={handleSave}
          onCancel={handleCancel}
          marketpulseOnline={marketpulseOnline}
        />
      </div>
    );
  }

  return (
    <StrategyRepository
      strategies={strategies}
      loading={loading}
      onNewStrategy={handleNewStrategy}
      onEditStrategy={handleEditStrategy}
      onDuplicateStrategy={handleDuplicateStrategy}
    />
  );
}
