import React, { useState, useEffect, useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { useExplanationStore } from '../store/dataStore';
import { API_ENDPOINTS, apiCall } from '../config/api';
import useDebouncedValue from '../hooks/useDebouncedValue';

interface ChartExplanationProps {
  chartType: 'annual_trends' | 'monthly_breakdown' | 'heatmap' | 'monthly_rank';
  data: Record<string, unknown>;
  isLoading?: boolean;
}

export const ChartExplanation: React.FC<ChartExplanationProps> = ({
  chartType,
  data,
  isLoading: externalIsLoading = false
}) => {
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  
  const getExplanation = useExplanationStore((state) => state.getExplanation);
  const cacheExplanation = useExplanationStore((state) => state.setExplanation);

  // Check AI service availability on mount
  useEffect(() => {
    const controller = new AbortController();

    const checkAvailability = async () => {
      try {
        const result = await apiCall<{ available: boolean }>(API_ENDPOINTS.aiStatus, {
          signal: controller.signal,
        });
        setIsAvailable(result.available);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setIsAvailable(false);
      }
    };

    checkAvailability();
    return () => controller.abort();
  }, []);

  const debouncedData = useDebouncedValue(data, 300);
  const dataKey = useMemo(() => JSON.stringify(debouncedData), [debouncedData]);
  const isDataEmpty = useMemo(
    () => !debouncedData || Object.keys(debouncedData).length === 0,
    [debouncedData, dataKey]
  );

  // Fetch explanation when data changes
  useEffect(() => {
    if (!debouncedData || externalIsLoading || isDataEmpty) return;

    // Check cache first
    const cached = getExplanation(chartType, debouncedData);
    if (cached) {
      setExplanation(cached);
      setIsAvailable(true);
      return;
    }

    const controller = new AbortController();

    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(null);
      setExplanation('');

      try {
        const result = await apiCall<{ available: boolean; explanation: string }>(API_ENDPOINTS.aiExplain, {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            chart_type: chartType,
            data: debouncedData,
          }),
        });
        
        if (result.available) {
          setExplanation(result.explanation);
          cacheExplanation(chartType, debouncedData, result.explanation);
          setIsAvailable(true);
        } else {
          setError(result.explanation);
          setIsAvailable(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Unable to fetch explanation: ${errorMessage}`);
        setIsAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce to avoid too many requests
    const timer = setTimeout(fetchExplanation, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [chartType, dataKey, debouncedData, externalIsLoading, getExplanation, cacheExplanation]);

  // If service is unavailable or checking, show setup instructions
  if (isAvailable === false && !isLoading) {
    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              AI Explanations Not Available
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              To enable AI-powered insights, install{' '}
              <a
                href="https://ollama.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                Ollama
              </a>
              , then run:
            </p>
            <pre className="mt-2 p-2 bg-blue-100 dark:bg-blue-800 rounded text-xs text-blue-900 dark:text-blue-100 overflow-x-auto">
              ollama pull mistral && ollama serve
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading || externalIsLoading) {
    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-pulse">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Generating insights...
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              This may take 10-30 seconds on first run
            </p>
            <div className="mt-2 space-y-2">
              <div className="h-3 bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
              <div className="h-3 bg-blue-200 dark:bg-blue-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Could not generate explanation
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show explanation
  if (explanation) {
    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Key Insights
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-2 leading-relaxed">
              {explanation}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
