import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import SectionTitle from '../shared/SectionTitle';

const AXIS_LABELS = ['Return', 'Risk', 'Consistency', 'Alpha', 'Efficiency', 'Resilience'];
const AXIS_KEYS = [
  'return_score',
  'risk_score',
  'consistency_score',
  'alpha_score',
  'efficiency_score',
  'resilience_score',
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { lens } = payload[0]?.payload || {};
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-medium text-slate-700 mb-1">{lens}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="font-mono tabular-nums">
          {entry.name}: {Number(entry.value).toFixed(0)}
        </p>
      ))}
    </div>
  );
}

export default function BlendedLensRadar({ portfolio, categoryAverage }) {
  const hasPortfolio = portfolio && AXIS_KEYS.some((k) => portfolio[k] != null);
  const hasCategoryAvg = categoryAverage && AXIS_KEYS.some((k) => categoryAverage[k] != null);

  if (!hasPortfolio && !hasCategoryAvg) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Blended Lens Profile</SectionTitle>
        <p className="text-sm text-slate-400">No lens data available.</p>
      </div>
    );
  }

  const radarData = AXIS_KEYS.map((key, i) => ({
    lens: AXIS_LABELS[i],
    portfolio: portfolio?.[key] ?? 0,
    category: categoryAverage?.[key] ?? 0,
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Weighted-average 6-lens scores for the portfolio vs category average">
        Blended Lens Profile
      </SectionTitle>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="lens"
            tick={{ fontSize: 10, fill: '#64748b' }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickCount={5}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
          <Radar
            name="Portfolio"
            dataKey="portfolio"
            stroke="#0d9488"
            fill="#0d9488"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          {hasCategoryAvg && (
            <Radar
              name="Category Avg"
              dataKey="category"
              stroke="#94a3b8"
              fill="#94a3b8"
              fillOpacity={0.05}
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
