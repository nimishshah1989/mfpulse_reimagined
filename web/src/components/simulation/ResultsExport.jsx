import { formatINR, formatPct } from '../../lib/format'
import { MODE_LABELS } from '../../lib/simulation'

const MODES = ['SIP', 'SIP_SIGNAL', 'LUMPSUM', 'HYBRID']

function ResultsExport({ fund, config, rules, results, period }) {
  if (!results) return null

  return (
    <>
      <button
        onClick={() => window.print()}
        className="border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Export Summary
      </button>

      <div className="hidden print:block p-8 text-sm text-slate-800">
        <h1 className="text-xl font-bold mb-1">{fund?.fund_name || 'Fund'} — Simulation Summary</h1>
        <p className="text-slate-500 mb-4">Period: {period}</p>

        <h2 className="font-semibold mb-2">Configuration</h2>
        <table className="w-full mb-4 border-collapse text-xs">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-1 text-slate-500">SIP Amount</td>
              <td className="py-1 font-mono tabular-nums">{formatINR(config.sip_amount, 0)}</td>
              <td className="py-1 text-slate-500">Lumpsum</td>
              <td className="py-1 font-mono tabular-nums">{formatINR(config.lumpsum_amount, 0)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-1 text-slate-500">Deploy %</td>
              <td className="py-1 font-mono tabular-nums">{config.deploy_pct ?? '-'}%</td>
              <td className="py-1 text-slate-500">SIP Day</td>
              <td className="py-1 font-mono tabular-nums">{config.sip_day ?? '-'}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-slate-500 mb-4">Signal rules configured: {rules?.length ?? 0}</p>

        <h2 className="font-semibold mb-2">Results</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-slate-500">
              <th className="py-1">Mode</th>
              <th className="py-1">XIRR</th>
              <th className="py-1">Invested</th>
              <th className="py-1">Value</th>
              <th className="py-1">Drawdown</th>
            </tr>
          </thead>
          <tbody>
            {MODES.map(mode => {
              const s = results[mode]?.summary || results[mode]
              if (!s) return null
              return (
                <tr key={mode} className="border-b border-slate-200">
                  <td className="py-1">{MODE_LABELS[mode]}</td>
                  <td className="py-1 font-mono tabular-nums">{formatPct(s.xirr_pct)}</td>
                  <td className="py-1 font-mono tabular-nums">{formatINR(s.total_invested, 0)}</td>
                  <td className="py-1 font-mono tabular-nums">{formatINR(s.current_value, 0)}</td>
                  <td className="py-1 font-mono tabular-nums">{formatPct(s.max_drawdown)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <style>{`@media print { body > *:not(.print\\:block) { display: none !important; } }`}</style>
    </>
  )
}

export default ResultsExport
