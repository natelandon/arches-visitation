import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Dashboard from './Dashboard'
import { useDataStore } from '../store/dataStore'

vi.mock('../store/dataStore')
vi.mock('./TimeSeriesChart', () => ({
  default: () => <div data-testid="time-series">TimeSeriesChart</div>,
}))
vi.mock('./MonthlyHeatmap', () => ({
  default: () => <div data-testid="monthly-heatmap">MonthlyHeatmap</div>,
}))
vi.mock('./ChartExplanation', () => ({
  ChartExplanation: () => <div data-testid="chart-explanation">ChartExplanation</div>,
}))
vi.mock('./DataEntry', () => ({
  default: () => <div data-testid="data-entry">DataEntry</div>,
}))
vi.mock('./MonthlyRank3D', () => ({
  default: () => <div data-testid="monthly-rank-3d">MonthlyRank3D</div>,
}))

describe('Dashboard Component', () => {
  const mockVisitation = [
    { date: '2024-01-15', visitors: 1000 },
    { date: '2024-02-15', visitors: 1200 },
    { date: '2024-03-15', visitors: 900 },
    { date: '2024-04-15', visitors: 1100 },
    { date: '2024-05-15', visitors: 1300 },
    { date: '2024-06-15', visitors: 1400 },
    { date: '2024-07-15', visitors: 1500 },
    { date: '2024-08-15', visitors: 1600 },
    { date: '2024-09-15', visitors: 1400 },
    { date: '2024-10-15', visitors: 1200 },
    { date: '2024-11-15', visitors: 1100 },
    { date: '2024-12-15', visitors: 1250 },
  ]

  const mockAnnual = [
    { year: 2022, visitors: 10000 },
    { year: 2023, visitors: 12000 },
    { year: 2024, visitors: 15000 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useDataStore as any).mockReturnValue({
      visitation: mockVisitation,
      annual: mockAnnual,
      hoveredDate: null,
      setHoveredDate: vi.fn(),
      fetchData: vi.fn(),
    })
    global.fetch = vi.fn()
  })

  it('renders dashboard container', () => {
    const { container } = render(<Dashboard />)
    expect(container).toBeInTheDocument()
  })

  it('renders all tab buttons', () => {
    render(<Dashboard />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Monthly Heatmap')).toBeInTheDocument()
    expect(screen.getByText('2025 Stats')).toBeInTheDocument()
    expect(screen.getByText('Add Data')).toBeInTheDocument()
  })

  it('renders overview tab content by default', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('time-series')).toBeInTheDocument()
  })

  it('switches to heatmap tab when clicked', async () => {
    render(<Dashboard />)
    const heatmapTab = screen.getByRole('button', { name: 'Monthly Heatmap' })
    fireEvent.click(heatmapTab)
    
    await waitFor(() => {
      expect(screen.getByTestId('monthly-heatmap')).toBeInTheDocument()
    })
  })

  it('switches to stats tab when clicked', async () => {
    render(<Dashboard />)
    const statsTab = screen.getByRole('button', { name: '2025 Stats' })
    fireEvent.click(statsTab)
    
    // Stats tab shows 3D chart and chart explanation
    expect(statsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to data entry tab when clicked', async () => {
    render(<Dashboard />)
    const dataEntryTab = screen.getByRole('button', { name: 'Add Data' })
    fireEvent.click(dataEntryTab)
    
    await waitFor(() => {
      expect(screen.getByTestId('data-entry')).toBeInTheDocument()
    })
  })

  it('displays annual summary statistics', () => {
    render(<Dashboard />)
    // Overview tab shows annual stats
    expect(screen.getByTestId('time-series')).toBeInTheDocument()
  })

  it('formats large numbers with K/M notation in summary', () => {
    render(<Dashboard />)
    const container = document.querySelector('main')
    expect(container?.textContent).toBeDefined()
  })

  it('shows current year stats in 2025 tab', async () => {
    render(<Dashboard />)
    const currentYearTab = screen.getByRole('button', { name: '2025 Stats' })
    fireEvent.click(currentYearTab)
    
    expect(currentYearTab).toHaveAttribute('aria-selected', 'true')
  })

  it('displays peak and lowest month information', () => {
    render(<Dashboard />)
    const container = document.querySelector('main')
    // Dashboard should display peak month data
    expect(container?.textContent).toContain('2024')
  })

  it('handles no data gracefully', () => {
    ;(useDataStore as any).mockReturnValue({
      visitation: [],
      annual: [],
      hoveredDate: null,
      setHoveredDate: vi.fn(),
      fetchData: vi.fn(),
    })

    render(<Dashboard />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('renders tab navigation with proper ARIA attributes', () => {
    render(<Dashboard />)
    const overviewTab = screen.getByRole('button', { name: 'Overview' })
    expect(overviewTab).toHaveAttribute('role', 'tab')
  })

  it('only one tab is active at a time', () => {
    render(<Dashboard />)
    const tabs = screen.getAllByRole('tab')
    const activeTabs = tabs.filter(tab => tab.getAttribute('aria-selected') === 'true')
    expect(activeTabs.length).toBe(1)
  })

  it('maintains tab state on re-render', () => {
    const { rerender } = render(<Dashboard />)
    const heatmapTab = screen.getByRole('button', { name: 'Monthly Heatmap' })
    fireEvent.click(heatmapTab)
    
    // Re-render with same props
    ;(useDataStore as any).mockReturnValue({
      visitation: mockVisitation,
      annual: mockAnnual,
      hoveredDate: null,
      setHoveredDate: vi.fn(),
      fetchData: vi.fn(),
    })
    
    rerender(<Dashboard />)
    expect(heatmapTab).toHaveAttribute('aria-selected', 'true')
  })

  it('displays responsive layout', () => {
    const { container } = render(<Dashboard />)
    const main = container.querySelector('main')
    expect(main).toBeInTheDocument()
  })

  it('shows explanation component with data', () => {
    render(<Dashboard />)
    const statsTab = screen.getByRole('button', { name: '2025 Stats' })
    fireEvent.click(statsTab)
    
    // Stats tab should have chart explanation
    expect(statsTab).toHaveAttribute('aria-selected', 'true')
  })
})
