import type { AnnualData } from '../types'

export interface OverviewSummary {
  year_range: { start: number; end: number }
  total_visitors: number
  average_per_year_last_10_years: number
  record_year: { year: number; visitors: number }
  biggest_rise: { year: number; visitors_gained: number }
  biggest_drop: { year: number; visitors_lost: number }
  recent_annual_totals: Record<string, number>
}

/**
 * Condense the annual chart into a small, plainly named payload for the AI
 * explanation. Changes are positive counts with the direction in the name
 * ("visitors_lost"), and only the latest ten years are listed, so a small
 * local model gets the numbers it needs and nothing it can misread.
 */
export function buildOverviewSummary(annual: AnnualData[], lastYear: number): OverviewSummary | null {
  const years = annual
    .filter(d => d.year <= lastYear)
    .toSorted((a, b) => a.year - b.year)
  if (years.length === 0) return null

  let record = years[0]
  let rise = { year: years[0].year, visitors_gained: 0 }
  let drop = { year: years[0].year, visitors_lost: 0 }
  for (let i = 0; i < years.length; i++) {
    const current = years[i]
    if (current.visitors > record.visitors) record = current
    if (i === 0) continue
    const change = current.visitors - years[i - 1].visitors
    if (change > rise.visitors_gained) rise = { year: current.year, visitors_gained: change }
    if (-change > drop.visitors_lost) drop = { year: current.year, visitors_lost: -change }
  }

  const lastTen = years.slice(-10)
  return {
    year_range: { start: years[0].year, end: years.at(-1)!.year },
    total_visitors: years.reduce((sum, d) => sum + d.visitors, 0),
    // Truncated, matching the backend's "10-Year Avg Annual" card
    average_per_year_last_10_years: Math.trunc(lastTen.reduce((sum, d) => sum + d.visitors, 0) / lastTen.length),
    record_year: { year: record.year, visitors: record.visitors },
    biggest_rise: rise,
    biggest_drop: drop,
    recent_annual_totals: Object.fromEntries(lastTen.map(d => [String(d.year), d.visitors])),
  }
}
