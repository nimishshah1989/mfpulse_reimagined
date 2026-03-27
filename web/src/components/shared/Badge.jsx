const TIER_COLORS = {
  // Return lens
  LEADER: 'bg-emerald-100 text-emerald-700',
  STRONG: 'bg-teal-100 text-teal-700',
  AVERAGE: 'bg-blue-100 text-blue-700',
  WEAK: 'bg-red-100 text-red-700',
  // Risk lens
  LOW_RISK: 'bg-emerald-100 text-emerald-700',
  MODERATE: 'bg-blue-100 text-blue-700',
  ELEVATED: 'bg-amber-100 text-amber-700',
  HIGH_RISK: 'bg-red-100 text-red-700',
  // Consistency lens
  ROCK_SOLID: 'bg-emerald-100 text-emerald-700',
  CONSISTENT: 'bg-teal-100 text-teal-700',
  MIXED: 'bg-amber-100 text-amber-700',
  ERRATIC: 'bg-red-100 text-red-700',
  // Alpha lens
  ALPHA_MACHINE: 'bg-emerald-100 text-emerald-700',
  POSITIVE: 'bg-teal-100 text-teal-700',
  NEUTRAL: 'bg-blue-100 text-blue-700',
  NEGATIVE: 'bg-red-100 text-red-700',
  // Efficiency lens
  LEAN: 'bg-emerald-100 text-emerald-700',
  FAIR: 'bg-teal-100 text-teal-700',
  EXPENSIVE: 'bg-amber-100 text-amber-700',
  BLOATED: 'bg-red-100 text-red-700',
  // Resilience lens
  FORTRESS: 'bg-emerald-100 text-emerald-700',
  STURDY: 'bg-teal-100 text-teal-700',
  FRAGILE: 'bg-amber-100 text-amber-700',
  VULNERABLE: 'bg-red-100 text-red-700',
};

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

export default function Badge({ children, variant = 'tier', className = '' }) {
  let colorClass = 'bg-slate-100 text-slate-600';

  if (variant === 'tier' && typeof children === 'string') {
    colorClass = TIER_COLORS[children] || colorClass;
  } else if (variant === 'category') {
    colorClass = 'bg-slate-100 text-slate-600';
  } else if (variant === 'status' && typeof children === 'string') {
    colorClass = STATUS_COLORS[children] || colorClass;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colorClass} ${className}`}
    >
      {children}
    </span>
  );
}
