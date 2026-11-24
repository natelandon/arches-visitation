import type { VisitationRecord } from '../types'

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

export interface MonthValue {
  month: number // 1-12
  name: string
  visitors: number
  rank: number // 1 = busiest
}

/** Total visitors per month for `year`, ranked busiest first. Months without data are left out. */
export function buildMonthValues(data: VisitationRecord[], year: number): MonthValue[] {
  const totals = new Map<number, number>()
  for (const record of data) {
    const date = new Date(record.date)
    if (date.getFullYear() !== year) continue
    const month = date.getMonth() + 1
    totals.set(month, (totals.get(month) ?? 0) + record.visitors)
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const rankOf = new Map(ranked.map(([month], i) => [month, i + 1]))
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, visitors]) => ({ month, name: MONTH_NAMES[month - 1], visitors, rank: rankOf.get(month)! }))
}
