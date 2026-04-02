import { useMemo, useState } from 'react';
import { formatScore, formatCount } from '../../lib/format';
import { LENS_LABELS } from '../../lib/lens';

const QUINTILES = [
  { label: '0\u201320', min: 0, max: 20 },
  { label: '20\u201340', min: 20, max: 40 },
  { label: '40\u201360', min: 40, max: 60 },
  { label: '60\u201380', min: 60, max: 80 },
  { label: '80\u2013100', min: 80, max: 100 },
];

function getCellColor(count, maxCount, quintileIndex) {
  if (count === 0) return { bg: '#ffffff', text: '#94a3b8' };
  const quintileColors = [
    { light: '#fef2f2', mid: '#fecaca', strong: '#f87171', intense: '#dc2626' },
    { light: '#fef2f2', mid: '#fecaca', strong: '#ef4444', intense: '#dc2626' },
    { light: '#fffbeb', mid: '#fde68a', strong: '#f59e0b', intense: '#d97706' },
    { light: '#ecfdf5', mid: '#a7f3d0', strong: '#10b981', intense: '#059669' },
    { light: '#ecfdf5', mid: '#6ee7b7', strong: '#059669', intense: '#047857' },
  ];
  const palette = quintileColors[quintileIndex] || quintileColors[2];
  const ratio = count / Math.max(maxCount, 1);
  if (ratio > 0.7) return { bg: palette.intense, text: '#ffffff' };
  if (ratio > 0.4) return { bg: palette.strong, text: '#ffffff' };
  if (ratio > 0.2) return { bg: palette.mid, text: '#1e293b' };
  return { bg: palette.light, text: '#475569' };
}

function getAvgColor(avg) {
  if (avg >= 80) return 'text-emerald-700';
  if (avg >= 60) return 'text-emerald-600';
  if (avg >= 40) return 'text-amber-600';
  return 'text-red-600';
}

export default function Heatmap({
  data,
  colorLens,
  onCellClick,
}) {
  const [tooltip, setTooltip] = useState(null);

  // Group data by category, compute quintile buckets
  const { rows, maxCount, columnTotals } = useMemo(() => {
    // Group funds by broad_category then category_name
    const catMap = {};
    const broadOrder = {};
    data.forEach((fund) => {
      const cat = fund.category_name;
      const broad = fund.broad_category || 'Other';
      if (!catMap[cat]) {
        catMap[cat] = { category: cat, broad, funds: [] };
        broadOrder[cat] = broad;
      }
      catMap[cat].funds.push(fund);
    });

    // Sort categories by broad_category group
    const broadRank = { Equity: 0, Hybrid: 1, Debt: 2, Other: 3 };
    const sortedCats = Object.values(catMap).sort(
      (a, b) =>
        (broadRank[a.broad] ?? 4) - (broadRank[b.broad] ?? 4) ||
        a.category.localeCompare(b.category)
    );

    let maxCellCount = 0;
    const colTotals = QUINTILES.map(() => 0);

    const rowData = sortedCats.map((cat) => {
      const buckets = QUINTILES.map((q, qi) => {
        const matching = cat.funds.filter((f) => {
          const score = Number(f[colorLens]) || 0;
          return score >= q.min && (q.max === 100 ? score <= q.max : score < q.max);
        });
        const count = matching.length;
        if (count > maxCellCount) maxCellCount = count;
        colTotals[qi] += count;

        // Top 3 funds in this cell
        const top3 = matching
          .sort((a, b) => (Number(b[colorLens]) || 0) - (Number(a[colorLens]) || 0))
          .slice(0, 3)
          .map((f) => ({
            name: f.fund_name || f.mstar_id,
            score: Number(f[colorLens]) || 0,
          }));

        return { count, top3, quintile: q };
      });

      const total = cat.funds.length;
      const scores = cat.funds
        .map((f) => Number(f[colorLens]) || 0)
        .filter((s) => s > 0);
      const avg = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      return {
        category: cat.category,
        broad: cat.broad,
        buckets,
        total,
        avg,
      };
    });

    return { rows: rowData, maxCount: maxCellCount, columnTotals: colTotals };
  }, [data, colorLens]);

  return (
    <div className="relative overflow-x-auto">
      <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
        Rows = SEBI categories. Columns = {LENS_LABELS[colorLens] || 'Score'} quintiles (0-100).
        Cell color intensity = fund concentration. Hover for top funds in each cell.
      </p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="text-left text-slate-500 font-medium px-3 py-2 border-b border-slate-200 w-48">
              Category
            </th>
            {QUINTILES.map((q) => (
              <th
                key={q.label}
                className="text-center text-slate-500 font-medium px-3 py-2 border-b border-slate-200 w-20"
              >
                {q.label}
              </th>
            ))}
            <th className="text-center text-slate-500 font-medium px-3 py-2 border-b border-slate-200 w-24">
              Total / Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            // Show broad category separator
            const showBroad =
              ri === 0 || rows[ri - 1].broad !== row.broad;
            return (
              <tr key={row.category}>
                <td className="px-3 py-1.5 border-b border-slate-100">
                  {showBroad && (
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider -mb-0.5">
                      {row.broad}
                    </div>
                  )}
                  <span className="text-slate-700">{row.category}</span>
                </td>
                {row.buckets.map((bucket, bi) => {
                  const cellStyle = getCellColor(bucket.count, maxCount, bi);
                  return (
                    <td
                      key={bi}
                      className="text-center px-3 py-1.5 border-b border-slate-100 cursor-pointer transition-all hover:ring-2 hover:ring-teal-300"
                      style={{ backgroundColor: cellStyle.bg, color: cellStyle.text }}
                      onClick={() =>
                        onCellClick &&
                        onCellClick(row.category, bucket.quintile)
                      }
                      onMouseEnter={(e) =>
                        setTooltip({
                          category: row.category,
                          quintile: bucket.quintile,
                          count: bucket.count,
                          top3: bucket.top3,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      onMouseMove={(e) =>
                        setTooltip((prev) =>
                          prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                        )
                      }
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <span className="font-mono font-bold">
                        {bucket.count > 0 ? bucket.count : ''}
                      </span>
                    </td>
                  );
                })}
                <td className="text-center px-3 py-1.5 border-b border-slate-100">
                  <span className="font-mono text-slate-600">{row.total}</span>
                  <span className="text-slate-300 mx-1">/</span>
                  <span className={`font-mono font-medium ${getAvgColor(row.avg)}`}>
                    {formatScore(row.avg)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50">
            <td className="px-3 py-1.5 text-slate-500 font-medium border-t border-slate-200">
              Total
            </td>
            {columnTotals.map((ct, i) => (
              <td
                key={i}
                className="text-center px-3 py-1.5 font-mono text-slate-600 font-medium border-t border-slate-200"
              >
                {ct}
              </td>
            ))}
            <td className="text-center px-3 py-1.5 font-mono text-slate-600 font-medium border-t border-slate-200">
              {data.length}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Tooltip */}
      {tooltip && <HeatmapTooltip tooltip={tooltip} colorLens={colorLens} />}
    </div>
  );
}

function HeatmapTooltip({ tooltip, colorLens }) {
  const { category, quintile, count, top3, x, y } = tooltip;

  const style = {
    position: 'fixed',
    left: x + 16,
    top: y - 10,
    zIndex: 50,
  };

  if (x > window.innerWidth - 280) style.left = x - 270;
  if (y > window.innerHeight - 160) style.top = y - 140;

  return (
    <div
      style={style}
      className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 pointer-events-none max-w-[250px]"
    >
      <div className="text-sm font-semibold text-slate-800">
        {category}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        {formatCount(count)} funds scoring {quintile.label} on {LENS_LABELS[colorLens]}
      </div>
      {top3.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-slate-400 font-medium">Top 3:</div>
          {top3.map((f, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-slate-600 truncate mr-2">
                {f.name}
              </span>
              <span className="text-xs font-mono text-teal-600 flex-shrink-0">
                {formatScore(f.score)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
