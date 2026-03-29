import SkeletonLoader from '../shared/SkeletonLoader';

const SEVERITY_BORDER = {
  green: 'border-emerald-500',
  amber: 'border-amber-500',
  red: 'border-red-500',
};

export default function SignalActionCards({ status, actionCards, onNavigate }) {
  if (status === 'loading') {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <SkeletonLoader key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (status === 'offline') {
    return null;
  }

  if (!actionCards || actionCards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {actionCards.map((card) => (
        <div
          key={card.id}
          className={`border-l-4 ${SEVERITY_BORDER[card.severity] || 'border-slate-300'} bg-white rounded-xl p-4 shadow-sm`}
        >
          <p className="text-sm font-semibold text-slate-900">{card.title}</p>
          <p className="text-xs text-slate-600 mt-1">{card.description}</p>

          {card.funds && card.funds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {card.funds.map((fund) => (
                <span
                  key={fund.mstar_id}
                  className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-teal-100"
                  onClick={() => onNavigate('/fund360?fund=' + fund.mstar_id)}
                >
                  {fund.fund_name}
                </span>
              ))}
            </div>
          )}

          {card.actions && card.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {card.actions.map((action) => (
                <button
                  key={action.label}
                  className="text-xs border border-teal-600 text-teal-600 px-3 py-1 rounded hover:bg-teal-50"
                  onClick={() => onNavigate(action.route)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
