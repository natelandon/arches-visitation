import { useEffect, useState } from 'react'
import { useThemeStore } from './store/themeStore'
import { useDataStore } from './store/dataStore'
import Dashboard from './components/Dashboard'
import Header from './components/Header'
import { ErrorBoundary } from './components/ErrorBoundary'

function App(): JSX.Element {
  const darkMode = useThemeStore((state) => state.darkMode)
  const fetchData = useDataStore((state) => state.fetchData)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    const initData = async () => {
      try {
        await fetchData()
        
        // Auto-set hoveredDate after data loads for initial demo
        setTimeout(() => {
          const state = useDataStore.getState()
          
          if (state.visitation.length > 0) {
            const testDate = new Date(state.visitation[Math.floor(state.visitation.length / 2)].date)
            state.setHoveredDate(testDate)
          }
        }, 500)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    initData()
  }, [fetchData])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
        <Header />
        {loading ? (
          <div className="flex items-center justify-center h-screen">
            <div
              className="text-lg text-muted-foreground"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              Loading data...
            </div>
          </div>
        ) : (
          <Dashboard />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
