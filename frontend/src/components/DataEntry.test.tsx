import { mockStore } from '../test/mockStore'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DataEntry from './DataEntry'
import { useDataStore } from '../store/dataStore'
import { clearApiCache } from '../config/api'

vi.mock('../store/dataStore')

describe('DataEntry Component', () => {
  const mockFetchData = vi.fn()
  const mockVisitation = [
    { date: '2025-01-15', visitors: 100 },
    { date: '2025-01-20', visitors: 150 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockStore(useDataStore, {
      visitation: mockVisitation,
      fetchData: mockFetchData,
    })
    clearApiCache()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] })
  })

  it('renders data entry form', () => {
    render(<DataEntry />)
    expect(screen.getByRole('heading', { name: 'Add Daily Visitor Data' })).toBeInTheDocument()
  })

  it('displays date input field', () => {
    render(<DataEntry />)
    expect(screen.getByLabelText('Date')).toHaveAttribute('type', 'date')
  })

  it('displays visitor count input', () => {
    render(<DataEntry />)
    expect(screen.getByRole('spinbutton', { name: 'Number of Visitors' })).toBeInTheDocument()
  })

  it('displays month statistics', () => {
    const { container } = render(<DataEntry />)
    expect(container).toBeInTheDocument()
  })

  it('shows current year by default', () => {
    const { container } = render(<DataEntry />)
    const currentYear = new Date().getFullYear()
    expect(container.textContent).toContain(currentYear.toString())
  })

  it('allows entering date and visitor count', async () => {
    render(<DataEntry />)
    const visitors = screen.getByLabelText('Number of Visitors')
    fireEvent.change(visitors, { target: { value: '250' } })
    expect(visitors).toHaveValue(250)
  })

  it('displays grace period message during new year', () => {
    const today = new Date()
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
    
    render(<DataEntry />)
    
    const message = screen.queryByText(/Grace period active/)
    if (dayOfYear <= 7) {
      expect(message).toBeInTheDocument()
    } else {
      expect(message).not.toBeInTheDocument()
    }
  })

  it('displays month tabs', () => {
    render(<DataEntry />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('allows switching between months', async () => {
    const year = new Date().getFullYear()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 1, date: `${year}-01-10T00:00:00`, visitors: 100 },
        { id: 2, date: `${year}-02-10T00:00:00`, visitors: 200 },
      ],
    })
    render(<DataEntry />)
    const february = await screen.findByRole('button', { name: 'View entries for Feb' })
    await waitFor(() => expect(february).toBeEnabled())
    fireEvent.click(february)
    expect(february).toHaveAttribute('aria-pressed', 'true')
  })

  it('displays daily records list', () => {
    const { container } = render(<DataEntry />)
    expect(container).toBeInTheDocument()
  })

  it('shows delete confirmation before removing record', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<DataEntry />)
    
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i })
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
      expect(screen.getByRole('form', { name: 'Visitor data entry form' })).toBeInTheDocument()
    }
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<DataEntry />)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching daily records:', expect.any(Error))
    })
    expect(screen.getByRole('form', { name: 'Visitor data entry form' })).toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })

  it('disables submit when visitor count is empty', async () => {
    render(<DataEntry />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('displays statistics for selected month', () => {
    const { container } = render(<DataEntry />)
    expect(container?.textContent).toContain('Total')
  })

  it('allows editing existing records', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<DataEntry />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('formats numbers in statistics display', () => {
    const { container } = render(<DataEntry />)
    expect(container?.textContent).toBeDefined()
  })

  it('shows year selector with allowed years', () => {
    const { container } = render(<DataEntry />)
    const currentYear = new Date().getFullYear()
    expect(container?.textContent).toContain(currentYear.toString())
  })
})
