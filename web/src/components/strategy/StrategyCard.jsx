import Card from '../shared/Card';
import Badge from '../shared/Badge';
import { formatPct, formatAUM } from '../../lib/format';

export default function StrategyCard({ strategy, onEdit, onBacktest, onDelete }) {
  const { id, name, description, fund_count, aum_cr, created_at, last_backtest_xirr, status } = strategy;
  const xirrPositive = last_backtest_xirr != null && last_backtest_xirr >= 0;

  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 truncate">{name}</h3>
            <Badge variant={status === 'active' ? 'emerald' : 'slate'}>{status}</Badge>
          </div>
          {description && (
            <p className="mt-1 text-sm text-slate-500 truncate">{description}</p>
          )}
        </div>
        {last_backtest_xirr != null && (
          <span className={`font-mono tabular-nums text-lg font-semibold whitespace-nowrap ${xirrPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatPct(last_backtest_xirr)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span>{fund_count} fund{fund_count !== 1 ? 's' : ''}</span>
        <span>{formatAUM(aum_cr)}</span>
        <span>Created {new Date(created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onEdit(id)}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onBacktest(id)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Backtest
        </button>
        <button
          onClick={() => onDelete(id)}
          className="ml-auto px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </Card>
  );
}
