import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3'
import type { VisitationRecord } from '../types'
import { MONTH_NAMES as MONTHS, buildMonthValues } from '../utils/monthValues'


// Layout (px). The container height includes the x-axis band so labels never clip.
// Taller when wide, so thin columns keep sensible proportions
const plotHeightFor = (width: number) => (width >= 720 ? 280 : 200)
// Below this band width, three-letter month names collide
const MIN_STEP_FOR_SHORT_NAMES = 30
const MARGIN = { top: 24, right: 8, bottom: 28, left: 44 }
const MAX_BAR_WIDTH = 24
const BAR_RADIUS = 4
const FALLBACK_WIDTH = 480

interface MonthlyVisitationChartProps {
  data: VisitationRecord[]
  year: number
  selectedMonth: number
  onSelectMonth: (month: number) => void
}

/** Axis ticks: in full under 10,000, compact above (50K). */
const formatTick = (value: number) =>
  value >= 10_000 ? `${value / 1000}K` : value.toLocaleString()

/** Label on a column cap: one decimal of thousands (175.7K). */
const formatCap = (value: number) =>
  value >= 10_000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString()

/** A column with a rounded data end and a square baseline. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(BAR_RADIUS, width / 2, height)
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    'Z',
  ].join(' ')
}

export default function MonthlyVisitationChart({
  data,
  year,
  selectedMonth,
  onSelectMonth,
}: MonthlyVisitationChartProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  const [hovered, setHovered] = useState<number | null>(null)
  const titleId = useId()

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const months = useMemo(() => buildMonthValues(data, year), [data, year])
  const selected = months.find(m => m.month === selectedMonth)
  const hoveredMonth = months.find(m => m.month === hovered)

  const plotHeight = plotHeightFor(width)
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const x = scaleBand<number>()
    .domain(MONTHS.map((_, i) => i + 1))
    .range([0, innerWidth])
    .paddingInner(0.25)
    .paddingOuter(0.1)
  const y = scaleLinear()
    .domain([0, Math.max(...months.map(m => m.visitors), 1)])
    .range([plotHeight, 0])
    .nice(4)
  const barWidth = Math.min(MAX_BAR_WIDTH, x.bandwidth())
  const barX = (month: number) => x(month)! + (x.bandwidth() - barWidth) / 2

  if (months.length === 0) {
    return <p className="text-sm text-muted-foreground">No monthly data for {year}</p>
  }

  const summary = selected
    ? `Visitors by month in ${year}. ${selected.name} is highlighted with ${selected.visitors.toLocaleString()} visitors, the ${ordinal(selected.rank)} busiest of ${months.length} months.`
    : `Visitors by month in ${year}.`

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={width}
        height={MARGIN.top + plotHeight + MARGIN.bottom}
        role="img"
        aria-labelledby={titleId}
        className="block overflow-visible"
      >
        <title id={titleId}>{summary}</title>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Gridlines and y-axis ticks */}
          {y.ticks(4).map(tick => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line
                x2={innerWidth}
                stroke={tick === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={-8}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {/* Columns */}
          {months.map(m => {
            const top = y(m.visitors)
            const isSelected = m.month === selectedMonth
            const isHovered = m.month === hovered
            return (
              <path
                key={m.month}
                d={columnPath(barX(m.month), top, barWidth, plotHeight - top)}
                data-month={m.month}
                data-selected={isSelected || undefined}
                fill={
                  isSelected
                    ? 'var(--chart-emphasis)'
                    : isHovered
                      ? 'var(--chart-context-hover)'
                      : 'var(--chart-context)'
                }
                className="transition-[fill] duration-150 motion-reduce:transition-none"
              />
            )
          })}

          {/* Value on the selected column's cap (the tooltip shows it while hovered) */}
          {selected && hovered !== selected.month && (
            <text
              x={barX(selected.month) + barWidth / 2}
              y={y(selected.visitors) - 8}
              textAnchor="middle"
              className="fill-foreground text-xs font-semibold"
            >
              {formatCap(selected.visitors)}
            </text>
          )}

          {/* Month labels */}
          {MONTHS.map((name, i) => (
            <text
              key={name}
              x={x(i + 1)! + x.bandwidth() / 2}
              y={plotHeight + 18}
              textAnchor="middle"
              className={`text-[11px] ${i + 1 === selectedMonth ? 'fill-foreground font-semibold' : 'fill-muted-foreground'}`}
            >
              {x.step() >= MIN_STEP_FOR_SHORT_NAMES ? name.slice(0, 3) : name[0]}
            </text>
          ))}

          {/* Hit targets: the whole column band, bigger than the bar. Pointer only;
              keyboard users select months with the dropdown or the month list. */}
          {months.map(m => (
            <rect
              key={m.month}
              data-testid={`month-hit-${m.month}`}
              x={x(m.month)! - (x.step() - x.bandwidth()) / 2}
              y={-MARGIN.top}
              width={x.step()}
              height={MARGIN.top + plotHeight + MARGIN.bottom}
              fill="transparent"
              className="cursor-pointer"
              aria-hidden="true"
              onPointerEnter={() => setHovered(m.month)}
              onPointerLeave={() => setHovered(h => (h === m.month ? null : h))}
              onClick={() => onSelectMonth(m.month)}
            />
          ))}
        </g>
      </svg>

      {/* Tooltip: value first, then month and rank */}
      {hoveredMonth && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
          style={{
            left: MARGIN.left + barX(hoveredMonth.month) + barWidth / 2,
            top: MARGIN.top + y(hoveredMonth.visitors) - 10,
          }}
        >
          <div className="text-sm font-semibold text-foreground">
            {hoveredMonth.visitors.toLocaleString()} visitors
          </div>
          <div className="text-muted-foreground">
            {hoveredMonth.name} · #{hoveredMonth.rank} of {months.length}
          </div>
        </div>
      )}

      {/* Table view: every value without hovering */}
      <table className="sr-only">
        <caption>Visitors by month, {year}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Visitors</th>
            <th scope="col">Rank</th>
          </tr>
        </thead>
        <tbody>
          {months.map(m => (
            <tr key={m.month}>
              <th scope="row">{m.name}</th>
              <td>{m.visitors.toLocaleString()}</td>
              <td>{m.rank} of {months.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}
