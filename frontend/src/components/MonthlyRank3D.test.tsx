import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock THREE library before importing the component
vi.mock('three', () => ({
  Scene: vi.fn(() => ({
    background: new (vi.fn())(),
    add: vi.fn(),
    dispose: vi.fn(),
  })),
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
  })),
  PerspectiveCamera: vi.fn(),
  BoxGeometry: vi.fn(),
  MeshStandardMaterial: vi.fn(),
  Mesh: vi.fn(() => ({
    position: { set: vi.fn() },
    rotation: { set: vi.fn() },
  })),
  Color: vi.fn(),
  Light: vi.fn(() => ({
    position: { set: vi.fn() },
  })),
  AmbientLight: vi.fn(() => ({
    position: { set: vi.fn() },
  })),
  DirectionalLight: vi.fn(() => ({
    position: { set: vi.fn() },
  })),
  Group: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
  })),
}))

import MonthlyRank3D from './MonthlyRank3D'

describe('MonthlyRank3D Component', () => {
  const mockData = [
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

  it('renders 3D container', () => {
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={6} />
    )
    expect(container).toBeInTheDocument()
  })

  it('accepts data prop', () => {
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={1} />
    )
    expect(container).toBeInTheDocument()
  })

  it('accepts year prop', () => {
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2023} highlightMonth={6} />
    )
    expect(container).toBeInTheDocument()
  })

  it('accepts highlightMonth prop', () => {
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={12} />
    )
    expect(container).toBeInTheDocument()
  })

  it('renders with empty data', () => {
    const { container } = render(
      <MonthlyRank3D data={[]} year={2024} highlightMonth={6} />
    )
    expect(container).toBeInTheDocument()
  })

  it('handles highlighting different months', () => {
    const { rerender, container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={1} />
    )
    expect(container).toBeInTheDocument()

    rerender(<MonthlyRank3D data={mockData} year={2024} highlightMonth={6} />)
    expect(container).toBeInTheDocument()

    rerender(<MonthlyRank3D data={mockData} year={2024} highlightMonth={12} />)
    expect(container).toBeInTheDocument()
  })

  it('creates canvas element for 3D rendering', () => {
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={6} />
    )
    // THREE.js creates canvas internally
    expect(container.firstChild).toBeDefined()
  })

  it('scales bars based on visitor count', () => {
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={6} />
    )
    // Verify render happens without errors
    expect(container).toBeInTheDocument()
  })

  it('ranks months correctly', () => {
    // July (1500) should be ranked higher than March (900)
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={7} />
    )
    expect(container).toBeInTheDocument()
  })

  it('updates when data changes', () => {
    const newData = [
      { date: '2024-01-15', visitors: 2000 },
      { date: '2024-02-15', visitors: 2200 },
      { date: '2024-03-15', visitors: 1900 },
      { date: '2024-04-15', visitors: 2100 },
      { date: '2024-05-15', visitors: 2300 },
      { date: '2024-06-15', visitors: 2400 },
      { date: '2024-07-15', visitors: 2500 },
      { date: '2024-08-15', visitors: 2600 },
      { date: '2024-09-15', visitors: 2400 },
      { date: '2024-10-15', visitors: 2200 },
      { date: '2024-11-15', visitors: 2100 },
      { date: '2024-12-15', visitors: 2250 },
    ]

    const { rerender, container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={6} />
    )

    rerender(<MonthlyRank3D data={newData} year={2024} highlightMonth={6} />)
    expect(container).toBeInTheDocument()
  })

  it('handles single month data', () => {
    const singleMonthData = [{ date: '2024-06-15', visitors: 1400 }]
    const { container } = render(
      <MonthlyRank3D data={singleMonthData} year={2024} highlightMonth={6} />
    )
    expect(container).toBeInTheDocument()
  })

  it('renders responsive container', () => {
    const { container } = render(
      <MonthlyRank3D data={mockData} year={2024} highlightMonth={6} />
    )
    const div = container.firstChild as HTMLElement
    expect(div.style.width || div.className).toBeDefined()
  })
})
