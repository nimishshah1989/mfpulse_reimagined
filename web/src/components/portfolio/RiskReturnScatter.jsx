import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import SectionTitle from '../shared/SectionTitle';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-medium text-slate-700 mb-1">{d.name}</p>
      <p className="font-mono tabular-nums text-slate-600">Risk: {Number(d.risk).toFixed(2)}%</p>
      <p className="font-mono tabular-nums text-slate-600">Return: {Number(d.cagr).toFixed(2)}%</p>
    </div>
  );
}

export default function RiskReturnScatter({ portfolio, benchmark, medianRisk, medianReturn }) {
  if (!portfolio) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Risk-Return Positioning</SectionTitle>
        <p className="text-sm text-slate-400">No scatter data available.</p>
      </div>
    );
  }

  const points = [
    { name: 'Portfolio', risk: portfolio.risk, cagr: portfolio.cagr, type: 'portfolio' },
  ];
  if (benchmark) {
    points.push({ name: 'Benchmark', risk: benchmark.risk, cagr: benchmark.cagr, type: 'benchmark' });
  }

  const medR = medianRisk ?? portfolio.risk;
  const medC = medianReturn ?? portfolio.cagr;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Portfolio positioned on a risk-return plot with quadrant labels">
        Risk-Return Positioning
      </SectionTitle>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="risk"
            type="number"
            name="Risk (Std Dev)"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            label={{ value: 'Risk (Std Dev %)', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94a3b8' }}
          />
          <YAxis
            dataKey="cagr"
            type="number"
            name="Return (CAGR)"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={45}
            label={{ value: 'Return (CAGR %)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={medR} stroke="#e2e8f0" strokeDasharray="3 3" />
          <ReferenceLine y={medC} stroke="#e2e8f0" strokeDasharray="3 3" />
          <Scatter data={points} nameKey="name">
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={p.type === 'portfolio' ? '#0d9488' : '#94a3b8'}
                stroke={p.type === 'portfolio' ? '#0d9488' : '#94a3b8'}
                strokeWidth={p.type === 'benchmark' ? 2 : 0}
                r={p.type === 'portfolio' ? 8 : 6}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant labels */}
      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-400">
        <div className="text-left">Conservative</div>
        <div className="text-right">High Risk High Return</div>
        <div className="text-left">Sweet Spot</div>
        <div className="text-right">Avoid</div>
      </div>
    </div>
  );
}
