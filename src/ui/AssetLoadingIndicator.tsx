import { useProgress } from '@react-three/drei'
import { hasRealAssets } from '@/assets/manifest'
import { LOADING_COPY } from '@/content'

/**
 * A single line of type, bottom-right, while a reconstruction streams in.
 *
 * `useProgress` reads `THREE.DefaultLoadingManager`, which is what `useLoader`
 * reports to, so it needs no wiring to the loaders themselves.
 */
export function AssetLoadingIndicator() {
  const { active, progress, errors } = useProgress()

  if (!hasRealAssets) return null

  const failed = errors.length > 0
  if (!active && !failed) return null

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-30 flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      <span className="meta">
        {failed ? LOADING_COPY.failed : LOADING_COPY.active(Math.round(progress))}
      </span>
      <span className="block h-px w-16 bg-ink/15">
        <span
          className="block h-px origin-left bg-accent transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${failed ? 1 : progress / 100})` }}
        />
      </span>
    </div>
  )
}
