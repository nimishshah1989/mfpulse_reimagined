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
  if (s >= 80) return 'rgba(5, 150, 105, 0.82)';    // #059669 deep green
  if (s >= 60) return 'rgba(16, 185, 129, 0.72)';   // #10b981 green
  if (s >= 40) return 'rgba(245, 158, 11, 0.68)';   // #f59e0b amber
  if (s >= 20) return 'rgba(239, 68, 68, 0.70)';    // #ef4444 light red
  return 'rgba(220, 38, 38, 0.72)';                  // #dc2626 deep red
}

/** White semi-transparent border matching mockup */
export function getBubbleBorder() {
  return 'rgba(255, 255, 255, 0.7)';
}

export function getRadius(aumRaw, aumScale, fund) {
  const aumCr = (Number(aumRaw) || 0) / AUM_CR_DIVISOR;
  if (aumCr > 0) return aumScale(aumCr);
  // Fallback for edge cases — size by score
  const score = Number(fund?.return_score) || 50;
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

  const xMidVal = isReturnX ? (xDomain[0] + xDomain[1]) / 2 : 50;
  const yMidVal = isReturnY ? (yDomain[0] + yDomain[1]) / 2 : 50;
  const xMid = xScale(xMidVal);
  const yMid = yScale(yMidVal);

  // Quadrant backgrounds — drawn OUTSIDE zoom so they always fill visible area
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, innerW, innerH);
  ctx.clip();

  ctx.fillStyle = 'rgba(5, 150, 105, 0.04)';
  ctx.fillRect(0, 0, xMid, yMid);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
  ctx.fillRect(xMid, 0, innerW - xMid, yMid);
  ctx.fillStyle = 'rgba(14, 165, 233, 0.04)';
  ctx.fillRect(0, yMid, xMid, innerH - yMid);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
  ctx.fillRect(xMid, yMid, innerW - xMid, innerH - yMid);

  // Quadrant divider lines — dashed at midpoint
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(xMid, 0); ctx.lineTo(xMid, innerH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, yMid); ctx.lineTo(innerW, yMid); ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  // Clipped + zoomed area for grid + bubbles
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, innerW, innerH);
  ctx.clip();

  ctx.save();
  ctx.translate(currentTransform.x, currentTransform.y);
  ctx.scale(currentTransform.k, currentTransform.k);

  // Grid lines — visible
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.8 / currentTransform.k;
  drawGridLines(ctx, xScale, yScale, innerW, innerH, xDomain, yDomain, isReturnX, isReturnY);

  // Bubbles
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
      ctx.fillStyle = getBubbleColor(pt.colorScore);
      ctx.fill();
      ctx.strokeStyle = getBubbleBorder();
      ctx.lineWidth = 1.5 / currentTransform.k;
      ctx.stroke();
    }
  }

  ctx.restore(); // zoom
  ctx.restore(); // clip

  // Axis lines — solid borders
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, innerH); // Y axis
  ctx.moveTo(0, innerH); ctx.lineTo(innerW, innerH); // X axis
  ctx.stroke();

  // Quadrant labels — positioned at corners to avoid bubble overlap
  ctx.font = '600 10px Inter, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const labelPad = 8;

  // Top-left: SWEET SPOT
  ctx.fillStyle = 'rgba(5, 150, 105, 0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('SWEET SPOT', labelPad, labelPad + 10);

  // Top-right: HIGH RISK HIGH RETURN
  ctx.fillStyle = 'rgba(245, 158, 11, 0.55)';
  ctx.textAlign = 'right';
  ctx.fillText('HIGH RISK HIGH RETURN', innerW - labelPad, labelPad + 10);

  // Bottom-left: CONSERVATIVE
  ctx.fillStyle = 'rgba(14, 165, 233, 0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('CONSERVATIVE', labelPad, innerH - labelPad);

  // Bottom-right: AVOID
  ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
  ctx.textAlign = 'right';
  ctx.fillText('AVOID', innerW - labelPad, innerH - labelPad);

  ctx.textBaseline = 'alphabetic';

  // Axis labels
  ctx.fillStyle = '#334155';
  ctx.font = '600 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  const xLabel = isReturnX
    ? 'Risk Score (0-100) \u2014 Lower is Better  \u2192'
    : `${LENS_LABELS[xAxis] || xAxis} Score (0-100)`;
  ctx.fillText(xLabel, innerW / 2, innerH + 38);

  const yLabel = isReturnY
    ? `\u2191  ${yAxis === 'return_1y' ? '1Y' : yAxis === 'return_3y' ? '3Y' : '5Y'} Return %`
    : `\u2191  ${LENS_LABELS[yAxis] || yAxis} Score`;
  ctx.save();
  ctx.translate(-44, innerH / 2);
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
  ctx.fillStyle = '#475569';
  ctx.font = '500 11px Inter, sans-serif';
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
