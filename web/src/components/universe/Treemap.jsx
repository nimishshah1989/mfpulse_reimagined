import { useRef, useEffect, useState, useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { hierarchy as d3Hierarchy, treemap as d3Treemap } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { formatScore, formatAUM } from '../../lib/format';
import { LENS_LABELS } from '../../lib/lens';

const colorScale = scaleLinear()
  .domain([0, 20, 40, 60, 80, 100])
  .range(['#dc2626', '#ef4444', '#d97706', '#10b981', '#059669', '#047857'])
  .clamp(true);

export default function Treemap({
  data,
  colorLens,
  onFundClick,
  onFundDoubleClick,
  width,
  height = 500,
}) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [zoomedCategory, setZoomedCategory] = useState(null);

  // Build hierarchy
  const hierarchy = useMemo(() => {
    const filtered = zoomedCategory
      ? data.filter((d) => d.category_name === zoomedCategory)
      : data;

    // Group by broad_category > category_name
    const grouped = {};
    filtered.forEach((fund) => {
      const broad = fund.broad_category || 'Other';
      const cat = fund.category_name || 'Unknown';
      if (!grouped[broad]) grouped[broad] = {};
      if (!grouped[broad][cat]) grouped[broad][cat] = [];
      grouped[broad][cat].push(fund);
    });

    const children = Object.entries(grouped).map(([broad, cats]) => ({
      name: broad,
      children: Object.entries(cats).map(([cat, funds]) => ({
        name: cat,
        children: funds.map((f) => ({
          name: f.fund_name || f.mstar_id,
          value: Math.max(Number(f.aum) || 1, 1),
          score: Number(f[colorLens]) || 0,
          fund: f,
        })),
      })),
    }));

    return d3Hierarchy({ name: 'root', children })
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data, colorLens, zoomedCategory]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const layout = d3Treemap()
      .size([width, height])
      .paddingOuter(3)
      .paddingTop(20)
      .paddingInner(1)
      .round(true);

    layout(hierarchy);

    const leaves = hierarchy.leaves();

    // Category group labels
    const categoryNodes = hierarchy.children || [];
    categoryNodes.forEach((broadNode) => {
      (broadNode.children || []).forEach((catNode) => {
        if (catNode.x1 - catNode.x0 > 40) {
          svg
            .append('text')
            .attr('x', catNode.x0 + 4)
            .attr('y', catNode.y0 + 14)
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', '#475569')
            .attr('pointer-events', 'none')
            .text(catNode.data.name);
        }
      });
    });

    // Leaf rectangles
    const leafGroup = svg
      .selectAll('g.leaf')
      .data(leaves)
      .join('g')
      .attr('class', 'leaf')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    leafGroup
      .append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (d) => colorScale(d.data.score))
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        setTooltip({
          fund: d.data.fund,
          score: d.data.score,
          x: event.clientX,
          y: event.clientY,
        });
      })
      .on('mousemove', (event) => {
        setTooltip((prev) =>
          prev ? { ...prev, x: event.clientX, y: event.clientY } : null
        );
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (event, d) => {
        if (onFundClick) onFundClick(d.data.fund);
      })
      .on('dblclick', (event, d) => {
        if (onFundDoubleClick) onFundDoubleClick(d.data.fund);
      });

    // Fund name labels (only if rect is large enough)
    leafGroup
      .filter((d) => d.x1 - d.x0 > 80 && d.y1 - d.y0 > 40)
      .append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('font-size', '10px')
      .attr('fill', (d) => (d.data.score > 60 ? '#fff' : '#334155'))
      .attr('pointer-events', 'none')
      .text((d) => {
        const maxLen = Math.floor((d.x1 - d.x0 - 8) / 6);
        const name = d.data.name;
        return name.length > maxLen ? name.slice(0, maxLen - 1) + '\u2026' : name;
      });
  }, [hierarchy, width, height, onFundClick, onFundDoubleClick, colorLens]);

  return (
    <div className="relative">
      <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
        Rectangle size = AUM (bigger = more assets). Color = {LENS_LABELS[colorLens] || 'Score'} (green = high, red = low).
        Click a category block to zoom in. Double-click a fund to open its detail page.
      </p>
      {/* Breadcrumb */}
      {zoomedCategory && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setZoomedCategory(null)}
            className="text-xs text-teal-600 hover:underline"
          >
            {'\u2190'} Back to all
          </button>
          <span className="text-xs text-slate-500 ml-2">
            {zoomedCategory}
          </span>
        </div>
      )}

      {/* Lens color selector */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-slate-500">Color by:</span>
        {/* This is controlled by parent — showing current label */}
        <span className="text-xs font-medium text-teal-600">
          {LENS_LABELS[colorLens]}
        </span>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white rounded-lg"
      />

      {/* Tooltip */}
      {tooltip && (
        <TreemapTooltip tooltip={tooltip} colorLens={colorLens} />
      )}

      {/* Color legend */}
      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
        <span>Low</span>
        <div className="flex h-3 rounded overflow-hidden" style={{ width: 120 }}>
          {[0, 20, 40, 60, 80, 100].map((v) => (
            <div
              key={v}
              className="flex-1"
              style={{ backgroundColor: colorScale(v) }}
            />
          ))}
        </div>
        <span>High</span>
        <span className="text-slate-400">({LENS_LABELS[colorLens]} score)</span>
      </div>
    </div>
  );
}

function TreemapTooltip({ tooltip, colorLens }) {
  const { fund, score, x, y } = tooltip;

  const style = {
    position: 'fixed',
    left: x + 16,
    top: y - 10,
    zIndex: 50,
  };

  if (x > window.innerWidth - 260) style.left = x - 250;
  if (y > window.innerHeight - 120) style.top = y - 100;

  return (
    <div
      style={style}
      className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 pointer-events-none"
    >
      <div className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">
        {fund.fund_name || fund.legal_name}
      </div>
      <div className="text-xs text-slate-500">{fund.category_name}</div>
      <div className="flex gap-3 mt-1.5">
        <div>
          <span className="text-[10px] text-slate-400">AUM</span>
          <span className="ml-1 text-xs font-mono text-slate-700">
            {formatAUM(Number(fund.aum) / 10000000)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400">
            {LENS_LABELS[colorLens]}
          </span>
          <span className="ml-1 text-xs font-mono text-slate-700">
            {formatScore(score)}/100
          </span>
        </div>
      </div>
    </div>
  );
}
