import { describe, it, expect } from 'vitest'
import { buildOverviewSummary } from './overviewSummary'

const annual = [
  { year: 2016, visitors: 1_585_718 },
  { year: 2017, visitors: 1_539_028 },
  { year: 2018, visitors: 1_663_557 },
  { year: 2019, visitors: 1_659_702 },
  { year: 2020, visitors: 1_238_083 },
  { year: 2021, visitors: 1_806_865 },
  { year: 2022, visitors: 1_460_652 },
  { year: 2026, visitors: 500 }, // current, partial year
]

describe('buildOverviewSummary', () => {
  it('returns null without complete years', () => {
    expect(buildOverviewSummary([], 2025)).toBeNull()
    expect(buildOverviewSummary([{ year: 2026, visitors: 1 }], 2025)).toBeNull()
  })

  it('summarizes years up to lastYear with plainly named, positive changes', () => {
    const s = buildOverviewSummary(annual, 2025)!

    expect(s.year_range).toEqual({ start: 2016, end: 2022 })
    expect(s.total_visitors).toBe(10_953_605)
    expect(s.record_year).toEqual({ year: 2021, visitors: 1_806_865 })
    expect(s.biggest_rise).toEqual({ year: 2021, visitors_gained: 568_782 })
    expect(s.biggest_drop).toEqual({ year: 2020, visitors_lost: 421_619 })
    expect(s.recent_annual_totals['2022']).toBe(1_460_652)
    expect(s.recent_annual_totals).not.toHaveProperty('2026')
  })

  it('averages the latest ten years and lists only those', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ year: 2000 + i, visitors: 1000 + i }))
    const s = buildOverviewSummary(many, 2025)!

    expect(Object.keys(s.recent_annual_totals)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(2005 + i))
    )
    // (1005 + ... + 1014) / 10 = 1009.5, truncated like the backend's stat card
    expect(s.average_per_year_last_10_years).toBe(1009)
  })
})
