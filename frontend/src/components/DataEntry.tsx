import { useState, useMemo, useEffect, FormEvent, ChangeEvent } from 'react'
import { Edit2, Trash2, Plus, Save, X } from 'lucide-react'
import { useDataStore } from '../store/dataStore'
import type { VisitationRecord } from '../types'
import { API_ENDPOINTS, apiCall, clearApiCache } from '../config/api'
import { formatNumber } from '../utils/formatting'

interface Statistics {
  monthTotal: number
  ytdTotal: number
  monthCount: number
  yearCount: number
}

// Helper function to filter records by year and month
const filterByYearAndMonth = (records: VisitationRecord[], year: number, month: number): VisitationRecord[] => {
  return records.filter(d => {
    const date = new Date(d.date)
    return date.getFullYear() === year && date.getMonth() + 1 === month
  })
}

// Helper function to filter records by year only
const filterByYear = (records: VisitationRecord[], year: number): VisitationRecord[] => {
  return records.filter(d => new Date(d.date).getFullYear() === year)
}

// Helper function to get month data statistics
const getMonthData = (records: VisitationRecord[], year: number, month: number): { data: VisitationRecord[]; count: number } => {
  const data = filterByYearAndMonth(records, year, month)
  return { data, count: data.length }
}

export default function DataEntry(): JSX.Element {
  const visitation = useDataStore((state) => state.visitation)
  const fetchData = useDataStore((state) => state.fetchData)
  const [dailyRecords, setDailyRecords] = useState<VisitationRecord[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [visitors, setVisitors] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [selectedMonthTab, setSelectedMonthTab] = useState<number>(new Date().getMonth() + 1)

  const currentYear = new Date().getFullYear()
  const today = new Date()
  const selectedMonth = new Date(selectedDate).getMonth() + 1

  const monthShortFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'short' }),
    []
  )
  const monthLongFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long' }),
    []
  )
  const monthDayLongFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }),
    []
  )
  const fullDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    []
  )
  
  // Grace period: Allow adding previous year data during first week of new year
  const isWithinGracePeriod = useMemo(() => {
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
    return dayOfYear <= 7
  }, [today])
  
  const allowedYears = useMemo(() => {
    return isWithinGracePeriod ? [currentYear - 1, currentYear] : [currentYear]
  }, [isWithinGracePeriod, currentYear])

  // Fetch daily records with IDs for the current year
  const fetchDailyRecords = async (year: number): Promise<void> => {
    try {
      const data = await apiCall<VisitationRecord[]>(API_ENDPOINTS.daily(year))
      setDailyRecords(data)
    } catch (error) {
      console.error('Error fetching daily records:', error)
    }
  }

  useEffect(() => {
    fetchDailyRecords(currentYear)
  }, [currentYear])

  const statistics = useMemo<Statistics>(() => {
    const yearData = filterByYear(visitation, currentYear)
    const monthData = filterByYearAndMonth(visitation, currentYear, selectedMonth)

    const monthTotal = monthData.reduce((sum, d) => sum + d.visitors, 0)
    const ytdTotal = yearData.reduce((sum, d) => sum + d.visitors, 0)

    return { monthTotal, ytdTotal, monthCount: monthData.length, yearCount: yearData.length }
  }, [visitation, currentYear, selectedMonth])

  const recordsByMonth = useMemo(() => {
    const buckets: VisitationRecord[][] = Array.from({ length: 12 }, () => [])

    dailyRecords.forEach(record => {
      const date = new Date(record.date)
      if (date.getFullYear() !== currentYear) return
      buckets[date.getMonth()].push(record)
    })

    return buckets
  }, [dailyRecords, currentYear])

  const selectedMonthRecords = useMemo(() => {
    return recordsByMonth[selectedMonthTab - 1] ?? []
  }, [recordsByMonth, selectedMonthTab])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    
    if (!selectedDate || !visitors) {
      setMessage('Please enter both date and visitor count')
      return
    }

    const visitorCount = parseInt(visitors)
    if (isNaN(visitorCount) || visitorCount < 0) {
      setMessage('Please enter a valid number of visitors')
      return
    }
    
    // Validate year is within allowed range
    const entryYear = parseInt(selectedDate.split('-')[0])
    if (!allowedYears.includes(entryYear)) {
      setMessage(`✗ You can only add data for ${allowedYears.join(' or ')}`)
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const requestBody: { date: string; visitors: number; id?: number } = {
        date: selectedDate,
        visitors: visitorCount
      }
      
      if (editingId) {
        requestBody.id = editingId
      }
      
      await apiCall(API_ENDPOINTS.entry, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      setMessage(editingId ? '✓ Entry updated successfully' : '✓ Data saved successfully')
      setVisitors('')
      setEditingId(null)

      clearApiCache()
      
      // Refresh daily records
      await fetchDailyRecords(currentYear)
      
      // Refresh data store
      await fetchData(true)
    } catch (error) {
      setMessage('✗ Error saving data: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (record: VisitationRecord): void => {
    setEditingId(record.id!)
    setSelectedDate(new Date(record.date).toISOString().split('T')[0])
    setVisitors(record.visitors.toString())
    setMessage('')
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return
    }

    setDeletingId(id)
    setMessage('')

    try {
      await apiCall(API_ENDPOINTS.entryById(id), {
        method: 'DELETE'
      })

      setMessage('✓ Entry deleted successfully')

      clearApiCache()
      
      // Refresh daily records immediately
      await fetchDailyRecords(currentYear)
      
      setDeletingId(null)
      
      // Refresh data store
      await fetchData(true)
    } catch (error) {
      setMessage('✗ Error deleting entry: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="p-6 border rounded-lg shadow-md border-border bg-card">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {new Date(selectedDate).toLocaleString('default', { month: 'long' })} {currentYear} Total
          </h3>
          <p className="text-3xl font-bold">{formatNumber(statistics.monthTotal)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{statistics.monthCount} days recorded</p>
        </div>
        <div className="p-6 border rounded-lg shadow-md border-border bg-card">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Year to Date {currentYear}</h3>
          <p className="text-3xl font-bold">{formatNumber(statistics.ytdTotal)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{statistics.yearCount} days recorded</p>
        </div>
      </div>

      {/* Data Entry Form */}
      <div className="p-6 border rounded-lg shadow-md border-border bg-card">
        <h2 className="mb-4 text-xl font-semibold">
          {editingId ? 'Edit Visitor Data' : 'Add Daily Visitor Data'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Visitor data entry form">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="date" className="block mb-2 text-sm font-medium text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                max={`${currentYear}-12-31`}
                min={isWithinGracePeriod ? `${currentYear - 1}-01-01` : `${currentYear}-01-01`}
                className="w-full px-3 py-2 border rounded-md bg-background border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {isWithinGracePeriod && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Grace period active: You can add data for {currentYear - 1} or {currentYear}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="visitors" className="block mb-2 text-sm font-medium text-muted-foreground">
                Number of Visitors
              </label>
              <input
                type="number"
                id="visitors"
                value={visitors}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setVisitors(e.target.value)}
                placeholder="Enter visitor count"
                min="0"
                className="w-full px-3 py-2 border rounded-md bg-background border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center gap-2 px-6 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm ${
                editingId 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600' 
                  : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
              }`}
              aria-label={editingId ? 'Update visitor entry' : 'Add new visitor entry'}
            >
              {saving ? (
                <>
                  <span className="animate-pulse">●</span>
                  <span>Saving...</span>
                </>
              ) : editingId ? (
                <>
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>Update Entry</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add Entry</span>
                </>
              )}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setSelectedDate(new Date().toISOString().split('T')[0])
                  setVisitors('')
                  setMessage('')
                }}
                className="inline-flex items-center gap-2 px-6 py-2 font-medium transition-colors rounded-md shadow-sm bg-muted text-foreground hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Cancel editing"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span>Cancel</span>
              </button>
            )}
            {message && (
              <div 
                role="status" 
                aria-live="polite"
                className={`text-sm font-medium px-3 py-1.5 rounded-md ${
                  message.startsWith('✓') 
                    ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50' 
                    : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50'
                }`}
              >
                {message}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Recent Entries */}
      <div className="p-6 border rounded-lg shadow-md border-border bg-card">
        <h2 className="mb-4 text-xl font-semibold" id="recent-entries-heading">
          Recent Entries ({currentYear})
        </h2>
        
        {/* Month Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto border-b border-border">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
            const monthName = monthShortFormatter.format(new Date(currentYear, month - 1, 1))
            const monthEntries = recordsByMonth[month - 1] ?? []
            const hasEntries = monthEntries.length > 0
            
            return (
              <button
                key={month}
                onClick={() => setSelectedMonthTab(month)}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedMonthTab === month
                    ? 'border-b-2 border-accent text-foreground'
                    : hasEntries
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground/50 cursor-default'
                }`}
                disabled={!hasEntries}
                aria-label={`View entries for ${monthName}`}
              >
                {monthName}
                {hasEntries && <span className="ml-1.5 text-xs">({monthEntries.length})</span>}
              </button>
            )
          })}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-labelledby="recent-entries-heading">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium text-left text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-medium text-right text-muted-foreground">Visitors</th>
                <th className="px-4 py-3 font-medium text-right text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedMonthRecords
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((record, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-accent/5">
                    <td className="px-4 py-3">
                      {fullDateFormatter.format(new Date(record.date))}
                    </td>
                    <td className="px-4 py-3 font-medium text-right">{formatNumber(record.visitors)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(record)}
                          disabled={deletingId === record.id}
                          className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                          aria-label={`Edit entry for ${monthDayLongFormatter.format(new Date(record.date))}`}
                        >
                          <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id!)}
                          disabled={deletingId === record.id}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                          aria-label={`Delete entry for ${monthDayLongFormatter.format(new Date(record.date))}`}
                        >
                          {deletingId === record.id ? (
                            <span className="text-xs animate-pulse" aria-label="Deleting">●●●</span>
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {selectedMonthRecords.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No entries for {monthLongFormatter.format(new Date(currentYear, selectedMonthTab - 1, 1))} {currentYear}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
