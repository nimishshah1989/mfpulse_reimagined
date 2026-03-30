/**
 * SectorRiskReturn — Aggregate sector-level risk vs return scatter.
 * X = RS Score (proxy for relative strength), Y = Weighted Return,
 * Bubble size = total AUM exposed. Color = quadrant.
 * Tells the story: "Which sectors are delivering returns at which risk level?"
 */
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { QUADRANT_COLORS } from '../../lib/sectors';
import { formatPct, formatAUMRaw } from '../../lib/format';

const MARGIN = { top: 24, right: 24, bottom: 40, left: 52 };

export default function SectorRiskReturn({ sectors, onSectorClick }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dims, setDims] = useState({ w: 600, h: 360 });
  const [hovered, setHovered] = useState(null);

  // Observe container width
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDims({ w: Math.max(400, e.contentRect.width), h: 360 });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => {
    if (!sectors?.length) return [];
    return sectors
      .filter((s) => s.weighted_return != null)
      .map((s) => ({
        ...s,
        x: s.rs_score ?? 50,
        y: s.weighted_return ?? 0,
        r: Math.max(12, Math.min(32, 8 + Math.sqrt((s.total_aum_exposed ?? 0) / 1e10) * 4)),
      }));
  }, [sectors]);

  const xExtent = useMemo(() => {
    if (!data.length) return [20, 80];
    const scores = data.map((d) => d.x);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const pad = (max - min) * 0.15 || 5;
    return [min - pad, max + pad];
  }, [data]);

  const yExtent = useMemo(() => {
    if (!data.length) return [-5, 25];
    const rets = data.map((d) => d.y);
    const min = Math.min(...rets);
    const max = Math.max(...rets);
    const pad = (max - min) * 0.15 || 2;
    return [min - pad, max + pad];
  }, [data]);

  const xScale = useCallback(
    (v) => MARGIN.left + ((v - xExtent[0]) / (xExtent[1] - xExtent[0])) * (dims.w - MARGIN.left - MARGIN.right),
    [dims.w, xExtent]
  );
  const yScale = useCallback(
    (v) => dims.h - MARGIN.bottom - ((v - yExtent[0]) / (yExtent[1] - yExtent[0])) * (dims.h - MARGIN.top - MARGIN.bottom),
    [dims.h, yExtent]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    canvas.style.width = `${dims.w}px`;
    canvas.style.height = `${dims.h}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dims.w, dims.h);

    const { w, h } = dims;
    const l = MARGIN.left, r = w - MARGIN.right;
    const t = MARGIN.top, b = h - MARGIN.bottom;

    // Background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(l, t, r - l, b - t);

    // Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = t + (b - t) * (i / 4);
      ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(r, y); ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const x = l + (r - l) * (i / 4);
      ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, b); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RS Score (Relative Strength) →', (l + r) / 2, h - 4);
    ctx.save();
    ctx.translate(12, (t + b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Weighted Return (%) →', 0, 0);
    ctx.restore();

    // Tick labels
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const v = xExtent[0] + (xExtent[1] - xExtent[0]) * (i / 4);
      ctx.fillText(Math.round(v).toString(), l + (r - l) * (i / 4), b + 6);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = yExtent[0] + (yExtent[1] - yExtent[0]) * (1 - i / 4);
      ctx.fillText(v.toFixed(1), l - 6, t + (b - t) * (i / 4));
    }

    // Draw bubbles
    for (const d of data) {
      const cx = xScale(d.x);
      const cy = yScale(d.y);
      const colors = QUADRANT_COLORS[d.quadrant] || QUADRANT_COLORS.Lagging;
      const isHov = hovered?.sector_name === d.sector_name;

      ctx.globalAlpha = isHov ? 1 : 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, isHov ? d.r + 3 : d.r, 0, Math.PI * 2);
      ctx.fillStyle = colors.circle;
      ctx.fill();

      if (isHov) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(8, d.r * 0.38)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const short = d.sector_name.length > 7 ? d.sector_name.slice(0, 5) + '..' : d.sector_name;
      ctx.fillText(short, cx, cy);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }, [data, dims, hovered, xScale, yScale, xExtent, yExtent]);

  useEffect(() => { draw(); }, [draw]);

  const findNearest = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      for (const d of data) {
        const cx = xScale(d.x);
        const cy = yScale(d.y);
        const dist = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2);
        if (dist < d.r + 8) return d;
      }
      return null;
    },
    [data, xScale, yScale]
  );

  if (!data.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="section-title">Sector Risk-Return Map</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Relative strength vs weighted return. Bubble size = AUM exposed. Click to explore.
          </p>
        </div>
      </div>

      <div ref={containerRef} className="relative" style={{ height: dims.h }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
        <svg
          className="absolute inset-0 cursor-crosshair"
          width={dims.w}
          height={dims.h}
          onMouseMove={(e) => setHovered(findNearest(e.clientX, e.clientY))}
          onMouseLeave={() => setHovered(null)}
          onClick={(e) => {
            const found = findNearest(e.clientX, e.clientY);
            if (found && onSectorClick) onSectorClick(found);
          }}
        />

        {/* Hover tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-50"
            style={{
              left: Math.min(xScale(hovered.x) + 16, dims.w - 200),
              top: Math.max(yScale(hovered.y) - 80, 8),
            }}
          >
            <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 w-[180px]">
              <p className="text-xs font-bold text-slate-800">{hovered.sector_name}</p>
              <div className="grid grid-cols-2 gap-1 mt-1 text-[10px]">
                <span className="text-slate-400">RS Score</span>
                <span className="font-bold tabular-nums text-right">{Math.round(hovered.x)}</span>
                <span className="text-slate-400">Wt. Return</span>
                <span className={`font-bold tabular-nums text-right ${hovered.y >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatPct(hovered.y)}
                </span>
                <span className="text-slate-400">AUM</span>
                <span className="font-semibold tabular-nums text-right">{formatAUMRaw(hovered.total_aum_exposed)}</span>
                <span className="text-slate-400">Quadrant</span>
                <span className="font-semibold text-right" style={{ color: QUADRANT_COLORS[hovered.quadrant]?.circle }}>
                  {hovered.quadrant}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
