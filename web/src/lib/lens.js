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
