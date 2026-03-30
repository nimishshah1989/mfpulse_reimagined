/**
 * ScreenerTable — sortable, paginated fund table with column group toggles.
 * Matches v3 mockup: Returns + Risk Metrics + Lens Scores + Quartile Ranks + Valuations.
 */
import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { formatPct, formatAUM } from '../../lib/format';
import { scoreColor } from '../../lib/lens';

const PAGE_SIZE = 50;

const COLUMN_GROUPS = [
  { key: 'returns', label: 'Returns' },
  { key: 'risk', label: 'Risk Metrics' },
  { key: 'lens', label: 'Lens Scores' },
  { key: 'quartile', label: 'Quartile Ranks' },
  { key: 'valuations', label: 'Valuations' },
];

const SORTABLE_COLUMNS = {
  fund_name: { label: 'Fund Name', group: 'core' },
  category_name: { label: 'Category', group: 'core' },
  aum: { label: 'AUM', group: 'core', numeric: true },
  return_1y: { label: '1Y', group: 'returns', numeric: true },
  return_3y: { label: '3Y', group: 'returns', numeric: true },
  return_5y: { label: '5Y', group: 'returns', numeric: true },
  sharpe_3y: { label: 'Sharpe', group: 'risk', numeric: true },
  alpha_3y: { label: 'Alpha', group: 'risk', numeric: true },
  max_drawdown_3y: { label: 'Max DD', group: 'risk', numeric: true },
  beta_3y: { label: 'Beta', group: 'risk', numeric: true },
  net_expense_ratio: { label: 'Expense', group: 'risk', numeric: true },
  return_score: { label: 'Return', group: 'lens', numeric: true },
  risk_score: { label: 'Risk', group: 'lens', numeric: true },
  consistency_score: { label: 'Consist.', group: 'lens', numeric: true },
  alpha_score: { label: 'Alpha', group: 'lens', numeric: true },
  efficiency_score: { label: 'Effic.', group: 'lens', numeric: true },
  resilience_score: { label: 'Resil.', group: 'lens', numeric: true },
  quartile_1y: { label: 'Q1Y', group: 'quartile', numeric: true },
  quartile_3y: { label: 'Q3Y', group: 'quartile', numeric: true },
  quartile_5y: { label: 'Q5Y', group: 'quartile', numeric: true },
  pe_ratio: { label: 'P/E', group: 'valuations', numeric: true },
  pb_ratio: { label: 'P/B', group: 'valuations', numeric: true },
  prospective_div_yield: { label: 'Div Yield', group: 'valuations', numeric: true },
  turnover_ratio: { label: 'Turnover', group: 'valuations', numeric: true },
};

function QuartileBadge({ q }) {
  if (q == null) return <span className="text-slate-300">—</span>;
  const colors = {
    1: 'bg-emerald-600',
    2: 'bg-teal-500',
    3: 'bg-amber-500',
    4: 'bg-rose-600',
  };
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-extrabold text-white ${colors[q] || 'bg-slate-300'}`}>
      {q}
    </span>
  );
}

function LensMiniBar({ fund }) {
  const lenses = ['return_score', 'risk_score', 'consistency_score', 'alpha_score', 'efficiency_score', 'resilience_score'];
  return (
    <div className="flex gap-0.5 items-end h-[18px]">
      {lenses.map((l) => {
        const val = Number(fund[l]) || 0;
        const pct = Math.max(val, 5);
        return (
          <div
            key={l}
            className="w-1 rounded-sm"
            style={{ height: `${pct}%`, background: scoreColor(val) }}
          />
        );
      })}
    </div>
  );
}

function returnColor(val) {
  const n = Number(val) || 0;
  if (n >= 20) return 'text-emerald-700';
  if (n >= 10) return 'text-teal-600';
  if (n >= 0) return 'text-amber-600';
  return 'text-rose-600';
}

export default function ScreenerTable({
  funds,
  selectedFunds,
  onToggleFund,
  onFundClick,
}) {
  const router = useRouter();
  const [activeGroups, setActiveGroups] = useState(new Set(['returns', 'risk', 'lens']));
  const [sortKey, setSortKey] = useState('return_1y');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  function toggleGroup(key) {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  }

  const visibleColumns = useMemo(() => {
    return Object.entries(SORTABLE_COLUMNS).filter(
      ([, col]) => col.group === 'core' || activeGroups.has(col.group)
    );
  }, [activeGroups]);

  const sorted = useMemo(() => {
    const col = SORTABLE_COLUMNS[sortKey];
    if (!col) return funds;
    return [...funds].sort((a, b) => {
      const av = col.numeric ? (Number(a[sortKey]) || 0) : (a[sortKey] || '');
      const bv = col.numeric ? (Number(b[sortKey]) || 0) : (b[sortKey] || '');
      if (typeof av === 'number') {
        return sortDir === 'desc' ? bv - av : av - bv;
      }
      return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }, [funds, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function renderCell(key, fund) {
    const val = fund[key];
    switch (key) {
      case 'fund_name':
        return (
          <span className="font-bold text-slate-800 truncate block max-w-[220px]">
            {fund.fund_name || fund.legal_name}
          </span>
        );
      case 'category_name':
        return <span className="text-slate-500">{val || fund.broad_category}</span>;
      case 'aum': {
        const cr = (Number(val) || 0) / 1e7;
        return <span className="tabular-nums font-semibold">{formatAUM(cr)}</span>;
      }
      case 'return_1y':
      case 'return_3y':
      case 'return_5y':
        return <span className={`tabular-nums font-bold ${returnColor(val)}`}>{formatPct(val)}</span>;
      case 'sharpe_3y':
      case 'beta_3y':
        return <span className="tabular-nums font-semibold">{val != null ? Number(val).toFixed(2) : '—'}</span>;
      case 'alpha_3y':
        return (
          <span className={`tabular-nums font-semibold ${Number(val) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {val != null ? (Number(val) >= 0 ? '+' : '') + Number(val).toFixed(1) : '—'}
          </span>
        );
      case 'max_drawdown_3y':
        return <span className="tabular-nums font-semibold text-rose-600">{val != null ? formatPct(val) : '—'}</span>;
      case 'net_expense_ratio':
        return (
          <span className={`tabular-nums font-semibold ${Number(val) > 1.5 ? 'text-rose-600' : ''}`}>
            {val != null ? Number(val).toFixed(2) + '%' : '—'}
          </span>
        );
      case 'return_score':
      case 'risk_score':
      case 'consistency_score':
      case 'alpha_score':
      case 'efficiency_score':
      case 'resilience_score':
        return (
          <span className="tabular-nums font-bold" style={{ color: scoreColor(Number(val) || 0) }}>
            {val != null ? Math.round(Number(val)) : '—'}
          </span>
        );
      case 'quartile_1y':
      case 'quartile_3y':
      case 'quartile_5y':
        return <QuartileBadge q={val} />;
      case 'pe_ratio':
      case 'pb_ratio':
        return <span className="tabular-nums font-semibold">{val != null ? Number(val).toFixed(1) : '—'}</span>;
      case 'prospective_div_yield':
        return <span className="tabular-nums font-semibold">{val != null ? Number(val).toFixed(1) + '%' : '—'}</span>;
      case 'turnover_ratio':
        return <span className="tabular-nums font-semibold">{val != null ? Math.round(Number(val)) + '%' : '—'}</span>;
      default:
        return <span>{val ?? '—'}</span>;
    }
  }

  const selectedSet = new Set(selectedFunds || []);

  return (
    <div>
      {/* Column group toggles */}
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Columns</span>
        {COLUMN_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => toggleGroup(g.key)}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-all ${
              activeGroups.has(g.key)
                ? 'bg-teal-50 text-teal-700 border-teal-300'
                : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="w-9 py-2.5 pl-4 text-left">
                  <span className="sr-only">Select</span>
                </th>
                {visibleColumns.map(([key, col]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`py-2.5 px-3 font-bold text-[10px] uppercase tracking-wider cursor-pointer whitespace-nowrap hover:text-teal-600 transition-colors ${
                      col.numeric ? 'text-right' : 'text-left'
                    } ${sortKey === key ? 'text-teal-700' : 'text-slate-400'}`}
                    style={{ minWidth: key === 'fund_name' ? 200 : undefined }}
                  >
                    {col.label}
                    {sortKey === key && (
                      <span className="ml-0.5">{sortDir === 'desc' ? ' ▼' : ' ▲'}</span>
                    )}
                  </th>
                ))}
                {activeGroups.has('lens') && (
                  <th className="py-2.5 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-400">
                    Lens
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageData.map((fund) => {
                const isSelected = selectedSet.has(fund.mstar_id);
                return (
                  <tr
                    key={fund.mstar_id}
                    className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors"
                    onClick={() => router.push(`/fund360?fund=${fund.mstar_id}`)}
                  >
                    <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onToggleFund?.(fund.mstar_id)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] transition-all ${
                          isSelected
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-300 hover:border-teal-400'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </button>
                    </td>
                    {visibleColumns.map(([key, col]) => (
                      <td
                        key={key}
                        className={`py-2.5 px-3 ${col.numeric ? 'text-right' : 'text-left'}`}
                      >
                        {renderCell(key, fund)}
                      </td>
                    ))}
                    {activeGroups.has('lens') && (
                      <td className="py-2.5 px-3">
                        <LensMiniBar fund={fund} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-slate-200">
          <span className="text-xs text-slate-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString('en-IN')}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 disabled:opacity-30"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = page < 3 ? i : page - 2 + i;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all ${
                    p === page
                      ? 'bg-teal-50 text-teal-700 border-teal-300'
                      : 'border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Compare hint */}
      {selectedSet.size >= 2 && (
        <div className="mt-3 px-4 py-2.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg">
          {selectedSet.size} funds selected — switch to Compare for head-to-head analysis
        </div>
      )}
    </div>
  );
}
