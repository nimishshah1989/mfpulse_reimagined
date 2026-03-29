import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { quadtree } from 'd3-quadtree';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import {
  MAX_AUM_DOMAIN, MIN_RADIUS, MAX_RADIUS, AUM_CR_DIVISOR,
  getRadius, findClosestPoint, drawChart,
} from './chartHelpers';

export default function BubbleScatter({
  data,
  xAxis,
  yAxis,
  colorLens,
  onFundClick,
  onFundDoubleClick,
  onHover,
  width,
  height,
  selectedTier,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const [transform, setTransform] = useState(zoomIdentity);
  const quadtreeRef = useRef(null);
  const animRef = useRef(null);
  const prevPositions = useRef(new Map());
  const clickTimerRef = useRef(null);

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const isReturnX = ['return_1y', 'return_3y', 'return_5y', 'net_expense_ratio', 'expense_ratio'].includes(xAxis);
  const isReturnY = ['return_1y', 'return_3y', 'return_5y'].includes(yAxis);

  const xDomain = useMemo(() => {
    if (!isReturnX) return [0, 100];
    const vals = data.map((d) => Number(d[xAxis])).filter((v) => !isNaN(v));
    if (vals.length === 0) return [0, 100];
    const sorted = [...vals].sort((a, b) => a - b);
    const p2 = sorted[Math.floor(sorted.length * 0.02)] ?? sorted[0];
    const p98 = sorted[Math.floor(sorted.length * 0.98)] ?? sorted[sorted.length - 1];
    const pad = (p98 - p2) * 0.1 || 5;
    return [Math.floor(p2 - pad), Math.ceil(p98 + pad)];
  }, [data, xAxis, isReturnX]);

  const yDomain = useMemo(() => {
    if (!isReturnY) return [0, 100];
    const vals = data.map((d) => Number(d[yAxis])).filter((v) => !isNaN(v));
    if (vals.length === 0) return [-10, 50];
    // Use 2nd/98th percentile to clip outliers
    const sorted = [...vals].sort((a, b) => a - b);
    const p2 = sorted[Math.floor(sorted.length * 0.02)] ?? sorted[0];
    const p98 = sorted[Math.floor(sorted.length * 0.98)] ?? sorted[sorted.length - 1];
    const pad = (p98 - p2) * 0.1 || 5;
    return [Math.floor(p2 - pad), Math.ceil(p98 + pad)];
  }, [data, yAxis, isReturnY]);

  const aumScale = useMemo(
    () => scaleSqrt().domain([0, MAX_AUM_DOMAIN]).range([MIN_RADIUS, MAX_RADIUS]).clamp(true),
    []
  );

  const xScale = useMemo(
    () => scaleLinear().domain(xDomain).range([0, innerW]),
    [xDomain, innerW]
  );
  const yScale = useMemo(
    () => scaleLinear().domain(yDomain).range([innerH, 0]),
    [yDomain, innerH]
  );

  const positions = useMemo(() => {
    const cKey = colorLens || 'alpha_score';
    return data.map((d) => ({
      id: d.mstar_id,
      x: Number(d[xAxis]) || 0,
      y: Number(d[yAxis]) || 0,
      r: getRadius(d.aum, aumScale, d),
      colorScore: Number(d[cKey]) || 0,
      fund: d,
    }));
  }, [data, xAxis, yAxis, colorLens, aumScale]);

  // Build quadtree
  useEffect(() => {
    quadtreeRef.current = quadtree()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .addAll(positions);
  }, [positions, xScale, yScale]);

  // Draw wrapper
  const draw = useCallback(
    (currentTransform, pts) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      drawChart(ctx, {
        width, height, margin, innerW, innerH,
        xScale, yScale, xAxis, yAxis,
        xDomain, yDomain,
        isReturnX, isReturnY,
        currentTransform, pts, selectedTier,
      });
    },
    [width, height, margin, innerW, innerH, xScale, yScale, xAxis, yAxis, selectedTier, isReturnX, isReturnY, xDomain, yDomain]
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
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
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

  // D3 zoom
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const zoomBehavior = zoom()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => setTransform(event.transform));
    select(overlay).call(zoomBehavior);
    return () => select(overlay).on('.zoom', null);
  }, []);

  // Redraw on zoom/tier
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
      const closest = findClosestPoint(quadtreeRef.current, coords.mx, coords.my, xScale, yScale, transform.k);
      if (closest) {
        if (onHover) onHover(closest.fund, e.clientX, e.clientY);
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
      } else {
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
      const closest = findClosestPoint(quadtreeRef.current, coords.mx, coords.my, xScale, yScale, transform.k);
      if (!closest) return;

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        if (onFundDoubleClick) onFundDoubleClick(closest.fund);
        return;
      }

      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        if (onFundClick) onFundClick(closest.fund, e.clientX, e.clientY);
      }, 250);
    },
    [getMouseCoords, xScale, yScale, transform.k, onFundClick, onFundDoubleClick]
  );

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={() => setTransform(zoomIdentity)}
          className="px-2.5 py-1 text-[10px] font-medium bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          Reset
        </button>
      </div>

      <canvas ref={canvasRef} style={{ width, height }} className="rounded-xl" />

      <svg
        ref={overlayRef}
        width={width}
        height={height}
        className="absolute top-0 left-0"
        style={{ cursor: 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHover?.(null, 0, 0)}
        onClick={handleClick}
      >
        <rect width={width} height={height} fill="transparent" />
      </svg>
    </div>
  );
}

export { findClosestPoint };
