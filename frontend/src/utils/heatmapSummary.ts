import type { VisitationRecord } from '../types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface HeatmapSummary {
  year_range: { start: number; end: number }
  monthly_average: Record<string, number>
  busiest_month: { month: string; average_visitors: number }
  quietest_month: { month: string; average_visitors: number }
  annual_totals: Record<string, number>
  highest_year: { year: number; visitors: number }
  lowest_year: { year: number; visitors: number }
}

/**
 * Condense heatmap data into a small payload for the AI explanation.
 *
 * Covers the latest `span` complete years (all 12 months present) up to
 * `lastYear`, keeping it short enough for a small local model's context.
 * Keys are named so the backend number checker can resolve paths like
 * `monthly_average.July` or `annual_totals.2019`.
 */
export function buildHeatmapSummary(
  visitation: VisitationRecord[],
  lastYear: number,
  span = 10
): HeatmapSummary | null {
  const byYear = new Map<number, number[]>()
  for (const record of visitation) {
    const date = new Date(record.date)
    const year = date.getFullYear()
    if (year > lastYear) continue
    const months = byYear.get(year) ?? new Array<number>(12).fill(NaN)
    const month = date.getMonth()
    months[month] = (Number.isNaN(months[month]) ? 0 : months[month]) + record.visitors
    byYear.set(year, months)
  }

  const years = [...byYear.keys()]
    .filter(year => byYear.get(year)!.every(v => !Number.isNaN(v)))
    .sort((a, b) => b - a)
    .slice(0, span)
    .sort((a, b) => a - b)
  if (years.length === 0) return null

  const monthly_average: Record<string, number> = {}
  MONTH_NAMES.forEach((name, i) => {
    const sum = years.reduce((acc, year) => acc + byYear.get(year)![i], 0)
    monthly_average[name] = Math.round(sum / years.length)
  })

  const annual_totals: Record<string, number> = {}
  for (const year of years) {
    annual_totals[String(year)] = byYear.get(year)!.reduce((a, b) => a + b, 0)
  }

  const monthEntries = Object.entries(monthly_average)
  const busiest = monthEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const quietest = monthEntries.reduce((a, b) => (b[1] < a[1] ? b : a))
  const yearEntries = years.map(year => [year, annual_totals[String(year)]] as const)
  const highest = yearEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const lowest = yearEntries.reduce((a, b) => (b[1] < a[1] ? b : a))

  return {
    year_range: { start: years[0], end: years[years.length - 1] },
    monthly_average,
    busiest_month: { month: busiest[0], average_visitors: busiest[1] },
    quietest_month: { month: quietest[0], average_visitors: quietest[1] },
    annual_totals,
    highest_year: { year: highest[0], visitors: highest[1] },
    lowest_year: { year: lowest[0], visitors: lowest[1] },
  }
}
