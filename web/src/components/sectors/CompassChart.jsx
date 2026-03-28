import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { QUADRANT_COLORS } from '../../lib/sectors';

const QUADRANT_BG = {
  Improving: 'rgba(14,165,233,0.04)',
  Leading: 'rgba(5,150,105,0.04)',
  Lagging: 'rgba(239,68,68,0.03)',
  Weakening: 'rgba(245,158,11,0.03)',
};

const QL_COLOR = { Improving: 'rgba(14,165,233,0.45)', Leading: 'rgba(5,150,105,0.45)', Lagging: 'rgba(239,68,68,0.35)', Weakening: 'rgba(245,158,11,0.35)' };

const BUBBLE_COLORS = {
  Leading: { fill: 'rgba(5,150,105,0.8)', stroke: '#059669' },
  Improving: { fill: 'rgba(14,165,233,0.75)', stroke: '#0ea5e9' },
  Weakening: { fill: 'rgba(245,158,11,0.7)', stroke: '#f59e0b' },
  Lagging: { fill: 'rgba(239,68,68,0.65)', stroke: '#ef4444' },
};

const MARGIN = { top: 28, right: 28, bottom: 36, left: 44 };

export default function CompassChart({
  sectors,
  selectedSector,
  onSectorClick,
  width: rawWidth,
  height = 520,
}) {
  const width = Math.max(400, rawWidth);
  const canvasRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  const xDomain = useMemo(() => {
    if (!sectors.length) return [-20, 25];
    const scores = sectors.map((s) => s.rs_score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 10;
    const pad = range * 0.2;
    return [Math.min(min - pad, -pad), Math.max(max + pad, pad)];
  }, [sectors]);

  const yDomain = useMemo(() => {
    if (!sectors.length) return [-10, 10];
    const moms = sectors.map((s) => s.rs_momentum);
    const min = Math.min(...moms);
    const max = Math.max(...moms);
    const range = max - min || 5;
    const pad = range * 0.25;
    return [Math.min(min - pad, -pad), Math.max(max + pad, pad)];
  }, [sectors]);

  const xScale = useCallback(
    () =>
      scaleLinear()
        .domain(xDomain)
        .range([MARGIN.left, width - MARGIN.right]),
    [width, xDomain]
  );
  const yScale = useCallback(
    () =>
      scaleLinear()
        .domain(yDomain)
        .range([height - MARGIN.bottom, MARGIN.top]),
    [height, yDomain]
  );

  const getRadius = (s) =>
    Math.max(16, Math.min(30, 12 + (s.fund_count || 0) * 0.4));

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
    const midX = x(0);
    const midY = y(0);
    const left = MARGIN.left;
    const right = width - MARGIN.right;
    const top = MARGIN.top;
    const bottom = height - MARGIN.bottom;

    // Quadrant backgrounds
    ctx.fillStyle = QUADRANT_BG.Improving;
    ctx.fillRect(left, top, midX - left, midY - top);
    ctx.fillStyle = QUADRANT_BG.Leading;
    ctx.fillRect(midX, top, right - midX, midY - top);
    ctx.fillStyle = QUADRANT_BG.Lagging;
    ctx.fillRect(left, midY, midX - left, bottom - midY);
    ctx.fillStyle = QUADRANT_BG.Weakening;
    ctx.fillRect(midX, midY, right - midX, bottom - midY);

    // Quadrant dividers
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(midX, top);
    ctx.lineTo(midX, bottom);
    ctx.moveTo(left, midY);
    ctx.lineTo(right, midY);
    ctx.stroke();

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

    // Axis ticks + labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const xStep = Math.max(5, Math.round((xDomain[1] - xDomain[0]) / 6));
    for (let v = Math.ceil(xDomain[0] / xStep) * xStep; v <= xDomain[1]; v += xStep) ctx.fillText(String(v), x(v), bottom + 14);
    ctx.textAlign = 'right';
    const yStep = Math.max(1, Math.round((yDomain[1] - yDomain[0]) / 6));
    for (let v = Math.ceil(yDomain[0] / yStep) * yStep; v <= yDomain[1]; v += yStep) ctx.fillText(String(v), left - 6, y(v) + 3);
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RS Score \u2192', (left + right) / 2, height - 2);
    ctx.save();
    ctx.translate(10, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('RS Momentum \u2192', 0, 0);
    ctx.restore();

    // Draw trail lines
    for (const sector of sectors) {
      const cx = x(sector.rs_score);
      const cy = y(sector.rs_momentum);
      if (sector.history?.length) {
        const colors = BUBBLE_COLORS[sector.quadrant] || BUBBLE_COLORS.Leading;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = colors.stroke;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        let prevX = cx;
        let prevY = cy;
        for (const h of sector.history) {
          const hx = x(h.rs_score);
          const hy = y(h.rs_momentum);
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(hx, hy);
          ctx.stroke();
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
      const isHovered = hovered?.sector_name === sector.sector_name;
      const isSelected = selectedSector?.sector_name === sector.sector_name;
      const drawR = isSelected || isHovered ? r + 4 : r;

      // Shadow for hovered/selected
      if (isHovered || isSelected) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
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

      if (isSelected) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Bubble label
      const shortName =
        sector.sector_name.length > 8
          ? sector.sector_name.slice(0, 6) + '..'
          : sector.sector_name;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(7, drawR * 0.4)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortName, cx, cy);
      ctx.textBaseline = 'alphabetic';
    }
  }, [sectors, selectedSector, hovered, width, height, xScale, yScale, xDomain, yDomain]);

  useEffect(() => {
    draw();
  }, [draw]);

  const findNearest = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const x = xScale();
      const y = yScale();
      let best = null;
      let bestDist = 35;
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
      return best ? { sector: best, x: mx, y: my } : null;
    },
    [sectors, xScale, yScale]
  );

  const handleMouseMove = (e) => {
    const result = findNearest(e.clientX, e.clientY);
    setHovered(result ? result.sector : null);
  };

  const handleClick = (e) => {
    const result = findNearest(e.clientX, e.clientY);
    if (result && onSectorClick) onSectorClick(result.sector);
  };

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
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClick}
      />

      {/* Hover expand card (matching mockup) */}
      {hovered && hoveredPos && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: Math.min(
              Math.max(hoveredPos.x - 110, 8),
              width - 228
            ),
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
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{ color: quadrantColor.stroke }}
                >
                  {hovered.rs_score}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400">Momentum</p>
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{
                    color:
                      hovered.rs_momentum >= 0
                        ? quadrantColor.stroke
                        : '#ef4444',
                  }}
                >
                  {hovered.rs_momentum > 0 ? '+' : ''}
                  {Number(hovered.rs_momentum).toFixed(1)}
                </p>
              </div>
            </div>

            {/* Mini sparkline */}
            {hovered.history?.length > 0 && (
              <div className="mb-2">
                <p className="text-[9px] text-slate-400 mb-1">
                  RS Trend (3M)
                </p>
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
                backgroundColor: quadrantColor.fill.replace(
                  /[\d.]+\)$/,
                  '0.1)'
                ),
                color: quadrantColor.stroke,
              }}
            >
              <span>{quadrantIcon(hovered.quadrant)}</span>
              {hovered.quadrant}
              {hovered.action && ` \u00B7 ${hovered.action}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function quadrantIcon(q) {
  switch (q) {
    case 'Leading':
      return '\u25CF';
    case 'Improving':
      return '\u2197';
    case 'Weakening':
      return '\u2198';
    case 'Lagging':
      return '\u25BC';
    default:
      return '\u25CF';
  }
}

function buildSparkline(sector) {
  const points = [];
  const history = sector.history || [];
  const allScores = [...history.map((h) => h.rs_score), sector.rs_score];
  const min = Math.min(...allScores);
  const max = Math.max(...allScores);
  const range = max - min || 1;
  const count = allScores.length;
  if (count < 2) return '';
  allScores.forEach((score, i) => {
    const px = (i / (count - 1)) * 180;
    const py = 28 - ((score - min) / range) * 26;
    points.push(`${px.toFixed(0)},${py.toFixed(0)}`);
  });
  return points.join(' ');
}
