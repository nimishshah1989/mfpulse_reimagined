const STATUS_COLORS = {
  healthy: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'All Systems Operational' },
  degraded: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Partial Degradation' },
  down: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Service Disruption' },
};

export default function StatusHero({ health }) {
  const status = health?.status || 'healthy';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.healthy;

  return (
    <div className={`rounded-xl border p-5 ${colors.bg} border-${status === 'healthy' ? 'emerald' : status === 'degraded' ? 'amber' : 'red'}-100`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${colors.dot} animate-pulse`} />
          <div>
            <h1 className={`text-lg font-bold ${colors.text}`}>{colors.label}</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">
              MF Pulse Engine {'\u2014'} Port 8001 {'\u2014'} EC2 t3.large Mumbai
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Uptime</div>
          <div className="text-sm font-mono font-semibold text-slate-700 tabular-nums">
            {health?.uptime || '99.9%'}
          </div>
        </div>
      </div>
    </div>
  );
}
