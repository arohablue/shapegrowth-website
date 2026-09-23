import { useRef } from 'react'
import { HERO_ARIA, HERO_COPY } from '@/content'
import { smoothstep } from '@/experience/easing'
import { BLOCK_RANGES } from '@/experience/timeline'
import { blockSignedOffset, useSceneFrame } from '@/progress/hooks'

const HERO = BLOCK_RANGES[0]!

export function Hero() {
  const innerRef = useRef<HTMLDivElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)

  useSceneFrame((state) => {
    const inner = innerRef.current
    if (!inner) return

    // Derived from the same global progress as the 3D scene — not from a
    // per-element ScrollTrigger. One number, many readouts.
    const signed = blockSignedOffset('hero', state)
    const exit = smoothstep(0, 0.85, signed)

    inner.style.opacity = String(1 - exit)
    inner.style.transform = `translate3d(0, ${(-exit * 60).toFixed(2)}px, 0)`

    if (cueRef.current) {
      cueRef.current.style.opacity = String(1 - smoothstep(0, 0.25, signed))
    }
  })

  return (
    <section
      style={{ height: `${HERO.vh}vh` }}
      className="relative"
      aria-label={HERO_ARIA}
    >
      <div className="sticky top-0 flex h-[100dvh] flex-col justify-between px-6 py-8 md:px-12 md:py-12">
        <header className="flex items-baseline justify-between">
          <span className="eyebrow">{HERO_COPY.eyebrow}</span>
          <span className="meta hidden sm:block">{HERO_COPY.specimen}</span>
        </header>

        {/* States the arc of the page rather than addressing the reader: it
            starts where offering 01 starts and ends where offering 02 ends, and
            the page then walks that span. The serif line carries "growth"
            because that is the end being promised.

            The words themselves are in `content.ts`; the three-span structure
            stays here because it is typographic, not editorial — the third line
            changes typeface and the stop takes the accent colour. */}
        <div ref={innerRef} className="reveal">
          <h1 className="display">
            <span className="display__line">{HERO_COPY.headline.lead}</span>
            <span className="display__line">{HERO_COPY.headline.middle}</span>
            <span className="display__line display__editorial">
              {HERO_COPY.headline.editorial}
              <span className="display__stop">{HERO_COPY.headline.stop}</span>
            </span>
          </h1>
        </div>

        <div className="flex items-end justify-between gap-8">
          <p className="max-w-[30ch] text-[0.9375rem] leading-relaxed text-ink/55">
            {HERO_COPY.standfirst}
          </p>

          <div ref={cueRef} className="reveal flex items-center gap-3">
            <span className="meta">{HERO_COPY.scrollCue}</span>
            <span className="block h-px w-10 bg-ink/30" />
          </div>
        </div>
      </div>
    </section>
  )
}
