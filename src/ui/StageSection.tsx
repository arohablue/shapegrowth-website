import { useRef } from 'react'
import { smoothstep } from '@/experience/easing'
import { SECTION_COPY } from '@/content'
import { BLOCK_RANGES } from '@/experience/timeline'
import type { StageId } from '@/experience/types'
import { blockFocus, blockSignedOffset, useSceneFrame } from '@/progress/hooks'

const RANGE = new Map(BLOCK_RANGES.map((r) => [r.id, r]))

/**
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THE COPY SITS IN A BOTTOM BAND AND NOT A SIDE COLUMN
 * ────────────────────────────────────────────────────────────────────────────
 * This was measured, not composed. `probe-copy-space.mjs` projected the real
 * normalised scan through the real camera spline at the progress each heading
 * peaks, on both breakpoints, and printed the screen occupancy. The result was
 * the same at every beat:
 *
 *   desktop 1440x900   specimen occupies columns 4-8, rows 2-6 of 9
 *   mobile  375x812    specimen occupies the middle third only
 *
 * Rows 0-1 and 7-8 are EMPTY — zero projected samples — at every beat on both
 * breakpoints. That sweep was run against the five headings this page used to
 * have, whose peaks spanned p 0.148 → 0.846; the three it has now peak at 0.238,
 * 0.602 and 0.926. The first two fall inside the measured span. The third does
 * not, and the camera is still travelling there, so the clear band at the very
 * end of the page is confirmed by screenshot rather than by that sweep. The previous layout put the copy in `col-span-5` at the
 * viewport's vertical centre, which reads as the safe choice and is not: 12-15%
 * of the specimen's projected samples fall inside that column, so the type was
 * laid directly over the plant's left flank for the whole page. The horizontal
 * band along the bottom is the only region that is reliably clear, and it is
 * also where both legibility-veil gradients are darkest (66% void on desktop,
 * 72% on mobile). The veil was already built for exactly this.
 *
 * It also unifies the breakpoints. Mobile is no longer a compromise where
 * full-width copy lands on the brightest part of the canopy — it is the same
 * caption in the same clear band.
 *
 * The alternation is now horizontal position only, never text alignment.
 * Ragged-left editorial serif at this size is measurably harder to read and
 * buys nothing the position does not already give. It is also load-bearing
 * rather than decorative: adjacent captions cross-fade, so at a beat boundary
 * two are briefly on screen at once, and alternating sides is what keeps them
 * side by side instead of stacked on each other.
 *
 *
 * WHY THE BAND IS FIXED AND NOT STICKY
 * ────────────────────────────────────
 * The first version of this was `sticky top-0` on a `h-[100dvh]` child, which
 * is the reflex for "pin the copy while the section scrolls". It does not do
 * that. A 100vh sticky child inside a 140vh section is pinned for exactly
 * 140 − 100 = 40vh of scroll; for the remaining 100vh it is released and
 * travels up and out with the section. So the caption held the clear bottom
 * band for 29% of its section and spent the rest of it sweeping the full height
 * of the frame — straight across the specimen the band was measured to avoid,
 * and at high opacity, because `blockFocus`'s falloff is 115vh and its peak
 * (section centre, scrollTop 170 for CAPTURE) lands 30vh *after* the pin
 * window has already ended. The measurement above was right and the layout
 * quietly ignored it.
 *
 * `position: fixed` is the honest expression of what was wanted: the caption
 * does not move, full stop. The section then has one job — contributing scroll
 * length — which is what it was already doing. This also matches
 * `.annotation-layer`, which is fixed for the same reason.
 *
 * It works because nothing above this establishes a containing block for fixed
 * positioning: `.document` is `position: relative` with a z-index and no
 * transform. `.reveal` DOES carry a transform, so it must stay *inside* the
 * fixed element — never outside it.
 *
 *
 * ON THE STAGGER
 * ──────────────
 * Label, then sentence, then specification — each on its own smoothstep of the
 * SAME focus value, so a block assembles and disassembles rather than fading as
 * one flat card. That is the difference between an editorial plate and a
 * cross-dissolving slideshow, and it costs five DOM writes per section.
 *
 * Enter and exit are two readouts of the global progress value — there is no
 * IntersectionObserver and no per-section trigger here, deliberately. Those
 * would be independent timelines, and independent timelines are what this
 * architecture exists to prevent.
 */
export function StageSection({ id, align }: { id: StageId; align: 'left' | 'right' }) {
  const copy = SECTION_COPY[id]
  const range = RANGE.get(id)!
  const bodyRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const ledeRef = useRef<HTMLParagraphElement>(null)
  const specRef = useRef<HTMLSpanElement>(null)
  const ruleRef = useRef<HTMLSpanElement>(null)

  useSceneFrame((state) => {
    const el = bodyRef.current
    if (!el) return

    const focus = blockFocus(id, state)
    const signed = blockSignedOffset(id, state)

    // Transform on the container, opacity on the children. Keeping them apart
    // matters for reduced motion: `.reveal` in index.css kills the transform
    // with `!important`, and the opacity stagger — which is not motion — is left
    // to run, which is the correct reading of the media query.
    //
    // 24px of drift, down from 30: the band now sits in the page's own bottom
    // padding rather than at the bottom of a 100vh box, so a downward drift
    // spends real clearance (40px at the mobile breakpoint) rather than slack.
    el.style.transform = `translate3d(0, ${(-signed * 24).toFixed(2)}px, 0)`

    // The thresholds are set by the crossover, not by taste. Blocks are 140vh
    // apart and the focus falloff is 115vh, so at a beat boundary BOTH
    // neighbours read focus = 1 − 70/115 = 0.391. Anything that reaches full
    // strength below 0.391 is therefore fully opaque twice at every boundary.
    //
    // Two plate labels crossfading is the continuous-narrative effect we want;
    // two sentences at once is just two sentences. So the lede's ramp is placed
    // entirely above the crossover (0.34 → 0.66, giving 0.08 at the boundary and
    // a 78vh full-strength plateau mid-section) while the label is allowed to
    // straddle it. The spec trails both and is gone well before.
    if (headRef.current) headRef.current.style.opacity = smoothstep(0.22, 0.54, focus).toFixed(3)
    if (ledeRef.current) ledeRef.current.style.opacity = smoothstep(0.34, 0.66, focus).toFixed(3)
    if (specRef.current) specRef.current.style.opacity = smoothstep(0.46, 0.78, focus).toFixed(3)
    if (ruleRef.current) {
      ruleRef.current.style.transform = `scaleX(${smoothstep(0.26, 0.8, focus).toFixed(4)})`
    }
  })

  return (
    // The section contributes scroll length and a landmark, nothing else. It is
    // deliberately not `relative`: nothing is positioned against it, and it must
    // not become a containing block for the fixed band inside it.
    <section id={id} style={{ height: `${range.vh}vh` }} aria-label={`${copy.index} ${copy.title}`}>
      <div className="fixed inset-x-0 bottom-0 px-6 pb-10 md:px-12 md:pb-14">
        <div className="mx-auto grid w-full max-w-[92rem] grid-cols-12">
          <div
            ref={bodyRef}
            className={
              align === 'left'
                ? 'reveal col-span-12 md:col-span-6 md:col-start-1'
                : 'reveal col-span-12 md:col-span-6 md:col-start-7'
            }
          >
            {/* Plate number, rule, beat — one line. Stacking the number above a
                large heading is the landing-page move; a caption sets them on
                the same baseline and lets the sentence lead. */}
            <div ref={headRef} className="mb-4 flex items-center gap-4" style={{ opacity: 0 }}>
              <span className="section-index">{copy.index}</span>
              <span
                ref={ruleRef}
                className="block h-px w-10 shrink-0 origin-left bg-accent/45"
                style={{ transform: 'scaleX(0)' }}
              />
              <h2 className="section-title">{copy.title}</h2>
            </div>

            <p ref={ledeRef} className="section-lede mb-4 max-w-[30ch]" style={{ opacity: 0 }}>
              {copy.lede}
            </p>

            <span ref={specRef} className="meta block" style={{ opacity: 0 }}>
              {copy.spec}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
