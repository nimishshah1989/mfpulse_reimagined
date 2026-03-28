import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { quadtree } from 'd3-quadtree';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { lensColor, LENS_LABELS } from '../../lib/lens';

function getBubbleColor(lensScore) {
  return lensColor(Number(lensScore) || 0);
}

function getRadius(aum) {
  const a = Number(aum) || 0;
  if (a <= 0) return 3;
  const logAum = Math.log10(a + 1);
  return Math.max(3, Math.min(30, logAum * 5));
}

function findClosestPoint(qt, mx, my, xScale, yScale, transformK) {
  let closest = null;
  let closestDist = Infinity;

  qt.visit((node) => {
    if (!node.length) {
      let d = node;
      do {
        const dx = xScale(d.data.x) - mx;
        const dy = yScale(d.data.y) - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < d.data.r / transformK + 5 && dist < closestDist) {
          closestDist = dist;
          closest = d.data;
        }
        d = d.next;
      } while (d);
    }
    return false;
  });

  return closest;
}

const QUADRANT_LABELS = [
  { text: 'Sweet Spot', x: 'right', y: 'top', color: '#059669' },
  { text: 'High Risk / High Return', x: 'left', y: 'top', color: '#0369a1' },
  { text: 'Low Return / Low Risk', x: 'right', y: 'bottom', color: '#0369a1' },
  { text: 'Avoid Zone', x: 'left', y: 'bottom', color: '#dc2626' },
];

export default function BubbleScatter({
  data,
  xAxis,
  yAxis,
  colorLens,
  onFundClick,
  onHover,
  width,
  height,
  selectedTier,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredFund, setHoveredFund] = useState(null);
  const [transform, setTransform] = useState(zoomIdentity);
  const quadtreeRef = useRef(null);
  const animRef = useRef(null);
  const prevPositions = useRef(new Map());

  const margin = { top: 40, right: 40, bottom: 55, left: 65 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = useMemo(
    () => scaleLinear().domain([0, 100]).range([0, innerW]),
    [innerW]
  );
  const yScale = useMemo(
    () => scaleLinear().domain([0, 100]).range([innerH, 0]),
    [innerH]
  );

  const positions = useMemo(() => {
    const activeLens = colorLens || xAxis;
    return data.map((d) => ({
      id: d.mstar_id,
      x: Number(d[xAxis]) || 0,
      y: Number(d[yAxis]) || 0,
      r: getRadius(d.aum),
      color: getBubbleColor(d[activeLens]),
      fund: d,
    }));
  }, [data, xAxis, yAxis, colorLens]);

  // Build quadtree for hit detection
  useEffect(() => {
    quadtreeRef.current = quadtree()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .addAll(positions);
  }, [positions, xScale, yScale]);

  // Canvas draw
  const draw = useCallback(
    (currentTransform, pts) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(margin.left, margin.top);

      // Zoom transform
      ctx.save();
      ctx.translate(currentTransform.x, currentTransform.y);
      ctx.scale(currentTransform.k, currentTransform.k);

      // Quadrant zone shading
      const x50 = xScale(50);
      const y50 = yScale(50);

      // Top-right: sweet spot -- green tint
      ctx.fillStyle = 'rgba(5, 150, 105, 0.06)';
      ctx.fillRect(x50, 0, innerW - x50, y50);

      // Bottom-left: avoid zone -- red tint
      ctx.fillStyle = 'rgba(220, 38, 38, 0.06)';
      ctx.fillRect(0, y50, x50, innerH - y50);

      // Top-left: high risk high return -- blue tint
      ctx.fillStyle = 'rgba(3, 105, 161, 0.03)';
      ctx.fillRect(0, 0, x50, y50);

      // Bottom-right: low return low risk -- blue tint
      ctx.fillStyle = 'rgba(3, 105, 161, 0.03)';
      ctx.fillRect(x50, y50, innerW - x50, innerH - y50);

      // Grid at 25, 50, 75
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.5 / currentTransform.k;
      for (const v of [25, 50, 75]) {
        ctx.beginPath();
        ctx.moveTo(xScale(v), 0);
        ctx.lineTo(xScale(v), innerH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, yScale(v));
        ctx.lineTo(innerW, yScale(v));
        ctx.stroke();
      }

      // Quadrant lines at 50 (dashed, stronger)
      ctx.setLineDash([4 / currentTransform.k, 4 / currentTransform.k]);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.8 / currentTransform.k;
      ctx.beginPath();
      ctx.moveTo(xScale(50), 0);
      ctx.lineTo(xScale(50), innerH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, yScale(50));
      ctx.lineTo(innerW, yScale(50));
      ctx.stroke();
      ctx.setLineDash([]);

      // Bubbles
      for (const pt of pts) {
        const r = pt.r / currentTransform.k;
        const dimmed = selectedTier && pt.fund._tierLabel !== selectedTier;

        ctx.beginPath();
        ctx.arc(xScale(pt.x), yScale(pt.y), r, 0, 2 * Math.PI);

        if (dimmed) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 0.4 / currentTransform.k;
          ctx.stroke();
        } else {
          ctx.fillStyle = pt.color;
          ctx.fill();
          ctx.strokeStyle = pt.color.replace(/[\d.]+\)$/, '1)');
          ctx.lineWidth = 0.8 / currentTransform.k;
          ctx.stroke();
        }
      }
      ctx.restore();

      // Quadrant labels OUTSIDE chart area (in margins)
      ctx.font = 'bold 13px Inter, sans-serif';
      // Sweet Spot -- top right margin
      ctx.fillStyle = '#059669';
      ctx.textAlign = 'right';
      ctx.fillText('Sweet Spot', innerW, -12);
      // High Risk / High Return -- top left margin
      ctx.fillStyle = '#0369a1';
      ctx.textAlign = 'left';
      ctx.fillText('High Risk / High Return', 0, -12);
      // Low Return / Low Risk -- bottom right margin
      ctx.fillStyle = '#0369a1';
      ctx.textAlign = 'right';
      ctx.fillText('Low Return / Low Risk', innerW, innerH + 50);
      // Avoid Zone -- bottom left margin
      ctx.fillStyle = '#dc2626';
      ctx.textAlign = 'left';
      ctx.fillText('Avoid Zone', 0, innerH + 50);

      // Axis labels
      ctx.fillStyle = '#475569';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${LENS_LABELS[xAxis]} Score`, innerW / 2, innerH + 38);
      ctx.save();
      ctx.translate(-48, innerH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${LENS_LABELS[yAxis]} Score`, 0, 0);
      ctx.restore();

      // Tick labels: 0, 25, 50, 75, 100
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      for (const v of [0, 25, 50, 75, 100]) {
        ctx.fillText(String(v), xScale(v), innerH + 18);
      }
      ctx.textAlign = 'right';
      for (const v of [0, 25, 50, 75, 100]) {
        ctx.fillText(String(v), -8, yScale(v) + 4);
      }

      // "Low" / "High" labels at axis ends
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      // X axis
      ctx.textAlign = 'left';
      ctx.fillText('Low', xScale(0) - 2, innerH + 28);
      ctx.textAlign = 'right';
      ctx.fillText('High', xScale(100) + 2, innerH + 28);
      // Y axis
      ctx.textAlign = 'right';
      ctx.fillText('Low', -14, yScale(0) - 4);
      ctx.fillText('High', -14, yScale(100) + 12);

      ctx.restore();
    },
    [width, height, margin, innerW, innerH, xScale, yScale, xAxis, yAxis, selectedTier]
  );

  // Animation on data/axis change
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const startTime = performance.now();
    const prev = prevPositions.current;

    const animate = (now) => {
      const t = Math.min(1, (now - startTime) / 400);
      const ease = 1 - Math.pow(1 - t, 3);

      const interpolated = positions.map((pt) => {
        const old = prev.get(pt.id);
        if (old) {
          return {
            ...pt,
            x: old.x + (pt.x - old.x) * ease,
            y: old.y + (pt.y - old.y) * ease,
            r: old.r + (pt.r - old.r) * ease,
          };
        }
        return { ...pt, r: pt.r * ease };
      });

      draw(transform, interpolated);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const newMap = new Map();
        positions.forEach((pt) => newMap.set(pt.id, pt));
        prevPositions.current = newMap;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [positions, draw, transform]);

  // Canvas DPR setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, [width, height]);

  // D3 zoom on overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const zoomBehavior = zoom().scaleExtent([0.5, 10]).on('zoom', (event) => {
      setTransform(event.transform);
    });
    select(overlay).call(zoomBehavior);
    return () => { select(overlay).on('.zoom', null); };
  }, []);

  // Redraw on zoom or selectedTier change
  useEffect(() => {
    draw(transform, positions);
  }, [transform, draw, positions, selectedTier]);

  const getMouseCoords = useCallback(
    (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        mx: (e.clientX - rect.left - margin.left - transform.x) / transform.k,
        my: (e.clientY - rect.top - margin.top - transform.y) / transform.k,
      };
    },
    [margin, transform]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!quadtreeRef.current) return;
      const coords = getMouseCoords(e);
      if (!coords) return;
      const closest = findClosestPoint(
        quadtreeRef.current, coords.mx, coords.my, xScale, yScale, transform.k
      );
      if (closest) {
        setHoveredFund(closest.fund);
        if (onHover) onHover(closest.fund, e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
      } else {
        setHoveredFund(null);
        if (onHover) onHover(null, 0, 0);
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
      }
    },
    [getMouseCoords, xScale, yScale, transform.k, onHover]
  );

  const handleClick = useCallback(
    (e) => {
      if (!quadtreeRef.current) return;
      const coords = getMouseCoords(e);
      if (!coords) return;
      const closest = findClosestPoint(
        quadtreeRef.current, coords.mx, coords.my, xScale, yScale, transform.k
      );
      if (closest && onFundClick) onFundClick(closest.fund);
    },
    [getMouseCoords, xScale, yScale, transform.k, onFundClick]
  );

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <button
        type="button"
        onClick={() => setTransform(zoomIdentity)}
        className="absolute top-2 right-2 z-10 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50"
      >
        Reset Zoom
      </button>

      <canvas ref={canvasRef} style={{ width, height }} className="bg-white rounded-lg" />

      <svg
        ref={overlayRef}
        width={width}
        height={height}
        className="absolute top-0 left-0"
        style={{ cursor: 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredFund(null); if (onHover) onHover(null, 0, 0); }}
        onClick={handleClick}
      >
        <rect width={width} height={height} fill="transparent" />
      </svg>
    </div>
  );
}

export { findClosestPoint };
