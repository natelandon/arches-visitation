const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const DEFAULT_CACHE_TTL_MS = Number(
  import.meta.env.VITE_API_CACHE_TTL_MS ?? 30_000,
);
const responseCache = new Map<string, { timestamp: number; data: unknown }>();

export const API_ENDPOINTS = {
  stats: `${API_BASE_URL}/visitation/stats`,
  timeseries: `${API_BASE_URL}/visitation/timeseries`,
  annual: `${API_BASE_URL}/visitation/annual`,
  daily: (year: number) => `${API_BASE_URL}/visitation/daily?year=${year}`,
  entry: `${API_BASE_URL}/visitation/entry`,
  entryById: (id: number) => `${API_BASE_URL}/visitation/entry/${id}`,
  aiStatus: `${API_BASE_URL}/api/ai/status`,
  aiExplain: `${API_BASE_URL}/api/ai/explain-chart`,
} as const;

export async function apiCall<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const method = options?.method?.toUpperCase() ?? 'GET';
  const shouldCache = method === 'GET';

  if (shouldCache) {
    const cached = responseCache.get(url);
    if (cached && Date.now() - cached.timestamp < DEFAULT_CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T;
  if (shouldCache) {
    responseCache.set(url, { timestamp: Date.now(), data });
  }

  return data;
}

export const clearApiCache = (): void => {
  responseCache.clear();
};
