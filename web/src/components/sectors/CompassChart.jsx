import { useRef, useState, useCallback, useEffect } from 'react';
import { scaleLinear } from 'd3-scale';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { momentumColor } from '../../lib/lens';

const QUADRANT_BG = {
  Leading: 'rgba(5,150,105,0.06)',
  Improving: 'rgba(20,184,166,0.06)',
  Weakening: 'rgba(245,158,11,0.06)',
  Lagging: 'rgba(220,38,38,0.06)',
};

const QUADRANT_LABEL_COLOR = {
  Leading: 'rgba(5,150,105,0.45)',
  Improving: 'rgba(20,184,166,0.45)',
  Weakening: 'rgba(245,158,11,0.45)',
  Lagging: 'rgba(220,38,38,0.45)',
};

const MARGIN = { top: 32, right: 32, bottom: 40, left: 48 };

export default function CompassChart({
  sectors,
  selectedSector,
  onSectorClick,
  width: rawWidth,
  height = 480,
}) {
  const width = Math.max(400, rawWidth);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const animFrameRef = useRef(null);
  const [pulsePhase, setPulsePhase] = useState(0);

  const xScale = useCallback(
    () => scaleLinear().domain([0, 100]).range([MARGIN.left, width - MARGIN.right]),
    [width]
  );
  const yScale = useCallback(
    () => scaleLinear().domain([-20, 20]).range([height - MARGIN.bottom, MARGIN.top]),
    [height]
  );

  const getRadius = (s) => Math.max(8, Math.min(22, 4 + (s.fund_count || 0) * 0.4));

  // Pulse animation for selected sector
  useEffect(() => {
    if (!selectedSector) {
      setPulsePhase(0);
      return;
    }
    let running = true;
    let phase = 0;
    const animate = () => {
      if (!running) return;
      phase = (phase + 0.03) % (Math.PI * 2);
      setPulsePhase(phase);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [selectedSector]);

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
    const midX = x(50);
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
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, top);
    ctx.lineTo(midX, bottom);
    ctx.moveTo(left, midY);
    ctx.lineTo(right, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Quadrant labels — LARGE, bold, positioned in corners
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelOffsetX = (right - left) * 0.25;
    const labelOffsetY = (bottom - top) * 0.12;

    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillStyle = QUADRANT_LABEL_COLOR.Improving;
    ctx.fillText('Improving', left + labelOffsetX, top + labelOffsetY);
    ctx.fillStyle = QUADRANT_LABEL_COLOR.Leading;
    ctx.fillText('Leading', right - labelOffsetX, top + labelOffsetY);
    ctx.fillStyle = QUADRANT_LABEL_COLOR.Lagging;
    ctx.fillText('Lagging', left + labelOffsetX, bottom - labelOffsetY);
    ctx.fillStyle = QUADRANT_LABEL_COLOR.Weakening;
    ctx.fillText('Weakening', right - labelOffsetX, bottom - labelOffsetY);

    // Reset baseline
    ctx.textBaseline = 'alphabetic';

    // Axes ticks
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (const v of [0, 25, 50, 75, 100]) {
      const px = x(v);
      ctx.fillText(String(v), px, bottom + 16);
    }
    ctx.textAlign = 'right';
    for (const v of [-20, -10, 0, 10, 20]) {
      const py = y(v);
      ctx.fillText(String(v), left - 8, py + 3);
    }

    // Axis labels
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RS Score', (left + right) / 2, height - 2);
    ctx.save();
    ctx.translate(14, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('RS Momentum', 0, 0);
    ctx.restore();

    // Historical trails + sectors
    for (const sector of sectors) {
      const cx = x(sector.rs_score);
      const cy = y(sector.rs_momentum);
      const r = getRadius(sector);
      const color = momentumColor(sector.rs_momentum);
      const isSelected = selectedSector?.sector_name === sector.sector_name;

      // Trail
      if (sector.history?.length) {
        const trailColor = QUADRANT_COLORS[sector.quadrant]?.circle || '#64748b';
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = trailColor;
        ctx.globalAlpha = 0.5;
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
          ctx.beginPath();
          ctx.arc(hx, hy, r * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = trailColor;
          ctx.fill();
          prevX = hx;
          prevY = hy;
        }
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      }

      // Selected sector glow ring (animated pulse)
      if (isSelected) {
        const pulseRadius = r + 6 + Math.sin(pulsePhase) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3 + Math.sin(pulsePhase) * 0.15;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Outer glow
        const gradient = ctx.createRadialGradient(cx, cy, r, cx, cy, pulseRadius + 4);
        gradient.addColorStop(0, color + '30');
        gradient.addColorStop(1, color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main circle — slightly larger for selected
      const drawR = isSelected ? r + 3 : r;
      ctx.beginPath();
      ctx.arc(cx, cy, drawR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Text inside bubble
      const shortName =
        sector.sector_name.length > 10
          ? sector.sector_name.slice(0, 8) + '..'
          : sector.sector_name;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(8, drawR * 0.55)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortName, cx, cy - 4);
      ctx.font = `${Math.max(7, drawR * 0.45)}px Inter, sans-serif`;
      ctx.fillText(
        (sector.rs_momentum > 0 ? '+' : '') + sector.rs_momentum.toFixed(1),
        cx,
        cy + 6
      );

      // External label for larger bubbles or selected
      if (isSelected || r >= 14) {
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(sector.sector_name, cx, cy + drawR + 4);
        ctx.textBaseline = 'alphabetic';
      }
    }

    ctx.textBaseline = 'alphabetic';
  }, [sectors, selectedSector, width, height, xScale, yScale, pulsePhase]);

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
      let bestDist = 25;
      for (const s of sectors) {
        const dx = x(s.rs_score) - mx;
        const dy = y(s.rs_momentum) - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
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
    setTooltip(result);
  };

  const handleClick = (e) => {
    const result = findNearest(e.clientX, e.clientY);
    if (result && onSectorClick) onSectorClick(result.sector);
  };

  const quadrantLabel = tooltip?.sector?.quadrant || '';

  return (
    <div className="relative w-full" style={{ height }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full" />
      <svg
        ref={overlayRef}
        className="absolute inset-0 cursor-crosshair w-full"
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-white px-3 py-2 shadow-lg border border-slate-200 text-xs"
          style={{
            left: Math.min(tooltip.x + 14, width - 180),
            top: tooltip.y - 10,
          }}
        >
          <p className="font-semibold text-slate-800">{tooltip.sector.sector_name}</p>
          <p className="font-mono tabular-nums text-slate-600">
            RS: {tooltip.sector.rs_score} &middot; Momentum: {tooltip.sector.rs_momentum > 0 ? '+' : ''}
            {tooltip.sector.rs_momentum}
          </p>
          {tooltip.sector.rs_rank != null && (
            <p className="font-mono tabular-nums text-slate-500">
              Rank: #{tooltip.sector.rs_rank}
            </p>
          )}
          <span
            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
              QUADRANT_COLORS[quadrantLabel]?.badge || 'bg-slate-100 text-slate-600'
            }`}
          >
            {quadrantLabel}
          </span>
          <p className="text-slate-500 mt-0.5">{tooltip.sector.fund_count} funds</p>
        </div>
      )}
    </div>
  );
}
