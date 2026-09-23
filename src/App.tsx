import { lazy, Suspense, useEffect, useState } from 'react'
import { ProgressProvider } from '@/progress/ProgressProvider'
import { Hero } from '@/ui/Hero'
import { StageSection } from '@/ui/StageSection'
import { ProgressRail } from '@/ui/ProgressRail'
import { Outro } from '@/ui/Outro'
import { Offerings } from '@/ui/Offerings'
import { Contact } from '@/ui/Contact'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { TimelineHUD, hudEnabled } from '@/dev/TimelineHUD'
import { useTheme } from '@/theme/ThemeContext'
import type { StageId } from '@/experience/types'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THE CANVAS IS BEHIND A LAZY BOUNDARY
 * ────────────────────────────────────────────────────────────────────────────
 * three, R3F and drei are ~85% of this application's JavaScript, and until this
 * split they were all in the critical path: `SceneCanvas` was a static import,
 * so the browser had to parse and execute the entire renderer before React
 * could commit a single character of the headline. Measured on the production
 * build, that put 1,322.95 kB (382.11 kB gzip) between the reader and the first
 * word on a page whose opening is typographic.
 *
 * Nothing about the first paint needs any of it. The hero is type on the void
 * background, the canvas is `position: fixed` underneath it, and the specimen
 * cannot appear before its 3.4 MB scan has downloaded anyway.
 *
 * Two things had to move for the split to actually take effect, and both were
 * pulling three back into the eager chunk through the side door:
 *
 *   • `preloadAssets` — imported here for its own sake, but it reaches PLYLoader
 *     and GLTFLoader, so a static import of it is a static import of three. It
 *     is now imported inside the idle callback that was already deferring it.
 *   • `AssetLoadingIndicator` — one line of type, but it reads drei's
 *     `useProgress`. It reports on a load that cannot have started yet, so it
 *     belongs on the far side of the boundary too.
 *
 * `fallback={null}` throughout: there is nothing to show in the interim that is
 * better than what is already there. A skeleton or a spinner for a layer that is
 * *behind* the content would be inventing a loading state the reader does not
 * have.
 *
 *
 * THE THREE BEATS
 * ───────────────
 * Alternating the caption's horizontal position keeps the reading rhythm from
 * settling into a template; all three sit in the same clear bottom band, so the
 * side a caption takes never affects whether it covers the plant. See the header
 * of `StageSection.tsx` for the measurement.
 */
const SceneCanvas = lazy(() =>
  import('@/scene/SceneCanvas').then((m) => ({ default: m.SceneCanvas })),
)

const AssetLoadingIndicator = lazy(() =>
  import('@/ui/AssetLoadingIndicator').then((m) => ({ default: m.AssetLoadingIndicator })),
)

const SECTIONS: Array<{ id: StageId; align: 'left' | 'right' }> = [
  { id: 'capture', align: 'left' },
  { id: 'reconstruct', align: 'right' },
  { id: 'phenotype', align: 'left' },
]

export function App() {
  const [showHud] = useState(hudEnabled)
  const { theme } = useTheme()

  // Warm the assets once the first paint is done. Kicking this off during the
  // initial render would put a multi-megabyte scan in contention with the
  // fonts and the JS bundle, which is the one moment it must not be.
  //
  // The import is inside the callback, not at the top of the file: `loaders`
  // reaches PLYLoader and GLTFLoader, so hoisting it would put three back in the
  // critical path and undo the lazy boundary above.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 400))
    const handle = idle(() => {
      void import('@/assets/loaders').then((m) => m.preloadAssets())
    })
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle as number)
      else window.clearTimeout(handle as number)
    }
  }, [])

  return (
    // `trailing` rather than further children, and this is the one structural
    // rule of the page: the ScrollTrigger measures only what it is given as
    // `children`, so anything placed there becomes part of the reconstruction's
    // 810vh and rescales all three beats. The offerings and the contact section
    // are a separate document that happens to follow. See the two-slot note in
    // `ProgressProvider`.
    <ProgressProvider
      trailing={
        <>
          <Offerings />
          <Contact />
        </>
      }
    >
      {/* Keyed on the theme, which forces a full remount of the WebGL tree.
          That is heavier than re-assigning uniforms and it is the right trade
          here. Every layer builds its uniforms in a `useMemo`, and the cloud's
          blending mode and depth-write flag are material construction
          parameters, not live values — so a theme change has to rebuild the
          material regardless. Remounting makes all of it correct by
          construction instead of leaving nine layers each responsible for
          noticing. It costs one WebGL context recreation per toggle, on an
          action a reader takes approximately never, and the scan is already
          parsed and cached by the loaders so nothing re-downloads. */}
      <Suspense fallback={null}>
        <SceneCanvas key={theme} />
      </Suspense>
      <div className="legibility-veil" />

      <main className="document">
        <Hero />
        {SECTIONS.map((s) => (
          <StageSection key={s.id} id={s.id} align={s.align} />
        ))}
        <Outro />
      </main>

      <ProgressRail />
      <ThemeToggle />
      <Suspense fallback={null}>
        <AssetLoadingIndicator />
      </Suspense>
      <div className="grain" />
      {showHud && <TimelineHUD />}
    </ProgressProvider>
  )
}
