const KEYS = [
  'return_score',
  'risk_score',
  'consistency_score',
  'alpha_score',
  'efficiency_score',
  'resilience_score',
];

export default function MiniRadar({ scores, size = 60 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const angleStep = (2 * Math.PI) / 6;
  const startAngle = -Math.PI / 2;

  const axisPoints = KEYS.map((_, i) => {
    const angle = startAngle + i * angleStep;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const polyPoints = KEYS.map((key, i) => {
    const val = (scores[key] ?? 0) / 100;
    const angle = startAngle + i * angleStep;
    return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
  }).join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#f1f5f9"
        fillOpacity={0.3}
      />
      {axisPoints.map((pt, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={pt.x}
          y2={pt.y}
          stroke="#e2e8f0"
          strokeWidth={0.5}
        />
      ))}
      <polygon
        points={polyPoints}
        fill="#14b8a6"
        fillOpacity={0.4}
        stroke="#0d9488"
        strokeWidth={1}
      />
    </svg>
  );
}
