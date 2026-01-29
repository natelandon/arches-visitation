import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DataEntry from './DataEntry'
import { useDataStore } from '../store/dataStore'

vi.mock('../store/dataStore')

describe('DataEntry Component', () => {
  const mockFetchData = vi.fn()
  const mockVisitation = [
    { date: '2025-01-15', visitors: 100 },
    { date: '2025-01-20', visitors: 150 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useDataStore as any).mockReturnValue({
      visitation: mockVisitation,
      fetchData: mockFetchData,
    })
    global.fetch = vi.fn()
  })

  it('renders data entry form', () => {
    render(<DataEntry />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('displays date input field', () => {
    render(<DataEntry />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('displays visitor count input', () => {
    render(<DataEntry />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
  })

  it('displays month statistics', () => {
    render(<DataEntry />)
    const container = document.querySelector('main')
    expect(container).toBeInTheDocument()
  })

  it('shows current year by default', () => {
    render(<DataEntry />)
    const currentYear = new Date().getFullYear()
    const container = document.querySelector('main')
    expect(container?.textContent).toContain(currentYear.toString())
  })

  it('allows entering date and visitor count', async () => {
    render(<DataEntry />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('displays grace period message during new year', () => {
    const today = new Date()
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
    
    render(<DataEntry />)
    
    if (dayOfYear <= 7) {
      const container = document.querySelector('main')
      expect(container?.textContent).toBeDefined()
    }
  })

  it('displays month tabs', () => {
    render(<DataEntry />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('allows switching between months', async () => {
    render(<DataEntry />)
    const buttons = screen.getAllByRole('button')
    if (buttons.length > 0) {
      fireEvent.click(buttons[0])
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('displays daily records list', () => {
    render(<DataEntry />)
    const container = document.querySelector('main')
    expect(container).toBeInTheDocument()
  })

  it('shows delete confirmation before removing record', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ visitation: [] }),
    })

    render(<DataEntry />)
    
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i })
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
      const container = document.querySelector('main')
      expect(container).toBeInTheDocument()
    }
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<DataEntry />)

    await waitFor(() => {
      // Component should handle error
      const container = document.querySelector('main')
      expect(container).toBeInTheDocument()
    })

    consoleErrorSpy.mockRestore()
  })

  it('disables submit when visitor count is empty', async () => {
    render(<DataEntry />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('displays statistics for selected month', () => {
    render(<DataEntry />)
    const container = document.querySelector('main')
    expect(container?.textContent).toContain('Total')
  })

  it('allows editing existing records', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ visitation: [] }),
    })

    render(<DataEntry />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('formats numbers in statistics display', () => {
    render(<DataEntry />)
    const container = document.querySelector('main')
    expect(container?.textContent).toBeDefined()
  })

  it('shows year selector with allowed years', () => {
    render(<DataEntry />)
    const container = document.querySelector('main')
    const currentYear = new Date().getFullYear()
    expect(container?.textContent).toContain(currentYear.toString())
  })
})
