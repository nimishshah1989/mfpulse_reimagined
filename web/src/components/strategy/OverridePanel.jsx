import { useState } from 'react';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import Pill from '../shared/Pill';
import { createOverride, deleteOverride } from '../../lib/api';

const TYPE_COLORS = {
  FUND_BOOST: 'emerald',
  FUND_SUPPRESS: 'red',
  CATEGORY_TILT: 'amber',
  SECTOR_VIEW: 'blue',
};

const DIRECTION_ARROWS = { POSITIVE: '\u2191', NEGATIVE: '\u2193', NEUTRAL: '\u2192' };

const TYPES = ['FUND_BOOST', 'FUND_SUPPRESS', 'CATEGORY_TILT', 'SECTOR_VIEW'];
const DIRECTIONS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'];

function magnitudeStars(n) {
  return '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);
}

export default function OverridePanel({ overrides, selectedFundId, funds, onAdd, onRemove }) {
  const [expandedId, setExpandedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: 'FUND_BOOST',
    target_name: '',
    direction: 'POSITIVE',
    magnitude: 3,
    rationale: '',
    expiry: '',
  });

  const selectedFund = selectedFundId ? funds.find((f) => f.mstar_id === selectedFundId) : null;

  async function handleDeactivate(id) {
    try {
      await deleteOverride(id);
      onRemove(id);
    } catch (err) {
      console.error('Failed to deactivate override:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.rationale.trim().length < 10) return;
    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        target_id: selectedFundId || form.target_name,
        target_name: form.target_name || (selectedFund ? selectedFund.fund_name : ''),
        direction: form.direction,
        magnitude: form.magnitude,
        rationale: form.rationale.trim(),
        expiry: form.expiry || null,
      };
      const result = await createOverride(payload);
      onAdd(result);
      setForm({ type: 'FUND_BOOST', target_name: '', direction: 'POSITIVE', magnitude: 3, rationale: '', expiry: '' });
    } catch (err) {
      console.error('Failed to create override:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">FM Overrides</h3>

      {/* Active overrides */}
      <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
        {(!overrides || overrides.length === 0) && (
          <p className="text-xs text-slate-400 py-2">No active overrides</p>
        )}
        {(overrides || []).map((o) => {
          const expanded = expandedId === o.id;
          return (
            <div
              key={o.id}
              className="rounded-lg border border-slate-100 p-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedId(expanded ? null : o.id)}
            >
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={TYPE_COLORS[o.type] || 'slate'}>{o.type.replace('_', ' ')}</Badge>
                <span className="font-medium text-slate-700 truncate flex-1">{o.target_name}</span>
                <span className={o.direction === 'NEGATIVE' ? 'text-red-500' : o.direction === 'POSITIVE' ? 'text-emerald-600' : 'text-slate-400'}>
                  {DIRECTION_ARROWS[o.direction] || '-'}
                </span>
                <span className="text-amber-500 text-[10px]">{magnitudeStars(o.magnitude)}</span>
              </div>
              {!expanded && o.rationale && (
                <p className="mt-1 text-[11px] text-slate-400 truncate">{o.rationale.slice(0, 50)}{o.rationale.length > 50 ? '...' : ''}</p>
              )}
              {expanded && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-slate-600">{o.rationale}</p>
                  {o.expiry && <p className="text-[11px] text-slate-400">Expires: {new Date(o.expiry).toLocaleDateString('en-IN')}</p>}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeactivate(o.id); }}
                    className="mt-1 text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Deactivate
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New override form */}
      <form onSubmit={handleSubmit} className="border-t border-slate-100 pt-3 space-y-3">
        <h4 className="text-xs font-semibold text-slate-700">New Override</h4>

        <div>
          <label className="text-[11px] text-slate-500 mb-0.5 block">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 mb-0.5 block">Target</label>
          <input
            type="text"
            value={form.target_name}
            onChange={(e) => setForm({ ...form, target_name: e.target.value })}
            placeholder={selectedFund ? selectedFund.fund_name : 'Fund name or category'}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 mb-0.5 block">Direction</label>
          <div className="flex gap-1">
            {DIRECTIONS.map((dir) => (
              <Pill
                key={dir}
                active={form.direction === dir}
                onClick={() => setForm({ ...form, direction: dir })}
              >
                {dir}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 mb-0.5 block">
            Magnitude: <span className="text-amber-500">{magnitudeStars(form.magnitude)}</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={form.magnitude}
            onChange={(e) => setForm({ ...form, magnitude: Number(e.target.value) })}
            className="w-full accent-teal-600"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 mb-0.5 block">Rationale (min 10 chars)</label>
          <textarea
            value={form.rationale}
            onChange={(e) => setForm({ ...form, rationale: e.target.value })}
            rows={2}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none resize-none"
            required
            minLength={10}
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 mb-0.5 block">Expiry (optional)</label>
          <input
            type="date"
            value={form.expiry}
            onChange={(e) => setForm({ ...form, expiry: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || form.rationale.trim().length < 10}
          className="w-full rounded-lg bg-teal-600 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Adding...' : 'Add Override'}
        </button>
      </form>
    </Card>
  );
}
