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

  const top15 = useMemo(() => {
    if (!universe.length) return [];
    return [...universe].sort((a, b) => (b.aum || 0) - (a.aum || 0)).slice(0, 15);
  }, [universe]);

  useEffect(() => {
    if (!top15.length) return;
    top15.forEach(f => {
      cachedFetch(`verdict-${f.mstar_id}`, () => fetchFundVerdict(f.mstar_id).then(r => r.data?.verdict || r.verdict), 600)
        .then(v => { if (v) setVerdicts(prev => ({ ...prev, [f.mstar_id]: v })); })
        .catch(() => {});
    });
  }, [top15]);

  const insight = useMemo(() => buildInsight(top15), [top15]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading lens fingerprints…</div>;
  }

  return (
    <div>
      {/* Archetype Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {archetypeGrid.map(a => <ArchetypeCard key={a.archetype_id} archetype={a} />)}
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
            {top15.map(f => {
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

      {/* Bottom insight bar */}
      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6,
        background: 'linear-gradient(135deg, #f0fdfa, #ecfdf5)', fontSize: 11, color: '#065f46', lineHeight: 1.4 }}>
        {insight}
      </div>
    </div>
  );
}
