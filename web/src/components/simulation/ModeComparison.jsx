import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Card from '../shared/Card'
import SkeletonLoader from '../shared/SkeletonLoader'
import Badge from '../shared/Badge'
import { formatPct, formatINR } from '../../lib/format'
import { MODE_COLORS, MODE_LABELS, findBestMode, resampleTimeline } from '../../lib/simulation'

const MODES = ['SIP', 'SIP_SIGNAL', 'LUMPSUM', 'HYBRID']
const SIGNAL_MODES = new Set(['SIP_SIGNAL', 'HYBRID'])

function MetricRow({ label, value, className = '' }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-mono tabular-nums ${className}`}>{value}</span>
    </div>
  )
}

function DrawdownBar({ value }) {
  const pct = Math.min(Math.abs(value || 0), 100)
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Max Drawdown</span>
        <span className="font-mono tabular-nums text-red-600">{formatPct(value)}</span>
      </div>
      <div className="h-1.5 bg-red-100 rounded mt-0.5">
        <div className="h-1.5 bg-red-500 rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ResultCard({ mode, data, isBest, degraded }) {
  const summary = data?.summary || data
  if (!summary) return null

  const xirr = summary.xirr_pct
  const xirrColor = xirr >= 0 ? 'text-emerald-600' : 'text-red-600'
  const borderClass = isBest ? 'border-teal-500 border-2' : 'border-slate-200 border'

  return (
    <div className={`bg-white rounded-xl p-4 ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">{MODE_LABELS[mode]}</h3>
        <div className="flex gap-1">
          {isBest && <Badge className="bg-teal-600 text-white">BEST</Badge>}
          {degraded && <Badge className="bg-amber-100 text-amber-700">Degraded</Badge>}
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono tabular-nums ${xirrColor}`}>
        {formatPct(xirr)}
      </p>
      <p className="text-[10px] text-slate-400 mb-2">XIRR</p>
      <MetricRow label="Invested" value={formatINR(summary.total_invested, 0)} />
      <MetricRow label="Value" value={formatINR(summary.current_value, 0)} className="font-semibold text-slate-800" />
      <MetricRow label="Sharpe" value={(summary.sharpe_ratio ?? 0).toFixed(2)} />
      {SIGNAL_MODES.has(mode) && summary.signal_hit_count != null && (
        <MetricRow label="Signal Hits" value={summary.signal_hit_count} />
      )}
      <DrawdownBar value={summary.max_drawdown} />
    </div>
  )
}

function ModeComparison({ results, isLoading, marketpulseOnline }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODES.map(m => <SkeletonLoader key={m} className="h-56 rounded-xl" />)}
      </div>
    )
  }

  if (!results) {
    return (
      <Card title="Mode Comparison">
        <div className="py-12 text-center text-slate-400 text-sm">
          Configure and run a simulation to see results
        </div>
      </Card>
    )
  }

  const bestMode = useMemo(() => findBestMode(results), [results])

  const chartData = useMemo(() => {
    const resampled = {}
    let maxLen = 0
    MODES.forEach(mode => {
      const timeline = results[mode]?.daily_timeline
      if (timeline && timeline.length > 0) {
        resampled[mode] = resampleTimeline(timeline, 120)
        maxLen = Math.max(maxLen, resampled[mode].length)
      }
    })
    if (maxLen === 0) return []

    const base = Object.values(resampled).reduce((a, b) => a.length >= b.length ? a : b, [])
    return base.map((pt, i) => {
      const row = { date: pt.date }
      MODES.forEach(mode => {
        if (resampled[mode] && resampled[mode][i]) {
          row[mode] = resampled[mode][i].portfolio_value
        }
      })
      return row
    })
  }, [results])

  const formatYAxis = (val) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`
    if (val >= 100000) return `${(val / 100000).toFixed(1)}L`
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`
    return val
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODES.map(mode => (
          <ResultCard
            key={mode}
            mode={mode}
            data={results[mode]}
            isBest={mode === bestMode}
            degraded={!marketpulseOnline && SIGNAL_MODES.has(mode)}
          />
        ))}
      </div>

      {chartData.length > 0 && (
        <Card title="Equity Curves">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(d) => {
                  const dt = new Date(d)
                  return `${dt.getFullYear()}`
                }}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: '#64748b' }}
                width={55}
              />
              <Tooltip
                formatter={(val, name) => [formatINR(val, 0), MODE_LABELS[name]]}
                labelFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
              />
              <Legend
                formatter={(val) => MODE_LABELS[val]}
                wrapperStyle={{ fontSize: '12px' }}
              />
              {MODES.map(mode => (
                <Line
                  key={mode}
                  type="monotone"
                  dataKey={mode}
                  stroke={MODE_COLORS[mode]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

export default ModeComparison
