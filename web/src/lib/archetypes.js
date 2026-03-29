/**
 * Fund archetype definitions and classification.
 * Maps to the 9 archetypes computed server-side.
 */

export const ARCHETYPE_META = {
  'all-rounder': {
    icon: '\u2733',
    color: '#059669',
    bg: '#ecfdf5',
    borderColor: '#059669',
  },
  'alpha-fragile': {
    icon: '\u26A1',
    color: '#7c3aed',
    bg: '#f5f3ff',
    borderColor: '#7c3aed',
  },
  'defensive': {
    icon: '\u2693',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    borderColor: '#0ea5e9',
  },
  'compounder': {
    icon: '\u25B2',
    color: '#10b981',
    bg: '#ecfdf5',
    borderColor: '#10b981',
  },
  'high-return-high-risk': {
    icon: '\u2B06',
    color: '#f59e0b',
    bg: '#fffbeb',
    borderColor: '#f59e0b',
  },
  'mid-tier': {
    icon: '\u2500',
    color: '#64748b',
    bg: '#f1f5f9',
    borderColor: '#64748b',
  },
  'watch': {
    icon: '\u26A0',
    color: '#dc2626',
    bg: '#fef2f2',
    borderColor: '#dc2626',
  },
  'turnaround': {
    icon: '\u21BB',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    borderColor: '#8b5cf6',
  },
  'trouble': {
    icon: '\u26A0',
    color: '#ef4444',
    bg: '#fef2f2',
    borderColor: '#ef4444',
  },
};

/**
 * Classify a fund into an archetype from its lens classes (client-side).
 * Mirrors backend _classify_archetype() for instant rendering.
 */
export function classifyArchetype(fund) {
  const TOP = new Set([
    'LEADER', 'STRONG', 'LOW_RISK', 'ROCK_SOLID', 'CONSISTENT',
    'ALPHA_MACHINE', 'POSITIVE', 'LEAN', 'FAIR', 'FORTRESS', 'STURDY',
  ]);
  const WEAK = new Set([
    'WEAK', 'HIGH_RISK', 'ERRATIC', 'NEGATIVE', 'BLOATED',
    'EXPENSIVE', 'VULNERABLE', 'FRAGILE',
  ]);

  const tiers = [
    fund.return_class || 'AVERAGE',
    fund.risk_class || 'MODERATE',
    fund.consistency_class || 'MIXED',
    fund.alpha_class || 'NEUTRAL',
    fund.efficiency_class || 'FAIR',
    fund.resilience_class || 'FRAGILE',
  ];

  const topCount = tiers.filter((t) => TOP.has(t)).length;
  const weakCount = tiers.filter((t) => WEAK.has(t)).length;
  const [ret, risk, cons, alpha, , resil] = tiers;

  if (topCount >= 5) return 'all-rounder';
  if (weakCount >= 3) return 'trouble';
  if (alpha === 'NEGATIVE' && ['LOW_RISK', 'MODERATE'].includes(risk) && ['AVERAGE', 'WEAK'].includes(ret)) return 'watch';
  if (['LEADER', 'STRONG'].includes(ret) && ['ALPHA_MACHINE', 'POSITIVE'].includes(alpha) && ['VULNERABLE', 'FRAGILE'].includes(resil)) return 'alpha-fragile';
  // Compounder before defensive (order matters)
  if (['ROCK_SOLID', 'CONSISTENT'].includes(cons) && ['LEADER', 'STRONG'].includes(ret)) return 'compounder';
  if (risk === 'LOW_RISK' && ['FORTRESS', 'STURDY'].includes(resil) && ret !== 'WEAK') return 'defensive';
  if (['LEADER', 'STRONG'].includes(ret) && ['HIGH_RISK', 'ELEVATED'].includes(risk)) return 'high-return-high-risk';
  if (['WEAK', 'AVERAGE'].includes(ret) && ['ALPHA_MACHINE', 'POSITIVE'].includes(alpha)) return 'turnaround';
  return 'mid-tier';
}

/**
 * Get tier label for display in fingerprint table cells.
 */
export const TIER_LABELS = {
  // Return
  LEADER: 'Leader', STRONG: 'Strong', AVERAGE: 'Avg', WEAK: 'Weak',
  // Risk
  LOW_RISK: 'Low', MODERATE: 'Mod.', ELEVATED: 'Elev.', HIGH_RISK: 'High',
  // Consistency
  ROCK_SOLID: 'Rock', CONSISTENT: 'Cons.', MIXED: 'Mixed', ERRATIC: 'Erratic',
  // Alpha
  ALPHA_MACHINE: 'Alpha+', POSITIVE: 'Pos.', NEUTRAL: 'Neut.', NEGATIVE: 'Neg.',
  // Efficiency
  LEAN: 'Lean', FAIR: 'Fair', EXPENSIVE: 'Costly', BLOATED: 'Bloat',
  // Resilience
  FORTRESS: 'Fort.', STURDY: 'Sturdy', FRAGILE: 'Fragile', VULNERABLE: 'Vuln.',
};

/**
 * Get CSS class for a tier value.
 */
export function tierColorClass(tierClass) {
  const GREEN = new Set(['LEADER', 'LOW_RISK', 'ROCK_SOLID', 'ALPHA_MACHINE', 'LEAN', 'FORTRESS']);
  const TEAL = new Set(['STRONG', 'MODERATE', 'CONSISTENT', 'POSITIVE', 'FAIR', 'STURDY']);
  const AMBER = new Set(['AVERAGE', 'ELEVATED', 'MIXED', 'NEUTRAL', 'EXPENSIVE', 'FRAGILE']);
  const RED = new Set(['WEAK', 'HIGH_RISK', 'ERRATIC', 'NEGATIVE', 'BLOATED', 'VULNERABLE']);

  if (GREEN.has(tierClass)) return 'bg-emerald-600 text-white';
  if (TEAL.has(tierClass)) return 'bg-emerald-500 text-white';
  if (AMBER.has(tierClass)) return 'bg-amber-500 text-white';
  if (RED.has(tierClass)) return 'bg-red-500 text-white';
  return 'bg-slate-400 text-white';
}

/**
 * Template verdicts by archetype (used before Claude API responds).
 */
export const TEMPLATE_VERDICTS = {
  'all-rounder': 'Core hold. Best multi-lens fund. SIP & forget.',
  'alpha-fragile': 'High conviction only. Will bleed in downturns.',
  'defensive': 'Bear market anchor. Park lumpsum here during corrections.',
  'compounder': 'Steady SIP pick. Consistent returns, no drama.',
  'high-return-high-risk': 'Tactical allocation only. Size positions carefully.',
  'mid-tier': 'Decent but no edge. Better options in category exist.',
  'watch': 'Review position. Alpha has eroded. Expensive for what it delivers.',
  'turnaround': 'Improving signal. Watch for confirmation before adding.',
  'trouble': 'Multiple weak signals. Avoid or exit.',
};
