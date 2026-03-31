import { formatINR } from '../../lib/format';
import Pill from '../shared/Pill';
import SimulationResults from './SimulationResults';

const PERIODS = ['3Y', '5Y', '7Y', '10Y'];

export default function ReviewStep({
  state,
  config,
  rules,
  period,
  setPeriod,
  backtestOnly,
  setBacktestOnly,
  simulating,
  simError,
  results,
  onRunSimulation,
  onSave,
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Review & Backtest</h3>
        <p className="text-xs text-slate-500 mt-1">Verify your configuration and run the simulation.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-[10px] text-slate-500 font-medium">Funds</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{state.funds.length}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-[10px] text-slate-500 font-medium">Monthly SIP</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{formatINR(config.sipAmount, 0)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-[10px] text-slate-500 font-medium">Lumpsum</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{formatINR(config.lumpsumAmount, 0)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-[10px] text-slate-500 font-medium">Signal Rules</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-800">{rules.length}</p>
        </div>
      </div>

      {/* Fund list summary */}
      {state.funds.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 text-slate-500 font-medium">Fund</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">Allocation</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">SIP Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.funds.map((fund) => {
                const alloc = state.allocations[fund.mstar_id] || 0;
                const sipShare = (alloc / 100) * config.sipAmount;
                return (
                  <tr key={fund.mstar_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{fund.fund_name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{alloc.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{formatINR(sipShare, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Period selection */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-600">Simulation Period</p>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <Pill key={p} active={period === p} onClick={() => setPeriod(p)}>
              {p}
            </Pill>
          ))}
        </div>
      </div>

      {/* Backtest toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={backtestOnly}
            onChange={(e) => setBacktestOnly(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Backtest only (do not activate for live tracking)
        </label>
      </div>

      {/* Run simulation button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRunSimulation}
          disabled={state.funds.length === 0 || simulating}
          className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {simulating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running Simulation...
            </span>
          ) : 'Run Backtest'}
        </button>
        {state.funds.length === 0 && (
          <p className="text-xs text-amber-600">Add at least one fund to run simulation</p>
        )}
      </div>

      {/* Results */}
      {(results || simError) && (
        <div className="pt-4 border-t border-slate-100">
          <SimulationResults
            results={results}
            loading={simulating}
            error={simError}
            onSave={onSave}
          />
        </div>
      )}
    </div>
  );
}
