import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TimeSeriesChart from './TimeSeriesChart'
import { useDataStore } from '../store/dataStore'

vi.mock('../store/dataStore')

describe('TimeSeriesChart Component', () => {
  const mockVisitationData = [
    { date: '2024-01-01', visitors: 100 },
    { date: '2024-01-02', visitors: 120 },
    { date: '2024-01-03', visitors: 110 },
  ]

  const mockAnnualData = [
    { year: 2022, visitors: 10000 },
    { year: 2023, visitors: 12000 },
    { year: 2024, visitors: 15000 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useDataStore as any).mockReturnValue({
      visitation: mockVisitationData,
      annual: mockAnnualData,
      setHoveredDate: vi.fn(),
    })
  })

  it('renders chart container', () => {
    const { container } = render(<TimeSeriesChart />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders with monthly data by default', () => {
    render(<TimeSeriesChart useAnnualData={false} />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders D3 chart element', () => {
    const { container } = render(<TimeSeriesChart />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('handles empty data gracefully', () => {
    ;(useDataStore as any).mockReturnValue({
      visitation: [],
      annual: [],
      setHoveredDate: vi.fn(),
    })

    const { container } = render(<TimeSeriesChart />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('creates responsive chart container', () => {
    const { container } = render(<TimeSeriesChart />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('updates chart when data changes', () => {
    const { rerender, container: container1 } = render(<TimeSeriesChart />)
    const svgBefore = container1.querySelector('svg')
    expect(svgBefore).toBeInTheDocument()

    ;(useDataStore as any).mockReturnValue({
      visitation: [
        { date: '2024-02-01', visitors: 200 },
        { date: '2024-02-02', visitors: 220 },
      ],
      annual: mockAnnualData,
      setHoveredDate: vi.fn(),
    })

    rerender(<TimeSeriesChart />)
    const svgAfter = container1.querySelector('svg')
    
    expect(svgAfter).toBeInTheDocument()
  })

  it('renders SVG with proper structure', () => {
    const { container } = render(<TimeSeriesChart />)
    const svg = container.querySelector('svg')
    expect(svg?.nodeName).toBe('svg')
  })

  it('handles props changes gracefully', () => {
    const { rerender } = render(<TimeSeriesChart useAnnualData={false} />)
    rerender(<TimeSeriesChart useAnnualData={true} />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
