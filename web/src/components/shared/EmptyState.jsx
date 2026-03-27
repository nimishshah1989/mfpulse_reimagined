export default function EmptyState({ icon, message, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <span className="text-4xl mb-3">{icon}</span>}
      <p className="text-slate-500 text-sm">{message}</p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
        >
          {action}
        </button>
      )}
    </div>
  );
}
