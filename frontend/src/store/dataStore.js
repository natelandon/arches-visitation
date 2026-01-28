import { create } from 'zustand'

export const useDataStore = create((set) => ({
  visitation: [],
  stats: {},
  selectedDateRange: null,
  hoveredDate: null,
  selectedPoint: null,
  filters: {},
  
  setVisitation: (data) => set({ visitation: data }),
  setStats: (stats) => set({ stats }),
  setSelectedDateRange: (range) => set({ selectedDateRange: range }),
  setHoveredDate: (date) => set({ hoveredDate: date }),
  setSelectedPoint: (point) => set({ selectedPoint: point }),
  setFilters: (filters) => set({ filters }),
  
  fetchData: async () => {
    try {
      const [statsRes, timeseriesRes] = await Promise.all([
        fetch('/api/visitation/stats'),
        fetch('/api/visitation/timeseries')
      ])
      
      const stats = await statsRes.json()
      const timeseries = await timeseriesRes.json()
      
      set({ stats, visitation: timeseries })
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }
}))
