import { useState, useEffect, useMemo } from 'react';
import { ARCHETYPE_META, classifyArchetype, TIER_LABELS, TEMPLATE_VERDICTS } from '../../lib/archetypes';
import { formatAUMRaw } from '../../lib/format';
import { cachedFetch } from '../../lib/cache';
import { fetchFundVerdict } from '../../lib/api';

const TIER_COLORS = {
  LEADER: '#059669', LOW_RISK: '#059669', ROCK_SOLID: '#059669', ALPHA_MACHINE: '#059669', LEAN: '#059669', FORTRESS: '#059669',
  STRONG: '#10b981', MODERATE: '#10b981', CONSISTENT: '#10b981', POSITIVE: '#10b981', FAIR: '#10b981', STURDY: '#10b981',
  AVERAGE: '#f59e0b', ELEVATED: '#f59e0b', MIXED: '#f59e0b', NEUTRAL: '#f59e0b', EXPENSIVE: '#f59e0b', FRAGILE: '#f59e0b',
  WEAK: '#ef4444', HIGH_RISK: '#ef4444', ERRATIC: '#ef4444', NEGATIVE: '#ef4444', BLOATED: '#ef4444', VULNERABLE: '#ef4444',
};

const LENS_KEYS = ['return_class', 'risk_class', 'consistency_class', 'alpha_class', 'efficiency_class', 'resilience_class'];
const LENS_SHORT = ['R', 'Rk', 'C', 'A', 'E', 'Rs'];

function TierPill({ tierClass }) {
  const label = TIER_LABELS[tierClass] || '—';
  const bg = TIER_COLORS[tierClass] || '#94a3b8';
  return (
    <span style={{ display: 'inline-block', width: 44, height: 18, borderRadius: 4, backgroundColor: bg, color: '#fff',
      fontSize: 8, fontWeight: 700, textTransform: 'uppercase', lineHeight: '18px', textAlign: 'center' }}>
      {label}
    </span>
  );
}

function ArchetypeCard({ archetype }) {
  const meta = ARCHETYPE_META[archetype.archetype_id] || ARCHETYPE_META['mid-tier'];
  const lensValues = archetype.lens_pattern || {};
  return (
    <div style={{ border: '1px solid #e2e8f0', borderLeft: `3px solid ${meta.borderColor}`, borderRadius: 6, padding: '8px 10px',
      cursor: 'default', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>{meta.icon} {archetype.name}</span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{archetype.count}</span>
          <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{archetype.percentage?.toFixed(1)}%</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
        {LENS_SHORT.map(l => (
          <span key={l} style={{ width: 20, fontSize: 7, color: '#94a3b8', textAlign: 'center' }}>{l}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 6 }}>
        {LENS_KEYS.map(k => {
          const val = lensValues[k];
          const bg = TIER_COLORS[val] || '#cbd5e1';
          return <span key={k} style={{ width: 20, height: 12, borderRadius: 3, backgroundColor: bg, display: 'inline-block' }} />;
        })}
      </div>
      <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.3 }}>{archetype.description || TEMPLATE_VERDICTS[archetype.archetype_id]}</div>
    </div>
  );
}

function buildInsight(top15) {
  const parts = [];
  const allRounders = top15.filter(f => classifyArchetype(f) === 'all-rounder');
  if (allRounders.length > 0) {
    parts.push(`${allRounders.map(f => f.fund_name?.split(' ').slice(0, 3).join(' ')).join(', ')} — all-rounder(s) in the top 15 by AUM.`);
  }
  const trouble = top15.filter(f => classifyArchetype(f) === 'trouble');
  if (trouble.length > 0) {
    parts.push(`${trouble.map(f => f.fund_name?.split(' ').slice(0, 3).join(' ')).join(', ')} flagged "trouble" despite high AUM.`);
  }
  const best = [...top15].sort((a, b) => (b.return_1y || 0) - (a.return_1y || 0))[0];
  if (best) {
    const arch = classifyArchetype(best);
    parts.push(`Highest 1Y return: ${best.fund_name?.split(' ').slice(0, 3).join(' ')} (${arch}).`);
  }
  return parts.join(' ') || 'Top 15 by AUM shown with lens fingerprints.';
}

export default function LensFingerprint({ universe: rawUniverse, archetypes: serverArchetypes, loading }) {
  const universe = rawUniverse || [];
  const [verdicts, setVerdicts] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState('aum');

  const archetypeGrid = useMemo(() => {
    if (serverArchetypes?.length) return [...serverArchetypes].sort((a, b) => b.count - a.count);
    if (!universe.length) return [];
    const counts = {};
    universe.forEach(f => {
      const id = classifyArchetype(f);
      if (!counts[id]) counts[id] = { archetype_id: id, name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), count: 0, lens_pattern: {} };
      counts[id].count += 1;
    });
    const total = universe.length || 1;
    return Object.values(counts).map(a => ({ ...a, percentage: (a.count / total) * 100 })).sort((a, b) => b.count - a.count);
  }, [universe, serverArchetypes]);

  const SORT_OPTIONS = [
    { key: 'aum', label: 'By AUM' },
    { key: 'return_1y', label: 'Top Returners' },
    { key: 'alpha_score', label: 'Best Alpha' },
    { key: 'risk_score', label: 'Lowest Risk' },
  ];

  const displayFunds = useMemo(() => {
    if (!universe.length) return [];
    const limit = expanded ? 30 : 10;
    const sorted = [...universe];
    if (sortBy === 'risk_score') {
      sorted.sort((a, b) => (a[sortBy] || 100) - (b[sortBy] || 100));
    } else {
      sorted.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
    }
    return sorted.slice(0, limit);
  }, [universe, expanded, sortBy]);

  useEffect(() => {
    if (!displayFunds.length) return;
    displayFunds.forEach(f => {
      cachedFetch(`verdict-${f.mstar_id}`, () => fetchFundVerdict(f.mstar_id).then(r => r.data?.verdict || r.verdict), 600)
        .then(v => { if (v) setVerdicts(prev => ({ ...prev, [f.mstar_id]: v })); })
        .catch(() => {});
    });
  }, [displayFunds]);

  const insight = useMemo(() => buildInsight(displayFunds), [displayFunds]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading lens fingerprints…</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Section title */}
      <p className="section-title mb-4">Fund Archetypes & Lens Fingerprints</p>

      {/* Archetype Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 mb-4">
        {archetypeGrid.map(a => <ArchetypeCard key={a.archetype_id} archetype={a} />)}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[9px] uppercase text-slate-400 font-medium mr-1">Sort by:</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortBy(key)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${
              sortBy === key
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fingerprint Heatmap Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              {['Fund', 'Return', 'Risk', 'Consist.', 'Alpha', 'Effic.', 'Resil.', 'Archetype', 'Verdict'].map((h, i) => (
                <th key={h} style={{ fontSize: 9, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600,
                  padding: '6px 4px', textAlign: i === 0 ? 'left' : 'center',
                  width: i === 0 ? 200 : i === 8 ? 140 : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayFunds.map(f => {
              const archId = classifyArchetype(f);
              const meta = ARCHETYPE_META[archId] || ARCHETYPE_META['mid-tier'];
              const verdict = verdicts[f.mstar_id] || TEMPLATE_VERDICTS[archId];
              return (
                <tr key={f.mstar_id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                  <td style={{ padding: '6px 4px', textAlign: 'left', maxWidth: 200 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.fund_name}
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>
                      {f.category_name?.split(' ').slice(0, 2).join(' ')} · {formatAUMRaw(f.aum)}
                    </div>
                  </td>
                  {LENS_KEYS.map(k => (
                    <td key={k} style={{ padding: '4px 2px', textAlign: 'center' }}>
                      <TierPill tierClass={f[k]} />
                    </td>
                  ))}
                  <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 600, borderRadius: 4, padding: '2px 6px',
                      backgroundColor: meta.bg, color: meta.color }}>
                      {meta.icon} {archId}
                    </span>
                  </td>
                  <td style={{ padding: '4px 4px', textAlign: 'center', maxWidth: 140 }}>
                    <span style={{ fontSize: 10, color: '#475569', lineHeight: 1.3, display: 'inline-block' }}>{verdict}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expand/collapse toggle */}
      {universe.length > 10 && (
        <div className="flex justify-center mt-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-teal-600 font-medium hover:text-teal-700 flex items-center gap-1"
          >
            {expanded ? '▴ Show fewer' : `▾ Show ${Math.min(30, universe.length)} funds`}
          </button>
        </div>
      )}

      {/* Bottom insight bar */}
      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6,
        background: 'linear-gradient(135deg, #f0fdfa, #ecfdf5)', fontSize: 11, color: '#065f46', lineHeight: 1.4 }}>
        {insight}
      </div>
    </div>
  );
}
