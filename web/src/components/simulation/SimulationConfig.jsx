import InfoIcon from '../shared/InfoIcon';

const PERIOD_OPTIONS = [
  { value: '5Y', label: '5 Years' },
  { value: '7Y', label: '7 Years' },
  { value: '10Y', label: '10 Years' },
  { value: 'max', label: 'Max' },
];

const SIP_DAY_OPTIONS = [1, 5, 10, 15];
const DEPLOY_OPTIONS = [10, 20, 33, 50];

function formatIndianInput(num) {
  if (num == null) return '';
  const s = String(Math.round(Number(num)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) parts.unshift(rest);
  return parts.join(',') + ',' + last3;
}

function parseIndianInput(str) {
  const cleaned = str.replace(/,/g, '').replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export default function SimulationConfig({
  config,
  period,
  onConfigChange,
  onPeriodChange,
  disabled,
}) {
  function handleChange(key, value) {
    onConfigChange({ ...config, [key]: value });
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <p className="section-title mb-3">Simulation Config</p>
      <div className="space-y-3">
        {/* SIP Amount + Lumpsum Reserve */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] font-medium text-slate-600">SIP Amount</label>
              <InfoIcon tip="Monthly investment amount. A typical SIP of 10,000-25,000/month is common for retail investors. The simulator invests this on your chosen SIP day each month." />
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-[10px] text-slate-400">{'\u20B9'}</span>
              <input
                type="text"
                value={formatIndianInput(config.sipAmount)}
                onChange={(e) => handleChange('sipAmount', parseIndianInput(e.target.value))}
                className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 tabular-nums focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] font-medium text-slate-600">Lumpsum Reserve</label>
              <InfoIcon tip="Cash reserve deployed when signals trigger. In Hybrid mode, this sits in liquid/overnight funds and gets deployed during market dips or breadth crossovers." />
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-[10px] text-slate-400">{'\u20B9'}</span>
              <input
                type="text"
                value={formatIndianInput(config.lumpsumAmount)}
                onChange={(e) => handleChange('lumpsumAmount', parseIndianInput(e.target.value))}
                className="w-full pl-6 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 tabular-nums focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>
        </div>

        {/* Period + SIP Day + Deploy % */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-medium text-slate-600 mb-1 block">Period</label>
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] font-medium text-slate-600">SIP Day</label>
              <InfoIcon tip="Day of month for SIP execution. Studies show the specific day has negligible long-term impact. Most investors choose 1st or 5th." />
            </div>
            <select
              value={config.sipDay}
              onChange={(e) => handleChange('sipDay', Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            >
              {SIP_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 5 ? 'th' : d === 10 ? 'th' : 'th'}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] font-medium text-slate-600">Deploy %</label>
              <InfoIcon tip="What % of lumpsum reserve to deploy per signal trigger. 20% means deploying 1L per signal from a 5L reserve. Lower % = more gradual deployment." />
            </div>
            <select
              value={config.lumpsumDeployPct}
              onChange={(e) => handleChange('lumpsumDeployPct', Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
            >
              {DEPLOY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}%</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
