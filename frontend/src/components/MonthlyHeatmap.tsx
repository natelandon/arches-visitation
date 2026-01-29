import { useMemo, useState } from 'react'
import type { VisitationRecord } from '../types'
import { formatNumber } from '../utils/formatting'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const RATIO_CLASSES = [
  { max: 0.2, bg: 'bg-blue-50', text: 'text-slate-900' },
  { max: 0.4, bg: 'bg-blue-100', text: 'text-slate-900' },
  { max: 0.6, bg: 'bg-blue-200', text: 'text-slate-900' },
  { max: 0.8, bg: 'bg-blue-400', text: 'text-white' },
  { max: 1, bg: 'bg-blue-600', text: 'text-white' },
]

type ViewMode = 'absolute' | 'relative'

interface MonthlyHeatmapProps {
  visitation: VisitationRecord[]
}

interface HeatmapData {
  years: number[]
  data: Record<number, Record<number, number>>
  yearExtents: Record<number, { min: number; max: number }>
  getRatio: (value: number, year: number) => number
  getTextClass: (ratio: number) => string
  getBgClass: (ratio: number) => string
  min: number
  max: number
}

// Helper: Calculate ratio for a value in context
const calculateRatio = (value: number, min: number, max: number, yearValues?: number[]): number => {
  if (yearValues && yearValues.length > 0) {
    const yearMin = Math.min(...yearValues)
    const yearMax = Math.max(...yearValues)
    if (yearMax === yearMin) return 0.5
    return (value - yearMin) / (yearMax - yearMin)
  }
  if (max === min) return 0.5
  return (value - min) / (max - min)
}

const getRatioClasses = (ratio: number) => {
  for (const bucket of RATIO_CLASSES) {
    if (ratio <= bucket.max) {
      return bucket
    }
  }

  return RATIO_CLASSES[RATIO_CLASSES.length - 1]
}

export default function MonthlyHeatmap({ visitation }: MonthlyHeatmapProps): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('absolute')
  const heatmapData = useMemo<HeatmapData>(() => {
    if (!visitation || visitation.length === 0) {
      return {
        years: [],
        data: {},
        yearExtents: {},
        getRatio: () => 0,
        getTextClass: () => 'text-muted-foreground',
        getBgClass: () => 'bg-muted',
        min: 0,
        max: 0,
      }
    }

    // Group by year and month
    const byYear: Record<number, Record<number, number>> = {}
    visitation.forEach(record => {
      const date = new Date(record.date)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (!byYear[year]) byYear[year] = {}
      if (!byYear[year][month]) byYear[year][month] = 0
      byYear[year][month] += record.visitors
    })

    // Filter to only years with at least 6 months of data
    const filteredYears = Object.keys(byYear).filter(year => {
      const monthCount = Object.keys(byYear[Number(year)]).length
      return monthCount >= 6
    })

    const years = filteredYears.map(Number).sort((a, b) => b - a)

    // Find min/max for color scaling
    let min = Infinity
    let max = -Infinity
    const yearExtents: Record<number, { min: number; max: number }> = {}
    Object.entries(byYear).forEach(([yearKey, yearData]) => {
      const values = Object.values(yearData)
      if (values.length === 0) return
      const yearMin = Math.min(...values)
      const yearMax = Math.max(...values)
      yearExtents[Number(yearKey)] = { min: yearMin, max: yearMax }
      min = Math.min(min, yearMin)
      max = Math.max(max, yearMax)
    })

    const getRatio = (value: number, year: number): number => {
      if (viewMode === 'relative') {
        const extent = yearExtents[year]
        if (!extent) return 0.5
        return calculateRatio(value, extent.min, extent.max)
      }

      return calculateRatio(value, min, max)
    }

    const getTextClass = (ratio: number): string => getRatioClasses(ratio).text
    const getBgClass = (ratio: number): string => getRatioClasses(ratio).bg

    return { years, data: byYear, yearExtents, getRatio, getTextClass, getBgClass, min, max }
  }, [visitation, viewMode])

  return (
    <div className="p-6 overflow-x-auto border rounded-lg shadow-md bg-card border-border">
      {/* View Mode Toggle and Legend */}
      <div className="flex items-start justify-between gap-8 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('absolute')}
            aria-pressed={viewMode === 'absolute'}
            aria-label="Show overall volume (absolute values)"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'absolute'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent/50'
            }`}
          >
            Overall Volume
          </button>
          <button
            onClick={() => setViewMode('relative')}
            aria-pressed={viewMode === 'relative'}
            aria-label="Show peak and low by year (relative values)"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'relative'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent/50'
            }`}
          >
            Peak/Low by Year
          </button>
        </div>
        
        {/* Legend */}
        <div className="flex flex-col items-end gap-1 text-xs" id="monthly-heatmap-legend">
          <p className="font-medium text-muted-foreground">Color Scale ({viewMode === 'absolute' ? 'Overall' : 'Year-by-Year'})</p>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {viewMode === 'absolute' ? 'Low' : 'Lowest'}
            </span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
                <div
                  key={ratio}
                  className={`w-4 h-4 border border-border ${getRatioClasses(ratio).bg}`}
                />
              ))}
            </div>
            <span className="text-muted-foreground">
              {viewMode === 'absolute' ? 'High' : 'Highest'}
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="flex justify-center">
        <div
          className="inline-block"
          role="grid"
          aria-label="Monthly visitation heatmap"
          aria-describedby="monthly-heatmap-legend"
        >
        {/* Header Row */}
        <div className="flex" role="row">
          <div className="w-12" aria-hidden="true"></div>
          {MONTHS.map(month => (
            <div key={month} className="w-16 text-xs font-medium text-center text-muted-foreground" role="columnheader" aria-label={month}>
              {month}
            </div>
          ))}
          <div className="w-12" aria-hidden="true"></div>
        </div>

        {/* Data Rows */}
        {heatmapData.years.map(year => (
          <div key={year} className="flex items-center" role="row" aria-label={`Year ${year}`}>
            <div className="w-12 pr-2 text-sm font-medium text-right text-muted-foreground" role="rowheader">{year}</div>
            {MONTHS.map((_, monthIdx) => {
              const value = heatmapData.data[year]?.[monthIdx] || 0
              const ratio = value === 0 ? 0 : heatmapData.getRatio(value, year)
              const bgClass = value === 0 ? 'bg-muted' : heatmapData.getBgClass(ratio)
              const textClass = value === 0 ? 'text-muted-foreground' : heatmapData.getTextClass(ratio)
              const monthName = MONTHS[monthIdx]
              return (
                <div
                  key={`${year}-${monthIdx}`}
                  className={`flex items-center justify-center w-16 h-10 text-xs font-semibold transition-all border cursor-pointer border-border/50 hover:scale-105 hover:z-10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${bgClass} ${textClass}`}
                  role="gridcell"
                  aria-label={`${monthName} ${year}: ${formatNumber(value)} visitors`}
                  tabIndex={0}
                  title={`${monthName} ${year}: ${formatNumber(value)}`}
                >
                  {value > 0 ? formatNumber(value) : '—'}
                </div>
              )
            })}
            <div className="w-12" aria-hidden="true"></div>
          </div>
        ))}
        </div>
      </div>
    </div>
  )
}
