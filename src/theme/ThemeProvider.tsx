import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { PALETTES, SCENE_TUNING, type Theme } from './palette'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'
import { DEFAULT_THEME, applyTheme, isTheme, readStoredTheme, storeTheme } from './theme'

/**
 * Seeds React state from the DOM, not from storage.
 *
 * By the time this runs, the boot script in `index.html` has already resolved
 * the theme and painted with it. Re-deriving the answer from `localStorage`
 * here would usually agree, but "usually" is exactly the failure this ordering
 * exists to prevent — if the two ever disagreed the page would visibly correct
 * itself after hydration, which is the flash. Reading back what is already on
 * the element makes agreement structural rather than coincidental.
 *
 * The fallbacks behind it are for the case where the boot script did not run
 * at all (CSP stripped the inline script, a test mounting the tree directly).
 */
function initialTheme(): Theme {
  const attr = document.documentElement.dataset['theme']
  if (isTheme(attr)) return attr
  return readStoredTheme() ?? DEFAULT_THEME
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  /**
   * Mount included, deliberately. On a normal load this re-applies the value
   * the boot script already set, which is a no-op on `data-theme` but is what
   * corrects the `theme-color` meta — that one is hardcoded in the markup and
   * the boot script does not touch it.
   *
   * Layout effect, not `useEffect`, and the difference is observable. React
   * currently flushes passive effects synchronously before paint when the
   * update came from a discrete event, so a click would *probably* be fine —
   * but "probably, because of a scheduling detail" is not what should stand
   * between the reader and a one-frame flash of the old theme. This commits the
   * attribute in the same frame as the render that changed it, by contract.
   * There is no SSR here for the usual `useLayoutEffect` warning to apply to.
   */
  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  /**
   * Persists, because every call is an explicit choice.
   *
   * Nothing writes storage on mount. A first-time visitor who never touches the
   * toggle leaves no key behind, so they stay on whatever the default is rather
   * than being silently pinned to today's value of it.
   */
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    storeTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      storeTheme(next)
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      palette: PALETTES[theme],
      scene: SCENE_TUNING[theme],
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
