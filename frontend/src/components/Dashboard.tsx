import { memo, useState, useMemo, useCallback, useId, lazy, Suspense, type KeyboardEvent } from 'react'
import { useDataStore } from '../store/dataStore'
import { ChartExplanation } from './ChartExplanation'
import LoadingFallback from './LoadingFallback'
import { formatNumber } from '../utils/formatting'
import { buildHeatmapSummary } from '../utils/heatmapSummary'
import { buildOverviewSummary } from '../utils/overviewSummary'
import MonthlyVisitationChart from './MonthlyVisitationChart'

const timeSeriesImport = () => import('./TimeSeriesChart')
const monthlyHeatmapImport = () => import('./MonthlyHeatmap')
const dataEntryImport = () => import('./DataEntry')

const TimeSeriesChart = lazy(() => timeSeriesImport())
const MonthlyHeatmap = lazy(() => monthlyHeatmapImport())
const DataEntry = lazy(() => dataEntryImport())

type TabType = 'overview' | 'heatmap' | 'current-year' | 'data-entry'

interface Tab {
  id: TabType
  label: string
}

interface AnnualSummary {
  total: number
  avg: number
  peakMonth: string
  peakVisitors: number
  lowestMonth: string
  lowestVisitors: number
}

interface SelectedMonthData {
  visitors: number
  percentage: string
  rank: number
  avgDaily: number
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'heatmap', label: 'Monthly Heatmap' },
  { id: 'current-year', label: '2025 Stats' },
  { id: 'data-entry', label: 'Add Data' },
]

const monthLongFormatter = new Intl.DateTimeFormat('default', { month: 'long' })

// Helper function to calculate annual summary stats
const calculateAnnualSummary = (data: Array<{ date: string; visitors: number }>, year: number): AnnualSummary | null => {
  const yearData = data.filter(d => new Date(d.date).getFullYear() === year)
  if (yearData.length === 0) return null
  
  const total = yearData.reduce((sum, d) => sum + d.visitors, 0)
  const avg = Math.round(total / yearData.length)
  const maxRecord = yearData.reduce((max, d) => d.visitors > max.visitors ? d : max)
  const minRecord = yearData.reduce((min, d) => d.visitors < min.visitors ? d : min)
  
  return {
    total,
    avg,
    peakMonth: monthLongFormatter.format(new Date(maxRecord.date)),
    peakVisitors: maxRecord.visitors,
    lowestMonth: monthLongFormatter.format(new Date(minRecord.date)),
    lowestVisitors: minRecord.visitors,
  }
}

// Helper function to calculate selected month details
const calculateMonthDetails = (visitation: Array<{ date: string; visitors: number }>, year: number, month: number): SelectedMonthData | null => {
  const yearData = visitation.filter(d => new Date(d.date).getFullYear() === year)
  const monthData = yearData.find(d => new Date(d.date).getMonth() + 1 === month)
  
  if (!monthData) return null
  
  const yearTotal = yearData.reduce((sum, d) => sum + d.visitors, 0)
  const percentage = ((monthData.visitors / yearTotal) * 100).toFixed(1)
  const sorted = yearData.toSorted((a, b) => b.visitors - a.visitors)
  const rank = sorted.findIndex(d => new Date(d.date).getMonth() + 1 === month) + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const avgDaily = Math.round(monthData.visitors / daysInMonth)
  
  return { visitors: monthData.visitors, percentage, rank, avgDaily }
}

// Tab Button Component (DRY)
interface TabButtonProps {
  tab: Tab
  id: string
  isActive: boolean
  onClick: () => void
  onPrefetch?: () => void
}

const TabButton = memo(({ tab, id, isActive, onClick, onPrefetch }: TabButtonProps) => {
  const ariaSelected = isActive ? 'true' : 'false'
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      aria-selected={ariaSelected}
      role="tab"
      // Only the selected tab is in the Tab order, so focus entering the
      // tablist always lands on it; arrow keys reach the others.
      tabIndex={isActive ? 0 : -1}
    className={`px-4 py-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent ${
      isActive
        ? 'border-b-2 border-accent text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    }`}
  >
      {tab.label}
    </button>
  )
})

export default function Dashboard(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  // Hosted read-only builds (VITE_READ_ONLY=true) can't change data
  const tabs = import.meta.env.VITE_READ_ONLY === 'true'
    ? TABS.filter(tab => tab.id !== 'data-entry')
    : TABS
  const [selectedMonth, setSelectedMonth] = useState<number>(12)
  const stats = useDataStore((state) => state.stats)
  const visitation = useDataStore((state) => state.visitation)
  const annualData = useDataStore((state) => state.annualData)

  const prefetchers = useMemo<Record<TabType, () => void>>(
    () => ({
      overview: () => {
        timeSeriesImport()
      },
      heatmap: () => {
        monthlyHeatmapImport()
      },
      'current-year': () => {},
      'data-entry': () => {
        dataEntryImport()
      },
    }),
    []
  )

  const handleTabClick = useCallback((tabId: TabType) => {
    setActiveTab(tabId)
  }, [])

  // Arrow keys move focus only; Enter/Space (native button activation)
  // selects. Panels lazy-load charts and start slow AI calls, so arrowing
  // past a tab shouldn't open it.
  const handleTabListKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1) return

    const last = tabs.length - 1
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return

    event.preventDefault()
    tabs[next].focus()
  }, [])

  const idPrefix = useId()
  const tabId = (id: TabType) => `${idPrefix}-tab-${id}`

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1
  const formatMonth = useCallback(
    (year: number, monthIndex: number) => monthLongFormatter.format(new Date(year, monthIndex)),
    []
  )

  // Memoized year-filtered data
  const yearData = useMemo(() =>
    visitation.filter(d => new Date(d.date).getFullYear() === previousYear),
    [visitation, previousYear]
  )

  // Compact, plainly named data for the overview's AI explanation
  const overviewSummary = useMemo(() =>
    buildOverviewSummary(annualData ?? [], previousYear),
    [annualData, previousYear]
  )

  // Compact real data for the heatmap's AI explanation
  const heatmapSummary = useMemo(() =>
    buildHeatmapSummary(visitation, previousYear),
    [visitation, previousYear]
  )

  // Memoized annual summary
  const annualSummary = useMemo(() =>
    calculateAnnualSummary(visitation, previousYear),
    [visitation, previousYear]
  )

  // Memoized month details
  const selectedMonthData = useMemo(() =>
    calculateMonthDetails(visitation, previousYear, selectedMonth),
    [visitation, previousYear, selectedMonth]
  )

  return (
    <div className="container p-6 mx-auto max-w-screen-2xl">
      {/* Tab Navigation - DRY: Using map instead of repeated buttons */}
      <div className="mb-6">
        {/* The tabs inside take focus, not the tablist itself (WAI-ARIA tabs
            pattern), so this rule's suggestion would add a stray Tab stop. */}
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
        <div
          className="flex border-b border-border"
          role="tablist"
          aria-label="Dashboard sections"
          onKeyDown={handleTabListKeyDown}
        >
          {tabs.map(tab => (
            <TabButton
              key={tab.id}
              tab={tab}
              id={tabId(tab.id)}
              isActive={activeTab === tab.id}
              onClick={() => handleTabClick(tab.id)}
              onPrefetch={prefetchers[tab.id]}
            />
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6" role="tabpanel" aria-labelledby={tabId('overview')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-6 border rounded-lg shadow-md border-border bg-card">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Total Visitors</h3>
              <p className="text-3xl font-bold">{formatNumber(stats.total_visitors || 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.years_covered?.[0] ? `${stats.years_covered[0]}–${stats.years_covered[1]}` : '—'}
              </p>
            </div>
            <div className="p-6 border rounded-lg shadow-md border-border bg-card">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">10-Year Avg Annual</h3>
              <p className="text-3xl font-bold">{formatNumber(stats.ten_year_average || 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">rolling average (latest 10 years)</p>
            </div>
            <div className="p-6 border rounded-lg shadow-md border-border bg-card">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Highest Growth Year</h3>
              <p className="text-3xl font-bold">{stats.highest_growth_year || '—'}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatNumber(stats.highest_growth_value || 0)} vs prior year</p>
            </div>
            <div className="p-6 border rounded-lg shadow-md border-border bg-card">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Biggest Decline Year</h3>
              <p className="text-3xl font-bold">{stats.biggest_decline_year || '—'}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatNumber(stats.biggest_decline_value || 0)} vs prior year</p>
            </div>
          </div>

          <div className="p-6 mt-6 border rounded-lg shadow-md border-border bg-card">
            <h2 className="mb-4 text-xl font-semibold">Annual Visitation Trends (Up to {previousYear})</h2>
            <Suspense fallback={<LoadingFallback label="Loading chart…" />}>
              <TimeSeriesChart useAnnualData={true} excludeCurrentYear={true} />
            </Suspense>
            <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Growth Year</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Decline Year</span>
              </div>
            </div>
            {overviewSummary && <ChartExplanation
              chartType="annual_trends"
              data={overviewSummary as unknown as Record<string, unknown>}
            />}
          </div>
        </div>
      )}

      {/* Heatmap Tab */}
      {activeTab === 'heatmap' && (
        <div className="space-y-6" role="tabpanel" aria-labelledby={tabId('heatmap')}>
          <h2 className="text-lg font-semibold text-foreground">Monthly Visitation Heatmap</h2>
          <Suspense fallback={<LoadingFallback label="Loading heatmap…" />}>
            <MonthlyHeatmap visitation={visitation} />
          </Suspense>
          {heatmapSummary && (
            <ChartExplanation
              chartType="heatmap"
              data={heatmapSummary as unknown as Record<string, unknown>}
            />
          )}
        </div>
      )}

      {/* 2025 Stats Tab - CLEAN: Using extracted helper functions */}
      {activeTab === 'current-year' && (
        <div className="space-y-6" role="tabpanel" aria-labelledby={tabId('current-year')}>
          <h2 className="text-lg font-semibold text-foreground">{previousYear} Annual Summary</h2>
          
          {/* Annual Summary Stats */}
          {annualSummary ? (
            <div className="p-6 border rounded-lg shadow-md bg-card border-border">
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <div className="p-4 text-center border rounded-md bg-accent/5 border-border/50">
                  <div className="mb-1 text-sm text-muted-foreground">Total Visitors</div>
                  <div className="text-2xl font-bold">{formatNumber(annualSummary.total)}</div>
                </div>
                <div className="p-4 text-center border rounded-md bg-accent/5 border-border/50">
                  <div className="mb-1 text-sm text-muted-foreground">Average/Month</div>
                  <div className="text-2xl font-bold">{formatNumber(annualSummary.avg)}</div>
                </div>
                <div className="p-4 text-center border rounded-md bg-accent/5 border-border/50">
                  <div className="mb-1 text-sm text-muted-foreground">Peak Month</div>
                  <div className="text-lg font-bold">{annualSummary.peakMonth}</div>
                  <div className="text-xs text-muted-foreground">{formatNumber(annualSummary.peakVisitors)}</div>
                </div>
                <div className="p-4 text-center border rounded-md bg-accent/5 border-border/50">
                  <div className="mb-1 text-sm text-muted-foreground">Lowest Month</div>
                  <div className="text-lg font-bold">{annualSummary.lowestMonth}</div>
                  <div className="text-xs text-muted-foreground">{formatNumber(annualSummary.lowestVisitors)}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No {previousYear} data available</p>
          )}
          
          {/* Monthly Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{previousYear} Monthly Breakdown</h3>
              <div className="flex items-center gap-2">
                <label htmlFor="month-select" className="text-sm text-muted-foreground">Select Month:</label>
                <select 
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-2 border rounded-lg bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  aria-label="Select month for breakdown"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                    const monthName = formatMonth(previousYear, month - 1)
                    return <option key={month} value={month}>{monthName}</option>
                  })}
                </select>
              </div>
            </div>
            
            {/* Selected Month Details */}
            <div className="p-6 border rounded-lg shadow-md bg-card border-border">
              <h4 className="mb-4 font-semibold">
                {formatMonth(previousYear, selectedMonth - 1)} {previousYear} Details
              </h4>
              {selectedMonthData ? (
                <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                  {[
                    { label: 'Total Visitors', value: formatNumber(selectedMonthData.visitors) },
                    { label: '% of Annual Total', value: `${selectedMonthData.percentage}%` },
                    { label: 'Rank (Busiest to Quietest)', value: `#${selectedMonthData.rank} of 12` },
                    { label: 'Average Daily Visitors', value: formatNumber(selectedMonthData.avgDaily) },
                  ].map(stat => (
                    <div key={stat.label} className="p-4 text-center border rounded-md bg-accent/5 border-border/50">
                      <div className="mb-1 text-sm text-muted-foreground">{stat.label}</div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No data available for this month</p>
              )}
            </div>

            {/* Visitors by month - full width */}
            <div className="p-6 mt-6 border rounded-lg shadow-md bg-card border-border">
              <h4 className="font-semibold">Visitors by month, {previousYear}</h4>
              <p className="mb-4 text-xs text-muted-foreground">Click a month to select it</p>
              <MonthlyVisitationChart
                data={yearData}
                year={previousYear}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
              />
            </div>

            {selectedMonthData && (
              <ChartExplanation
                chartType="monthly_breakdown"
                data={{
                  month: formatMonth(previousYear, selectedMonth - 1),
                  year: previousYear,
                  stats: selectedMonthData,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Data Entry Tab */}
      {activeTab === 'data-entry' && (
        <div role="tabpanel" aria-labelledby={tabId('data-entry')}>
          <Suspense fallback={<LoadingFallback label="Loading form…" />}>
            <DataEntry />
          </Suspense>
        </div>
      )}
    </div>
  )
}
