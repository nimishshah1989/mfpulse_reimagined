export default function SkeletonLoader({ variant = 'card', className = '' }) {
  const heights = {
    card: 'h-32',
    row: 'h-4',
    chart: 'h-64',
  };

  return (
    <div
      className={`bg-slate-100 animate-pulse rounded ${heights[variant] || 'h-32'} ${className}`}
    />
  );
}
