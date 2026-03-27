export default function Card({ title, emoji, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      {title && (
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
