import { useReducer, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { strategyReducer, initialState } from '../../lib/strategyReducer';
import {
  createStrategy,
  updateStrategy,
  fetchStrategy,
  fetchOverrides,
  backtestStrategy,
} from '../../lib/api';
import FundPicker from '../simulation/FundPicker';
import AllocationTreemap from './AllocationTreemap';
import OverridePanel from './OverridePanel';
import BacktestResults from './BacktestResults';

export default function StrategyEditor({ strategyId, onSave, onCancel }) {
  const [state, dispatch] = useReducer(strategyReducer, initialState);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState([]);
  const [error, setError] = useState(null);

  const treemapRef = useRef(null);
  const [treemapWidth, setTreemapWidth] = useState(500);

  useEffect(() => {
    if (!treemapRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTreemapWidth(Math.max(300, entry.contentRect.width));
      }
    });
    observer.observe(treemapRef.current);
    return () => observer.disconnect();
  }, []);

  // Load existing strategy
  useEffect(() => {
    if (!strategyId) return;
    let cancelled = false;
    async function load() {
      try {
        const [stratRes, overridesRes] = await Promise.all([
          fetchStrategy(strategyId),
          fetchOverrides().catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        const s = stratRes.data;
        setName(s.name || '');
        setDescription(s.description || '');
        dispatch({ type: 'LOAD_STRATEGY', data: s });
        setOverrides(overridesRes.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [strategyId]);

  const handleFundAdd = useCallback((fund) => {
    dispatch({ type: 'ADD_FUND', fund });
  }, []);

  const handleFundRemove = useCallback((mstarId) => {
    dispatch({ type: 'REMOVE_FUND', mstar_id: mstarId });
  }, []);

  const handleAllocationChange = useCallback((mstarId, weight) => {
    dispatch({ type: 'SET_ALLOCATION', mstar_id: mstarId, weight });
  }, []);

  const handleFundSelect = useCallback((mstarId) => {
    dispatch({ type: 'SELECT_FUND', mstar_id: mstarId });
  }, []);

  const handleOverrideAdd = useCallback((override) => {
    setOverrides((prev) => [...prev, override]);
    dispatch({ type: 'ADD_OVERRIDE', override });
  }, []);

  const handleOverrideRemove = useCallback((id) => {
    setOverrides((prev) => prev.filter((o) => o.id !== id));
    dispatch({ type: 'REMOVE_OVERRIDE', id });
  }, []);

  const handleBacktest = useCallback(async () => {
    if (!strategyId) return;
    dispatch({ type: 'SET_BACKTEST_LOADING', loading: true });
    try {
      const res = await backtestStrategy(strategyId);
      dispatch({ type: 'SET_BACKTEST_DATA', data: res.data });
    } catch (err) {
      setError(err.message);
      dispatch({ type: 'SET_BACKTEST_LOADING', loading: false });
    }
  }, [strategyId]);

  const totalAllocation = useMemo(
    () => state.funds.reduce((sum, f) => sum + (state.allocations[f.mstar_id] || 0), 0),
    [state.funds, state.allocations]
  );

  async function handleSave() {
    if (!name.trim()) {
      setError('Strategy name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        funds: state.funds.map((f) => ({
          mstar_id: f.mstar_id,
          fund_name: f.fund_name,
          weight: state.allocations[f.mstar_id] || 0,
        })),
        allocations: state.allocations,
        overrides: state.overrides,
      };
      if (strategyId) {
        await updateStrategy(strategyId, payload);
      } else {
        await createStrategy(payload);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Name + Description */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Strategy name"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left: Treemap + Fund list */}
        <div className="space-y-4">
          <FundPicker
            selectedFund={null}
            onFundSelect={handleFundAdd}
            onClear={() => {}}
          />

          {state.funds.length > 0 && (
            <div ref={treemapRef} className="min-w-0">
              <AllocationTreemap
                funds={state.funds}
                allocations={state.allocations}
                overrides={overrides}
                onAllocationChange={handleAllocationChange}
                onFundSelect={handleFundSelect}
                selectedFundId={state.selectedFundId}
                width={treemapWidth}
                height={300}
              />
            </div>
          )}

          {state.funds.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Fund</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">Weight</th>
                    <th className="px-4 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {state.funds.map((f) => (
                    <tr
                      key={f.mstar_id}
                      className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${
                        f.mstar_id === state.selectedFundId ? 'bg-teal-50' : ''
                      }`}
                      onClick={() => handleFundSelect(f.mstar_id)}
                    >
                      <td className="px-4 py-2 text-xs text-slate-700 truncate max-w-[200px]">
                        {f.fund_name}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-xs text-slate-900">
                        {(state.allocations[f.mstar_id] || 0).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFundRemove(f.mstar_id); }}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={`px-4 py-2 text-xs font-mono tabular-nums font-medium ${
                Math.abs(totalAllocation - 100) < 0.5 ? 'text-teal-600' : 'text-red-600'
              }`}>
                Total: {totalAllocation.toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* Right: Overrides */}
        <div className="space-y-4">
          <OverridePanel
            overrides={overrides}
            selectedFundId={state.selectedFundId}
            funds={state.funds}
            onAdd={handleOverrideAdd}
            onRemove={handleOverrideRemove}
          />
        </div>
      </div>

      {/* Backtest Results */}
      {strategyId && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleBacktest}
              disabled={state.backtestLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {state.backtestLoading ? 'Running Backtest...' : 'Run Backtest'}
            </button>
          </div>
          <BacktestResults data={state.backtestData} loading={state.backtestLoading} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
        <button
          onClick={handleSave}
          disabled={saving || state.funds.length === 0}
          className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : strategyId ? 'Update Strategy' : 'Create Strategy'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
