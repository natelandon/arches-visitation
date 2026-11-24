import { describe, it, expect } from 'vitest'
import { formatNumber } from './formatting'

describe('formatNumber', () => {
  it('shortens thousands and millions', () => {
    expect(formatNumber(568782)).toBe('568.8K')
    expect(formatNumber(1806865)).toBe('1.8M')
  })

  it('shortens negative numbers the same way', () => {
    expect(formatNumber(-421619)).toBe('-421.6K')
    expect(formatNumber(-1500000)).toBe('-1.5M')
  })

  it('leaves small numbers as they are', () => {
    expect(formatNumber(950)).toBe('950')
    expect(formatNumber(-950)).toBe('-950')
  })
})
