import { useRef, useEffect } from 'react';
import { select } from 'd3-selection';
import { LENS_OPTIONS } from '../../lib/lens';

const COLORS = ['#0d9488', '#f59e0b', '#7c3aed'];
const GRID_LEVELS = [20, 40, 60, 80, 100];
const AXES = [
  { key: 'return_score', label: LENS_OPTIONS?.[0]?.label ?? 'Return' },
  { key: 'risk_score', label: LENS_OPTIONS?.[1]?.label ?? 'Risk' },
  { key: 'consistency_score', label: LENS_OPTIONS?.[2]?.label ?? 'Consistency' },
  { key: 'alpha_score', label: LENS_OPTIONS?.[3]?.label ?? 'Alpha' },
  { key: 'efficiency_score', label: LENS_OPTIONS?.[4]?.label ?? 'Efficiency' },
  { key: 'resilience_score', label: LENS_OPTIONS?.[5]?.label ?? 'Resilience' },
];

function angleFor(i) {
  return -Math.PI / 2 + i * (2 * Math.PI / 6);
}

function vertex(cx, cy, radius, score, i) {
  const a = angleFor(i);
  return {
    x: cx + radius * (score / 100) * Math.cos(a),
    y: cy + radius * (score / 100) * Math.sin(a),
  };
}

export default function RadarChart({ funds = [], size = 320, categoryAvg = null }) {
  const svgRef = useRef(null);
  const legendHeight = (funds.length > 1 || categoryAvg) ? 32 : 0;
  const totalHeight = size + legendHeight;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;

  useEffect(() => {
    if (!svgRef.current || funds.length === 0) return;
    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const chart = svg.append('g');

    // Grid hexagons
    GRID_LEVELS.forEach((level) => {
      const points = AXES.map((_, i) => {
        const v = vertex(cx, cy, radius, level, i);
        return `${v.x},${v.y}`;
      }).join(' ');
      chart.append('polygon')
        .attr('points', points)
        .attr('fill', 'none')
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);
    });

    // Axis lines
    AXES.forEach((_, i) => {
      const v = vertex(cx, cy, radius, 100, i);
      chart.append('line')
        .attr('x1', cx).attr('y1', cy)
        .attr('x2', v.x).attr('y2', v.y)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);
    });

    // Axis labels
    AXES.forEach((axis, i) => {
      const a = angleFor(i);
      const labelR = radius + 22;
      const lx = cx + labelR * Math.cos(a);
      const ly = cy + labelR * Math.sin(a);
      chart.append('text')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('class', 'fill-slate-600 text-xs font-medium')
        .text(axis.label);
    });

    // Category average overlay (dashed gray polygon)
    if (categoryAvg) {
      const avgPts = AXES.map((axis, i) => {
        const score = categoryAvg[axis.key] ?? 0;
        return vertex(cx, cy, radius, score, i);
      });
      const avgStr = avgPts.map((p) => `${p.x},${p.y}`).join(' ');
      chart.append('polygon')
        .attr('points', avgStr)
        .attr('fill', '#94a3b8')
        .attr('fill-opacity', 0.05)
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 4')
        .attr('opacity', 0.7);

      avgPts.forEach((p) => {
        chart.append('circle')
          .attr('cx', p.x).attr('cy', p.y).attr('r', 2.5)
          .attr('fill', '#94a3b8')
          .attr('opacity', 0.7);
      });
    }

    // Fund polygons + dots
    funds.forEach((fund, fi) => {
      const color = COLORS[fi % COLORS.length];
      const pts = AXES.map((axis, i) => {
        const score = fund.scores[axis.key] ?? 0;
        return vertex(cx, cy, radius, score, i);
      });

      const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
      chart.append('polygon')
        .attr('points', pointsStr)
        .attr('fill', color)
        .attr('fill-opacity', 0.2)
        .attr('stroke', color)
        .attr('stroke-width', 2);

      pts.forEach((p, i) => {
        const score = fund.scores[AXES[i].key] ?? 0;
        const dot = chart.append('circle')
          .attr('cx', p.x).attr('cy', p.y).attr('r', 4)
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer');

        dot.append('title')
          .text(`${fund.label} - ${AXES[i].label}: ${score}`);

        const a = angleFor(i);
        const offsetX = Math.cos(a) * 14;
        const offsetY = Math.sin(a) * 14;
        chart.append('text')
          .attr('x', p.x + offsetX)
          .attr('y', p.y + offsetY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('class', 'font-mono text-xs fill-slate-700')
          .text(score);
      });
    });

    // Legend
    if (funds.length > 1 || categoryAvg) {
      const legend = svg.append('g')
        .attr('transform', `translate(${cx}, ${size + 8})`);
      const items = [];
      funds.forEach((fund, fi) => {
        items.push({ label: fund.label, color: COLORS[fi % COLORS.length], dashed: false });
      });
      if (categoryAvg) {
        items.push({ label: 'Category Avg', color: '#94a3b8', dashed: true });
      }
      const spacing = 120;
      const startX = -((items.length - 1) * spacing) / 2;

      items.forEach((item, idx) => {
        const g = legend.append('g')
          .attr('transform', `translate(${startX + idx * spacing}, 0)`);
        if (item.dashed) {
          g.append('line')
            .attr('x1', -8).attr('y1', 0)
            .attr('x2', 4).attr('y2', 0)
            .attr('stroke', item.color)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4,2');
        } else {
          g.append('rect')
            .attr('x', -8).attr('y', -6)
            .attr('width', 12).attr('height', 12)
            .attr('rx', 2)
            .attr('fill', item.color);
        }
        g.append('text')
          .attr('x', 10).attr('y', 4)
          .attr('class', 'text-xs fill-slate-600')
          .text(item.label);
      });
    }
  }, [funds, size, cx, cy, radius]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${totalHeight}`}
      className="w-full h-auto max-w-sm mx-auto"
    />
  );
}
