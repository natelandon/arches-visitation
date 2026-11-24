import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import MonthlyVisitationChart from './MonthlyVisitationChart'
import { buildMonthValues } from '../utils/monthValues'

const VISITORS = [31944, 51541, 152554, 162090, 193448, 175660, 158207, 150262, 142337, 158262, 84413, 51096]
const data = VISITORS.map((visitors, i) => ({
  date: `2025-${String(i + 1).padStart(2, '0')}-01T00:00:00`,
  visitors,
}))

const renderChart = (selectedMonth = 6, onSelectMonth = vi.fn()) =>
  render(
    <MonthlyVisitationChart data={data} year={2025} selectedMonth={selectedMonth} onSelectMonth={onSelectMonth} />
  )

describe('buildMonthValues', () => {
  it('ranks months busiest first and keeps calendar order', () => {
    const months = buildMonthValues(data, 2025)
    expect(months.map(m => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(months.find(m => m.name === 'May')!.rank).toBe(1)
    expect(months.find(m => m.name === 'June')!.rank).toBe(2)
    expect(months.find(m => m.name === 'January')!.rank).toBe(12)
  })

  it('sums several records in one month and ignores other years', () => {
    const months = buildMonthValues(
      [
        { date: '2025-03-01T00:00:00', visitors: 100 },
        { date: '2025-03-15T00:00:00', visitors: 50 },
        { date: '2024-03-01T00:00:00', visitors: 999 },
      ],
      2025
    )
    expect(months).toEqual([{ month: 3, name: 'March', visitors: 150, rank: 1 }])
  })
})

describe('MonthlyVisitationChart', () => {
  it('draws one column per month and highlights only the selected one', () => {
    const { container } = renderChart(6)
    expect(container.querySelectorAll('path[data-month]')).toHaveLength(12)
    const selected = container.querySelectorAll('path[data-selected]')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveAttribute('data-month', '6')
    expect(selected[0]).toHaveAttribute('fill', 'var(--chart-emphasis)')
  })

  it('labels only the selected column, with a compact value', () => {
    renderChart(6)
    expect(screen.getByText('175.7K')).toBeInTheDocument()
    expect(screen.queryByText('193.4K')).not.toBeInTheDocument()
  })

  it('describes the chart for screen readers, including rank', () => {
    renderChart(6)
    expect(screen.getByRole('img', {
      name: 'Visitors by month in 2025. June is highlighted with 175,660 visitors, the 2nd busiest of 12 months.',
    })).toBeInTheDocument()
  })

  it('has a table with every month, value, and rank', () => {
    renderChart(6)
    const table = screen.getByRole('table', { name: 'Visitors by month, 2025' })
    const may = within(table).getByRole('row', { name: /May/ })
    expect(may).toHaveTextContent('193,448')
    expect(may).toHaveTextContent('1 of 12')
    expect(within(table).getAllByRole('row')).toHaveLength(13) // header + 12
  })

  it('shows the value and rank on hover', () => {
    renderChart(6)
    fireEvent.pointerEnter(screen.getByTestId('month-hit-1'))
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('31,944 visitors')
    expect(tooltip).toHaveTextContent('January · #12 of 12')

    fireEvent.pointerLeave(screen.getByTestId('month-hit-1'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('selects a month when its column is clicked', () => {
    const onSelectMonth = vi.fn()
    renderChart(6, onSelectMonth)
    fireEvent.click(screen.getByTestId('month-hit-3'))
    expect(onSelectMonth).toHaveBeenCalledWith(3)
  })

  it('says so when the year has no data', () => {
    render(<MonthlyVisitationChart data={[]} year={2025} selectedMonth={1} onSelectMonth={vi.fn()} />)
    expect(screen.getByText('No monthly data for 2025')).toBeInTheDocument()
  })

  it('hides the cap label while the selected month is hovered, so the tooltip does not cover it', () => {
    renderChart(6)
    fireEvent.pointerEnter(screen.getByTestId('month-hit-6'))
    expect(screen.queryByText('175.7K')).not.toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('175,660 visitors')
  })
})
