import { useRef } from 'react'
import { OUTRO_COPY } from '@/content'
import { smoothstep } from '@/experience/easing'
import { BLOCK_RANGES } from '@/experience/timeline'
import { blockSignedOffset, useSceneFrame } from '@/progress/hooks'

const OUTRO = BLOCK_RANGES[BLOCK_RANGES.length - 1]!

export function Outro() {
  const ref = useRef<HTMLDivElement>(null)

  useSceneFrame((state) => {
    const el = ref.current
    if (!el) return
    const signed = blockSignedOffset('outro', state)
    // (-0.42, -0.02), not (-1, -0.15). The outro block is never scrolled through
    // — progress reaches 1 when the document bottom meets the viewport bottom,
    // so the whole of this block IS the final frame. A window opening at
    // signed = -1 therefore spends most of its fade at p < 0.94, where the
    // PHENOTYPE caption still owns the same bottom band, and the two would sit
    // on top of each other. Opening at -0.42 puts the fade entirely after the
    // phenotype label has cleared (p 0.951 → 0.998).
    const enter = smoothstep(-0.42, -0.02, signed)
    el.style.opacity = String(enter)
    el.style.transform = `translate3d(0, ${((1 - enter) * 28).toFixed(2)}px, 0)`
  })

  return (
    <section style={{ height: `${OUTRO.vh}vh` }} aria-label={OUTRO_COPY.closing}>
      {/* Fixed, for the reason given in StageSection.tsx — and here it is not a
          refinement but the difference between a legible ending and none. As a
          bottom-aligned sticky child of the last block, this content was only
          inside the viewport for the final 133px of scroll: it rose into the
          frame already at ~0.95 opacity, so the fade was spent entirely
          off-screen and the closing line arrived as a jump-cut. */}
      <div className="fixed inset-x-0 bottom-0 px-6 pb-8 md:px-12 md:pb-12">
        {/* The two meta fragments are the colophon of a plate — what was
            examined, what came off it. Same tracked mono as the annotation
            labels. The wording, and why there is no call to action here, is in
            `content.ts`. */}
        <div ref={ref} className="reveal">
          <p className="section-lede mb-10 max-w-[16ch]">{OUTRO_COPY.closing}</p>
          <div className="flex items-end justify-between border-t border-ink/12 pt-6">
            <span className="meta">{OUTRO_COPY.colophonLeft}</span>
            <span className="meta">{OUTRO_COPY.colophonRight}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
