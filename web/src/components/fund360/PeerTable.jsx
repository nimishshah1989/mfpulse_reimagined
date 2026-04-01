import { useRouter } from 'next/router';
import { useState, useMemo } from 'react';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatPct, formatScore } from '../../lib/format';
import InfoIcon from '../shared/InfoIcon';

const COLUMNS = [
  { key: 'fund_name', label: 'Fund', sortable: false },
  { key: 'return_1y', label: '1Y', sortable: true, tip: '1-year trailing return (CAGR)' },
  { key: 'return_3y', label: '3Y', sortable: true, tip: '3-year annualized return' },
  { key: 'sharpe_3y', label: 'Sharpe', sortable: true, tip: 'Risk-adjusted return. Higher = better. (Return - Risk Free) / Std Dev' },
  { key: 'return_score', label: 'Return', sortable: true, tip: 'Percentile rank (0-100) within category for returns' },
  { key: 'risk_score', label: 'Risk', sortable: true, tip: 'Percentile rank (0-100) for risk. Higher = lower risk (inverted)' },
  { key: 'alpha_score', label: 'Alpha', sortable: true, tip: 'Percentile rank (0-100) for manager skill (excess return over benchmark)' },
];

function truncate(str, max) {
  if (!str) return '\u2014';
  return str.length > max ? str.slice(0, max) + '\u2026' : str;
}

export default function PeerTable({ peers, currentMstarId }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState('return_1y');
  const [sortDir, setSortDir] = useState('desc');

  const sortedPeers = useMemo(() => {
    if (!peers || peers.length === 0) return [];
    return [...peers].sort((a, b) => {
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [peers, sortKey, sortDir]);

  if (!peers) {
    return (
      <Card title="Category Peers">
        <SkeletonLoader />
      </Card>
    );
  }

  if (peers.length === 0) {
    return (
      <Card title="Category Peers">
        <p className="text-sm text-slate-500 text-center py-8">
          No peer data available
        </p>
      </Card>
    );
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function renderCell(peer, col) {
    const val = peer[col.key];
    if (col.key === 'fund_name') {
      return (
        <span className="text-xs text-slate-800">
          {truncate(val, 30)}
        </span>
      );
    }
    if (['return_1y', 'return_3y'].includes(col.key)) {
      if (val === null || val === undefined) return '\u2014';
      const color = val >= 0 ? 'text-emerald-600' : 'text-red-600';
      return (
        <span className={`font-mono tabular-nums text-xs ${color}`}>
          {formatPct(val)}
        </span>
      );
    }
    if (col.key === 'sharpe_3y') {
      if (val === null || val === undefined) return '\u2014';
      return (
        <span className="font-mono tabular-nums text-xs text-slate-700">
          {Number(val).toFixed(2)}
        </span>
      );
    }
    if (val === null || val === undefined) return '\u2014';
    return (
      <span className="font-mono tabular-nums text-xs text-slate-700">
        {formatScore(val)}
      </span>
    );
  }

  return (
    <Card title="Category Peers">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`py-2 px-2 text-xs font-medium text-slate-500 ${
                    col.key === 'fund_name' ? 'text-left' : 'text-right'
                  } ${col.sortable ? 'cursor-pointer select-none hover:text-slate-800' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-0.5">{col.label} {col.tip && <InfoIcon tip={col.tip} />}</span>
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">
                      {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPeers.map((peer) => {
              const isCurrent = peer.mstar_id === currentMstarId;
              return (
                <tr
                  key={peer.mstar_id}
                  className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                    isCurrent ? 'bg-teal-50 font-medium' : ''
                  }`}
                  onClick={() =>
                    router.push(`/fund360?fund=${peer.mstar_id}`)
                  }
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`py-2 px-2 ${
                        col.key === 'fund_name' ? 'text-left' : 'text-right'
                      }`}
                    >
                      {renderCell(peer, col)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
