import Card from '../shared/Card';

function pctBetter(fund, peer, isLowerBetter = false) {
  if (fund == null || peer == null) return null;
  const f = Number(fund);
  const p = Number(peer);
  if (isNaN(f) || isNaN(p) || p === 0) return null;
  const diff = isLowerBetter ? p - f : f - p;
  const pct = (diff / Math.abs(p)) * 100;
  return pct;
}

function HeroMetric({ label, value, pct, isLowerBetter = false, format }) {
  const displayVal = value != null ? format(value) : '—';
  const better = pct != null ? Math.abs(pct).toFixed(0) : null;
  const isBetter = pct != null && pct > 0;

  return (
    <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className="text-2xl font-mono tabular-nums font-bold text-slate-800">{displayVal}</span>
      {better != null && (
        <span
          className={`text-[11px] font-medium ${isBetter ? 'text-emerald-600' : 'text-red-600'}`}
        >
          {isBetter ? `${better}% better than peers` : `${better}% worse than peers`}
        </span>
      )}
    </div>
  );
}

function DetailRow({ label, value, format }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-mono tabular-nums font-medium text-slate-700">
        {value != null ? format(value) : '—'}
      </span>
    </div>
  );
}

const fmtPct2 = (v) => `${Number(v).toFixed(2)}%`;
const fmtNum2 = (v) => Number(v).toFixed(2);
const fmtPctAbs = (v) => `${Math.abs(Number(v)).toFixed(2)}%`;

/**
 * RiskProfile — hero metrics + detail grid.
 *
 * Props:
 *   riskStats  object — { max_drawdown, sharpe_ratio, downside_capture, std_dev, beta, sortino, ... }
 *   peerAvg    object — optional, same shape for comparison
 */
export default function RiskProfile({ riskStats, peerAvg }) {
  if (!riskStats) {
    return (
      <Card title="Risk Profile">
        <div className="py-8 text-center text-sm text-slate-400">No risk data available</div>
      </Card>
    );
  }

  const ddPct = pctBetter(riskStats.max_drawdown, peerAvg?.max_drawdown, true);
  const sharpePct = pctBetter(riskStats.sharpe_ratio, peerAvg?.sharpe_ratio, false);
  const dcPct = pctBetter(riskStats.downside_capture, peerAvg?.downside_capture, true);

  return (
    <Card title="Risk Profile">
      {/* Hero metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <HeroMetric
          label="Max Drawdown"
          value={riskStats.max_drawdown}
          pct={ddPct}
          isLowerBetter
          format={fmtPctAbs}
        />
        <HeroMetric
          label="Sharpe Ratio"
          value={riskStats.sharpe_ratio}
          pct={sharpePct}
          format={fmtNum2}
        />
        <HeroMetric
          label="Downside Capture"
          value={riskStats.downside_capture}
          pct={dcPct}
          isLowerBetter
          format={fmtPct2}
        />
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <DetailRow label="Std Deviation" value={riskStats.std_dev} format={fmtPct2} />
        <DetailRow label="Beta" value={riskStats.beta} format={fmtNum2} />
        <DetailRow label="Sortino Ratio" value={riskStats.sortino} format={fmtNum2} />
        <DetailRow label="Alpha" value={riskStats.alpha} format={fmtNum2} />
        {riskStats.upside_capture != null && (
          <DetailRow label="Upside Capture" value={riskStats.upside_capture} format={fmtPct2} />
        )}
        {riskStats.information_ratio != null && (
          <DetailRow label="Information Ratio" value={riskStats.information_ratio} format={fmtNum2} />
        )}
      </div>
    </Card>
  );
}
