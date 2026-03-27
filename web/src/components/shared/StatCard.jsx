export default function StatCard({
  label,
  value,
  subtext,
  color,
  className = '',
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-4 ${className}`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`text-2xl font-bold font-mono mt-1 ${color || 'text-slate-800'}`}
      >
        {value}
      </p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}
