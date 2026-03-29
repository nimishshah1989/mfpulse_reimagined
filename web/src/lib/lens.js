export const LENS_OPTIONS = [
  { key: 'return_score', label: 'Return' },
  { key: 'risk_score', label: 'Risk' },
  { key: 'consistency_score', label: 'Consistency' },
  { key: 'alpha_score', label: 'Alpha' },
  { key: 'efficiency_score', label: 'Efficiency' },
  { key: 'resilience_score', label: 'Resilience' },
];

export const LENS_LABELS = Object.fromEntries(
  LENS_OPTIONS.map((l) => [l.key, l.label])
);

export const LENS_CLASS_KEYS = {
  return_score: 'return_class',
  risk_score: 'risk_class',
  consistency_score: 'consistency_class',
  alpha_score: 'alpha_class',
  efficiency_score: 'efficiency_class',
  resilience_score: 'resilience_class',
};

export const ALL_LENS_KEYS = LENS_OPTIONS.map((l) => l.key);

export const BROAD_COLORS = {
  Equity: { fill: 'rgba(20, 184, 166, 0.6)', stroke: '#14b8a6' },
  Debt: { fill: 'rgba(16, 185, 129, 0.6)', stroke: '#10b981' },
  Hybrid: { fill: 'rgba(245, 158, 11, 0.6)', stroke: '#f59e0b' },
  Other: { fill: 'rgba(148, 163, 184, 0.6)', stroke: '#94a3b8' },
};

export function lensColor(score) {
  if (score >= 90) return '#085041';
  if (score >= 70) return '#0d9488';
  if (score >= 50) return '#5DCAA5';
  if (score >= 30) return '#BA7517';
  return '#E24B4A';
}

export function lensLabel(score) {
  if (score >= 90) return 'Exceptional';
  if (score >= 75) return 'Leader';
  if (score >= 60) return 'Strong';
  if (score >= 45) return 'Adequate';
  if (score >= 30) return 'Weak';
  return 'Poor';
}

export function lensBgColor(score) {
  if (score >= 50) return '#E1F5EE';
  if (score >= 30) return '#FAEEDA';
  return '#FCEBEB';
}

/**
 * Green-to-Red score spectrum per spec:
 * 80-100 green, 60-79 teal, 40-59 amber, 20-39 light red, 0-19 deep red
 */
export function scoreColor(value) {
  const v = Number(value);
  if (isNaN(v)) return '#94a3b8';
  if (v >= 80) return '#059669';
  if (v >= 60) return '#0d9488';
  if (v >= 40) return '#d97706';
  if (v >= 20) return '#ef4444';
  return '#dc2626';
}

export function scoreBgColor(value) {
  const v = Number(value);
  if (isNaN(v)) return '#f1f5f9';
  if (v >= 80) return '#ecfdf5';
  if (v >= 60) return '#f0fdfa';
  if (v >= 40) return '#fffbeb';
  if (v >= 20) return '#fef2f2';
  return '#fef2f2';
}

export function momentumColor(momentum) {
  if (momentum >= 5) return '#085041';
  if (momentum >= 2) return '#0d9488';
  if (momentum >= 0) return '#5DCAA5';
  if (momentum >= -2) return '#BA7517';
  return '#E24B4A';
}
