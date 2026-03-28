import Card from '../shared/Card';
import { formatPct } from '../../lib/format';

const PERIODS = [
  { key: 'return_1m', label: '1M' },
  { key: 'return_3m', label: '3M' },
  { key: 'return_6m', label: '6M' },
  { key: 'return_ytd', label: 'YTD' },
  { key: 'return_1y', label: '1Y' },
  { key: 'return_2y', label: '2Y' },
  { key: 'return_3y', label: '3Y' },
  { key: 'return_5y', label: '5Y' },
  { key: 'return_7y', label: '7Y' },
  { key: 'return_10y', label: '10Y' },
  { key: 'return_since_inception', label: 'SI' },
];

function ReturnCell({ value }) {
  if (value == null) {
    return <td className="text-xs py-2 px-3 border-b border-slate-100 text-center text-slate-400">&mdash;</td>;
  }
  const color = value >= 0 ? 'text-emerald-600' : 'text-red-600';
  return (
    <td className={`text-xs py-2 px-3 border-b border-slate-100 text-center font-mono tabular-nums ${color}`}>
      {formatPct(value)}
    </td>
  );
}

function DiffCell({ fund, category }) {
  if (fund == null || category == null) {
    return <td className="text-xs py-2 px-3 border-b border-slate-100 text-center text-slate-400">&mdash;</td>;
  }
  const diff = fund - category;
  const color = diff >= 0 ? 'text-emerald-600' : 'text-red-600';
  return (
    <td className={`text-xs py-2 px-3 border-b border-slate-100 text-center font-mono tabular-nums ${color}`}>
      {formatPct(diff)}
    </td>
  );
}

export default function ReturnsTable({ fundReturns, categoryReturns }) {
  return (
    <Card title="Returns">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <th className="text-xs font-medium text-slate-500 py-2 px-3 text-left border-b border-slate-200" />
              {PERIODS.map((p) => (
                <th key={p.key} className="text-xs font-medium text-slate-500 py-2 px-3 text-center border-b border-slate-200">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-xs font-medium text-slate-700 py-2 px-3 border-b border-slate-100 whitespace-nowrap">Fund</td>
              {PERIODS.map((p) => (
                <ReturnCell key={p.key} value={fundReturns?.[p.key]} />
              ))}
            </tr>
            <tr>
              <td className="text-xs font-medium text-slate-700 py-2 px-3 border-b border-slate-100 whitespace-nowrap">Category Avg</td>
              {PERIODS.map((p) => (
                <ReturnCell key={p.key} value={categoryReturns?.[p.key] ?? null} />
              ))}
            </tr>
            <tr>
              <td className="text-xs font-medium text-slate-700 py-2 px-3 border-b border-slate-100 whitespace-nowrap">Difference</td>
              {PERIODS.map((p) => (
                <DiffCell key={p.key} fund={fundReturns?.[p.key]} category={categoryReturns?.[p.key]} />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
