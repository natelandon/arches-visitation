import { useMemo } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function MonthlyHeatmap({ visitation }) {
  const heatmapData = useMemo(() => {
    if (!visitation || visitation.length === 0) return { years: [], data: [] }

    // Group by year and month
    const byYear = {}
    visitation.forEach(record => {
      const date = new Date(record.date)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (!byYear[year]) byYear[year] = {}
      if (!byYear[year][month]) byYear[year][month] = 0
      byYear[year][month] += record.visitors
    })

    const years = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => a - b)

    // Find min/max for color scaling
    let min = Infinity
    let max = -Infinity
    Object.values(byYear).forEach(yearData => {
      Object.values(yearData).forEach(val => {
        min = Math.min(min, val)
        max = Math.max(max, val)
      })
    })

    const getColor = (value) => {
      if (value === 0 || value === undefined) return '#f5f5f5'
      const ratio = (value - min) / (max - min)
      // Color gradient from light blue to dark red
      if (ratio < 0.33) {
        return `hsl(220, 70%, ${80 - ratio * 30}%)`
      } else if (ratio < 0.66) {
        return `hsl(60, 100%, ${70 - (ratio - 0.33) * 30}%)`
      } else {
        return `hsl(0, 100%, ${60 - (ratio - 0.66) * 30}%)`
      }
    }

    return {
      years,
      data: byYear,
      getColor,
      min,
      max
    }
  }, [visitation])

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 overflow-x-auto">
      <div className="inline-block">
        {/* Header */}
        <div className="flex">
          <div className="w-16"></div>
          {MONTHS.map(month => (
            <div key={month} className="w-12 text-center text-xs font-medium text-muted-foreground">
              {month}
            </div>
          ))}
        </div>

        {/* Rows */}
        {heatmapData.years.map(year => (
          <div key={year} className="flex items-center">
            <div className="w-16 text-sm font-medium text-muted-foreground pr-2">{year}</div>
            {MONTHS.map((_, monthIdx) => {
              const value = heatmapData.data[year]?.[monthIdx] || 0
              const color = heatmapData.getColor(value)
              return (
                <div
                  key={`${year}-${monthIdx}`}
                  className="w-12 h-12 border border-border flex items-center justify-center text-xs font-medium cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ backgroundColor: color }}
                  title={`${MONTHS[monthIdx]} ${year}: ${formatNumber(value)}`}
                >
                  {value > 0 ? formatNumber(value) : '—'}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Low</span>
        <div className="flex gap-1">
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <div
              key={ratio}
              className="w-4 h-4 border border-border"
              style={{
                backgroundColor: heatmapData.getColor(
                  heatmapData.min + (heatmapData.max - heatmapData.min) * ratio
                )
              }}
            />
          ))}
        </div>
        <span className="text-muted-foreground">High</span>
      </div>
    </div>
  )
}
