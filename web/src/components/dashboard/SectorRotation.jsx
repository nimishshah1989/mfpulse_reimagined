import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import SkeletonLoader from '../shared/SkeletonLoader';

const QUADRANT_COLORS = {
  Leading: { dot: '#059669', badge: 'text-emerald-700 bg-emerald-100' },
  Improving: { dot: '#0ea5e9', badge: 'text-sky-700 bg-sky-100' },
  Weakening: { dot: '#d97706', badge: 'text-amber-700 bg-amber-100' },
  Lagging: { dot: '#ef4444', badge: 'text-red-600 bg-red-50' },
};

function toTitleCase(str) {
  if (!str) return 'Improving';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getName(s) {
  return s.display_name || s.sector_name || s.name || '';
}

/* Return score → red-to-green gradient (matching universe page) */
function returnScoreColor(score) {
  if (score == null) return '#94a3b8';
  if (score >= 75) return 'rgba(5, 150, 105, 0.85)';   // deep green
  if (score >= 50) return 'rgba(13, 148, 136, 0.80)';   // teal
  if (score >= 25) return 'rgba(245, 158, 11, 0.75)';   // amber
  return 'rgba(239, 68, 68, 0.80)';                      // red
}

function returnScoreBorder(score) {
  if (score == null) return '#94a3b8';
  if (score >= 75) return 'rgba(5,150,105,0.9)';
  if (score >= 50) return 'rgba(13,148,136,0.85)';
  if (score >= 25) return 'rgba(245,158,11,0.8)';
  return 'rgba(239,68,68,0.85)';
}

/* Exclude non-equity categories from bubble chart */
const EXCLUDED_CAT_KEYWORDS = [
  'liquid', 'overnight', 'money market', 'ultra short', 'low duration',
  'short duration', 'medium duration', 'long duration', 'dynamic bond',
  'corporate bond', 'credit risk', 'gilt', 'banking & psu', 'floater',
  'index funds - fixed income', 'conservative', '10 year', 'fixed maturity',
  'close ended', 'interval', 'capital protection', 'retirement',
  'children', 'solution oriented',
];

function isEquityCategory(catName) {
  if (!catName) return false;
  const lower = catName.toLowerCase();
  return !EXCLUDED_CAT_KEYWORDS.some((kw) => lower.includes(kw));
}

/* ──────────────── Category Bubble Chart (SVG) ──────────────── */

function CategoryBubbleChart({ universe, onCategoryClick }) {
  const [hovered, setHovered] = useState(null);

  const categories = useMemo(() => {
    if (!universe || universe.length === 0) return [];
    const grouped = {};
    universe.forEach((f) => {
      const cat = f.category_name;
      if (!cat || !isEquityCategory(cat)) return;
      if (!grouped[cat]) grouped[cat] = { returns: [], risks: [], returnScores: [], count: 0, originalName: cat };
      grouped[cat].count += 1;
      if (f.return_1y != null) grouped[cat].returns.push(Number(f.return_1y));
      if (f.risk_score != null) grouped[cat].risks.push(Number(f.risk_score));
      if (f.return_score != null) grouped[cat].returnScores.push(Number(f.return_score));
    });

    const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return Object.entries(grouped)
      .filter(([, d]) => d.count >= 3 && d.returns.length > 0 && d.risks.length > 0)
      .map(([name, d]) => ({
        name: name.replace(/ Fund$/, '').replace(/Equity - /, ''),
        originalName: d.originalName,
        count: d.count,
        avgReturn: avg(d.returns),
        avgRisk: avg(d.risks),
        avgReturnScore: avg(d.returnScores),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [universe]);

  if (categories.length === 0) return <div className="w-full h-[440px] bg-slate-50 rounded-lg flex items-center justify-center text-xs text-slate-400">No equity category data available</div>;

  const W = 700, H = 460;
  const pad = { top: 20, right: 20, bottom: 36, left: 48 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Percentile-based axis ranges to handle outliers (clip at 5th/95th)
  const returns = categories.map((c) => c.avgReturn).filter((v) => v != null);
  const risks = categories.map((c) => c.avgRisk).filter((v) => v != null);
  const percentile = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length * p)] ?? s[0]; };
  const retP5 = percentile(returns, 0.05), retP95 = percentile(returns, 0.95);
  const riskP5 = percentile(risks, 0.05), riskP95 = percentile(risks, 0.95);
  const retRange = retP95 - retP5 || 10;
  const riskRange = riskP95 - riskP5 || 20;
  const minR = retP5 - retRange * 0.12, maxR = retP95 + retRange * 0.12;
  const minRk = riskP5 - riskRange * 0.12, maxRk = riskP95 + riskRange * 0.12;
  const maxCount = Math.max(...categories.map((c) => c.count));

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const scaleX = (rk) => pad.left + clamp((rk - minRk) / (maxRk - minRk), 0, 1) * plotW;
  const scaleY = (ret) => pad.top + plotH - clamp((ret - minR) / (maxR - minR), 0, 1) * plotH;
  const scaleR = (count) => 12 + (count / maxCount) * 36;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={`h${t}`} x1={pad.left} x2={W - pad.right} y1={pad.top + plotH * t} y2={pad.top + plotH * t}
            stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={`v${t}`} y1={pad.top} y2={H - pad.bottom} x1={pad.left + plotW * t} x2={pad.left + plotW * t}
            stroke="#f1f5f9" strokeWidth="1" />
        ))}

        {/* Axes */}
        <line x1={pad.left} x2={W - pad.right} y1={H - pad.bottom} y2={H - pad.bottom} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={H - pad.bottom} stroke="#cbd5e1" strokeWidth="1" />

        {/* Axis labels */}
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500">
          Avg Risk Score →
        </text>
        <text x={10} y={H / 2} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500"
          transform={`rotate(-90, 10, ${H / 2})`}>
          Avg 1Y Return % →
        </text>

        {/* Tick labels on axes */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const riskVal = minRk + (maxRk - minRk) * t;
          return (
            <text key={`xt${t}`} x={pad.left + plotW * t} y={H - pad.bottom + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {riskVal.toFixed(0)}
            </text>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const retVal = minR + (maxR - minR) * t;
          return (
            <text key={`yt${t}`} x={pad.left - 6} y={pad.top + plotH - plotH * t + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
              {retVal.toFixed(0)}%
            </text>
          );
        })}

        {/* Bubbles — clickable */}
        {categories.map((cat) => {
          const cx = scaleX(cat.avgRisk);
          const cy = scaleY(cat.avgReturn);
          const r = scaleR(cat.count);
          const fill = returnScoreColor(cat.avgReturnScore);
          const border = returnScoreBorder(cat.avgReturnScore);
          const isHovered = hovered === cat.name;
          return (
            <g key={cat.name}
              onMouseEnter={() => setHovered(cat.name)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onCategoryClick?.(cat.originalName)}
              style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r={r} fill={fill} opacity={isHovered ? 1 : 0.85}
                stroke={isHovered ? '#0f172a' : border} strokeWidth={isHovered ? 2.5 : 1.5}
                style={{ transition: 'all 0.15s' }} />
              {(r >= 14 || isHovered) && (
                <text x={cx} y={cy + 1} textAnchor="middle" fontSize={isHovered ? '11' : '9'} fontWeight="700"
                  fill="#fff" pointerEvents="none" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {cat.name.length > 12 ? cat.name.slice(0, 10) + '…' : cat.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {hovered && (() => {
          const cat = categories.find((c) => c.name === hovered);
          if (!cat) return null;
          const tx = Math.min(scaleX(cat.avgRisk) + 20, W - 160);
          const ty = Math.max(scaleY(cat.avgReturn) - 10, pad.top);
          return (
            <g>
              <rect x={tx} y={ty - 12} width={150} height={56} rx={6} fill="#0f172a" opacity={0.92} />
              <text x={tx + 8} y={ty + 4} fontSize="11" fontWeight="600" fill="#fff">{cat.name}</text>
              <text x={tx + 8} y={ty + 18} fontSize="10" fill="#94a3b8">
                {cat.count} funds · Ret {cat.avgReturn?.toFixed(1)}%
              </text>
              <text x={tx + 8} y={ty + 30} fontSize="10" fill="#94a3b8">
                Risk {cat.avgRisk?.toFixed(0)} · Score {cat.avgReturnScore?.toFixed(0)}
              </text>
              <text x={tx + 8} y={ty + 42} fontSize="9" fill="#67e8f9">Click to drill down</text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1">
        <span className="text-[11px] text-slate-600 font-medium">Return Score:</span>
        {[
          { color: '#059669', label: '75+' },
          { color: '#0d9488', label: '50+' },
          { color: '#f59e0b', label: '25+' },
          { color: '#ef4444', label: '<25' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
        <span className="text-[10px] text-slate-400 ml-2">Bubble size = fund count · Click to explore</span>
      </div>
    </div>
  );
}

/* ──────────────── Sector Table (sorted by Fund Wt) ──────────────── */

function SectorTable({ sectors }) {
  const sorted = useMemo(() => {
    return [...sectors].sort((a, b) => (b.avg_weight_pct || 0) - (a.avg_weight_pct || 0));
  }, [sectors]);

  return (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
            <th className="text-left py-2 px-2 font-semibold">Sector</th>
            <th className="text-left py-2 px-2 font-semibold">Zone</th>
            <th className="text-right py-2 px-2 font-semibold">RS</th>
            <th className="text-right py-2 px-2 font-semibold">Mom.</th>
            <th className="text-right py-2 px-2 font-semibold">Fund Wt%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const quadrant = toTitleCase(s.quadrant);
            const config = QUADRANT_COLORS[quadrant] || QUADRANT_COLORS.Improving;
            const mom = s.momentum_1m;
            const momStr = mom != null ? `${mom >= 0 ? '+' : ''}${Number(mom).toFixed(1)}` : '--';
            const wt = s.avg_weight_pct;
            const wtStr = wt != null ? `${Number(wt).toFixed(1)}%` : '--';

            return (
              <tr key={getName(s) || i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                <td className="py-2 px-2 font-medium text-slate-800 text-[13px]">{getName(s)}</td>
                <td className="py-2 px-2">
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${config.badge}`}>
                    {quadrant}
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                  {s.rs_score != null ? Number(s.rs_score).toFixed(0) : '--'}
                </td>
                <td className={`py-2 px-2 text-right font-mono tabular-nums ${mom == null ? 'text-slate-400' : mom >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {momStr}
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums font-semibold text-slate-700">
                  {wtStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────── Playbook Insight Bar ──────────────── */

function PlaybookBar({ sectors }) {
  if (!sectors || sectors.length === 0) return null;

  const byQuadrant = (q) =>
    sectors
      .filter((s) => toTitleCase(s.quadrant) === q)
      .sort((a, b) => (b.rs_score || 0) - (a.rs_score || 0))
      .slice(0, 3)
      .map(getName)
      .filter(Boolean);

  const leading = byQuadrant('Leading');
  const improving = byQuadrant('Improving');
  const lagging = byQuadrant('Lagging');

  const parts = [];
  if (leading.length > 0) parts.push(`Overweight ${leading.join(', ')}`);
  if (improving.length > 0) parts.push(`Watch ${improving.join(', ')}`);
  if (lagging.length > 0) parts.push(`Reduce ${lagging.join(', ')}`);

  if (parts.length === 0) return null;

  return (
    <div className="mt-4 px-4 py-3 rounded-lg border"
      style={{ backgroundColor: '#f0fdfa', borderColor: '#ccfbf1', color: '#0f766e' }}
    >
      <p className="text-xs leading-relaxed">
        <span className="font-semibold">Playbook:</span>{' '}
        {parts.join('. ')}.
      </p>
    </div>
  );
}

/* ──────────────── Category Drill-Down Panel ──────────────── */

function CategoryDrillDown({ categoryName, universe, onFundClick, onClose }) {
  const funds = useMemo(() => {
    if (!universe || !categoryName) return [];
    return universe
      .filter((f) => f.category_name === categoryName)
      .sort((a, b) => (b.return_1y || 0) - (a.return_1y || 0))
      .slice(0, 15);
  }, [universe, categoryName]);

  if (!categoryName) return null;

  return (
    <div className="mt-4 border border-teal-200 rounded-xl bg-teal-50/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-800">
          {categoryName} — {funds.length} funds
        </p>
        <button type="button" onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-slate-100">
          Close
        </button>
      </div>
      {funds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {funds.map((f) => (
            <div key={f.mstar_id}
              onClick={() => onFundClick?.(f.mstar_id)}
              className="bg-white rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:shadow-sm hover:border-teal-300 transition-all">
              <p className="text-[11px] font-medium text-slate-800 truncate">{f.fund_name}</p>
              <div className="flex items-center gap-3 mt-1">
                {f.return_1y != null && (
                  <span className={`text-[10px] font-semibold tabular-nums ${Number(f.return_1y) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Number(f.return_1y) >= 0 ? '+' : ''}{Number(f.return_1y).toFixed(1)}% 1Y
                  </span>
                )}
                {f.return_score != null && (
                  <span className="text-[10px] text-slate-500 tabular-nums">Score {Number(f.return_score).toFixed(0)}</span>
                )}
                {f.aum != null && (
                  <span className="text-[10px] text-slate-400 tabular-nums">{(Number(f.aum) / 1e7).toFixed(0)} Cr</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No funds in this category</p>
      )}
    </div>
  );
}

/* ──────────────── Main Component ──────────────── */

export default function SectorRotation({ sectors, universe, loading, onFundClick }) {
  const router = useRouter();
  const [drillCategory, setDrillCategory] = useState(null);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-6 w-48 rounded mb-4" />
        <SkeletonLoader className="h-[440px] rounded-lg mb-4" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonLoader key={i} className="h-8 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!sectors || sectors.length === 0) return null;

  const normalized = sectors.map((s) => ({
    ...s,
    quadrant: toTitleCase(s.quadrant),
    sector_name: s.sector_name || s.display_name || s.name || 'Unknown',
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Sector & Category Landscape</p>
        <button type="button" onClick={() => router.push('/sectors')}
          className="text-[11px] text-teal-600 font-semibold hover:text-teal-700">
          Explore Sectors →
        </button>
      </div>

      {/* Bubble Chart — full width for maximum impact */}
      <CategoryBubbleChart universe={universe} onCategoryClick={setDrillCategory} />

      {/* Drill-down panel (shows when a bubble is clicked) */}
      {drillCategory && (
        <CategoryDrillDown
          categoryName={drillCategory}
          universe={universe}
          onFundClick={(mstarId) => { router.push(`/fund360?fund=${mstarId}`); }}
          onClose={() => setDrillCategory(null)}
        />
      )}

      {/* Sector Table — below chart */}
      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Morningstar Sector Rotation</p>
        <SectorTable sectors={normalized} />
      </div>

      {/* Playbook — immediately below the table */}
      <PlaybookBar sectors={normalized} />

      {/* Fund Wt explanation */}
      <div className="mt-3 bg-slate-50 rounded-lg px-4 py-2.5">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-700">Bubble chart</span>: X = avg risk score, Y = avg 1Y return, size = fund count, color = return score (green = strong, red = weak). Click any bubble to see funds.{' '}
          <span className="font-semibold text-slate-700">Fund Wt%</span> = average portfolio allocation across {normalized.length > 0 ? '~1,096' : ''} fund holdings.
        </p>
      </div>
    </div>
  );
}
