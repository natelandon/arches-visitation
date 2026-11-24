import { mockStore } from '../test/mockStore'
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

describe('Dashboard Component', () => {
  // The Stats tab shows the previous calendar year, so build data for it.
  const statsYear = new Date().getFullYear() - 1
  const monthlyVisitors = [1000, 1200, 900, 1100, 1300, 1400, 1500, 1600, 1400, 1200, 1100, 1250]
  const mockVisitation = monthlyVisitors.map((visitors, i) => ({
    date: `${statsYear}-${String(i + 1).padStart(2, '0')}-15T00:00:00`,
    visitors,
  }))

  const mockAnnual = [
    { year: 2022, visitors: 10000 },
    { year: 2023, visitors: 12000 },
    { year: 2024, visitors: 15000 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockStore(useDataStore, {
      visitation: mockVisitation,
      annual: mockAnnual,
      stats: {},
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

  it('renders overview tab content by default', async () => {
    render(<Dashboard />)
    expect(await screen.findByTestId('time-series')).toBeInTheDocument()
  })

  it('switches to heatmap tab when clicked', async () => {
    render(<Dashboard />)
    const heatmapTab = screen.getByRole('tab', { name: 'Monthly Heatmap' })
    fireEvent.click(heatmapTab)
    
    await waitFor(() => {
      expect(screen.getByTestId('monthly-heatmap')).toBeInTheDocument()
    })
  })

  it('switches to stats tab when clicked', async () => {
    render(<Dashboard />)
    const statsTab = screen.getByRole('tab', { name: /Stats$/ })
    fireEvent.click(statsTab)
    
    // Stats tab shows 3D chart and chart explanation
    expect(statsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to data entry tab when clicked', async () => {
    render(<Dashboard />)
    const dataEntryTab = screen.getByRole('tab', { name: 'Add Data' })
    fireEvent.click(dataEntryTab)
    
    await waitFor(() => {
      expect(screen.getByTestId('data-entry')).toBeInTheDocument()
    })
  })

  it('displays annual summary statistics', () => {
    render(<Dashboard />)
    expect(screen.getByText('Total Visitors')).toBeInTheDocument()
    expect(screen.getByText('10-Year Avg Annual')).toBeInTheDocument()
  })

  it('formats large numbers with K/M notation in summary', () => {
    mockStore(useDataStore, {
      visitation: mockVisitation,
      stats: { total_visitors: 2_500_000, years_covered: [1929, 2025] },
    })
    render(<Dashboard />)
    expect(screen.getByText('2.5M')).toBeInTheDocument()
    expect(screen.getByText('1929–2025')).toBeInTheDocument()
  })

  it('shows current year stats in 2025 tab', async () => {
    render(<Dashboard />)
    const currentYearTab = screen.getByRole('tab', { name: /Stats$/ })
    fireEvent.click(currentYearTab)
    
    expect(currentYearTab).toHaveAttribute('aria-selected', 'true')
  })

  it('displays peak and lowest month information', () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('tab', { name: /Stats$/ }))
    expect(screen.getByText('Peak Month').parentElement).toHaveTextContent('August')
    expect(screen.getByText('Lowest Month').parentElement).toHaveTextContent('March')
  })

  it('handles no data gracefully', () => {
    mockStore(useDataStore, {
      visitation: [],
      annual: [],
      stats: {},
      hoveredDate: null,
      setHoveredDate: vi.fn(),
      fetchData: vi.fn(),
    })

    render(<Dashboard />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('renders tab navigation with proper ARIA attributes', () => {
    render(<Dashboard />)
    const overviewTab = screen.getByRole('tab', { name: 'Overview' })
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
    const heatmapTab = screen.getByRole('tab', { name: 'Monthly Heatmap' })
    fireEvent.click(heatmapTab)
    
    // Re-render with same props
    mockStore(useDataStore, {
      visitation: mockVisitation,
      annual: mockAnnual,
      stats: {},
      hoveredDate: null,
      setHoveredDate: vi.fn(),
      fetchData: vi.fn(),
    })
    
    rerender(<Dashboard />)
    expect(heatmapTab).toHaveAttribute('aria-selected', 'true')
  })

  it('displays responsive layout', () => {
    const { container } = render(<Dashboard />)
    expect(container.querySelector('.grid.sm\\:grid-cols-2')).toBeInTheDocument()
  })

  it('shows explanation component with data', () => {
    render(<Dashboard />)
    const statsTab = screen.getByRole('tab', { name: /Stats$/ })
    fireEvent.click(statsTab)
    
    expect(statsTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByTestId('chart-explanation').length).toBeGreaterThan(0)
  })

  describe('tab keyboard access', () => {
    const tab = (name: string | RegExp) => screen.getByRole('tab', { name })

    it('names the tab list and labels each panel by its tab', () => {
      render(<Dashboard />)
      expect(screen.getByRole('tablist', { name: 'Dashboard sections' })).toBeInTheDocument()
      expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument()

      fireEvent.click(tab('Monthly Heatmap'))
      expect(screen.getByRole('tabpanel', { name: 'Monthly Heatmap' })).toBeInTheDocument()
    })

    it('arrow keys move focus between tabs without selecting them', () => {
      render(<Dashboard />)
      tab('Overview').focus()

      fireEvent.keyDown(tab('Overview'), { key: 'ArrowRight' })
      expect(tab('Monthly Heatmap')).toHaveFocus()
      expect(tab('Overview')).toHaveAttribute('aria-selected', 'true')
      expect(tab('Monthly Heatmap')).toHaveAttribute('aria-selected', 'false')

      fireEvent.keyDown(tab('Monthly Heatmap'), { key: 'ArrowLeft' })
      expect(tab('Overview')).toHaveFocus()
    })

    it('arrow keys wrap around, and Home/End jump to the ends', () => {
      render(<Dashboard />)
      tab('Overview').focus()

      fireEvent.keyDown(tab('Overview'), { key: 'ArrowLeft' })
      expect(tab('Add Data')).toHaveFocus()
      fireEvent.keyDown(tab('Add Data'), { key: 'ArrowRight' })
      expect(tab('Overview')).toHaveFocus()

      fireEvent.keyDown(tab('Overview'), { key: 'End' })
      expect(tab('Add Data')).toHaveFocus()
      fireEvent.keyDown(tab('Add Data'), { key: 'Home' })
      expect(tab('Overview')).toHaveFocus()
    })

    it('only the selected tab is in the Tab order, so focus re-enters on it', () => {
      render(<Dashboard />)
      fireEvent.click(tab(/Stats$/))

      for (const t of screen.getAllByRole('tab')) {
        const selected = t.getAttribute('aria-selected') === 'true'
        expect(t).toHaveAttribute('tabindex', selected ? '0' : '-1')
      }
      expect(tab(/Stats$/)).toHaveAttribute('tabindex', '0')
    })
  })
})
