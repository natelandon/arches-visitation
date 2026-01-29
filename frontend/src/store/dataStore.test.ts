import { describe, it, expect, beforeEach } from 'vitest';
import { useExplanationStore } from './dataStore';

const sampleData = {
  month: 'January',
  year: 2025,
  stats: { visitors: 1000, percentage: '10.0', rank: 1, avgDaily: 32 },
};

describe('useExplanationStore', () => {
  beforeEach(() => {
    useExplanationStore.getState().clearExplanations();
  });

  it('stores and retrieves explanations by chart type and data', () => {
    const store = useExplanationStore.getState();

    expect(store.getExplanation('monthly_breakdown', sampleData)).toBeNull();

    store.setExplanation('monthly_breakdown', sampleData, 'Cached explanation');

    expect(store.getExplanation('monthly_breakdown', sampleData)).toBe(
      'Cached explanation',
    );
  });

  it('clears cached explanations', () => {
    const store = useExplanationStore.getState();

    store.setExplanation('monthly_breakdown', sampleData, 'Cached explanation');
    store.clearExplanations();

    expect(store.getExplanation('monthly_breakdown', sampleData)).toBeNull();
  });
});
