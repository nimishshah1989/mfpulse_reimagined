export default function Pill({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-150 ${
        active
          ? 'bg-teal-600 text-white border-teal-600 shadow-sm shadow-teal-200'
          : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-700'
      } ${className}`}
    >
      {children}
    </button>
  );
}
