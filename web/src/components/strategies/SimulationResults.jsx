/**
 * SimulationResults — orchestrates the full results display.
 * Sub-components live in SimulationParts.jsx to keep files under 300 lines.
 */

import { useMemo } from 'react';
import { formatINR, formatPct } from '../../lib/format';
import { MODE_COLORS, MODE_LABELS, findBestMode, resampleTimeline } from '../../lib/simulation';
import SkeletonLoader from '../shared/SkeletonLoader';
import {
  ComparisonCard, SignalEventTimeline, CashFlowDetail, EquityCurveChart,
} from './SimulationParts';

function NarrativeInsight({ bestMode, results }) {
  const s = results[bestMode]?.summary;
  if (!s) return null;

  return (
    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-teal-800 mb-1">Recommendation</p>
          <p className="text-sm text-teal-700 leading-relaxed">
            <strong>{MODE_LABELS[bestMode]}</strong> delivers the highest XIRR at{' '}
            <span className="font-mono tabular-nums font-semibold">{formatPct(s.xirr_pct)}</span>
            {' '}with a final value of{' '}
            <span className="font-mono tabular-nums font-semibold">{formatINR(s.final_value, 0)}</span>
            {' '}on{' '}
            <span className="font-mono tabular-nums font-semibold">{formatINR(s.total_invested, 0)}</span>
            {' '}invested.
            {s.num_topups > 0
              ? ` ${s.num_topups} signal events triggered extra deployments, capturing market dips effectively.`
              : ' Consistent systematic investment delivered reliable compounding in this scenario.'}
            {s.max_drawdown_pct > 0 && ` Max drawdown was ${Number(s.max_drawdown_pct).toFixed(1)}%.`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SimulationResults({ results, loading, error, onSave }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <SkeletonLoader key={i} className="h-64 rounded-xl" />)}
        </div>
        <SkeletonLoader variant="chart" className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm text-red-700 font-medium">Simulation Error</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!results) return null;

  const modes = Object.keys(results).filter((k) => results[k]?.summary);
  const bestMode = findBestMode(results);

  // Merge all timelines for the equity curve chart
  const chartData = useMemo(() => {
    if (modes.length === 0) return [];
    const firstMode = modes[0];
    const timeline = results[firstMode]?.daily_timeline || [];
    const resampled = resampleTimeline(timeline);
    return resampled.map((point) => {
      const row = { date: point.date };
      modes.forEach((m) => {
        const modeTimeline = results[m]?.daily_timeline || [];
        const match = modeTimeline.find((p) => p.date === point.date);
        row[m] = match ? (match.portfolio_value || match.value) : null;
      });
      return row;
    });
  }, [results, modes]);

  // Signal event dots for the equity curve
  const signalDots = useMemo(() => {
    if (!bestMode) return [];
    const cashflows = results[bestMode]?.cashflow_events || [];
    const timeline = results[bestMode]?.daily_timeline || [];
    const topups = cashflows.filter((cf) => cf.event_type === 'TOPUP' || cf.event_type === 'LUMPSUM');

    return topups.map((tu) => {
      const snap = timeline.find((s) => s.date === tu.date);
      if (!snap) return null;
      const cfDate = new Date(tu.date);
      cfDate.setDate(cfDate.getDate() + 90);
      const laterStr = cfDate.toISOString().split('T')[0];
      const laterSnap = timeline.find((s) => s.date >= laterStr);
      return { date: tu.date, value: snap.portfolio_value, gain: laterSnap ? laterSnap.nav > tu.nav : true };
    }).filter(Boolean);
  }, [results, bestMode]);

  return (
    <div className="space-y-6">
      {/* Comparison cards */}
      <div className={`grid grid-cols-1 gap-4 ${modes.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        {modes.map((m) => (
          <ComparisonCard key={m} mode={m} summary={results[m]?.summary}
            isBest={m === bestMode} modeColor={MODE_COLORS[m] || '#94a3b8'} />
        ))}
      </div>

      {/* Narrative insight */}
      {bestMode && <NarrativeInsight bestMode={bestMode} results={results} />}

      {/* Equity curve with signal dots */}
      <EquityCurveChart chartData={chartData} modes={modes} bestMode={bestMode} signalDots={signalDots} />

      {/* Signal event timeline (collapsible) */}
      <SignalEventTimeline results={results} modes={modes} />

      {/* Cash flow detail (collapsible) */}
      <CashFlowDetail results={results} modes={modes} />

      {/* Save button */}
      {onSave && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">Save this strategy to your repository for future reference.</p>
          <button type="button" onClick={onSave}
            className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm">
            Save Strategy
          </button>
        </div>
      )}
    </div>
  );
}
