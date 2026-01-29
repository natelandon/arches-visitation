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
      .setExplanation('monthly_breakdown', sampleData, 'Cached explanation');

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
});
