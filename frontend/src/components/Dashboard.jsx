import { useState } from 'react'
import { useDataStore } from '../store/dataStore'
import TimeSeriesChart from './TimeSeriesChart'
import MonthlyHeatmap from './MonthlyHeatmap'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const { stats, visitation } = useDataStore()

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  return (
    <div className="container max-w-screen-2xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex border-b border-border">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border-b-2 border-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => handleTabChange('details')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'details'
                ? 'border-b-2 border-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Heatmap & Stats
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border p-6 bg-card">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Visitors</h3>
              <p className="text-3xl font-bold">{formatNumber(stats.total_visitors || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">over {stats.years_covered || '—'} years</p>
            </div>
            <div className="rounded-lg border border-border p-6 bg-card">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Avg Annual</h3>
              <p className="text-3xl font-bold">{formatNumber(stats.average_annual || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">visitors per year</p>
            </div>
            <div className="rounded-lg border border-border p-6 bg-card">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Peak Year</h3>
              <p className="text-3xl font-bold">{stats.peak_year || '—'}</p>
              <p className="text-xs text-muted-foreground mt-2">{formatNumber(stats.peak_year_visitors || 0)}</p>
            </div>
            <div className="rounded-lg border border-border p-6 bg-card">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Peak Month</h3>
              <p className="text-3xl font-bold">{stats.peak_month || '—'}</p>
              <p className="text-xs text-muted-foreground mt-2">{formatNumber(stats.peak_month_visitors || 0)}</p>
            </div>
          </div>

          {/* Trend Analysis */}
          <div className="mt-6 rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Visitation Trends</h2>
            <TimeSeriesChart />
            <p className="text-sm text-muted-foreground mt-4">💡 Hover over the chart to explore historical patterns</p>
          </div>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Monthly Heatmap */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Monthly Visitation Heatmap</h2>
            <MonthlyHeatmap visitation={visitation} />
          </div>

          {/* 2025 Statistics */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">2025 Annual Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-4">Monthly Summary</h3>
                <div className="space-y-2 text-sm">
                  {visitation
                    .filter(d => new Date(d.date).getFullYear() === 2025)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((record, idx) => {
                      const date = new Date(record.date)
                      const monthName = date.toLocaleString('default', { month: 'long' })
                      return (
                        <div key={idx} className="flex justify-between border-b border-border pb-2">
                          <span className="text-muted-foreground">{monthName}</span>
                          <span className="font-medium">{formatNumber(record.visitors)}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold mb-4">2025 Quick Stats</h3>
                <div className="space-y-4">
                  {(() => {
                    const data2025 = visitation.filter(d => new Date(d.date).getFullYear() === 2025)
                    if (data2025.length === 0) {
                      return <p className="text-muted-foreground">No 2025 data available</p>
                    }
                    const total = data2025.reduce((sum, d) => sum + d.visitors, 0)
                    const avg = Math.round(total / data2025.length)
                    const max = Math.max(...data2025.map(d => d.visitors))
                    const min = Math.min(...data2025.map(d => d.visitors))
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Visitors</span>
                          <span className="font-medium">{formatNumber(total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average/Month</span>
                          <span className="font-medium">{formatNumber(avg)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Peak Month</span>
                          <span className="font-medium">{formatNumber(max)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Lowest Month</span>
                          <span className="font-medium">{formatNumber(min)}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
