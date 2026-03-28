import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { quadtree } from 'd3-quadtree';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { lensColor, LENS_LABELS } from '../../lib/lens';

const AUM_CR_DIVISOR = 10000000;
const MIN_RADIUS = 3;
const MAX_RADIUS = 35;
const MAX_AUM_DOMAIN = 50000; // Crores

function getBubbleColor(lensScore) {
  return lensColor(Number(lensScore) || 0);
}

function getRadius(aumRaw, aumScale) {
  const aumCr = (Number(aumRaw) || 0) / AUM_CR_DIVISOR;
  return aumCr > 0 ? aumScale(aumCr) : MIN_RADIUS;
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
        if (dist < d.data.r / transformK + 6 && dist < closestDist) {
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

/**
 * High-performance D3+Canvas scatter chart with zoom, quadrants, and AUM-proportional bubbles.
 *
 * Props:
 *   data - fund array with lens scores, aum, return fields
 *   xAxis - key for x dimension (score key or 'return_1y'/'return_3y'/'return_5y')
 *   yAxis - key for y dimension (score key)
 *   colorLens - key for bubble color
 *   period - '1Y' | '3Y' | '5Y' determines x-axis return field
 *   onFundClick(fund, x, y) - single click on bubble
 *   onFundDoubleClick(fund) - double click → navigate
 *   onHover(fund, x, y) - mouse hover
 *   width, height - canvas dimensions
 *   selectedTier - tier label to highlight
 */
export default function BubbleScatter({
  data,
  xAxis,
  yAxis,
  colorLens,
  period,
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

  const margin = { top: 30, right: 30, bottom: 55, left: 65 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Determine if x-axis is a return field (percentage) or a score (0-100)
  const isReturnAxis = ['return_1y', 'return_3y', 'return_5y'].includes(xAxis);

  // Calculate dynamic domain for return axes
  const xDomain = useMemo(() => {
    if (!isReturnAxis) return [0, 100];
    const vals = data.map((d) => Number(d[xAxis])).filter((v) => !isNaN(v));
    if (vals.length === 0) return [-10, 50];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || 5;
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [data, xAxis, isReturnAxis]);

  const aumScale = useMemo(
    () => scaleSqrt().domain([0, MAX_AUM_DOMAIN]).range([MIN_RADIUS, MAX_RADIUS]).clamp(true),
    []
  );

  const xScale = useMemo(
    () => scaleLinear().domain(xDomain).range([0, innerW]),
    [xDomain, innerW]
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
      r: getRadius(d.aum, aumScale),
      color: getBubbleColor(d[activeLens]),
      fund: d,
    }));
  }, [data, xAxis, yAxis, colorLens, aumScale]);

  // Build quadtree for hit detection
  useEffect(() => {
    quadtreeRef.current = quadtree()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .addAll(positions);
  }, [positions, xScale, yScale]);

  // Canvas draw function
  const draw = useCallback(
    (currentTransform, pts) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Background fill
      ctx.fillStyle = '#fafbfc';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(margin.left, margin.top);

      // Clip region for chart area
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, innerW, innerH);
      ctx.clip();

      // Zoom transform
      ctx.save();
      ctx.translate(currentTransform.x, currentTransform.y);
      ctx.scale(currentTransform.k, currentTransform.k);

      // Calculate midpoints
      const xMid = isReturnAxis ? xScale(0) : xScale(50);
      const yMid = yScale(50);

      // Quadrant zone shading
      ctx.fillStyle = 'rgba(5, 150, 105, 0.04)';
      ctx.fillRect(xMid, 0, innerW - xMid, yMid);

      ctx.fillStyle = 'rgba(220, 38, 38, 0.04)';
      ctx.fillRect(0, yMid, xMid, innerH - yMid);

      ctx.fillStyle = 'rgba(217, 119, 6, 0.02)';
      ctx.fillRect(0, 0, xMid, yMid);

      ctx.fillStyle = 'rgba(37, 99, 235, 0.02)';
      ctx.fillRect(xMid, yMid, innerW - xMid, innerH - yMid);

      // Grid lines
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.5 / currentTransform.k;

      if (!isReturnAxis) {
        for (const v of [25, 50, 75]) {
          ctx.beginPath();
          ctx.moveTo(xScale(v), 0);
          ctx.lineTo(xScale(v), innerH);
          ctx.stroke();
        }
      } else {
        // Auto-generate grid lines for return axes
        const [dMin, dMax] = xDomain;
        const step = (dMax - dMin) > 40 ? 10 : 5;
        for (let v = Math.ceil(dMin / step) * step; v <= dMax; v += step) {
          ctx.beginPath();
          ctx.moveTo(xScale(v), 0);
          ctx.lineTo(xScale(v), innerH);
          ctx.stroke();
        }
      }
      for (const v of [25, 50, 75]) {
        ctx.beginPath();
        ctx.moveTo(0, yScale(v));
        ctx.lineTo(innerW, yScale(v));
        ctx.stroke();
      }

      // Midpoint lines (dashed, stronger)
      ctx.setLineDash([4 / currentTransform.k, 4 / currentTransform.k]);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.8 / currentTransform.k;
      ctx.beginPath();
      ctx.moveTo(xMid, 0);
      ctx.lineTo(xMid, innerH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, yMid);
      ctx.lineTo(innerW, yMid);
      ctx.stroke();
      ctx.setLineDash([]);

      // Density-based opacity
      const visibleCount = pts.length;
      const baseOpacity = visibleCount > 2000 ? 0.5 : visibleCount > 1000 ? 0.65 : 0.8;

      // Draw bubbles
      for (const pt of pts) {
        const r = pt.r / currentTransform.k;
        const dimmed = selectedTier && pt.fund._tierLabel !== selectedTier;
        const cx = xScale(pt.x);
        const cy = yScale(pt.y);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);

        if (dimmed) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = 0.3 / currentTransform.k;
          ctx.stroke();
        } else {
          // Parse color and apply opacity
          const baseColor = pt.color;
          ctx.globalAlpha = baseOpacity;
          ctx.fillStyle = baseColor;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 0.6 / currentTransform.k;
          ctx.stroke();
        }
      }

      ctx.restore(); // zoom transform
      ctx.restore(); // clip

      // Quadrant labels — subtle, inside chart area corners
      ctx.font = '8px Inter, sans-serif';
      ctx.globalAlpha = 0.25;

      // Top right — high return, low risk
      ctx.fillStyle = '#059669';
      ctx.textAlign = 'right';
      ctx.fillText('High return · Low risk', innerW - 6, 14);

      // Top left — high risk, high return
      ctx.fillStyle = '#d97706';
      ctx.textAlign = 'left';
      ctx.fillText('High risk · High return', 6, 14);

      // Bottom right — steady, low return
      ctx.fillStyle = '#2563eb';
      ctx.textAlign = 'right';
      ctx.fillText('Steady · Low return', innerW - 6, innerH - 6);

      // Bottom left — avoid zone
      ctx.fillStyle = '#dc2626';
      ctx.textAlign = 'left';
      ctx.fillText('High risk · Low return', 6, innerH - 6);

      ctx.globalAlpha = 1;

      // X-axis label
      ctx.fillStyle = '#475569';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const xLabel = isReturnAxis
        ? `${period || '1Y'} Return (%)`
        : `${LENS_LABELS[xAxis] || xAxis} Score (0-100)`;
      ctx.fillText(xLabel, innerW / 2, innerH + 38);

      // Y-axis label
      const yLabel =
        yAxis === 'risk_score'
          ? 'Risk Score (0=High Risk, 100=Low Risk)'
          : `${LENS_LABELS[yAxis] || yAxis} Score (0-100)`;
      ctx.save();
      ctx.translate(-48, innerH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();

      // Tick labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';

      if (!isReturnAxis) {
        for (const v of [0, 25, 50, 75, 100]) {
          ctx.fillText(String(v), xScale(v), innerH + 18);
        }
      } else {
        const [dMin, dMax] = xDomain;
        const step = (dMax - dMin) > 40 ? 10 : 5;
        for (let v = Math.ceil(dMin / step) * step; v <= dMax; v += step) {
          ctx.fillText(`${v}%`, xScale(v), innerH + 18);
        }
      }

      ctx.textAlign = 'right';
      for (const v of [0, 25, 50, 75, 100]) {
        ctx.fillText(String(v), -8, yScale(v) + 4);
      }

      // Low/High axis end labels
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      if (!isReturnAxis) {
        ctx.textAlign = 'left';
        ctx.fillText('Low', xScale(xDomain[0]) - 2, innerH + 28);
        ctx.textAlign = 'right';
        ctx.fillText('High', xScale(xDomain[1]) + 2, innerH + 28);
      }
      ctx.textAlign = 'right';
      ctx.fillText('Low', -14, yScale(0) - 4);
      ctx.fillText('High', -14, yScale(100) + 12);

      ctx.restore();
    },
    [width, height, margin, innerW, innerH, xScale, yScale, xAxis, yAxis, selectedTier, isReturnAxis, xDomain, period]
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

  // D3 zoom on overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const zoomBehavior = zoom()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });
    select(overlay).call(zoomBehavior);
    return () => {
      select(overlay).on('.zoom', null);
    };
  }, []);

  // Redraw on zoom/tier change
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
        quadtreeRef.current,
        coords.mx,
        coords.my,
        xScale,
        yScale,
        transform.k
      );
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
      const closest = findClosestPoint(
        quadtreeRef.current,
        coords.mx,
        coords.my,
        xScale,
        yScale,
        transform.k
      );

      if (!closest) return;

      // Single click with delay to distinguish from double-click
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        // Double click
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
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTransform(zoomIdentity)}
          className="px-2.5 py-1 text-[10px] font-medium bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
        >
          Reset
        </button>
      </div>

      {/* Fund count badge */}
      <div className="absolute top-2 left-2 z-10">
        <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-white/90 border border-slate-200 rounded-md text-slate-500 shadow-sm tabular-nums">
          {data.length.toLocaleString('en-IN')} funds
        </span>
      </div>

      <canvas ref={canvasRef} style={{ width, height }} className="rounded-lg" />

      <svg
        ref={overlayRef}
        width={width}
        height={height}
        className="absolute top-0 left-0"
        style={{ cursor: 'grab' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (onHover) onHover(null, 0, 0);
        }}
        onClick={handleClick}
      >
        <rect width={width} height={height} fill="transparent" />
      </svg>
    </div>
  );
}

export { findClosestPoint };
