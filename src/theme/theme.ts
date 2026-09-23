import { PALETTES, type Theme } from './palette'

/**
 * Theme resolution, in one place so the inline boot script in `index.html` and
 * the React app cannot drift apart.
 *
 * The boot script is hand-written rather than importing this module, because it
 * has to run before the bundle exists — see the comment there. The two things
 * it duplicates are `THEME_STORAGE_KEY` and `DEFAULT_THEME`. Nothing enforces
 * that the copies agree, so changing either constant here means editing
 * `index.html` in the same commit.
 */
export type { Theme }

export const THEME_STORAGE_KEY = 'phenotyping:theme'

/**
 * Light, unconditionally, for anyone who has not chosen.
 *
 * Deliberately NOT `prefers-color-scheme`. The system preference is a good
 * default in general and it is the wrong one here: this page opens on a
 * typographic hero and a long scroll-driven sequence that is art-directed
 * light-first, and a reader arriving from a dark-mode OS would get a theme
 * nobody chose for them. Dark remains one toggle away and is remembered
 * forever once taken, which is the part the system preference was standing in
 * for anyway.
 */
export const DEFAULT_THEME: Theme = 'light'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/**
 * The stored *explicit* choice, or null if there is none.
 *
 * Null and `DEFAULT_THEME` are not the same thing and the caller should not
 * collapse them: "never chose" is a state the default applies to, whereas
 * "chose light" is a decision that must survive any future change to the
 * default.
 *
 * Wrapped because `localStorage` is not merely empty in Safari's Lockdown mode
 * and some embedded webviews — reading it throws, and an exception here would
 * take the whole first render with it.
 */
export function readStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(raw) ? raw : null
  } catch {
    return null
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode or a blocked origin. The theme still applies for this
    // session; it just will not be remembered, which is the correct degradation.
  }
}

/**
 * Writes the theme to the document.
 *
 * `data-theme` on `<html>` is what the stylesheet keys off. The `theme-color`
 * meta is updated alongside it because it is baked into the markup as the dark
 * background, and a stale value paints the iOS status bar and the Android
 * address bar near-black behind a light page.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset['theme'] = theme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', PALETTES[theme].void)
}
