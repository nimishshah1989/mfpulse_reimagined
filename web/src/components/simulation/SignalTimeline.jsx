import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { formatINR } from '../../lib/format'
import { getSignalColor, computeStartDate } from '../../lib/simulation'
import Card from '../shared/Card'
import EmptyState from '../shared/EmptyState'

const MARGIN = { top: 20, right: 50, bottom: 30, left: 60 }
const NAV_RATIO = 0.7
const TEAL_600 = '#0d9488'
const TEAL_100 = '#ccfbf1'
const TEAL_400 = '#2dd4bf'

function SignalTimeline({ navHistory, cashflowEvents, period = '5Y', width = 800, height = 340 }) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  if (!navHistory || navHistory.length === 0) {
    return (
      <Card title="Signal Timeline">
        <EmptyState message="No NAV data available" />
      </Card>
    )
  }

  const parsedNav = useMemo(() =>
    navHistory.map(d => ({ date: new Date(d.nav_date), nav: +d.nav }))
      .sort((a, b) => a.date - b.date),
    [navHistory]
  )

  const visibleNav = useMemo(() => {
    const start = computeStartDate(period)
    return start ? parsedNav.filter(d => d.date >= start) : parsedNav
  }, [parsedNav, period])

  const visibleEvents = useMemo(() => {
    if (!cashflowEvents) return []
    const start = computeStartDate(period)
    return cashflowEvents
      .map(e => ({ ...e, date: new Date(e.date) }))
      .filter(e => !start || e.date >= start)
  }, [cashflowEvents, period])

  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom
  const navPanelH = innerH * NAV_RATIO
  const capPanelH = innerH * (1 - NAV_RATIO)
  const navPanelBottom = MARGIN.top + navPanelH
  const capPanelBottom = navPanelBottom + capPanelH

  const xScale = useMemo(() =>
    d3.scaleTime()
      .domain(d3.extent(visibleNav, d => d.date))
      .range([MARGIN.left, width - MARGIN.right]),
    [visibleNav, width]
  )

  const navScale = useMemo(() => {
    const [min, max] = d3.extent(visibleNav, d => d.nav)
    const pad = (max - min) * 0.05
    return d3.scaleLinear()
      .domain([min - pad, max + pad])
      .range([navPanelBottom, MARGIN.top])
  }, [visibleNav, navPanelBottom])

  const capitalData = useMemo(() => {
    if (!visibleEvents.length) return []
    let cum = 0
    return visibleEvents.map(e => {
      cum += +e.amount
      return { date: e.date, capital: cum, trigger: e.trigger }
    })
  }, [visibleEvents])

  const capitalScale = useMemo(() => {
    if (!capitalData.length) return null
    const max = d3.max(capitalData, d => d.capital) || 1
    return d3.scaleLinear()
      .domain([0, max * 1.1])
      .range([capPanelBottom, navPanelBottom + 4])
  }, [capitalData, capPanelBottom, navPanelBottom])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || visibleNav.length === 0) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // X-axis ticks
    ctx.strokeStyle = '#e2e8f0'
    ctx.fillStyle = '#64748b'
    ctx.font = '11px Inter, sans-serif'
    ctx.textAlign = 'center'
    const xTicks = xScale.ticks(6)
    xTicks.forEach(t => {
      const x = xScale(t)
      ctx.beginPath()
      ctx.moveTo(x, MARGIN.top)
      ctx.lineTo(x, capPanelBottom)
      ctx.stroke()
      ctx.fillText(d3.timeFormat('%b %Y')(t), x, capPanelBottom + 16)
    })

    // Y-axis ticks (NAV)
    ctx.textAlign = 'right'
    const yTicks = navScale.ticks(5)
    yTicks.forEach(t => {
      const y = navScale(t)
      ctx.beginPath()
      ctx.strokeStyle = '#f1f5f9'
      ctx.moveTo(MARGIN.left, y)
      ctx.lineTo(width - MARGIN.right, y)
      ctx.stroke()
      ctx.fillStyle = '#64748b'
      ctx.fillText(formatINR(t, 0), MARGIN.left - 6, y + 4)
    })

    // NAV line
    ctx.beginPath()
    ctx.strokeStyle = TEAL_600
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    visibleNav.forEach((d, i) => {
      const x = xScale(d.date)
      const y = navScale(d.nav)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Signal markers
    const bisector = d3.bisector(d => d.date).left
    visibleEvents.forEach(evt => {
      const x = xScale(evt.date)
      const idx = bisector(visibleNav, evt.date)
      const navPt = visibleNav[Math.min(idx, visibleNav.length - 1)]
      if (!navPt) return
      const y = navScale(navPt.nav)
      const color = getSignalColor(evt.trigger)

      ctx.setLineDash([4, 3])
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, navPanelBottom)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })

    // Capital step chart
    if (capitalData.length && capitalScale) {
      ctx.beginPath()
      ctx.moveTo(xScale(capitalData[0].date), capitalScale(0))
      capitalData.forEach(d => {
        const x = xScale(d.date)
        ctx.lineTo(x, capitalScale(d.capital))
      })
      const lastX = xScale(capitalData[capitalData.length - 1].date)
      ctx.lineTo(lastX, capitalScale(0))
      ctx.closePath()
      ctx.fillStyle = TEAL_100
      ctx.fill()

      // Topup highlights
      capitalData.forEach(d => {
        if (d.trigger && d.trigger !== 'SIP') {
          const x = xScale(d.date)
          ctx.beginPath()
          ctx.fillStyle = TEAL_400
          ctx.fillRect(x - 1.5, capitalScale(d.capital), 3, capitalScale(0) - capitalScale(d.capital))
        }
      })
    }
  }, [visibleNav, visibleEvents, capitalData, capitalScale, xScale, navScale, width, height, navPanelBottom, capPanelBottom])

  useEffect(() => { draw() }, [draw])

  const bisector = useMemo(() => d3.bisector(d => d.date).left, [])

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const date = xScale.invert(mx)
    const idx = bisector(visibleNav, date)
    const clamped = Math.max(0, Math.min(idx, visibleNav.length - 1))
    const pt = visibleNav[clamped]
    if (!pt) return

    const dayEvents = visibleEvents.filter(ev =>
      ev.date.toDateString() === pt.date.toDateString()
    )
    setTooltip({ x: mx, y: my, date: pt.date, nav: pt.nav, events: dayEvents })
  }, [xScale, bisector, visibleNav, visibleEvents])

  const handleMouseLeave = useCallback(() => setTooltip(null), [])

  return (
    <Card title="Signal Timeline">
      <div className="relative" style={{ width, height }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
        <svg
          ref={overlayRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ background: 'transparent' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {tooltip && (
          <div
            className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <p className="text-slate-500">{d3.timeFormat('%d %b %Y')(tooltip.date)}</p>
            <p className="font-mono tabular-nums font-semibold text-slate-800">
              NAV: {formatINR(tooltip.nav, 2)}
            </p>
            {tooltip.events.map((ev, i) => (
              <p key={i} className="mt-1 text-slate-600">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: getSignalColor(ev.trigger) }}
                />
                {ev.trigger}: {formatINR(ev.amount, 0)}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

export default SignalTimeline
