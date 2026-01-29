import { create } from 'zustand';
import type {
  DataStore,
  VisitationRecord,
  AnnualData,
  Stats,
  ExplanationStore,
  ExplanationCache,
} from '../types';
import { API_ENDPOINTS, apiCall } from '../config/api';

export const useDataStore = create<DataStore>((set) => ({
  visitation: [],
  annualData: [],
  stats: {
    total_visitors: 0,
    years_covered: 0,
    ten_year_average: 0,
    highest_growth_year: 0,
    highest_growth_value: 0,
    biggest_decline_year: 0,
    biggest_decline_value: 0,
    peak_month: '',
    peak_month_visitors: 0,
    peak_year_visitors: 0,
  },
  hoveredDate: null,

  setVisitation: (data: VisitationRecord[]) => set({ visitation: data }),
  setAnnualData: (data: AnnualData[]) => set({ annualData: data }),
  setStats: (stats: Stats) => set({ stats }),
  setHoveredDate: (date: Date | null) => set({ hoveredDate: date }),

  fetchData: async (force = false) => {
    try {
      const [stats, timeseries, annual] = await Promise.all([
        apiCall<Stats>(
          API_ENDPOINTS.stats,
          force ? { cache: 'no-store' } : undefined,
        ),
        apiCall<VisitationRecord[]>(
          API_ENDPOINTS.timeseries,
          force ? { cache: 'no-store' } : undefined,
        ),
        apiCall<AnnualData[]>(
          API_ENDPOINTS.annual,
          force ? { cache: 'no-store' } : undefined,
        ),
      ]);

      set({ stats, visitation: timeseries, annualData: annual });
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  },
}));

const createExplanationKey = (
  chartType: ExplanationCache['chartType'],
  data: Record<string, unknown>,
): string => {
  return `${chartType}:${JSON.stringify(data)}`;
};

export const useExplanationStore = create<ExplanationStore>((set, get) => ({
  explanations: new Map(),

  getExplanation: (
    chartType: ExplanationCache['chartType'],
    data: Record<string, unknown>,
  ): string | null => {
    const key = createExplanationKey(chartType, data);
    const cached = get().explanations.get(key);
    return cached?.explanation ?? null;
  },

  setExplanation: (
    chartType: ExplanationCache['chartType'],
    data: Record<string, unknown>,
    explanation: string,
  ) => {
    const key = createExplanationKey(chartType, data);
    const newCache: ExplanationCache = {
      key,
      chartType,
      explanation,
      timestamp: Date.now(),
    };
    set((state) => {
      const next = new Map(state.explanations);
      next.set(key, newCache);
      return { explanations: next };
    });
  },

  clearExplanations: () => {
    set({ explanations: new Map() });
  },
}));
