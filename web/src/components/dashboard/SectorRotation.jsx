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

/* Alpha score → color gradient */
function alphaColor(score) {
  if (score == null) return '#94a3b8';
  if (score >= 70) return '#059669';
  if (score >= 55) return '#10b981';
  if (score >= 40) return '#0ea5e9';
  if (score >= 25) return '#f59e0b';
  return '#ef4444';
}

/* ──────────────── Category Bubble Chart (SVG) ──────────────── */

function CategoryBubbleChart({ universe }) {
  const [hovered, setHovered] = useState(null);

  const categories = useMemo(() => {
    if (!universe || universe.length === 0) return [];
    const grouped = {};
    universe.forEach((f) => {
      const cat = f.category_name;
      if (!cat) return;
      if (!grouped[cat]) grouped[cat] = { returns: [], risks: [], alphas: [], count: 0 };
      grouped[cat].count += 1;
      if (f.return_1y != null) grouped[cat].returns.push(Number(f.return_1y));
      if (f.risk_score != null) grouped[cat].risks.push(Number(f.risk_score));
      if (f.alpha_score != null) grouped[cat].alphas.push(Number(f.alpha_score));
    });

    const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return Object.entries(grouped)
      .filter(([, d]) => d.count >= 10 && d.returns.length > 0 && d.risks.length > 0)
      .map(([name, d]) => ({
        name: name.replace(/ Fund$/, '').replace(/Equity - /, ''),
        count: d.count,
        avgReturn: avg(d.returns),
        avgRisk: avg(d.risks),
        avgAlpha: avg(d.alphas),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 18);
  }, [universe]);

  if (categories.length === 0) return <div className="w-full h-[320px] bg-slate-50 rounded-lg" />;

  const W = 520, H = 320;
  const pad = { top: 28, right: 20, bottom: 36, left: 48 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const returns = categories.map((c) => c.avgReturn).filter(Boolean);
  const risks = categories.map((c) => c.avgRisk).filter(Boolean);
  const minR = Math.min(...returns) - 2, maxR = Math.max(...returns) + 2;
  const minRk = Math.min(...risks) - 5, maxRk = Math.max(...risks) + 5;
  const maxCount = Math.max(...categories.map((c) => c.count));

  const scaleX = (rk) => pad.left + ((rk - minRk) / (maxRk - minRk)) * plotW;
  const scaleY = (ret) => pad.top + plotH - ((ret - minR) / (maxR - minR)) * plotH;
  const scaleR = (count) => 6 + (count / maxCount) * 24;

  return (
    <div className="flex-1 min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 320 }}>
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
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500">
          Risk Score →
        </text>
        <text x={14} y={H / 2} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500"
          transform={`rotate(-90, 14, ${H / 2})`}>
          Return 1Y % →
        </text>

        {/* Bubbles */}
        {categories.map((cat) => {
          const cx = scaleX(cat.avgRisk);
          const cy = scaleY(cat.avgReturn);
          const r = scaleR(cat.count);
          const fill = alphaColor(cat.avgAlpha);
          const isHovered = hovered === cat.name;
          return (
            <g key={cat.name} onMouseEnter={() => setHovered(cat.name)} onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}>
              <circle cx={cx} cy={cy} r={r} fill={fill} opacity={isHovered ? 0.95 : 0.7}
                stroke={isHovered ? '#0f172a' : '#fff'} strokeWidth={isHovered ? 2 : 1}
                style={{ transition: 'all 0.15s' }} />
              {(r >= 12 || isHovered) && (
                <text x={cx} y={cy + 1} textAnchor="middle" fontSize={isHovered ? '10' : '8'} fontWeight="600"
                  fill="#fff" pointerEvents="none">
                  {cat.name.length > 10 ? cat.name.slice(0, 8) + '…' : cat.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {hovered && (() => {
          const cat = categories.find((c) => c.name === hovered);
          if (!cat) return null;
          const tx = Math.min(scaleX(cat.avgRisk) + 20, W - 140);
          const ty = Math.max(scaleY(cat.avgReturn) - 10, pad.top);
          return (
            <g>
              <rect x={tx} y={ty - 12} width={130} height={50} rx={6} fill="#0f172a" opacity={0.92} />
              <text x={tx + 8} y={ty + 4} fontSize="11" fontWeight="600" fill="#fff">{cat.name}</text>
              <text x={tx + 8} y={ty + 18} fontSize="10" fill="#94a3b8">
                {cat.count} funds · Ret {cat.avgReturn?.toFixed(1)}%
              </text>
              <text x={tx + 8} y={ty + 30} fontSize="10" fill="#94a3b8">
                Risk {cat.avgRisk?.toFixed(0)} · Alpha {cat.avgAlpha?.toFixed(0)}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1">
        <span className="text-[10px] text-slate-500 font-medium">Alpha Score:</span>
        {[
          { color: '#059669', label: 'High' },
          { color: '#0ea5e9', label: 'Med' },
          { color: '#f59e0b', label: 'Low' },
          { color: '#ef4444', label: 'Weak' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
        <span className="text-[10px] text-slate-400 ml-2">Bubble size = fund count</span>
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

/* ──────────────── Main Component ──────────────── */

export default function SectorRotation({ sectors, universe, loading }) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-6 w-48 rounded mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonLoader className="h-[320px] rounded-lg" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonLoader key={i} className="h-8 rounded" />
            ))}
          </div>
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

      {/* 2-column: Bubble Chart | Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <CategoryBubbleChart universe={universe} />
        <SectorTable sectors={normalized} />
      </div>

      {/* Fund Wt explanation */}
      <div className="mt-3 bg-slate-50 rounded-lg px-4 py-2.5">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-700">Fund Wt%</span> shows the average portfolio allocation that mutual funds hold in each sector.
          Higher weight = more institutional capital concentrated in that sector. Sorted by weight to show where fund managers have the most conviction.
        </p>
      </div>

      {/* Playbook */}
      <PlaybookBar sectors={normalized} />
    </div>
  );
}
