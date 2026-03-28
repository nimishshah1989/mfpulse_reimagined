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
  if (!aum || aum <= 0) return 4;
  return Math.max(3, Math.min(25, Math.sqrt(Math.log(Number(aum) + 1)) * 4));
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

export default function BubbleScatter({
  data,
  xAxis,
  yAxis,
  colorLens,
  onFundClick,
  onHover,
  width,
  height = 600,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [hoveredFund, setHoveredFund] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [transform, setTransform] = useState(zoomIdentity);
  const quadtreeRef = useRef(null);
  const animRef = useRef(null);
  const prevPositions = useRef(new Map());

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
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

      // Top-right: sweet spot — light green tint
      ctx.fillStyle = 'rgba(5, 150, 105, 0.04)';
      ctx.fillRect(x50, 0, innerW - x50, y50);

      // Bottom-left: below average — light red tint
      ctx.fillStyle = 'rgba(220, 38, 38, 0.04)';
      ctx.fillRect(0, y50, x50, innerH - y50);

      // Grid
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.5 / currentTransform.k;
      for (let v = 20; v <= 80; v += 20) {
        ctx.beginPath();
        ctx.moveTo(xScale(v), 0);
        ctx.lineTo(xScale(v), innerH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, yScale(v));
        ctx.lineTo(innerW, yScale(v));
        ctx.stroke();
      }

      // Quadrant lines at 50
      ctx.setLineDash([4 / currentTransform.k, 4 / currentTransform.k]);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.5 / currentTransform.k;
      ctx.beginPath();
      ctx.moveTo(xScale(50), 0);
      ctx.lineTo(xScale(50), innerH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, yScale(50));
      ctx.lineTo(innerW, yScale(50));
      ctx.stroke();
      ctx.setLineDash([]);

      // Quadrant labels
      ctx.font = `italic ${11 / currentTransform.k}px Inter, sans-serif`;
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'right';
      ctx.fillText('Sweet spot', xScale(98), yScale(96));
      ctx.textAlign = 'left';
      ctx.fillText('Below average', xScale(2), yScale(4));

      // Bubbles — color from lens score (string, not object)
      for (const pt of pts) {
        const r = pt.r / currentTransform.k;
        ctx.beginPath();
        ctx.arc(xScale(pt.x), yScale(pt.y), r, 0, 2 * Math.PI);
        ctx.fillStyle = pt.color;
        ctx.fill();
        // Stroke: slightly darker version — derive by replacing alpha
        ctx.strokeStyle = pt.color.replace(/[\d.]+\)$/, '1)');
        ctx.lineWidth = 0.8 / currentTransform.k;
        ctx.stroke();
      }
      ctx.restore();

      // Axis labels (outside zoom)
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${LENS_LABELS[xAxis]} (score 0\u2013100)`, innerW / 2, innerH + 40);
      ctx.save();
      ctx.translate(-40, innerH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${LENS_LABELS[yAxis]} (score 0\u2013100)`, 0, 0);
      ctx.restore();

      // Tick labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      for (let v = 0; v <= 100; v += 20) ctx.fillText(String(v), xScale(v), innerH + 18);
      ctx.textAlign = 'right';
      for (let v = 0; v <= 100; v += 20) ctx.fillText(String(v), -8, yScale(v) + 4);

      ctx.restore();
    },
    [width, height, margin, innerW, innerH, xScale, yScale, xAxis, yAxis]
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

  // Redraw on zoom
  useEffect(() => {
    draw(transform, positions);
  }, [transform, draw, positions]);

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
        setHoverPos({ x: e.clientX, y: e.clientY });
        if (onHover) onHover(closest.fund, e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
      } else {
        setHoveredFund(null);
        if (onHover) onHover(null, 0, 0);
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
      }
    },
    [getMouseCoords, xScale, yScale, transform.k]
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
    <div className="relative">
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

      {/* HoverCard is rendered by the parent (universe.jsx) via selectedFund state */}
      {/* Expose hovered fund so parent can display HoverCard */}
    </div>
  );
}

// Export hover state management hook for parent use
export { findClosestPoint };
