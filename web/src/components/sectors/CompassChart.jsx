/**
 * CompassChart — Sector Rotation Compass.
 * X = RS Score (0-100), Y = RS Momentum (change in RS score).
 * Quadrant dividers at RS=50 (vertical) and Momentum=0 (horizontal).
 *
 * How to read:
 * - Top-right (Leading): High RS + gaining momentum → overweight
 * - Top-left (Improving): Low RS but gaining momentum → early entry
 * - Bottom-right (Weakening): High RS but losing momentum → reduce
 * - Bottom-left (Lagging): Low RS + losing momentum → avoid
 */
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { QUADRANT_COLORS } from '../../lib/sectors';

const QUADRANT_BG = {
  Improving: 'rgba(14,165,233,0.05)',
  Leading: 'rgba(5,150,105,0.05)',
  Lagging: 'rgba(239,68,68,0.04)',
  Weakening: 'rgba(245,158,11,0.04)',
};

const QL_COLOR = {
  Improving: 'rgba(14,165,233,0.5)',
  Leading: 'rgba(5,150,105,0.5)',
  Lagging: 'rgba(239,68,68,0.4)',
  Weakening: 'rgba(245,158,11,0.4)',
};

const BUBBLE_COLORS = {
  Leading: { fill: 'rgba(5,150,105,0.8)', stroke: '#059669' },
  Improving: { fill: 'rgba(14,165,233,0.75)', stroke: '#0ea5e9' },
  Weakening: { fill: 'rgba(245,158,11,0.7)', stroke: '#f59e0b' },
  Lagging: { fill: 'rgba(239,68,68,0.65)', stroke: '#ef4444' },
};

const MARGIN = { top: 32, right: 28, bottom: 44, left: 52 };

// Quadrant dividers: RS=50 (vertical), Momentum=0 (horizontal)
const RS_MID = 50;
const MOM_MID = 0;

export default function CompassChart({
  sectors,
  selectedSector,
  onSectorClick,
  width: rawWidth,
  height = 480,
}) {
  const width = Math.max(400, rawWidth);
  const canvasRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  // Domain: ensure RS=50 and Momentum=0 are always visible and centered
  const xDomain = useMemo(() => {
    if (!sectors.length) return [10, 90];
    const scores = sectors.map((s) => s.rs_score ?? 50);
    const min = Math.min(...scores, RS_MID);
    const max = Math.max(...scores, RS_MID);
    // Symmetric padding around RS_MID=50
    const spread = Math.max(max - RS_MID, RS_MID - min, 15);
    return [RS_MID - spread - 8, RS_MID + spread + 8];
  }, [sectors]);

  const yDomain = useMemo(() => {
    if (!sectors.length) return [-15, 15];
    const moms = sectors.map((s) => s.rs_momentum ?? 0);
    const min = Math.min(...moms, MOM_MID);
    const max = Math.max(...moms, MOM_MID);
    // Symmetric padding around 0
    const spread = Math.max(Math.abs(max), Math.abs(min), 5);
    return [-spread - 5, spread + 5];
  }, [sectors]);

  const xScale = useCallback(
    () => scaleLinear().domain(xDomain).range([MARGIN.left, width - MARGIN.right]),
    [width, xDomain]
  );
  const yScale = useCallback(
    () => scaleLinear().domain(yDomain).range([height - MARGIN.bottom, MARGIN.top]),
    [height, yDomain]
  );

  const getRadius = (s) =>
    Math.max(18, Math.min(34, 14 + Math.sqrt((s.fund_count || 0)) * 0.8));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const x = xScale();
    const y = yScale();
    const midX = x(RS_MID);   // Vertical divider at RS=50
    const midY = y(MOM_MID);  // Horizontal divider at Momentum=0
    const left = MARGIN.left;
    const right = width - MARGIN.right;
    const top = MARGIN.top;
    const bottom = height - MARGIN.bottom;

    // Quadrant backgrounds
    // Top-left: Improving (low RS + positive momentum)
    ctx.fillStyle = QUADRANT_BG.Improving;
    ctx.fillRect(left, top, midX - left, midY - top);
    // Top-right: Leading (high RS + positive momentum)
    ctx.fillStyle = QUADRANT_BG.Leading;
    ctx.fillRect(midX, top, right - midX, midY - top);
    // Bottom-left: Lagging (low RS + negative momentum)
    ctx.fillStyle = QUADRANT_BG.Lagging;
    ctx.fillRect(left, midY, midX - left, bottom - midY);
    // Bottom-right: Weakening (high RS + negative momentum)
    ctx.fillStyle = QUADRANT_BG.Weakening;
    ctx.fillRect(midX, midY, right - midX, bottom - midY);

    // Quadrant dividers
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, top);
    ctx.lineTo(midX, bottom);
    ctx.moveTo(left, midY);
    ctx.lineTo(right, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Divider labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RS = 50', midX, bottom + 12);
    ctx.textAlign = 'right';
    ctx.fillText('Mom = 0', left - 6, midY + 3);

    // Quadrant labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px Inter, sans-serif';
    const qLabels = [
      ['IMPROVING', left + (midX - left) / 2, top + 16, QL_COLOR.Improving],
      ['LEADING', midX + (right - midX) / 2, top + 16, QL_COLOR.Leading],
      ['LAGGING', left + (midX - left) / 2, bottom - 14, QL_COLOR.Lagging],
      ['WEAKENING', midX + (right - midX) / 2, bottom - 14, QL_COLOR.Weakening],
    ];
    for (const [text, lx, ly, color] of qLabels) {
      ctx.fillStyle = color;
      ctx.fillText(text, lx, ly);
    }
    ctx.textBaseline = 'alphabetic';

    // Axis ticks
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const xStep = Math.max(5, Math.round((xDomain[1] - xDomain[0]) / 8));
    for (let v = Math.ceil(xDomain[0] / xStep) * xStep; v <= xDomain[1]; v += xStep) {
      if (Math.abs(v - RS_MID) < xStep / 2) continue; // skip near divider
      ctx.fillText(String(v), x(v), bottom + 12);
    }
    ctx.textAlign = 'right';
    const yStep = Math.max(2, Math.round((yDomain[1] - yDomain[0]) / 6));
    for (let v = Math.ceil(yDomain[0] / yStep) * yStep; v <= yDomain[1]; v += yStep) {
      if (Math.abs(v) < yStep / 2) continue; // skip near divider
      ctx.fillText(String(v), left - 6, y(v) + 3);
    }

    // Axis titles
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('RS Score (Relative Strength) \u2192', (left + right) / 2, height - 2);
    ctx.save();
    ctx.translate(12, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('\u2191 RS Momentum (Score Change)', 0, 0);
    ctx.restore();

    // Draw trail lines (history)
    for (const sector of sectors) {
      const cx = x(sector.rs_score);
      const cy = y(sector.rs_momentum);
      if (sector.history?.length) {
        const colors = BUBBLE_COLORS[sector.quadrant] || BUBBLE_COLORS.Leading;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = colors.stroke;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        let prevX = cx;
        let prevY = cy;
        for (const h of sector.history) {
          const hx = x(h.rs_score);
          const hy = y(h.rs_momentum);
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          // Small dot at historical point
          ctx.beginPath();
          ctx.arc(hx, hy, 3, 0, Math.PI * 2);
          ctx.fillStyle = colors.stroke;
          ctx.fill();
          prevX = hx;
          prevY = hy;
        }
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }
    }

    // Draw bubbles
    for (const sector of sectors) {
      const cx = x(sector.rs_score);
      const cy = y(sector.rs_momentum);
      const r = getRadius(sector);
      const colors = BUBBLE_COLORS[sector.quadrant] || BUBBLE_COLORS.Leading;
      const isHov = hovered?.sector_name === sector.sector_name;
      const isSel = selectedSector?.sector_name === sector.sector_name;
      const drawR = isSel || isHov ? r + 4 : r;

      // Shadow
      if (isHov || isSel) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, drawR, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, drawR, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.fill();

      if (isSel) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Label
      const shortName =
        sector.sector_name.length > 10
          ? sector.sector_name.slice(0, 8) + '..'
          : sector.sector_name;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(8, drawR * 0.36)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortName, cx, cy);
      ctx.textBaseline = 'alphabetic';
    }
  }, [sectors, selectedSector, hovered, width, height, xScale, yScale, xDomain, yDomain]);

  useEffect(() => { draw(); }, [draw]);

  const findNearest = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const x = xScale();
      const y = yScale();
      let best = null;
      let bestDist = 40;
      for (const s of sectors) {
        const r = getRadius(s);
        const dx = x(s.rs_score) - mx;
        const dy = y(s.rs_momentum) - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist && dist < r + 12) {
          bestDist = dist;
          best = s;
        }
      }
      return best;
    },
    [sectors, xScale, yScale]
  );

  const hoveredPos = useMemo(() => {
    if (!hovered || !canvasRef.current) return null;
    const x = xScale();
    const y = yScale();
    const cx = x(hovered.rs_score);
    const cy = y(hovered.rs_momentum);
    const r = getRadius(hovered);
    return { x: cx, y: cy + r + 8 };
  }, [hovered, xScale, yScale]);

  const quadrantColor = BUBBLE_COLORS[hovered?.quadrant] || BUBBLE_COLORS.Leading;

  return (
    <div className="relative w-full" style={{ height }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full" />
      <svg
        className="absolute inset-0 cursor-crosshair w-full"
        width={width}
        height={height}
        onMouseMove={(e) => setHovered(findNearest(e.clientX, e.clientY))}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          const found = findNearest(e.clientX, e.clientY);
          if (found && onSectorClick) onSectorClick(found);
        }}
      />

      {/* Hover tooltip */}
      {hovered && hoveredPos && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: Math.min(Math.max(hoveredPos.x - 110, 8), width - 228),
            top: hoveredPos.y,
          }}
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 w-[220px]">
            <p className="text-xs font-bold text-slate-800 mb-1.5">
              {hovered.sector_name}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-[9px] text-slate-400">RS Score</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: quadrantColor.stroke }}>
                  {hovered.rs_score}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400">Momentum</p>
                <p className="text-sm font-bold tabular-nums"
                  style={{ color: hovered.rs_momentum >= 0 ? quadrantColor.stroke : '#ef4444' }}
                >
                  {hovered.rs_momentum > 0 ? '+' : ''}
                  {Number(hovered.rs_momentum).toFixed(1)}
                </p>
              </div>
            </div>

            {hovered.history?.length > 0 && (
              <div className="mb-2">
                <p className="text-[9px] text-slate-400 mb-1">RS Trend (3M)</p>
                <svg viewBox="0 0 180 30" className="w-full h-6">
                  <polyline
                    points={buildSparkline(hovered)}
                    fill="none"
                    stroke={quadrantColor.stroke}
                    strokeWidth="2"
                  />
                </svg>
              </div>
            )}

            <div
              className="flex items-center gap-1 text-[10px] font-semibold rounded px-2 py-1"
              style={{
                backgroundColor: quadrantColor.fill.replace(/[\d.]+\)$/, '0.1)'),
                color: quadrantColor.stroke,
              }}
            >
              <span>{quadrantIcon(hovered.quadrant)}</span>
              {hovered.quadrant}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function quadrantIcon(q) {
  switch (q) {
    case 'Leading': return '\u25CF';
    case 'Improving': return '\u2197';
    case 'Weakening': return '\u2198';
    case 'Lagging': return '\u25BC';
    default: return '\u25CF';
  }
}

function buildSparkline(sector) {
  const history = sector.history || [];
  const allScores = [...history.map((h) => h.rs_score), sector.rs_score];
  const min = Math.min(...allScores);
  const max = Math.max(...allScores);
  const range = max - min || 1;
  if (allScores.length < 2) return '';
  return allScores
    .map((score, i) => {
      const px = (i / (allScores.length - 1)) * 180;
      const py = 28 - ((score - min) / range) * 26;
      return `${px.toFixed(0)},${py.toFixed(0)}`;
    })
    .join(' ');
}
