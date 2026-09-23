import { createContext, useContext } from 'react'
import type { Palette, SceneTuning, Theme } from './palette'

export interface ThemeContextValue {
  theme: Theme
  /** The four role colours resolved for `theme`. Stable per theme. */
  palette: Palette
  /** Blending and lighting for `theme`. Stable per theme. */
  scene: SceneTuning
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

/** Sugar for the scene layers, which want the colours and nothing else. */
export function usePalette(): Palette {
  return useTheme().palette
}
