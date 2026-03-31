import { formatINR, formatPct } from '../../lib/format';
import SectionTitle from '../shared/SectionTitle';

function ContribBar({ value, max, color }) {
  if (value == null || max === 0) return <span className="text-slate-300">{'\u2014'}</span>;
  const pct = Math.min(Math.abs(value / max) * 100, 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono tabular-nums text-[10px] text-slate-500 w-10 text-right">
        {formatPct(value)}
      </span>
    </div>
  );
}

export default function HoldingsTable({ holdings }) {
  if (!holdings?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Holdings</SectionTitle>
        <p className="text-sm text-slate-400">No holdings data available.</p>
      </div>
    );
  }

  const maxReturnContrib = Math.max(
    ...holdings.map((h) => Math.abs(h.return_contribution ?? 0)),
    0.01
  );
  const maxRiskContrib = Math.max(
    ...holdings.map((h) => Math.abs(h.risk_contribution ?? 0)),
    0.01
  );

  const totals = holdings.reduce(
    (acc, h) => ({
      weight: acc.weight + (h.weight ?? 0),
      current_value: acc.current_value + (h.current_value ?? 0),
    }),
    { weight: 0, current_value: 0 }
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <SectionTitle tip="Fund-level breakdown with contribution to overall portfolio return and risk">
        Holdings
      </SectionTitle>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Header */}
          <div className="grid grid-cols-[2fr_60px_90px_70px_100px_100px] gap-2 px-2 py-2 text-[10px] font-semibold tracking-wider uppercase text-slate-400 border-b border-slate-100">
            <span>Fund Name</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Value</span>
            <span className="text-right">Return</span>
            <span>Return Contrib</span>
            <span>Risk Contrib</span>
          </div>

          {/* Rows */}
          {holdings.map((h, i) => {
            const retColor = (h.fund_return ?? 0) >= 0 ? '#059669' : '#dc2626';
            return (
              <div
                key={h.mstar_id || i}
                className="grid grid-cols-[2fr_60px_90px_70px_100px_100px] gap-2 px-2 py-2.5 items-center text-xs border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-slate-800 truncate">{h.fund_name || '\u2014'}</p>
                  {h.category && (
                    <p className="text-[10px] text-slate-400 truncate">{h.category}</p>
                  )}
                </div>
                <div className="text-right relative">
                  <div
                    className="absolute inset-y-0 right-0 bg-teal-100/50 rounded-sm"
                    style={{ width: `${Math.min((h.weight ?? 0), 100)}%` }}
                  />
                  <span className="relative font-mono tabular-nums text-slate-700">
                    {h.weight != null ? `${h.weight.toFixed(1)}%` : '\u2014'}
                  </span>
                </div>
                <span className="text-right font-mono tabular-nums text-slate-700">
                  {formatINR(h.current_value)}
                </span>
                <span
                  className="text-right font-mono tabular-nums font-medium"
                  style={{ color: retColor }}
                >
                  {formatPct(h.fund_return)}
                </span>
                <ContribBar
                  value={h.return_contribution}
                  max={maxReturnContrib}
                  color="#0d9488"
                />
                <ContribBar
                  value={h.risk_contribution}
                  max={maxRiskContrib}
                  color="#d97706"
                />
              </div>
            );
          })}

          {/* Totals */}
          <div className="grid grid-cols-[2fr_60px_90px_70px_100px_100px] gap-2 px-2 py-2.5 text-xs font-semibold border-t border-slate-200 bg-slate-50/50">
            <span className="text-slate-700">Total</span>
            <span className="text-right font-mono tabular-nums text-slate-700">
              {totals.weight.toFixed(1)}%
            </span>
            <span className="text-right font-mono tabular-nums text-slate-700">
              {formatINR(totals.current_value)}
            </span>
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
