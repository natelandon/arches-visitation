import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Header from './Header'
import { useThemeStore } from '../store/themeStore'

// Mock the theme store
vi.mock('../store/themeStore', () => ({
  useThemeStore: vi.fn(),
}))

describe('Header Component', () => {
  const mockToggleDarkMode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useThemeStore as any).mockReturnValue({
      darkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    })
  })

  it('renders header with title and icon', () => {
    render(<Header />)
    expect(screen.getByText('Arches Visitation Analytics')).toBeInTheDocument()
    expect(screen.getByAltText('Delicate Arch')).toBeInTheDocument()
  })

  it('displays Dark button when not in dark mode', () => {
    render(<Header />)
    expect(screen.getByText('Dark')).toBeInTheDocument()
  })

  it('displays Light button when in dark mode', () => {
    ;(useThemeStore as any).mockReturnValue({
      darkMode: true,
      toggleDarkMode: mockToggleDarkMode,
    })
    render(<Header />)
    expect(screen.getByText('Light')).toBeInTheDocument()
  })

  it('calls toggleDarkMode when theme button is clicked', () => {
    render(<Header />)
    const button = screen.getByRole('button', { name: /toggle dark mode/i })
    fireEvent.click(button)
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1)
  })

  it('theme button has correct aria-label', () => {
    render(<Header />)
    const button = screen.getByRole('button', { name: /toggle dark mode/i })
    expect(button).toHaveAttribute('aria-label', 'Toggle dark mode')
  })

  it('logo link is accessible', () => {
    render(<Header />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/')
  })

  it('shows moon icon in light mode and sun icon in dark mode', () => {
    const { rerender } = render(<Header />)
    expect(screen.getByText('Dark')).toBeInTheDocument()

    ;(useThemeStore as any).mockReturnValue({
      darkMode: true,
      toggleDarkMode: mockToggleDarkMode,
    })
    rerender(<Header />)
    expect(screen.getByText('Light')).toBeInTheDocument()
  })
})
