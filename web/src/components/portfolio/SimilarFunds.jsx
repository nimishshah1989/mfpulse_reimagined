import { lensColor } from '../../lib/lens';
import { formatPct } from '../../lib/format';
import SectionTitle from '../shared/SectionTitle';

const MINI_METRICS = [
  { key: 'cagr', label: 'CAGR' },
  { key: 'max_drawdown', label: 'Max DD' },
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'sector_overlap', label: 'Sector Overlap' },
];

const LENS_KEYS = [
  'return_score',
  'risk_score',
  'consistency_score',
  'alpha_score',
  'efficiency_score',
  'resilience_score',
];

function FundCard({ fund }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      {/* Match badge */}
      {fund.match_pct != null && (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-700 mb-2">
          {Math.round(fund.match_pct)}% Match
        </span>
      )}

      {/* Name + category */}
      <p className="text-sm font-semibold text-slate-800 truncate">{fund.fund_name || '\u2014'}</p>
      {fund.category && (
        <p className="text-[10px] text-slate-400 truncate mb-3">{fund.category}</p>
      )}

      {/* Mini metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {MINI_METRICS.map((m) => {
          const val = fund[m.key];
          const isNeg = m.key === 'max_drawdown';
          return (
            <div key={m.key} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{m.label}</span>
              <span className="font-mono tabular-nums text-[11px] font-medium"
                style={{
                  color: val == null
                    ? '#94a3b8'
                    : m.key === 'sharpe'
                    ? '#475569'
                    : isNeg
                    ? '#dc2626'
                    : Number(val) >= 0
                    ? '#059669'
                    : '#dc2626',
                }}
              >
                {val == null
                  ? '\u2014'
                  : m.key === 'sharpe'
                  ? Number(val).toFixed(2)
                  : m.key === 'sector_overlap'
                  ? `${Number(val).toFixed(0)}%`
                  : formatPct(val)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Lens dots */}
      <div className="flex items-center gap-1">
        {LENS_KEYS.map((k) => {
          const score = fund[k];
          return (
            <span
              key={k}
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: score != null ? lensColor(score) : '#e2e8f0' }}
              title={`${k.replace('_score', '')}: ${score != null ? Math.round(score) : '\u2014'}`}
            />
          );
        })}
      </div>

      {/* View link */}
      {fund.mstar_id && (
        <a
          href={`/fund360?id=${fund.mstar_id}`}
          className="block mt-3 text-[11px] font-medium text-teal-600 hover:text-teal-700"
        >
          View Fund →
        </a>
      )}
    </div>
  );
}

export default function SimilarFunds({ funds }) {
  if (!funds?.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SectionTitle>Similar Funds</SectionTitle>
        <p className="text-sm text-slate-400">No similar funds found.</p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle tip="Existing mutual funds with the most similar risk-return and sector profile">
        Similar Funds
      </SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {funds.slice(0, 3).map((f, i) => (
          <FundCard key={f.mstar_id || i} fund={f} />
        ))}
      </div>
    </div>
  );
}
