/**
 * FundManagerStrategy — Fund manager qualitative information card.
 * Shows manager identity, philosophy, strategy, and key fund facts
 * in a 2-column layout matching the sectors design language.
 */
import InfoBulb from '../shared/InfoBulb';

function getManagerInitials(managers) {
  if (!managers || typeof managers !== 'string' || !managers.trim()) return 'FM';
  const firstName = managers.split(',')[0].trim();
  const words = firstName.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'FM';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function computeTenure(inceptionDate) {
  if (!inceptionDate) return null;
  const start = new Date(inceptionDate);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  const years = Math.floor((now - start) / (365.25 * 24 * 60 * 60 * 1000));
  return years;
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPct(value) {
  if (value == null || isNaN(value)) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function getPurchaseMode(mode) {
  if (mode === 2) return 'Direct Growth';
  if (mode === 1) return 'Regular Growth';
  return '—';
}

function FactCell({ label, value, valueClass }) {
  return (
    <div className="bg-white p-2.5">
      <p className="text-[9px] text-slate-400 uppercase mb-0.5">{label}</p>
      <p className={`text-[12px] font-semibold text-slate-700 font-mono tabular-nums ${valueClass || ''}`}>
        {value}
      </p>
    </div>
  );
}

export default function FundManagerStrategy({ fundDetail }) {
  if (!fundDetail) return null;

  const {
    managers,
    investment_philosophy,
    investment_strategy,
    primary_benchmark,
    sip_available,
    inception_date,
    purchase_mode,
    net_expense_ratio,
    expense_ratio,
    turnover_ratio,
    lock_in_period,
    distribution_status,
    indian_risk_level,
  } = fundDetail;

  const initials = getManagerInitials(managers);
  const tenure = computeTenure(inception_date);
  const managerName = managers
    ? managers.split(',')[0].trim()
    : 'Unknown Manager';
  const hasPhilosophy = investment_philosophy && investment_philosophy.trim();
  const hasStrategy = investment_strategy && investment_strategy.trim();

  const sipLabel =
    sip_available === true
      ? 'Yes'
      : sip_available === false
        ? 'No'
        : '—';

  const expenseDisplay = formatPct(net_expense_ratio ?? expense_ratio);
  const turnoverDisplay = formatPct(turnover_ratio);
  const lockInDisplay =
    lock_in_period != null && lock_in_period > 0
      ? `${lock_in_period} yr`
      : lock_in_period === 0
        ? 'None'
        : '—';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="section-title mb-4">Fund Manager & Strategy</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* LEFT — Manager Info */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-800">
                {managerName}
              </p>
              <p className="text-[11px] text-slate-400">
                Fund Manager
                {inception_date ? ` · Since ${formatDate(inception_date)}` : ''}
                {tenure != null ? ` · ${tenure} yr tenure` : ''}
              </p>
            </div>
          </div>

          {hasPhilosophy || hasStrategy ? (
            <div className="space-y-3 mt-3">
              {hasPhilosophy && (
                <div>
                  <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Investment Philosophy
                  </p>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    {investment_philosophy}
                  </p>
                </div>
              )}
              {hasStrategy && (
                <div>
                  <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Investment Strategy
                  </p>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    {investment_strategy}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 mt-3">
              No strategy information available for this fund
            </p>
          )}
        </div>

        {/* RIGHT — Fund Facts */}
        <div>
          <p className="text-[11px] font-bold text-slate-700 mb-2">
            Fund Facts
          </p>
          <div className="grid grid-cols-2 gap-px bg-slate-100 rounded-lg overflow-hidden">
            <FactCell label="Inception" value={formatDate(inception_date)} />
            <FactCell
              label="Benchmark"
              value={primary_benchmark || '—'}
            />
            <FactCell
              label="Purchase Mode"
              value={getPurchaseMode(purchase_mode)}
            />
            <FactCell
              label="SIP Available"
              value={sipLabel}
              valueClass={
                sip_available === true ? 'text-emerald-600' : ''
              }
            />
            <FactCell label="Expense Ratio" value={expenseDisplay} />
            <FactCell label="Turnover" value={turnoverDisplay} />
            <FactCell label="Lock-in" value={lockInDisplay} />
            <FactCell
              label="Distribution"
              value={distribution_status || '—'}
            />
          </div>
        </div>
      </div>

      <InfoBulb
        title="Fund Manager"
        items={[
          {
            icon: '\u{1F464}',
            label: 'Manager tenure',
            text: "Longer tenure means the track record IS the manager's record. 5+ years = reliable attribution.",
          },
          {
            icon: '\u{1F4CB}',
            label: 'Investment philosophy',
            text: 'How the manager thinks about investing — growth, value, GARP, momentum, etc. Alignment with your own style matters.',
          },
        ]}
      />
    </div>
  );
}
