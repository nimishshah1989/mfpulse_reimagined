export default function Pill({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
        active
          ? 'bg-teal-600 text-white border-teal-600'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      } ${className}`}
    >
      {children}
    </button>
  );
}
