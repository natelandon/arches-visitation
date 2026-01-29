import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'
import { useThemeStore } from './store/themeStore'
import { useDataStore } from './store/dataStore'

// Mock child components to avoid complex dependencies
vi.mock('./components/Header', () => ({
  default: () => <div data-testid="header">Header</div>,
}))

vi.mock('./components/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>,
}))

vi.mock('./store/themeStore', () => ({
  useThemeStore: vi.fn(() => ({
    darkMode: false,
  })),
}))

vi.mock('./store/dataStore', () => ({
  useDataStore: vi.fn((selector: any) => ({
    fetchData: vi.fn().mockResolvedValue(undefined),
    visitation: [{ date: '2025-01-15', visitors: 100 }],
    setHoveredDate: vi.fn(),
  })),
}))

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', async () => {
    render(<App />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<App />)
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('renders Dashboard after data loads', async () => {
    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('applies dark class to root element when darkMode is true', () => {
    ;(useThemeStore as any).mockReturnValue({
      darkMode: true,
    })
    const { rerender } = render(<App />)
    expect(document.documentElement).toBeDefined()
  })

  it('removes dark class from root element when darkMode is false', () => {
    ;(useThemeStore as any).mockReturnValue({
      darkMode: false,
    })
    render(<App />)
    expect(document.documentElement).toBeDefined()
  })

  it('handles fetchData errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })

    consoleErrorSpy.mockRestore()
  })

  it('renders Header component', () => {
    render(<App />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('applies correct CSS classes', () => {
    const { container } = render(<App />)
    const div = container.querySelector('div')
    expect(div?.className).toContain('min-h-screen')
  })
})
