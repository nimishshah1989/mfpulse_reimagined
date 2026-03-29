import { useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import SkeletonLoader from '../shared/SkeletonLoader';

const QUADRANT_COLORS = {
  Leading: { dot: '#059669', badge: 'text-emerald-700 bg-emerald-100', text: 'text-emerald-600' },
  Improving: { dot: '#0ea5e9', badge: 'text-sky-700 bg-sky-100', text: 'text-sky-600' },
  Weakening: { dot: '#d97706', badge: 'text-amber-700 bg-amber-100', text: 'text-amber-600' },
  Lagging: { dot: '#ef4444', badge: 'text-red-600 bg-red-50', text: 'text-red-500' },
};

function toTitleCase(str) {
  if (!str) return 'Improving';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getName(s) {
  return s.display_name || s.sector_name || s.name || '';
}

/* ──────────────── Compass (280×280 canvas) ──────────────── */

function Compass({ sectors }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sectors || sectors.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const SIZE = 280;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // Quadrant backgrounds
    ctx.fillStyle = 'rgba(245,158,11,0.05)';  // top-left  Weakening
    ctx.fillRect(0, 0, cx, cy);
    ctx.fillStyle = 'rgba(16,185,129,0.06)';  // top-right Leading
    ctx.fillRect(cx, 0, cx, cy);
    ctx.fillStyle = 'rgba(239,68,68,0.04)';   // bot-left  Lagging
    ctx.fillRect(0, cy, cx, cy);
    ctx.fillStyle = 'rgba(14,165,233,0.05)';  // bot-right Improving
    ctx.fillRect(cx, cy, cx, cy);

    // Crosshair
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, SIZE);
    ctx.moveTo(0, cy); ctx.lineTo(SIZE, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Quadrant labels (9px)
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#059669';
    ctx.fillText('Leading', cx + cx / 2, 14);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillText('Improving', cx + cx / 2, SIZE - 6);
    ctx.fillStyle = '#d97706';
    ctx.fillText('Weakening', cx / 2, 14);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Lagging', cx / 2, SIZE - 6);

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('RS Score \u2192', SIZE - 6, cy - 6);
    ctx.textAlign = 'center';
    ctx.fillText('Momentum \u2191', cx + 2, 26);

    // Padding inside the compass for dot placement
    const pad = 28;
    const plotW = SIZE - pad * 2;
    const plotH = SIZE - pad * 2;

    // Plot dots
    sectors.forEach((s) => {
      const rs = Math.max(0, Math.min(100, s.rs_score ?? 50));
      const mom = Math.max(-5, Math.min(5, s.momentum_1m ?? 0));

      const x = pad + (rs / 100) * plotW;
      const y = pad + ((5 - mom) / 10) * plotH; // +5 at top, -5 at bottom

      const quadrant = toTitleCase(s.quadrant);
      const color = QUADRANT_COLORS[quadrant]?.dot || '#94a3b8';

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      const name = getName(s);
      if (name) {
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, y - 9);
      }
    });
  }, [sectors]);

  return (
    <canvas
      ref={canvasRef}
      className="block flex-shrink-0"
      style={{ width: 280, height: 280 }}
    />
  );
}

/* ──────────────── Sector Table ──────────────── */

function SectorTable({ sectors }) {
  return (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <th className="text-left py-2 px-2 font-medium">Sector</th>
            <th className="text-left py-2 px-2 font-medium">Quadrant</th>
            <th className="text-right py-2 px-2 font-medium">RS Score</th>
            <th className="text-right py-2 px-2 font-medium">Momentum</th>
            <th className="text-right py-2 px-2 font-medium">Fund Wt%</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s, i) => {
            const quadrant = toTitleCase(s.quadrant);
            const config = QUADRANT_COLORS[quadrant] || QUADRANT_COLORS.Improving;
            const mom = s.momentum_1m;
            const momStr = mom != null ? `${mom >= 0 ? '+' : ''}${Number(mom).toFixed(1)}` : '--';
            const wt = s.avg_weight_pct;
            const wtStr = wt != null ? `${Number(wt).toFixed(1)}%` : '--';

            return (
              <tr
                key={getName(s) || i}
                className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
              >
                <td className="py-2 px-2 font-medium text-slate-700">{getName(s)}</td>
                <td className="py-2 px-2">
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${config.badge}`}>
                    {quadrant}
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                  {s.rs_score != null ? Number(s.rs_score).toFixed(0) : '--'}
                </td>
                <td className={`py-2 px-2 text-right font-mono tabular-nums ${mom >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {momStr}
                </td>
                <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600">
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

export default function SectorRotation({ sectors, loading }) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-6 w-48 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
          <SkeletonLoader className="h-[280px] rounded-lg" />
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

  const sorted = [...normalized].sort((a, b) => (b.rs_score || 0) - (a.rs_score || 0));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Sector Rotation</p>
        <button
          type="button"
          onClick={() => router.push('/sectors')}
          className="text-[10px] text-teal-600 font-medium hover:text-teal-700"
        >
          Explore Sectors &rarr;
        </button>
      </div>

      {/* 2-column: Compass | Table */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
        <Compass sectors={normalized} />
        <SectorTable sectors={sorted} />
      </div>

      {/* Playbook */}
      <PlaybookBar sectors={normalized} />
    </div>
  );
}
