import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useDataStore } from '../store/dataStore'

export default function TimeSeriesChart() {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const { visitation, hoveredDate, setHoveredDate } = useDataStore()

  useEffect(() => {
    // Initialize on data load
  }, [visitation])

  useEffect(() => {
    if (!containerRef.current || visitation.length === 0) return

    const margin = { top: 20, right: 30, bottom: 30, left: 60 }
    const containerWidth = containerRef.current.clientWidth
    const width = Math.max(containerWidth - margin.left - margin.right, 100)
    const height = 350 - margin.top - margin.bottom
    
    if (width <= 100) return

    // Sort visitation data by date
    const sortedData = [...visitation].sort((a, b) => new Date(a.date) - new Date(b.date))

    // Clear previous
    const svgElement = d3.select(svgRef.current)
    svgElement.selectAll("*").remove()

    svgElement
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)

    const svg = svgElement.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(sortedData, d => new Date(d.date)))
      .range([0, width])

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(sortedData, d => d.visitors)])
      .range([height, 0])

    // Line generator
    const line = d3.line()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.visitors))

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.05)
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat('')
      )

    // Area under curve
    const area = d3.area()
      .x(d => xScale(new Date(d.date)))
      .y0(height)
      .y1(d => yScale(d.visitors))

    svg.append('path')
      .datum(sortedData)
      .attr('fill', 'currentColor')
      .attr('fill-opacity', 0.05)
      .attr('d', area)

    // Line path
    svg.append('path')
      .datum(sortedData)
      .attr('fill', 'none')
      .attr('stroke', 'currentColor')
      .attr('stroke-width', 2.5)
      .attr('d', line)

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
      .attr('fill', 'rgba(255,0,0,0.01)')
      .attr('pointer-events', 'all')
      .style('cursor', 'crosshair')

    // Hover line
    const hoverLine = svg.append('line')
      .attr('stroke', 'currentColor')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4')
      .attr('opacity', 0)

    // Tooltip circle
    const circle = svg.append('circle')
      .attr('r', 5)
      .attr('fill', 'currentColor')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('opacity', 0)

    // Tooltip text
    const tooltip = svg.append('text')
      .attr('opacity', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', 'currentColor')
      .style('background', 'rgba(0,0,0,0.5)')

    overlay.on('mousemove', (event) => {
      const [mouseX] = d3.pointer(event, overlay.node())
      const date = xScale.invert(mouseX)
      
      // Find closest data point by distance
      let closest = sortedData[0]
      let minDist = Math.abs(new Date(sortedData[0].date) - date)
      
      for (let i = 1; i < sortedData.length; i++) {
        const dist = Math.abs(new Date(sortedData[i].date) - date)
        if (dist < minDist) {
          minDist = dist
          closest = sortedData[i]
        }
      }
      
      if (closest) {
        const x = xScale(new Date(closest.date))
        const y = yScale(closest.visitors)
        
        console.log('[TimeSeriesChart] Hover:', closest.date, closest.visitors, 'calling setHoveredDate')
        
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
        
        tooltip
          .attr('x', x)
          .attr('y', y - 15)
          .attr('opacity', 1)
          .text(`${new Date(closest.date).toLocaleDateString()}: ${closest.visitors.toLocaleString()}`)
        
        setHoveredDate(closest.date)
      }
    })

    overlay.on('mouseleave', () => {
      hoverLine.attr('opacity', 0)
      circle.attr('opacity', 0)
      tooltip.attr('opacity', 0)
      setHoveredDate(null)
    })

  }, [visitation, setHoveredDate])

  return (
    <div ref={containerRef} className="w-full bg-card rounded-lg border border-border overflow-hidden" style={{ minHeight: '400px' }}>
      <svg ref={svgRef}></svg>
    </div>
  )
}
