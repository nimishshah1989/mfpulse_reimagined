const MODES = [
  { key: 'sip_topups', label: 'SIP + Top-ups', desc: 'Regular SIP with signal-based top-ups' },
  { key: 'lumpsum_events', label: 'Lumpsum on Events', desc: 'Distribute annual budget on market signals' },
  { key: 'custom', label: 'Custom per Fund', desc: 'Configure each fund independently' },
];

export default function ModeToggle({ mode, onModeChange, sipAmount, onSipChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onModeChange(m.key)}
            className={`p-3 rounded-lg border-2 text-left transition-colors ${
              mode === m.key
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className={`text-sm font-semibold ${mode === m.key ? 'text-teal-700' : 'text-slate-700'}`}>
              {m.label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>

      {mode === 'lumpsum_events' && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-600">Forced monthly SIP:</label>
          <input
            type="number"
            value={sipAmount}
            onChange={(e) => onSipChange(Number(e.target.value))}
            className="w-28 border border-slate-200 rounded px-2 py-1 text-sm font-mono tabular-nums"
            min={0}
            step={1000}
          />
        </div>
      )}
    </div>
  );
}
