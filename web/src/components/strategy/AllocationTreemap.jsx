import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';

function avgScore(f) {
  const scores = [f.return_score, f.risk_score, f.consistency_score, f.alpha_score, f.efficiency_score, f.resilience_score];
  const valid = scores.filter((s) => s != null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 50;
}

function luminance(hex) {
  const rgb = d3.color(hex);
  if (!rgb) return 0.5;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

export default function AllocationTreemap({
  funds,
  allocations,
  overrides,
  onAllocationChange,
  onFundSelect,
  selectedFundId,
  width,
  height,
}) {
  const svgRef = useRef(null);
  const [locked, setLocked] = useState({});

  const colorScale = useMemo(
    () => d3.scaleLinear().domain([20, 50, 80]).range(['#e2e8f0', '#99f6e4', '#0d9488']).clamp(true),
    []
  );

  const overrideMap = useMemo(() => {
    const m = {};
    (overrides || []).forEach((o) => { m[o.target_id] = o; });
    return m;
  }, [overrides]);

  const total = useMemo(
    () => funds.reduce((sum, f) => sum + (allocations[f.mstar_id] || 0), 0),
    [funds, allocations]
  );

  useEffect(() => {
    if (!svgRef.current || !funds.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const root = d3.hierarchy({
      children: funds.map((f) => ({
        ...f,
        value: allocations[f.mstar_id] || 0,
      })),
    }).sum((d) => Math.max(d.value, 0.5));

    d3.treemap().size([width, height]).padding(3).round(true)(root);

    const leaves = svg
      .selectAll('g')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => onFundSelect(d.data.mstar_id));

    leaves
      .append('rect')
      .attr('width', (d) => Math.max(d.x1 - d.x0, 0))
      .attr('height', (d) => Math.max(d.y1 - d.y0, 0))
      .attr('rx', 4)
      .attr('fill', (d) => colorScale(avgScore(d.data)))
      .attr('stroke', (d) => {
        if (d.data.mstar_id === selectedFundId) return '#0d9488';
        const ov = overrideMap[d.data.mstar_id];
        if (ov) return ov.direction === 'NEGATIVE' ? '#dc2626' : '#059669';
        return 'none';
      })
      .attr('stroke-width', (d) => {
        if (d.data.mstar_id === selectedFundId) return 2;
        return overrideMap[d.data.mstar_id] ? 3 : 0;
      })
      .attr('stroke-dasharray', (d) =>
        d.data.mstar_id === selectedFundId ? '4 2' : 'none'
      );

    leaves
      .append('text')
      .attr('x', 6)
      .attr('y', 16)
      .attr('font-size', '12px')
      .attr('fill', (d) => (luminance(colorScale(avgScore(d.data))) > 0.55 ? '#1e293b' : '#ffffff'))
      .text((d) => {
        const w = d.x1 - d.x0;
        if (w < 50) return '';
        const name = d.data.fund_name || '';
        return name.length > Math.floor(w / 7) ? name.slice(0, Math.floor(w / 7)) + '...' : name;
      });

    leaves
      .append('text')
      .attr('x', 6)
      .attr('y', 30)
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('fill', (d) => (luminance(colorScale(avgScore(d.data))) > 0.55 ? '#475569' : '#e2e8f0'))
      .text((d) => {
        const w = d.x1 - d.x0;
        return w >= 40 ? `${allocations[d.data.mstar_id] || 0}%` : '';
      });
  }, [funds, allocations, overrides, selectedFundId, width, height, colorScale, overrideMap, onFundSelect]);

  return (
    <div>
      <svg ref={svgRef} width={width} height={height} className="rounded-xl" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {funds.map((f) => (
          <div key={f.mstar_id} className="flex items-center gap-1">
            <label className="text-xs text-slate-600 truncate max-w-[6rem]" title={f.fund_name}>
              {f.fund_name}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={allocations[f.mstar_id] || 0}
              disabled={locked[f.mstar_id]}
              onChange={(e) => onAllocationChange(f.mstar_id, Number(e.target.value))}
              className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs font-mono tabular-nums text-right focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
            />
            <button
              onClick={() => setLocked((prev) => ({ ...prev, [f.mstar_id]: !prev[f.mstar_id] }))}
              className="text-xs text-slate-400 hover:text-slate-600"
              title={locked[f.mstar_id] ? 'Unlock' : 'Lock'}
            >
              {locked[f.mstar_id] ? '\u{1F512}' : '\u{1F513}'}
            </button>
          </div>
        ))}
      </div>

      <p className={`mt-2 text-sm font-mono tabular-nums font-medium ${total === 100 ? 'text-teal-600' : 'text-red-600'}`}>
        Total: {total}%
      </p>
    </div>
  );
}
