import { useRef } from 'react'
import { SECTION_COPY } from '@/content'
import { STAGE_ORDER } from '@/experience/timeline'
import { useSceneFrame } from '@/progress/hooks'

/**
 * The only persistent chrome on the page. A hairline rail, a fill, and the
 * current section — nothing that needs a card, a border or a background.
 */
export function ProgressRail() {
  const fillRef = useRef<HTMLSpanElement>(null)
  const labelRefs = useRef<Array<HTMLSpanElement | null>>([])

  useSceneFrame((state) => {
    if (fillRef.current) {
      fillRef.current.style.transform = `scaleY(${state.experienceProgress.toFixed(4)})`
    }
    for (let i = 0; i < labelRefs.current.length; i++) {
      const el = labelRefs.current[i]
      if (el) el.style.opacity = i === state.activeStageIndex ? '1' : '0.26'
    }
  })

  return (
    <nav
      className="pointer-events-none fixed top-1/2 right-6 z-10 hidden -translate-y-1/2 lg:block"
      aria-label="Section progress"
    >
      <div className="flex items-stretch gap-4">
        <ul className="flex flex-col justify-between gap-5 text-right">
          {STAGE_ORDER.map((id, i) => (
            <li key={id}>
              <span
                ref={(el) => {
                  labelRefs.current[i] = el
                }}
                className="meta block transition-opacity duration-500"
              >
                {SECTION_COPY[id].title}
              </span>
            </li>
          ))}
        </ul>

        <div className="relative w-px bg-ink/15">
          <span
            ref={fillRef}
            className="absolute inset-x-0 top-0 h-full origin-top bg-accent"
            style={{ transform: 'scaleY(0)' }}
          />
        </div>
      </div>
    </nav>
  )
}
