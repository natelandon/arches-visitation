import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChartExplanation } from './ChartExplanation';
import { useExplanationStore } from '../store/dataStore';

const sampleData = {
  month: 'January',
  year: 2025,
  stats: { visitors: 1000, percentage: '10.0', rank: 1, avgDaily: 32 },
};

describe('ChartExplanation', () => {
  beforeEach(() => {
    useExplanationStore.getState().clearExplanations();
    vi.restoreAllMocks();
  });

  it('uses cached explanation without fetching the explanation endpoint', async () => {
    useExplanationStore
      .getState()
      .setExplanation('monthly_breakdown', sampleData, { explanation: 'Cached explanation' });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    } as Response);

    render(
      <ChartExplanation chartType="monthly_breakdown" data={sampleData} />
    );

    expect(await screen.findByText('Cached explanation')).toBeInTheDocument();
    
    // Verify fetch was only called for health check, not for explanation
    const explanationCalls = fetchSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/explain-chart')
    );
    expect(explanationCalls).toHaveLength(0);
  });

  it('fetches explanation when cache is empty', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, explanation: 'Fresh explanation' }),
    } as Response);

    render(
      <ChartExplanation chartType="monthly_breakdown" data={sampleData} />
    );

    await waitFor(() => {
      expect(screen.getByText('Fresh explanation')).toBeInTheDocument();
    });
  });

  it('shows which numbers were checked against the data', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        available: true,
        explanation: 'January had 1,000 visitors.',
        verification: {
          status: 'failed',
          claims: [
            { text: '1,000 visitors', value: 1000, source_field: 'stats.visitors', status: 'verified', actual: 1000 },
            { text: 'rank 2', value: 2, source_field: 'stats.rank', status: 'mismatch', actual: 1 },
          ],
          unchecked_numbers: ['45%'],
          attempts: 2,
          model: 'mistral',
        },
      }),
    } as Response);

    render(<ChartExplanation chartType="monthly_breakdown" data={sampleData} />);

    expect(await screen.findByText("Some numbers don't match the data")).toBeInTheDocument();
    expect(screen.getByText(/data says 1/)).toBeInTheDocument();
    expect(screen.getByText(/isn't in the chart data/)).toBeInTheDocument();
    expect(screen.getByText('mistral, 2 attempts')).toBeInTheDocument();
  });

  it('shows a timeout as a retryable error, not as Ollama missing', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) =>
      ({
        ok: true,
        json: async () =>
          String(url).includes('/explain-chart')
            ? { available: false, reason: 'error', explanation: 'Explanation generation timed out. Please try again.' }
            : { available: true },
      }) as Response
    );

    render(<ChartExplanation chartType="heatmap" data={{ x: 1 }} />);

    expect(await screen.findByText('Could not generate explanation')).toBeInTheDocument();
    expect(screen.getByText(/timed out/)).toBeInTheDocument();
    expect(screen.queryByText('AI Explanations Not Available')).not.toBeInTheDocument();
  });

  it('shows setup instructions when Ollama is unreachable', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) =>
      ({
        ok: true,
        json: async () =>
          String(url).includes('/explain-chart')
            ? { available: false, reason: 'unavailable', explanation: 'not running' }
            : { available: true },
      }) as Response
    );

    render(<ChartExplanation chartType="heatmap" data={{ x: 2 }} />);

    expect(await screen.findByText('AI Explanations Not Available')).toBeInTheDocument();
  });

  it('never shows the previous data\'s explanation after the data changes', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (!String(url).includes('/explain-chart')) {
        return { ok: true, json: async () => ({ available: true }) } as Response;
      }
      const { data } = JSON.parse(String((init as RequestInit).body));
      if (data.month === 'December') {
        return { ok: true, json: async () => ({ available: true, explanation: 'December explanation' }) } as Response;
      }
      return new Promise<Response>(() => {}); // May: still generating
    });

    const { rerender } = render(<ChartExplanation chartType="monthly_breakdown" data={{ month: 'December' }} />);
    expect(await screen.findByText('December explanation')).toBeInTheDocument();

    rerender(<ChartExplanation chartType="monthly_breakdown" data={{ month: 'May' }} />);

    // Immediately, and after the debounce, December's text is gone and May shows as loading
    expect(screen.queryByText('December explanation')).not.toBeInTheDocument();
    expect(await screen.findByText('Generating insights...')).toBeInTheDocument();
    expect(screen.queryByText('December explanation')).not.toBeInTheDocument();
  });

  it('switching back to data with a cached explanation shows it straight away', async () => {
    useExplanationStore.getState().setExplanation('monthly_breakdown', { month: 'June' }, { explanation: 'June explanation' });
    vi.spyOn(global, 'fetch').mockImplementation(async (url) =>
      (String(url).includes('/explain-chart')
        ? new Promise<Response>(() => {})
        : ({ ok: true, json: async () => ({ available: true }) } as Response))
    );

    const { rerender } = render(<ChartExplanation chartType="monthly_breakdown" data={{ month: 'May' }} />);
    rerender(<ChartExplanation chartType="monthly_breakdown" data={{ month: 'June' }} />);

    expect(screen.getByText('June explanation')).toBeInTheDocument();
  });
});
