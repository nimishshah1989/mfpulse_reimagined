import { useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import SkeletonLoader from '../shared/SkeletonLoader';
import SectionTitle from '../shared/SectionTitle';

const QUADRANT_CONFIG = {
  Leading: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-100',
    badge: 'text-emerald-600 bg-emerald-100',
    scoreColor: 'text-emerald-600',
  },
  Improving: {
    dot: 'bg-sky-500',
    bg: 'bg-sky-50/50',
    border: 'border-sky-100',
    badge: 'text-sky-600 bg-sky-100',
    scoreColor: 'text-sky-600',
  },
  Weakening: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50/50',
    border: 'border-amber-100',
    badge: 'text-amber-600 bg-amber-100',
    scoreColor: 'text-red-500',
  },
  Lagging: {
    dot: 'bg-red-400',
    bg: '',
    border: '',
    badge: 'text-red-500 bg-red-50',
    scoreColor: 'text-red-500',
  },
};

function toTitleCase(str) {
  if (!str) return 'Improving';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function MiniCompass({ sectors }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sectors || sectors.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Background quadrants
    const quadColors = [
      ['rgba(16,185,129,0.06)', 'Leading'],    // top-right
      ['rgba(14,165,233,0.06)', 'Improving'],   // bottom-right
      ['rgba(245,158,11,0.06)', 'Weakening'],   // top-left
      ['rgba(239,68,68,0.06)', 'Lagging'],      // bottom-left
    ];

    // Top-right (Leading)
    ctx.fillStyle = quadColors[0][0];
    ctx.fillRect(cx, 0, cx, cy);
    // Bottom-right (Improving)
    ctx.fillStyle = quadColors[1][0];
    ctx.fillRect(cx, cy, cx, cy);
    // Top-left (Weakening)
    ctx.fillStyle = quadColors[2][0];
    ctx.fillRect(0, 0, cx, cy);
    // Bottom-left (Lagging)
    ctx.fillStyle = quadColors[3][0];
    ctx.fillRect(0, cy, cx, cy);

    // Axes
    ctx.strokeStyle = 'rgba(148,163,184,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.font = '9px Inter, system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('RS Score \u2192', W - 35, cy - 6);
    ctx.save();
    ctx.translate(cx + 6, 15);
    ctx.fillText('Momentum \u2191', 0, 0);
    ctx.restore();

    // Quadrant labels
    ctx.font = '8px Inter, system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Leading', cx + cx / 2, 14);
    ctx.fillText('Improving', cx + cx / 2, H - 6);
    ctx.fillText('Weakening', cx / 2, 14);
    ctx.fillText('Lagging', cx / 2, H - 6);

    // Plot sectors
    const maxRS = 100;
    const maxMom = 10;

    sectors.forEach((s) => {
      const rs = s.rs_score || 50;
      const mom = s.momentum || 0;
      const x = cx + ((rs - 50) / 50) * (cx - 20);
      const y = cy - (mom / maxMom) * (cy - 20);

      const quadrant = toTitleCase(s.quadrant);
      let color = '#059669';
      if (quadrant === 'Improving') color = '#0ea5e9';
      if (quadrant === 'Weakening') color = '#f59e0b';
      if (quadrant === 'Lagging') color = '#ef4444';

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      const name = s.display_name || s.sector_name || s.name || '';
      if (name) {
        ctx.font = '9px Inter, system-ui';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, y - 9);
      }
    });
  }, [sectors]);

  return (
    <div className="relative w-full aspect-square max-w-[240px] mx-auto mb-4">
      <canvas ref={canvasRef} width={240} height={240} className="w-full h-full" />
    </div>
  );
}

function SectorRow({ sector }) {
  const quadrant = toTitleCase(sector.quadrant);
  const config = QUADRANT_CONFIG[quadrant] || QUADRANT_CONFIG.Improving;
  const displayName = sector.display_name || sector.sector_name || sector.name || '';
  const mom = sector.momentum;
  const momStr = mom != null ? `${mom >= 0 ? '+' : ''}${Number(mom).toFixed(1)}` : '--';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg} ${config.border ? `border ${config.border}` : 'hover:bg-slate-50'}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className="text-xs font-medium text-slate-700 flex-1">{displayName}</span>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${config.badge}`}>
        {quadrant}
      </span>
      <span className={`text-xs font-semibold tabular-nums ${config.scoreColor}`}>
        {momStr}
      </span>
    </div>
  );
}

function RotationPlaybook({ sectors }) {
  if (!sectors || sectors.length === 0) return null;

  const byQuadrant = (q) => sectors
    .filter((s) => toTitleCase(s.quadrant) === q)
    .sort((a, b) => (b.rs_score || 0) - (a.rs_score || 0))
    .slice(0, 3)
    .map((s) => s.display_name || s.sector_name || s.name)
    .filter(Boolean);

  const leading = byQuadrant('Leading');
  const improving = byQuadrant('Improving');
  const weakening = byQuadrant('Weakening');

  const entries = [];
  if (leading.length > 0) entries.push({ color: 'text-emerald-700', label: 'Overweight', names: leading.join(', ') });
  if (improving.length > 0) entries.push({ color: 'text-sky-700', label: 'Watch', names: improving.join(', ') });
  if (weakening.length > 0) entries.push({ color: 'text-amber-700', label: 'Reduce', names: weakening.join(', ') });

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 p-3 rounded-lg bg-teal-50 border border-teal-100">
      <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider mb-2">
        Rotation Playbook
      </p>
      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.label} className="flex items-start gap-2">
            <span className={`text-[10px] font-bold ${e.color} w-16 flex-shrink-0`}>{e.label}</span>
            <span className="text-[11px] text-slate-700 leading-snug">{e.names}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SectorSnapshot({ sectors, loading }) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="space-y-3">
          <SkeletonLoader className="h-[240px] rounded-lg" />
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonLoader key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!sectors || sectors.length === 0) return null;

  // Normalize quadrant casing
  const normalized = sectors.map((s) => ({
    ...s,
    quadrant: toTitleCase(s.quadrant),
    sector_name: s.sector_name || s.display_name || s.name || 'Unknown',
  }));

  // Sort by RS score descending
  const sortedSectors = [...normalized].sort((a, b) => (b.rs_score || 0) - (a.rs_score || 0));
  const topSectors = sortedSectors.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Sector Rotation</p>
        <button
          type="button"
          onClick={() => router.push('/sectors')}
          className="text-[10px] text-teal-600 font-medium hover:text-teal-700"
        >
          Full Compass &rarr;
        </button>
      </div>

      {/* Mini Compass */}
      <MiniCompass sectors={normalized} />

      {/* Sector list */}
      <div className="space-y-2">
        {topSectors.map((sector, idx) => (
          <SectorRow key={sector.display_name || sector.sector_name || idx} sector={sector} />
        ))}
      </div>

      {/* Rotation playbook */}
      <RotationPlaybook sectors={normalized} />
    </div>
  );
}
