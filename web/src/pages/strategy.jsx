import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { fetchStrategies, backtestStrategy } from '../lib/api';
import StrategyCard from '../components/strategy/StrategyCard';
import StrategyEditor from '../components/strategy/StrategyEditor';
import SkeletonLoader from '../components/shared/SkeletonLoader';
import EmptyState from '../components/shared/EmptyState';

export default function StrategyPage() {
  const router = useRouter();

  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);

  // Read template from simulation page
  useEffect(() => {
    if (router.isReady && router.query.template) {
      try {
        const decoded = JSON.parse(atob(router.query.template));
        if (decoded.mstar_id) {
          setCreating(true);
        }
      } catch {
        // Invalid template, ignore
      }
    }
  }, [router.isReady, router.query.template]);

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStrategies();
      setStrategies(res.data || []);
    } catch (err) {
      setError(err.message);
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const handleEdit = useCallback((id) => {
    setEditingId(id);
    setCreating(false);
  }, []);

  const handleBacktest = useCallback(async (id) => {
    try {
      await backtestStrategy(id);
      loadStrategies();
    } catch (err) {
      setError(err.message);
    }
  }, [loadStrategies]);

  const handleDelete = useCallback(async (id) => {
    // Soft confirmation via state — real delete would need API
    setStrategies((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleSave = useCallback(() => {
    setEditingId(null);
    setCreating(false);
    loadStrategies();
  }, [loadStrategies]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setCreating(false);
  }, []);

  // Editor view
  if (editingId || creating) {
    return (
      <div className="space-y-6 -m-6">
        <div className="bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {editingId ? 'Edit Strategy' : 'Create New Strategy'}
            </p>
          </div>
        </div>
        <div className="px-6">
          <StrategyEditor
            strategyId={editingId}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6 -m-6">
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Design and backtest model portfolios
          </p>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
          >
            New Strategy
          </button>
        </div>
      </div>

      <div className="px-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonLoader key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && strategies.length === 0 && (
          <EmptyState
            message="No strategies yet. Create your first model portfolio."
            action={{ label: 'Create Strategy', onClick: () => setCreating(true) }}
          />
        )}

        {!loading && strategies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                onEdit={handleEdit}
                onBacktest={handleBacktest}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
