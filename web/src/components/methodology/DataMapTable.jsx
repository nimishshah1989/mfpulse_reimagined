import InfoIcon from '../shared/InfoIcon';

export default function DataMapTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left py-2 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.tip && <InfoIcon tip={col.tip} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-slate-50 ${
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="py-2 px-3 text-slate-600">
                  {col.key === 'db_column' || col.key === 'ms_field' ? (
                    <code className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-teal-700">
                      {row[col.key]}
                    </code>
                  ) : col.key === 'coverage' ? (
                    <CoverageBadge value={row[col.key]} />
                  ) : (
                    row[col.key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoverageBadge({ value }) {
  if (!value) return <span className="text-slate-300">{'\u2014'}</span>;
  const num = parseInt(value, 10);
  const color =
    num >= 95
      ? 'bg-emerald-50 text-emerald-700'
      : num >= 85
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';

  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>
      {value}
    </span>
  );
}
