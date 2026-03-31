import { formatINR, formatPct } from '../../lib/format';
import SectionTitle from '../shared/SectionTitle';

export default function SignalTimeline({ events }) {
  if (!events?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Signal Events</SectionTitle>
        <p className="text-sm text-slate-400">No signal events yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Timeline of signal-triggered deployments with returns since each event">
        Signal Events
      </SectionTitle>

      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-2.5 top-1 bottom-1 w-px bg-teal-300" />

        <div className="space-y-4">
          {events.map((evt, i) => {
            const retSince = evt.return_since;
            const retColor = retSince == null
              ? 'text-slate-400'
              : Number(retSince) >= 0
              ? 'text-emerald-600'
              : 'text-red-600';

            return (
              <div key={evt.id || i} className="relative">
                {/* Dot */}
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-teal-100 border-2 border-teal-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                </div>

                <div className="pb-1">
                  {/* Date + rule */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-slate-700">
                      {evt.date || '\u2014'}
                    </span>
                    {evt.rule_name && (
                      <span className="text-[10px] text-slate-400">
                        {evt.rule_name}
                      </span>
                    )}
                  </div>

                  {/* Amount + multiplier + return */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {evt.amount != null && (
                      <span className="font-mono tabular-nums text-xs text-slate-700">
                        {formatINR(evt.amount)}
                      </span>
                    )}
                    {evt.multiplier != null && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-700">
                        {evt.multiplier}x
                      </span>
                    )}
                    {retSince != null && (
                      <span className={`font-mono tabular-nums text-xs font-medium ${retColor}`}>
                        {formatPct(retSince)} since
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
