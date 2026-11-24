export interface VisitationRecord {
  id?: number;
  date: string;
  visitors: number;
}

export interface AnnualData {
  year: number;
  visitors: number;
}

export interface Stats {
  total_visitors: number;
  years_covered: [number, number]; // [first year, last year]
  ten_year_average: number;
  highest_growth_year: number;
  highest_growth_value: number;
  biggest_decline_year: number;
  biggest_decline_value: number;
  peak_month: string;
  peak_month_visitors: number;
  peak_year_visitors: number;
}

export interface DataStore {
  visitation: VisitationRecord[];
  annualData: AnnualData[];
  stats: Stats;
  hoveredDate: Date | null;
  setHoveredDate: (date: Date | null) => void;
  setVisitation: (data: VisitationRecord[]) => void;
  setAnnualData: (data: AnnualData[]) => void;
  setStats: (stats: Stats) => void;
  fetchData: (force?: boolean) => Promise<void>;
}

export interface ThemeStore {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export interface VisitationEntry {
  date: string;
  visitors: number;
}

export type ClaimStatus = 'verified' | 'mismatch' | 'unknown_field';

export interface CheckedClaim {
  text: string;
  value: number;
  source_field: string;
  status: ClaimStatus;
  actual: number | null;
}

export interface ExplanationVerification {
  status: 'verified' | 'partially_verified' | 'failed';
  claims: CheckedClaim[];
  unchecked_numbers: string[];
  attempts: number;
  model: string;
}

export interface ExplanationResult {
  explanation: string;
  verification?: ExplanationVerification;
}

export interface ExplanationCache extends ExplanationResult {
  key: string;
  chartType: 'annual_trends' | 'monthly_breakdown' | 'heatmap' | 'monthly_rank';
  timestamp: number;
}

export interface ExplanationStore {
  explanations: Map<string, ExplanationCache>;
  getExplanation: (
    chartType: ExplanationCache['chartType'],
    data: Record<string, unknown>,
  ) => ExplanationResult | null;
  setExplanation: (
    chartType: ExplanationCache['chartType'],
    data: Record<string, unknown>,
    result: ExplanationResult,
  ) => void;
  clearExplanations: () => void;
}
