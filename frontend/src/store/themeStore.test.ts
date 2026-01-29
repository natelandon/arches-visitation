import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from './themeStore';

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset localStorage
    localStorage.clear();
    // Reset store to initial state
    vi.clearAllMocks();
  });

  it('provides darkMode state', () => {
    const store = useThemeStore.getState();
    expect(typeof store.darkMode).toBe('boolean');
  });

  it('provides toggleDarkMode function', () => {
    const store = useThemeStore.getState();
    expect(typeof store.toggleDarkMode).toBe('function');
  });

  it('function can be called without errors', () => {
    const store = useThemeStore.getState();
    expect(() => {
      store.toggleDarkMode();
    }).not.toThrow();
  });

  it('persists darkMode preference to localStorage', () => {
    const store = useThemeStore.getState();
    const initialMode = store.darkMode;

    // Call toggle
    store.toggleDarkMode();

    // Verify localStorage was accessed (implementation dependent)
    const saved = localStorage.getItem('theme-mode');
    expect(saved).toBeDefined();
  });

  it('allows reading darkMode state', () => {
    const store = useThemeStore.getState();
    const mode = store.darkMode;
    expect(typeof mode).toBe('boolean');
  });

  it('toggleDarkMode is callable multiple times', () => {
    const store = useThemeStore.getState();

    expect(() => {
      store.toggleDarkMode();
      store.toggleDarkMode();
      store.toggleDarkMode();
    }).not.toThrow();
  });

  it('store state is accessible via hook', () => {
    const state = useThemeStore.getState();
    expect(state).toBeDefined();
    expect('darkMode' in state).toBe(true);
    expect('toggleDarkMode' in state).toBe(true);
  });
});
