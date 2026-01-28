import { useEffect, useState } from 'react'
import { useThemeStore } from './store/themeStore'
import { useDataStore } from './store/dataStore'
import Dashboard from './components/Dashboard'
import Header from './components/Header'

function App() {
  const { darkMode } = useThemeStore()
  const { fetchData } = useDataStore()
  const [loading, setLoading] = useState(true)

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
            const testDate = state.visitation[Math.floor(state.visitation.length / 2)].date
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Header />
      {loading ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg text-muted-foreground">Loading data...</div>
        </div>
      ) : (
        <Dashboard />
      )}
    </div>
  )
}

export default App
