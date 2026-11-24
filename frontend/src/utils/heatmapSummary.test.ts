import { describe, it, expect } from 'vitest'
import { buildHeatmapSummary } from './heatmapSummary'
import type { VisitationRecord } from '../types'

const fullYear = (year: number, base: number): VisitationRecord[] =>
  Array.from({ length: 12 }, (_, m) => ({
    date: `${year}-${String(m + 1).padStart(2, '0')}-01T00:00:00`,
    // Peak in May (index 4), low in January (index 0)
    visitors: base + (m === 4 ? 1000 : m === 0 ? -500 : 0),
  }))

describe('buildHeatmapSummary', () => {
  it('returns null when there are no complete years', () => {
    expect(buildHeatmapSummary([], 2024)).toBeNull()
    expect(buildHeatmapSummary(fullYear(2024, 1000).slice(0, 6), 2024)).toBeNull()
  })

  it('averages months and finds extremes across complete years', () => {
    const data = [...fullYear(2022, 1000), ...fullYear(2023, 3000)]
    const s = buildHeatmapSummary(data, 2024)!
    expect(s.year_range).toEqual({ start: 2022, end: 2023 })
    expect(s.monthly_average.May).toBe(3000)
    expect(s.monthly_average.January).toBe(1500)
    expect(s.busiest_month).toEqual({ month: 'May', average_visitors: 3000 })
    expect(s.quietest_month).toEqual({ month: 'January', average_visitors: 1500 })
    expect(s.annual_totals['2023']).toBe(3000 * 12 + 500)
    expect(s.highest_year.year).toBe(2023)
    expect(s.lowest_year.year).toBe(2022)
  })

  it('skips years after lastYear and partial years, and limits to span', () => {
    const data = [
      ...fullYear(2020, 100),
      ...fullYear(2021, 200),
      ...fullYear(2022, 300),
      ...fullYear(2025, 999),
      ...fullYear(2019, 50).slice(0, 11),
    ]
    const s = buildHeatmapSummary(data, 2024, 2)!
    expect(Object.keys(s.annual_totals)).toEqual(['2021', '2022'])
  })
})
