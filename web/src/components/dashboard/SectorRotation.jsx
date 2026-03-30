import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import SkeletonLoader from '../shared/SkeletonLoader';

const QUADRANT_COLORS = {
  Leading: { dot: '#059669', badge: 'text-emerald-700 bg-emerald-100', bar: '#059669' },
  Improving: { dot: '#0ea5e9', badge: 'text-sky-700 bg-sky-100', bar: '#0ea5e9' },
  Weakening: { dot: '#d97706', badge: 'text-amber-700 bg-amber-100', bar: '#d97706' },
  Lagging: { dot: '#ef4444', badge: 'text-red-600 bg-red-50', bar: '#ef4444' },
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
  if (score >= 75) return 'rgba(5, 150, 105, 0.85)';
  if (score >= 50) return 'rgba(13, 148, 136, 0.80)';
  if (score >= 25) return 'rgba(245, 158, 11, 0.75)';
  return 'rgba(239, 68, 68, 0.80)';
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

function CategoryBubbleChart({ categories, onCategoryClick }) {
  const [hovered, setHovered] = useState(null);

  if (categories.length === 0) return <div className="w-full h-[340px] bg-slate-50 rounded-lg flex items-center justify-center text-xs text-slate-400">No equity category data</div>;

  const W = 480, H = 340;
  const pad = { top: 18, right: 16, bottom: 34, left: 44 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

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
  const scaleR = (count) => 10 + (count / maxCount) * 28;

  return (
    <div className="flex-1 min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 340 }}>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={`h${t}`} x1={pad.left} x2={W - pad.right} y1={pad.top + plotH * t} y2={pad.top + plotH * t} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={`v${t}`} y1={pad.top} y2={H - pad.bottom} x1={pad.left + plotW * t} x2={pad.left + plotW * t} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <line x1={pad.left} x2={W - pad.right} y1={H - pad.bottom} y2={H - pad.bottom} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={H - pad.bottom} stroke="#cbd5e1" strokeWidth="1" />
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500">Risk Score →</text>
        <text x={10} y={H / 2} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="500" transform={`rotate(-90, 10, ${H / 2})`}>1Y Return % →</text>

        {[0, 0.5, 1].map((t) => (
          <text key={`xt${t}`} x={pad.left + plotW * t} y={H - pad.bottom + 13} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {(minRk + (maxRk - minRk) * t).toFixed(0)}
          </text>
        ))}
        {[0, 0.5, 1].map((t) => (
          <text key={`yt${t}`} x={pad.left - 5} y={pad.top + plotH - plotH * t + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {(minR + (maxR - minR) * t).toFixed(0)}%
          </text>
        ))}

        {categories.map((cat) => {
          const cx = scaleX(cat.avgRisk);
          const cy = scaleY(cat.avgReturn);
          const r = scaleR(cat.count);
          const fill = returnScoreColor(cat.avgReturnScore);
          const border = returnScoreBorder(cat.avgReturnScore);
          const isH = hovered === cat.name;
          return (
            <g key={cat.name} onMouseEnter={() => setHovered(cat.name)} onMouseLeave={() => setHovered(null)}
              onClick={() => onCategoryClick?.(cat.originalName)} style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r={r} fill={fill} opacity={isH ? 1 : 0.85}
                stroke={isH ? '#0f172a' : border} strokeWidth={isH ? 2 : 1.5} style={{ transition: 'all 0.15s' }} />
              {(r >= 12 || isH) && (
                <text x={cx} y={cy + 1} textAnchor="middle" fontSize={isH ? '10' : '8'} fontWeight="700"
                  fill="#fff" pointerEvents="none" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {cat.name.length > 10 ? cat.name.slice(0, 9) + '…' : cat.name}
                </text>
              )}
            </g>
          );
        })}

        {hovered && (() => {
          const cat = categories.find((c) => c.name === hovered);
          if (!cat) return null;
          const tx = Math.min(scaleX(cat.avgRisk) + 16, W - 145);
          const ty = Math.max(scaleY(cat.avgReturn) - 10, pad.top);
          return (
            <g>
              <rect x={tx} y={ty - 12} width={140} height={50} rx={6} fill="#0f172a" opacity={0.92} />
              <text x={tx + 7} y={ty + 3} fontSize="10" fontWeight="600" fill="#fff">{cat.name}</text>
              <text x={tx + 7} y={ty + 16} fontSize="9" fill="#94a3b8">{cat.count} funds · Ret {cat.avgReturn?.toFixed(1)}%</text>
              <text x={tx + 7} y={ty + 28} fontSize="9" fill="#94a3b8">Risk {cat.avgRisk?.toFixed(0)} · Score {cat.avgReturnScore?.toFixed(0)}</text>
              <text x={tx + 7} y={ty + 38} fontSize="8" fill="#67e8f9">Click to drill down</text>
            </g>
          );
        })()}
      </svg>
      <div className="flex items-center justify-center gap-3 mt-1">
        {[
          { color: '#059669', label: '75+' },
          { color: '#0d9488', label: '50+' },
          { color: '#f59e0b', label: '25+' },
          { color: '#ef4444', label: '<25' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-slate-500">{label}</span>
          </div>
        ))}
        <span className="text-[9px] text-slate-400">Size = fund count</span>
      </div>
    </div>
  );
}

/* ──────────────── Category Table (clickable rows) ──────────────── */

function CategoryTable({ categories, onCategoryClick }) {
  return (
    <div className="flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: 370 }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
            <th className="text-left py-1.5 px-2 font-semibold">Category</th>
            <th className="text-right py-1.5 px-1 font-semibold">Funds</th>
            <th className="text-right py-1.5 px-1 font-semibold">Avg 1Y</th>
            <th className="text-right py-1.5 px-1 font-semibold">Risk</th>
            <th className="text-right py-1.5 px-1 font-semibold">Score</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const retColor = cat.avgReturn != null ? (cat.avgReturn >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-slate-400';
            return (
              <tr key={cat.name} onClick={() => onCategoryClick?.(cat.originalName)}
                className="border-b border-slate-50 hover:bg-teal-50/50 cursor-pointer transition-colors">
                <td className="py-1.5 px-2 font-medium text-slate-800 text-[11px]">{cat.name}</td>
                <td className="py-1.5 px-1 text-right font-mono tabular-nums text-slate-600 text-[11px]">{cat.count}</td>
                <td className={`py-1.5 px-1 text-right font-mono tabular-nums text-[11px] font-semibold ${retColor}`}>
                  {cat.avgReturn != null ? `${cat.avgReturn >= 0 ? '+' : ''}${cat.avgReturn.toFixed(1)}%` : '--'}
                </td>
                <td className="py-1.5 px-1 text-right font-mono tabular-nums text-slate-600 text-[11px]">
                  {cat.avgRisk != null ? cat.avgRisk.toFixed(0) : '--'}
                </td>
                <td className="py-1.5 px-1 text-right">
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: returnScoreColor(cat.avgReturnScore) }} />
                  <span className="font-mono tabular-nums text-[11px] text-slate-700">{cat.avgReturnScore != null ? cat.avgReturnScore.toFixed(0) : '--'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────── Sector Table (enriched) ──────────────── */

function SectorTable({ sectors }) {
  const sorted = useMemo(() => {
    return [...sectors].sort((a, b) => (b.avg_weight_pct || 0) - (a.avg_weight_pct || 0));
  }, [sectors]);

  const maxWt = Math.max(...sorted.map((s) => Number(s.avg_weight_pct) || 0), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <th className="text-left py-2 px-2 font-semibold">Sector</th>
            <th className="text-left py-2 px-2 font-semibold">Zone</th>
            <th className="text-right py-2 px-1 font-semibold">RS</th>
            <th className="text-right py-2 px-1 font-semibold">1M Mom</th>
            <th className="text-right py-2 px-1 font-semibold">3M Mom</th>
            <th className="text-right py-2 px-1 font-semibold"># Funds</th>
            <th className="py-2 px-2 font-semibold" style={{ minWidth: 100 }}>Fund Weight</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const quadrant = toTitleCase(s.quadrant);
            const config = QUADRANT_COLORS[quadrant] || QUADRANT_COLORS.Improving;
            const mom1 = s.momentum_1m;
            const mom3 = s.momentum_3m;
            const fmtMom = (m) => m != null ? `${m >= 0 ? '+' : ''}${Number(m).toFixed(1)}` : '--';
            const momColor = (m) => m == null ? 'text-slate-400' : m >= 0 ? 'text-emerald-600' : 'text-red-500';
            const wt = Number(s.avg_weight_pct) || 0;
            const wtBarPct = (wt / maxWt) * 100;

            return (
              <tr key={getName(s) || i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                <td className="py-2 px-2 font-medium text-slate-800 text-[12px]">{getName(s)}</td>
                <td className="py-2 px-2">
                  <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded ${config.badge}`}>{quadrant}</span>
                </td>
                <td className="py-2 px-1 text-right font-mono tabular-nums text-slate-700 text-[12px] font-semibold">
                  {s.rs_score != null ? Number(s.rs_score).toFixed(0) : '--'}
                </td>
                <td className={`py-2 px-1 text-right font-mono tabular-nums text-[11px] ${momColor(mom1)}`}>{fmtMom(mom1)}</td>
                <td className={`py-2 px-1 text-right font-mono tabular-nums text-[11px] ${momColor(mom3)}`}>{fmtMom(mom3)}</td>
                <td className="py-2 px-1 text-right font-mono tabular-nums text-slate-600 text-[11px]">
                  {s.fund_count || '--'}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${wtBarPct}%`, backgroundColor: config.bar }} />
                    </div>
                    <span className="font-mono tabular-nums text-[11px] text-slate-700 font-semibold w-[36px] text-right">
                      {wt > 0 ? `${wt.toFixed(1)}%` : '--'}
                    </span>
                  </div>
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
    <div className="mt-3 px-4 py-2.5 rounded-lg border"
      style={{ backgroundColor: '#f0fdfa', borderColor: '#ccfbf1', color: '#0f766e' }}>
      <p className="text-xs leading-relaxed">
        <span className="font-semibold">Playbook:</span>{' '}{parts.join('. ')}.
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
        <p className="text-xs font-semibold text-slate-800">{categoryName} — {funds.length} funds</p>
        <button type="button" onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2 py-0.5 rounded hover:bg-slate-100">Close</button>
      </div>
      {funds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {funds.map((f) => (
            <div key={f.mstar_id} onClick={() => onFundClick?.(f.mstar_id)}
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-6 w-48 rounded mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonLoader className="h-[340px] rounded-lg" />
          <SkeletonLoader className="h-[340px] rounded-lg" />
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

      {/* 2-column: Bubble Chart | Category Table — both clickable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <CategoryBubbleChart categories={categories} onCategoryClick={setDrillCategory} />
        <CategoryTable categories={categories} onCategoryClick={setDrillCategory} />
      </div>

      {/* Drill-down panel */}
      {drillCategory && (
        <CategoryDrillDown
          categoryName={drillCategory}
          universe={universe}
          onFundClick={(mstarId) => { router.push(`/fund360?fund=${mstarId}`); }}
          onClose={() => setDrillCategory(null)}
        />
      )}

      {/* Morningstar Sector Rotation — enriched table */}
      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Morningstar Sector Rotation</p>
        <SectorTable sectors={normalized} />
      </div>

      <PlaybookBar sectors={normalized} />
    </div>
  );
}
