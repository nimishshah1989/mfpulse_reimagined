function pctBetter(fund, peer, isLowerBetter = false) {
  if (fund == null || peer == null) return null;
  const f = Number(fund);
  const p = Number(peer);
  if (isNaN(f) || isNaN(p) || p === 0) return null;
  const diff = isLowerBetter ? p - f : f - p;
  const pct = (diff / Math.abs(p)) * 100;
  return pct;
}

function HeroMetric({ label, value, pct, isLowerBetter = false, format, icon }) {
  const displayVal = value != null ? format(value) : '\u2014';
  const better = pct != null ? Math.abs(pct).toFixed(0) : null;
  const isBetter = pct != null && pct > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-2 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-3xl font-mono tabular-nums font-bold text-slate-800">{displayVal}</span>
      {better != null && (
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
              isBetter ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {isBetter ? '\u2191' : '\u2193'}
          </span>
          <span
            className={`text-xs font-medium ${isBetter ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {better}% {isBetter ? 'better' : 'worse'} than peers
          </span>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, format, peerVal, isLowerBetter }) {
  const hasComparison = value != null && peerVal != null;
  let compColor = 'text-slate-500';
  if (hasComparison) {
    const diff = isLowerBetter ? Number(peerVal) - Number(value) : Number(value) - Number(peerVal);
    compColor = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-500';
  }

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        {peerVal != null && (
          <span className="text-[10px] font-mono tabular-nums text-slate-400">
            Avg: {format(peerVal)}
          </span>
        )}
        <span className={`text-xs font-mono tabular-nums font-semibold ${compColor}`}>
          {value != null ? format(value) : '\u2014'}
        </span>
      </div>
    </div>
  );
}

const fmtPct2 = (v) => `${Number(v).toFixed(2)}%`;
const fmtNum2 = (v) => Number(v).toFixed(2);
const fmtPctAbs = (v) => `${Math.abs(Number(v)).toFixed(2)}%`;

/**
 * RiskProfile — 3 hero metric cards + full detail grid.
 *
 * Props:
 *   riskStats  object — { max_drawdown, sharpe_ratio, downside_capture, std_dev, beta, sortino, ... }
 *   peerAvg    object — optional, same shape for comparison
 */
export default function RiskProfile({ riskStats, peerAvg }) {
  if (!riskStats) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No risk data available
      </div>
    );
  }

  const ddPct = pctBetter(riskStats.max_drawdown, peerAvg?.max_drawdown, true);
  const stdPct = pctBetter(riskStats.std_dev, peerAvg?.std_dev, true);
  const sharpePct = pctBetter(riskStats.sharpe_ratio, peerAvg?.sharpe_ratio, false);

  return (
    <div className="space-y-5">
      {/* Hero metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HeroMetric
          label="Max Drawdown"
          value={riskStats.max_drawdown}
          pct={ddPct}
          isLowerBetter
          format={fmtPctAbs}
          icon={'\u26A1'}
        />
        <HeroMetric
          label="Std Dev (3Y)"
          value={riskStats.std_dev}
          pct={stdPct}
          isLowerBetter
          format={fmtPct2}
          icon={'\uD83D\uDCC9'}
        />
        <HeroMetric
          label="Sharpe Ratio"
          value={riskStats.sharpe_ratio}
          pct={sharpePct}
          format={fmtNum2}
          icon={'\uD83C\uDFAF'}
        />
      </div>

      {/* Full risk stats table */}
      <div className="bg-slate-50 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
          All Risk Metrics
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <DetailRow label="Max Drawdown" value={riskStats.max_drawdown} format={fmtPctAbs} peerVal={peerAvg?.max_drawdown} isLowerBetter />
          <DetailRow label="Std Deviation" value={riskStats.std_dev} format={fmtPct2} peerVal={peerAvg?.std_dev} isLowerBetter />
          <DetailRow label="Beta" value={riskStats.beta} format={fmtNum2} peerVal={peerAvg?.beta} isLowerBetter />
          <DetailRow label="Sharpe Ratio" value={riskStats.sharpe_ratio} format={fmtNum2} peerVal={peerAvg?.sharpe_ratio} />
          <DetailRow label="Sortino Ratio" value={riskStats.sortino} format={fmtNum2} peerVal={peerAvg?.sortino} />
          <DetailRow label="Alpha" value={riskStats.alpha} format={fmtNum2} peerVal={peerAvg?.alpha} />
          <DetailRow label="Downside Capture" value={riskStats.downside_capture} format={fmtPct2} peerVal={peerAvg?.downside_capture} isLowerBetter />
          {riskStats.upside_capture != null && (
            <DetailRow label="Upside Capture" value={riskStats.upside_capture} format={fmtPct2} peerVal={peerAvg?.upside_capture} />
          )}
          {riskStats.information_ratio != null && (
            <DetailRow label="Information Ratio" value={riskStats.information_ratio} format={fmtNum2} peerVal={peerAvg?.information_ratio} />
          )}
        </div>
      </div>
    </div>
  );
}
