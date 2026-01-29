import { memo, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { useDataStore } from '../store/dataStore'
import { ChartExplanation } from './ChartExplanation'
import LoadingFallback from './LoadingFallback'
import { formatNumber } from '../utils/formatting'

const timeSeriesImport = () => import('./TimeSeriesChart')
const monthlyHeatmapImport = () => import('./MonthlyHeatmap')
const monthlyRank3dImport = () => import('./MonthlyRank3D')
const dataEntryImport = () => import('./DataEntry')

const TimeSeriesChart = lazy(() => timeSeriesImport())
const MonthlyHeatmap = lazy(() => monthlyHeatmapImport())
const MonthlyRank3D = lazy(() => monthlyRank3dImport())
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
  const sorted = [...yearData].sort((a, b) => b.visitors - a.visitors)
  const rank = sorted.findIndex(d => new Date(d.date).getMonth() + 1 === month) + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const avgDaily = Math.round(monthData.visitors / daysInMonth)
  
  return { visitors: monthData.visitors, percentage, rank, avgDaily }
}

// Tab Button Component (DRY)
interface TabButtonProps {
  tab: Tab
  isActive: boolean
  onClick: () => void
  onPrefetch?: () => void
}

// eslint-disable-next-line jsx-a11y/anchor-is-valid
const TabButton = memo(({ tab, isActive, onClick, onPrefetch }: TabButtonProps) => {
  const ariaSelected = isActive ? 'true' : 'false'
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onPrefetch}
      aria-selected={ariaSelected}
      role="tab"
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
  const [selectedMonth, setSelectedMonth] = useState<number>(12)
  const stats = useDataStore((state) => state.stats)
  const visitation = useDataStore((state) => state.visitation)

  const prefetchers = useMemo<Record<TabType, () => void>>(
    () => ({
      overview: () => {
        timeSeriesImport()
      },
      heatmap: () => {
        monthlyHeatmapImport()
      },
      'current-year': () => {
        monthlyRank3dImport()
      },
      'data-entry': () => {
        dataEntryImport()
      },
    }),
    []
  )

  const handleTabClick = useCallback((tabId: TabType) => {
    setActiveTab(tabId)
  }, [])

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
        {/* eslint-disable-next-line jsx-a11y/role-has-required-aria-props */}
        <div className="flex border-b border-border" role="tablist">
          {TABS.map(tab => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => handleTabClick(tab.id)}
              onPrefetch={prefetchers[tab.id]}
            />
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6" role="tabpanel" aria-labelledby="overview">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-6 border rounded-lg shadow-md border-border bg-card">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Total Visitors</h3>
              <p className="text-3xl font-bold">{formatNumber(stats.total_visitors || 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">over {stats.years_covered || '—'} years</p>
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
            <ChartExplanation
              chartType="annual_trends"
              data={stats as unknown as Record<string, unknown>}
            />
          </div>
        </div>
      )}

      {/* Heatmap Tab */}
      {activeTab === 'heatmap' && (
        <div className="space-y-6" role="tabpanel">
          <h2 className="text-lg font-semibold text-foreground">Monthly Visitation Heatmap</h2>
          <Suspense fallback={<LoadingFallback label="Loading heatmap…" />}>
            <MonthlyHeatmap visitation={visitation} />
          </Suspense>
          <ChartExplanation
            chartType="heatmap"
            data={{
              years: yearData.length ? [Math.min(...yearData.map(d => new Date(d.date).getFullYear())), Math.max(...yearData.map(d => new Date(d.date).getFullYear()))] : [],
              months_coverage: 12
            }}
          />
        </div>
      )}

      {/* 2025 Stats Tab - CLEAN: Using extracted helper functions */}
      {activeTab === 'current-year' && (
        <div className="space-y-6" role="tabpanel">
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
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Selected Month Details */}
              <div className="p-6 border rounded-lg shadow-md bg-card border-border">
                <h4 className="mb-4 font-semibold">
                  {formatMonth(previousYear, selectedMonth - 1)} {previousYear} Details
                </h4>
                {selectedMonthData ? (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Total Visitors</span>
                      <span className="text-lg font-bold">{formatNumber(selectedMonthData.visitors)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">% of Annual Total</span>
                      <span className="font-medium">{selectedMonthData.percentage}%</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Rank (Busiest to Quietest)</span>
                      <span className="font-medium">#{selectedMonthData.rank} of 12</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Average Daily Visitors</span>
                      <span className="font-medium">{formatNumber(selectedMonthData.avgDaily)}</span>
                    </div>
                    <div className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold">Monthly Visitation Rank</h5>
                      </div>
                      <Suspense fallback={<LoadingFallback label="Loading 3D chart…" />}>
                        <MonthlyRank3D data={yearData} year={previousYear} highlightMonth={selectedMonth} />
                      </Suspense>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No data available for this month</p>
                )}
              </div>
              
              {/* All Months Summary */}
              <div className="p-6 border rounded-lg shadow-md bg-card border-border">
                <h4 className="mb-4 font-semibold">All Months Overview</h4>
                <div className="space-y-2 text-sm">
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1
                    const monthName = formatMonth(previousYear, i)
                    const record = yearData.find(d => new Date(d.date).getMonth() + 1 === month)
                    const visitors = record?.visitors ?? 0
                    const isSelected = month === selectedMonth
                    const ariaPressed = isSelected ? 'true' : 'false'
                    
                    // Only show months with data
                    if (visitors === 0) return null
                    
                    return (
                      <button
                        key={month}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isSelected
                            ? 'bg-accent/10 border-accent/40 text-foreground'
                            : 'border-transparent text-muted-foreground hover:border-accent/30 hover:bg-accent/5'
                        }`}
                        onClick={() => setSelectedMonth(month)}
                        aria-pressed={ariaPressed}
                      >
                        <span className={isSelected ? 'font-semibold' : ''}>{monthName}</span>
                        <span className={isSelected ? 'font-bold' : 'font-medium'}>{formatNumber(visitors)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
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
        <div role="tabpanel">
          <Suspense fallback={<LoadingFallback label="Loading form…" />}>
            <DataEntry />
          </Suspense>
        </div>
      )}
    </div>
  )
}
