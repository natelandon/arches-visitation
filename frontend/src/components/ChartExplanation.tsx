import React, { useState, useEffect } from 'react';
import { Lightbulb, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { useExplanationStore } from '../store/dataStore';
import { API_ENDPOINTS, apiCall } from '../config/api';
import useDebouncedValue from '../hooks/useDebouncedValue';
import type { ExplanationResult, ExplanationVerification } from '../types';

const STATUS_STYLES: Record<ExplanationVerification['status'], {
  label: string;
  className: string;
  Icon: typeof ShieldCheck;
}> = {
  verified: {
    label: 'Every number checked against the data',
    className: 'text-emerald-700 dark:text-emerald-300',
    Icon: ShieldCheck,
  },
  partially_verified: {
    label: "Some numbers couldn't be checked",
    className: 'text-amber-700 dark:text-amber-300',
    Icon: ShieldQuestion,
  },
  failed: {
    label: "Some numbers don't match the data",
    className: 'text-red-700 dark:text-red-300',
    Icon: ShieldAlert,
  },
};

const CLAIM_LABELS = {
  verified: 'matches',
  mismatch: 'does not match',
  unknown_field: 'no such field',
} as const;

const formatValue = (value: number | null) =>
  value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export const VerificationDetails: React.FC<{ verification: ExplanationVerification }> = ({
  verification,
}) => {
  const { label, className, Icon } = STATUS_STYLES[verification.status];
  const hasDetails = verification.claims.length > 0 || verification.unchecked_numbers.length > 0;

  return (
    <details className="mt-3 text-xs" data-testid="verification">
      <summary className={`flex items-center gap-1.5 font-medium ${hasDetails ? 'cursor-pointer' : 'list-none'} ${className}`}>
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        {label}
      </summary>
      {hasDetails && (
        <ul className="mt-2 space-y-1 pl-6 text-blue-800 dark:text-blue-300">
          {verification.claims.map((claim, i) => (
            <li key={`${claim.source_field}-${i}`}>
              <span className="font-medium">{claim.text}</span>{' '}
              <code className="text-[11px]">{claim.source_field}</code>{' '}
              {CLAIM_LABELS[claim.status]}
              {claim.status === 'mismatch' && ` (data says ${formatValue(claim.actual)})`}
            </li>
          ))}
          {verification.unchecked_numbers.map((number) => (
            <li key={`unchecked-${number}`}>
              <span className="font-medium">{number}</span> isn't in the chart data
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 pl-6 text-[11px] text-blue-700/80 dark:text-blue-300/70">
        {verification.model}, {verification.attempts} {verification.attempts === 1 ? 'attempt' : 'attempts'}
      </p>
    </details>
  );
};

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
  // Each result and error remembers which data it belongs to, so after the
  // data changes the old text is never shown for the new data.
  const [result, setResult] = useState<{ key: string; value: ExplanationResult } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
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
  const isDataEmpty = !debouncedData || Object.keys(debouncedData).length === 0;
  const currentKey = JSON.stringify(data);

  // Derived during render from the current data (not the debounced copy), so a
  // cached explanation appears immediately and never lags behind a change.
  const cached = !data || Object.keys(data).length === 0 ? undefined : getExplanation(chartType, data);
  const shown = cached ?? (result?.key === currentKey ? result.value : null);
  const currentError = !cached && error?.key === currentKey ? error.message : null;

  // Fetch explanation when data changes
  useEffect(() => {
    if (externalIsLoading || isDataEmpty || getExplanation(chartType, debouncedData)) return;

    const key = JSON.stringify(debouncedData);
    const controller = new AbortController();

    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiCall<ExplanationResult & { available: boolean; reason?: 'unavailable' | 'error' }>(API_ENDPOINTS.aiExplain, {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            chart_type: chartType,
            data: debouncedData,
          }),
        });
        
        if (response.available) {
          const next: ExplanationResult = {
            explanation: response.explanation,
            verification: response.verification,
          };
          setResult({ key, value: next });
          cacheExplanation(chartType, debouncedData, next);
          setIsAvailable(true);
        } else {
          setError({ key, message: response.explanation });
          // Only an unreachable Ollama gets the setup instructions; a timeout
          // or bad model output is shown as a plain error.
          setIsAvailable(response.reason !== 'unavailable');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError({ key, message: `Unable to fetch explanation: ${errorMessage}` });
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
  }, [chartType, debouncedData, externalIsLoading, isDataEmpty, getExplanation, cacheExplanation]);

  // If service is unavailable or checking, show setup instructions
  if (isAvailable === false && !isLoading && !cached) {
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
  // Loading until there is an explanation or an error for the current data
  if (externalIsLoading || (!shown && !currentError)) {
    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-pulse">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Generating insights...
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              This can take 1-2 minutes on a laptop CPU
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
  if (currentError) {
    return (
      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Could not generate explanation
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {currentError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show explanation
  if (shown?.explanation) {
    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Key Insights
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-2 leading-relaxed">
              {shown.explanation}
            </p>
            {shown.verification && (
              <VerificationDetails verification={shown.verification} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
