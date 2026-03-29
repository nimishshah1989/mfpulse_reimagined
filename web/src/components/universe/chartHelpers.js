import { LENS_LABELS } from '../../lib/lens';

const AUM_CR_DIVISOR = 10000000;
const MIN_RADIUS = 5;
const MAX_RADIUS = 40;
const MAX_AUM_DOMAIN = 50000;
const FALLBACK_MIN = 6;
const FALLBACK_MAX = 18;

export { AUM_CR_DIVISOR, MIN_RADIUS, MAX_RADIUS, MAX_AUM_DOMAIN };

export function getBubbleColor(score) {
  const s = Number(score) || 0;
  if (s >= 75) return 'rgba(5, 150, 105, 0.55)';
  if (s >= 50) return 'rgba(13, 148, 136, 0.50)';
  if (s >= 25) return 'rgba(245, 158, 11, 0.45)';
  return 'rgba(239, 68, 68, 0.45)';
}

export function getBubbleBorder(score) {
  const s = Number(score) || 0;
  if (s >= 75) return 'rgba(5,150,105,0.7)';
  if (s >= 50) return 'rgba(13,148,136,0.6)';
  if (s >= 25) return 'rgba(245,158,11,0.5)';
  return 'rgba(239,68,68,0.5)';
}

export function getRadius(aumRaw, aumScale, fund) {
  const aumCr = (Number(aumRaw) || 0) / AUM_CR_DIVISOR;
  if (aumCr > 0) return aumScale(aumCr);
  // Fallback: size by return_score when AUM is missing (51% of funds)
  const score = Number(fund?.return_score) || Number(fund?.efficiency_score) || 50;
  return FALLBACK_MIN + (score / 100) * (FALLBACK_MAX - FALLBACK_MIN);
}

export function findClosestPoint(qt, mx, my, xScale, yScale, transformK) {
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
 * Draw the chart background, grid, quadrants, bubbles, labels, and ticks.
 */
export function drawChart(ctx, params) {
  const {
    width, height, margin, innerW, innerH,
    xScale, yScale, xAxis, yAxis,
    xDomain, yDomain,
    isReturnX, isReturnY,
    currentTransform, pts, selectedTier,
  } = params;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(margin.left, margin.top);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, innerW, innerH);
  ctx.clip();

  ctx.save();
  ctx.translate(currentTransform.x, currentTransform.y);
  ctx.scale(currentTransform.k, currentTransform.k);

  const xMidVal = isReturnX ? (xDomain[0] + xDomain[1]) / 2 : 50;
  const yMidVal = isReturnY ? (yDomain[0] + yDomain[1]) / 2 : 50;
  const xMid = xScale(xMidVal);
  const yMid = yScale(yMidVal);

  // Quadrant background rectangles
  // Top-left: low risk + high return = SWEET SPOT (emerald tint)
  ctx.fillStyle = 'rgba(5, 150, 105, 0.04)';
  ctx.fillRect(0, 0, xMid, yMid);
  // Top-right: high risk + high return = HIGH RISK HIGH RETURN (amber tint)
  ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
  ctx.fillRect(xMid, 0, innerW - xMid, yMid);
  // Bottom-left: low risk + low return = CONSERVATIVE (sky tint)
  ctx.fillStyle = 'rgba(14, 165, 233, 0.04)';
  ctx.fillRect(0, yMid, xMid, innerH - yMid);
  // Bottom-right: high risk + low return = AVOID (red tint)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
  ctx.fillRect(xMid, yMid, innerW - xMid, innerH - yMid);

  // Grid
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 0.5 / currentTransform.k;
  drawGridLines(ctx, xScale, yScale, innerW, innerH, xDomain, yDomain, isReturnX, isReturnY);

  // Quadrant divider lines — dashed gray at midpoint of each axis
  ctx.setLineDash([4 / currentTransform.k, 4 / currentTransform.k]);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1 / currentTransform.k;
  ctx.beginPath(); ctx.moveTo(xMid, 0); ctx.lineTo(xMid, innerH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, yMid); ctx.lineTo(innerW, yMid); ctx.stroke();
  ctx.setLineDash([]);

  // Bubbles
  const visibleCount = pts.length;
  const baseOpacity = visibleCount > 2000 ? 0.45 : visibleCount > 1000 ? 0.6 : 0.75;

  for (const pt of pts) {
    const r = pt.r / currentTransform.k;
    const dimmed = selectedTier && pt.fund._tierDisplay !== selectedTier;
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
      ctx.globalAlpha = baseOpacity;
      ctx.fillStyle = getBubbleColor(pt.colorScore);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = getBubbleBorder(pt.colorScore);
      ctx.lineWidth = 1 / currentTransform.k;
      ctx.stroke();
    }
  }

  ctx.restore(); // zoom
  ctx.restore(); // clip

  // Quadrant labels — centered in each quadrant, subtle matching colors
  ctx.font = '600 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // SWEET SPOT — top-left (emerald at 0.15 opacity)
  ctx.fillStyle = 'rgba(5, 150, 105, 0.15)';
  ctx.fillText('SWEET SPOT', xMid / 2, yMid / 2);

  // HIGH RISK HIGH RETURN — top-right (amber at 0.15 opacity)
  ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.fillText('HIGH RISK HIGH RETURN', xMid + (innerW - xMid) / 2, yMid / 2);

  // CONSERVATIVE — bottom-left (sky at 0.15 opacity)
  ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
  ctx.fillText('CONSERVATIVE', xMid / 2, yMid + (innerH - yMid) / 2);

  // AVOID — bottom-right (red at 0.15 opacity)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.fillText('AVOID', xMid + (innerW - xMid) / 2, yMid + (innerH - yMid) / 2);

  ctx.textBaseline = 'alphabetic';

  // Axis labels
  ctx.fillStyle = '#64748b';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  const xLabel = isReturnX
    ? 'Risk (Std Dev 3Y %) \u2014 Lower is Better  \u2192'
    : `${LENS_LABELS[xAxis] || xAxis} Score (0-100)`;
  ctx.fillText(xLabel, innerW / 2, innerH + 36);

  const yLabel = isReturnY
    ? `\u2191  ${yAxis === 'return_1y' ? '1Y' : yAxis === 'return_3y' ? '3Y' : '5Y'} Return %`
    : `\u2191  ${LENS_LABELS[yAxis] || yAxis} Score`;
  ctx.save();
  ctx.translate(-42, innerH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // Ticks
  drawTicks(ctx, xScale, yScale, innerW, innerH, xDomain, yDomain, isReturnX, isReturnY);

  ctx.restore();
}

function drawGridLines(ctx, xScale, yScale, innerW, innerH, xDomain, yDomain, isReturnX, isReturnY) {
  if (!isReturnX) {
    for (const v of [25, 50, 75]) {
      ctx.beginPath(); ctx.moveTo(xScale(v), 0); ctx.lineTo(xScale(v), innerH); ctx.stroke();
    }
  } else {
    const [dMin, dMax] = xDomain;
    const step = (dMax - dMin) > 40 ? 10 : 5;
    for (let v = Math.ceil(dMin / step) * step; v <= dMax; v += step) {
      ctx.beginPath(); ctx.moveTo(xScale(v), 0); ctx.lineTo(xScale(v), innerH); ctx.stroke();
    }
  }
  if (!isReturnY) {
    for (const v of [25, 50, 75]) {
      ctx.beginPath(); ctx.moveTo(0, yScale(v)); ctx.lineTo(innerW, yScale(v)); ctx.stroke();
    }
  } else {
    const [dMin, dMax] = yDomain;
    const step = (dMax - dMin) > 40 ? 10 : 5;
    for (let v = Math.ceil(dMin / step) * step; v <= dMax; v += step) {
      ctx.beginPath(); ctx.moveTo(0, yScale(v)); ctx.lineTo(innerW, yScale(v)); ctx.stroke();
    }
  }
}

function drawTicks(ctx, xScale, yScale, innerW, innerH, xDomain, yDomain, isReturnX, isReturnY) {
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'center';
  if (!isReturnX) {
    for (const v of [0, 25, 50, 75, 100]) {
      ctx.fillText(String(v), xScale(v), innerH + 16);
    }
  } else {
    const [dMin, dMax] = xDomain;
    const step = (dMax - dMin) > 40 ? 10 : 5;
    for (let v = Math.ceil(dMin / step) * step; v <= dMax; v += step) {
      ctx.fillText(`${v}%`, xScale(v), innerH + 16);
    }
  }
  ctx.textAlign = 'right';
  if (!isReturnY) {
    for (const v of [0, 25, 50, 75, 100]) {
      ctx.fillText(String(v), -8, yScale(v) + 4);
    }
  } else {
    const [dMin, dMax] = yDomain;
    const step = (dMax - dMin) > 40 ? 10 : 5;
    for (let v = Math.ceil(dMin / step) * step; v <= dMax; v += step) {
      ctx.fillText(`${v}%`, -8, yScale(v) + 4);
    }
  }
}
