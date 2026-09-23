import { useTheme } from '@/theme/ThemeContext'

/**
 * The theme control. Styled by `.theme-toggle`, which is appended to the same
 * rule as `.plate__expand` and `.plate-view__close` rather than given its own
 * treatment — the page has exactly one button style and this is it.
 *
 * The label names the destination ("DARK" while light), not the current state.
 * A control labelled with what it already is reads as a status readout, and the
 * two are indistinguishable at a glance in a page with no other chrome. The
 * accessible name spells the action out in full, since "DARK" alone is not a
 * sentence a screen reader can act on.
 *
 * No `aria-pressed`. It is tempting — the thing is binary — but a toggle button
 * announces "pressed/not pressed" against its own label, which here would be
 * "dark, pressed" while the page is *light*. The state is the page, not the
 * button, so this stays a plain button that performs an action.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {next}
    </button>
  )
}
