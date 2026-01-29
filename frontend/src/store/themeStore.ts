import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeStore } from '../types';

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      darkMode: true,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
    }),
    {
      name: 'theme-storage',
    },
  ),
);
