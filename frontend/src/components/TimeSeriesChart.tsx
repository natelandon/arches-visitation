import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { useDataStore } from '../store/dataStore'
import type { VisitationRecord, AnnualData } from '../types'

interface TimeSeriesChartProps {
  useAnnualData?: boolean
  excludeCurrentYear?: boolean
}

interface DataWithChanges extends AnnualData {
  prevVisitors: number | null
  change: number
}

// Configuration constants - extracted from magic numbers
const CHART_CONFIG = {
  margin: { top: 20, right: 30, bottom: 30, left: 60 },
  height: 350,
  minWidth: 100,
  bar: { opacity: 0.8, opacityHover: 1 },
  colors: { growth: '#10b981', decline: '#ef4444', neutral: 'currentColor' },
  line: { strokeWidth: 2.5, strokeDasharray: '4', opacity: 0.05 },
  circle: { r: 5, strokeWidth: 2 },
  interactive: { fillOpacity: 0.01, tooltipOffset: 15 }
}

// Helper: Filter data by current year
const filterByCurrentYear = (data: (AnnualData | VisitationRecord)[], useAnnual: boolean): (AnnualData | VisitationRecord)[] => {
  const currentYear = new Date().getFullYear()
  return data.filter(d => {
    if (useAnnual) {
      return (d as AnnualData).year < currentYear
    }
    return new Date((d as VisitationRecord).date).getFullYear() < currentYear
  })
}

// Helper: Sort data appropriately
const sortChartData = (data: (AnnualData | VisitationRecord)[], useAnnual: boolean): (AnnualData | VisitationRecord)[] => {
  return useAnnual
    ? [...(data as AnnualData[])].sort((a, b) => a.year - b.year)
    : [...(data as VisitationRecord[])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

// Helper: Create scales based on data type (eliminates repeated scale logic)
const createScales = (data: (AnnualData | VisitationRecord)[], width: number, height: number, useAnnual: boolean) => {
  let xScale: d3.ScaleLinear<number, number> | d3.ScaleTime<number, number>
  let yMax: number

  if (useAnnual) {
    const annualData = data as AnnualData[]
    xScale = d3.scaleLinear()
      .domain([d3.min(annualData, d => d.year) ?? 0, d3.max(annualData, d => d.year) ?? 0])
      .range([0, width])
    yMax = d3.max(annualData, d => d.visitors) ?? 0
  } else {
    const visitData = data as VisitationRecord[]
    xScale = d3.scaleTime()
      .domain([
        d3.min(visitData, d => new Date(d.date)) ?? new Date(),
        d3.max(visitData, d => new Date(d.date)) ?? new Date()
      ])
      .range([0, width])
    yMax = d3.max(visitData, d => d.visitors) ?? 0
  }

  const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0])
  return { xScale, yScale }
}

// Helper: Find closest data point to mouse position (eliminates duplicated hover logic)
const findClosestPoint = (
  mouseX: number,
  data: (AnnualData | VisitationRecord)[],
  xScale: any,
  useAnnual: boolean
): AnnualData | VisitationRecord => {
  let closest = data[0]
  let minDist = Infinity

  if (useAnnual) {
    const yearAtMouse = (xScale as d3.ScaleLinear<number, number>).invert(mouseX)
    for (const d of data as AnnualData[]) {
      const dist = Math.abs(d.year - yearAtMouse)
      if (dist < minDist) {
        minDist = dist
        closest = d
      }
    }
  } else {
    const dateAtMouse = (xScale as d3.ScaleTime<number, number>).invert(mouseX)
    for (const d of data as VisitationRecord[]) {
      const dist = Math.abs(new Date(d.date).getTime() - dateAtMouse.getTime())
      if (dist < minDist) {
        minDist = dist
        closest = d
      }
    }
  }

  return closest
}

// Helper: Format tooltip text based on data type
const annualFormatter = new Intl.NumberFormat()
const dateFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const formatTooltip = (data: AnnualData | VisitationRecord, useAnnual: boolean): string => {
  if (useAnnual) {
    return `${(data as AnnualData).year}: ${annualFormatter.format(data.visitors)}`
  }
  return `${dateFormatter.format(new Date((data as VisitationRecord).date))}: ${annualFormatter.format(data.visitors)}`
}

// Helper: Calculate year-over-year changes for bar colors
const calculateChanges = (data: AnnualData[]): DataWithChanges[] => {
  return data.map((d, i) => ({
    ...d,
    prevVisitors: i > 0 ? data[i - 1].visitors : null,
    change: i > 0 ? d.visitors - data[i - 1].visitors : 0
  }))
}

export default function TimeSeriesChart({ useAnnualData = false, excludeCurrentYear = false }: TimeSeriesChartProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const visitation = useDataStore((state) => state.visitation)
  const annualData = useDataStore((state) => state.annualData)
  const setHoveredDate = useDataStore((state) => state.setHoveredDate)
  
  const rawData = useMemo(
    () => (useAnnualData ? annualData : visitation),
    [useAnnualData, annualData, visitation]
  )

  const data = useMemo(
    () => (excludeCurrentYear ? filterByCurrentYear(rawData, useAnnualData) : rawData),
    [excludeCurrentYear, rawData, useAnnualData]
  )

  const sortedData = useMemo(
    () => sortChartData(data, useAnnualData),
    [data, useAnnualData]
  )

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const margin = CHART_CONFIG.margin
    const containerWidth = containerRef.current.clientWidth
    const width = Math.max(containerWidth - margin.left - margin.right, CHART_CONFIG.minWidth)
    const height = CHART_CONFIG.height - margin.top - margin.bottom
    
    if (width <= CHART_CONFIG.minWidth) return

    // Clear previous
    const svgElement = d3.select(svgRef.current)
    svgElement.selectAll("*").remove()

    svgElement
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .attr('role', 'img')
      .attr('aria-label', `${useAnnualData ? 'Annual' : 'Monthly'} visitation time series chart`)

    const svg = svgElement.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Create scales using helper (eliminates duplication)
    const { xScale, yScale } = createScales(sortedData, width, height, useAnnualData)

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', CHART_CONFIG.line.opacity)
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => '')
      )

    if (useAnnualData) {
      // For annual data: use color-coded bars
      const annualSortedData = sortedData as AnnualData[]
      const barWidth = Math.max(width / annualSortedData.length - 2, 2)
      
      // Calculate year-over-year changes using helper
      const dataWithChanges = calculateChanges(annualSortedData)
      
      svg.selectAll('.bar')
        .data(dataWithChanges)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => (xScale as d3.ScaleLinear<number, number>)(d.year) - barWidth / 2)
        .attr('y', d => yScale(d.visitors))
        .attr('width', barWidth)
        .attr('height', d => height - yScale(d.visitors))
        .attr('fill', d => {
          if (d.change > 0) return CHART_CONFIG.colors.growth
          if (d.change < 0) return CHART_CONFIG.colors.decline
          return CHART_CONFIG.colors.neutral
        })
        .attr('opacity', CHART_CONFIG.bar.opacity)
        .attr('aria-label', d => formatTooltip(d, true))
        .on('mouseenter', function() {
          d3.select(this).attr('opacity', CHART_CONFIG.bar.opacityHover)
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', CHART_CONFIG.bar.opacity)
        })
    } else {
      // For monthly data: use area + line chart
      const visitationSortedData = sortedData as VisitationRecord[]
      const timeScale = xScale as d3.ScaleTime<number, number>
      
      const area = d3.area<VisitationRecord>()
        .x(d => timeScale(new Date(d.date)))
        .y0(height)
        .y1(d => yScale(d.visitors))

      const line = d3.line<VisitationRecord>()
        .x(d => timeScale(new Date(d.date)))
        .y(d => yScale(d.visitors))

      svg.append('path')
        .datum(visitationSortedData)
        .attr('fill', 'currentColor')
        .attr('fill-opacity', CHART_CONFIG.line.opacity)
        .attr('d', area)

      // Line path
      svg.append('path')
        .datum(visitationSortedData)
        .attr('fill', 'none')
        .attr('stroke', 'currentColor')
        .attr('stroke-width', CHART_CONFIG.line.strokeWidth)
        .attr('d', line)
    }

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickSize(-height))
      .attr('color', 'currentColor')
      .select('.domain').remove()

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(yScale))
      .attr('color', 'currentColor')
      .select('.domain').remove()

    // Y axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', 'currentColor')
      .text('Visitors')

    // Interactive overlay
    const overlay = svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill-opacity', CHART_CONFIG.interactive.fillOpacity)
      .attr('pointer-events', 'all')
      .style('cursor', 'crosshair')
      .attr('role', 'application')
      .attr('aria-label', 'Interactive chart overlay. Use mouse to hover over data points. Use left and right arrow keys to move between points.')
      .attr('tabindex', 0)

    // Hover line
    const hoverLine = svg.append('line')
      .attr('stroke', 'currentColor')
      .attr('opacity', 0)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', CHART_CONFIG.line.strokeDasharray)

    // Tooltip circle
    const circle = svg.append('circle')
      .attr('r', CHART_CONFIG.circle.r)
      .attr('fill', 'currentColor')
      .attr('stroke', 'white')
      .attr('stroke-width', CHART_CONFIG.circle.strokeWidth)
      .attr('opacity', 0)

    // Tooltip text
    const tooltip = svg.append('text')
      .attr('opacity', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', 'currentColor')
      .attr('role', 'status')
      .attr('aria-live', 'polite')

    const showPoint = (point: AnnualData | VisitationRecord) => {
      const x = useAnnualData
        ? (xScale as d3.ScaleLinear<number, number>)((point as AnnualData).year)
        : (xScale as d3.ScaleTime<number, number>)(new Date((point as VisitationRecord).date))
      const y = yScale(point.visitors)

      hoverLine
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('opacity', 1)

      circle
        .attr('cx', x)
        .attr('cy', y)
        .attr('opacity', 1)

      const displayText = formatTooltip(point, useAnnualData)

      tooltip
        .attr('x', x)
        .attr('y', y - CHART_CONFIG.interactive.tooltipOffset)
        .attr('opacity', 1)
        .text(displayText)

      tooltip.attr('aria-label', displayText)

      if (!useAnnualData) {
        setHoveredDate(new Date((point as VisitationRecord).date))
      }
    }

    let keyboardIndex = Math.max(sortedData.length - 1, 0)
    overlay.on('mousemove', (event) => {
      const [mouseX] = d3.pointer(event, overlay.node())
      
      // Find closest point using helper (eliminates duplication)
      const closest = findClosestPoint(mouseX, sortedData, xScale, useAnnualData)
      
      if (closest) {
        showPoint(closest)
      }
    })

    overlay.on('focus', () => {
      if (sortedData.length > 0) {
        showPoint(sortedData[keyboardIndex])
      }
    })

    overlay.on('keydown', (event) => {
      if (sortedData.length === 0) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        keyboardIndex = Math.max(keyboardIndex - 1, 0)
        showPoint(sortedData[keyboardIndex])
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        keyboardIndex = Math.min(keyboardIndex + 1, sortedData.length - 1)
        showPoint(sortedData[keyboardIndex])
      }
    })

    overlay.on('mouseleave', () => {
      hoverLine.attr('opacity', 0)
      circle.attr('opacity', 0)
      tooltip.attr('opacity', 0)
      if (!useAnnualData) {
        setHoveredDate(null)
      }
    })

  }, [sortedData, setHoveredDate, useAnnualData])

  return (
    <div ref={containerRef} className="w-full min-h-[400px] bg-card rounded-lg border border-border shadow-md overflow-hidden">
      <svg ref={svgRef}></svg>
    </div>
  )
}
