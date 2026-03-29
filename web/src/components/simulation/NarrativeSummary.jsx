import { useMemo } from 'react';
import { formatINR } from '../../lib/format';

function doublingYears(xirr) {
  if (!xirr || xirr <= 0) return null;
  return (72 / xirr).toFixed(1);
}

/**
 * NarrativeSummary — plain-English summary of simulation results.
 *
 * Props:
 *   results      object  — compareResults from simulation API
 *   fund         object  — selected fund
 *   config       object  — simulation config (sip_amount, etc.)
 *   period       string  — e.g. "7Y"
 */
export default function NarrativeSummary({ results, fund, config, period }) {
  const narrative = useMemo(() => {
    if (!results) return null;

    const sipData = results.SIP?.summary || results.SIP;
    const sigData = results.SIP_SIGNAL?.summary || results.SIP_SIGNAL;
    const bestMode = findBestMode(results);

    if (!sipData) return null;

    const fundName = fund?.fund_name || fund?.legal_name || 'this fund';
    const sipAmt = config?.sip_amount || 10000;
    const years = period?.replace('Y', '') || '7';

    const lines = [];

    // Opening line
    const finalVal = sipData.final_value ?? sipData.current_value;
    if (finalVal) {
      lines.push(
        `A monthly SIP of ${formatINR(sipAmt, 0)} in ${fundName} over ${years} years would have grown to ${formatINR(finalVal, 0)}.`
      );
    }

    // XIRR context
    const xirr = sipData.xirr_pct ?? sipData.cagr_pct;
    if (xirr != null) {
      const dbl = doublingYears(xirr);
      lines.push(
        `That's an annualized return of ${Number(xirr).toFixed(1)}%${dbl ? ` — your money roughly doubles every ${dbl} years` : ''}.`
      );
    }

    // Signal enhancement
    if (sigData) {
      const sigXirr = sigData.xirr_pct ?? sigData.cagr_pct;
      if (sigXirr != null && xirr != null) {
        const diff = Number(sigXirr) - Number(xirr);
        if (diff > 0.5) {
          lines.push(
            `Adding signal-based top-ups improved returns by ${diff.toFixed(1)} percentage points, reaching ${Number(sigXirr).toFixed(1)}% XIRR.`
          );
        } else if (diff < -0.5) {
          lines.push(
            `Signal-based top-ups didn't help this time — they actually reduced returns by ${Math.abs(diff).toFixed(1)} percentage points.`
          );
        } else {
          lines.push(
            `Signal-based top-ups had minimal impact on returns for this period.`
          );
        }
      }
    }

    // Risk context
    const drawdown = sipData.max_drawdown_pct ?? sipData.max_drawdown;
    if (drawdown != null) {
      const dd = Math.abs(Number(drawdown));
      if (dd > 30) {
        lines.push(
          `Be aware: the maximum drawdown was ${dd.toFixed(0)}% — you'd have seen your portfolio drop by nearly a third at one point.`
        );
      } else if (dd > 15) {
        lines.push(
          `The portfolio experienced a ${dd.toFixed(0)}% max drawdown — a moderate dip that required patience.`
        );
      } else {
        lines.push(
          `Risk was well-contained with only a ${dd.toFixed(0)}% max drawdown.`
        );
      }
    }

    // Best mode recommendation
    if (bestMode && bestMode.mode !== 'SIP') {
      const modeNames = { SIP_SIGNAL: 'SIP + Signals', LUMPSUM: 'Lumpsum', HYBRID: 'Hybrid' };
      lines.push(
        `${modeNames[bestMode.mode] || bestMode.mode} was the best strategy for this period with ${Number(bestMode.xirr).toFixed(1)}% XIRR.`
      );
    }

    return lines.join(' ');
  }, [results, fund, config, period]);

  if (!narrative) return null;

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
      <div className="flex items-start gap-2">
        <span className="text-teal-500 text-sm mt-0.5">✦</span>
        <p className="text-sm text-teal-900 leading-relaxed">{narrative}</p>
      </div>
    </div>
  );
}

function findBestMode(results) {
  const modes = ['SIP', 'SIP_SIGNAL', 'LUMPSUM', 'HYBRID'];
  let best = null;
  for (const mode of modes) {
    const data = results[mode]?.summary || results[mode];
    if (!data) continue;
    const xirr = data.xirr_pct ?? data.cagr_pct;
    if (xirr != null && (best == null || Number(xirr) > Number(best.xirr))) {
      best = { mode, xirr };
    }
  }
  return best;
}
