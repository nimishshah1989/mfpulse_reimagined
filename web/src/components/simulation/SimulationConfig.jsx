import Card from '../shared/Card';

const FIELDS = [
  { key: 'sipAmount', label: 'SIP Amount (₹/month)', min: 500, step: 500 },
  { key: 'lumpsumAmount', label: 'Lumpsum Reserve (₹)', min: 0, step: 10000 },
  { key: 'lumpsumDeployPct', label: 'Deploy per Signal (%)', min: 5, max: 100, step: 5 },
  { key: 'sipDay', label: 'SIP Day of Month', min: 1, max: 28, step: 1 },
];

export default function SimulationConfig({ config, onConfigChange, disabled }) {
  function handleChange(key, value) {
    onConfigChange({ ...config, [key]: value });
  }

  return (
    <Card className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Configuration</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {FIELDS.map(({ key, label, min, max, step }) => (
          <div key={key}>
            <label className="block text-xs text-slate-500 mb-1">{label}</label>
            <input
              type="number"
              value={config[key]}
              onChange={(e) => handleChange(key, Number(e.target.value))}
              min={min}
              max={max}
              step={step}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleChange('autoSimulate', !config.autoSimulate)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            config.autoSimulate
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Auto-simulate
        </button>
        <span className="text-xs text-slate-400">
          {config.autoSimulate ? 'Runs on every change' : 'Manual trigger'}
        </span>
      </div>
    </Card>
  );
}
