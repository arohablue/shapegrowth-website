import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { PHENOTYPE_DISCLAIMER } from '@/content'
import { smoothstep } from '@/experience/easing'
import {
  annotationCapacity,
  annotationReveal,
  formatValue,
  ORDERED_MEASUREMENTS,
  resolveAnnotationPoint,
  type SpecimenBounds,
} from '@/experience/phenotype'
import type { RepresentationWeights } from '@/experience/representation'
import type { Breakpoint } from '@/experience/types'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE MEASUREMENT PASS, SET IN TYPE
 * ────────────────────────────────────────────────────────────────────────────
 * The other half of `PhenotypeLayer`: the lines are in the scene, the readings
 * are in the DOM. Split across two components in this file, for reasons that
 * are worth stating because both alternatives look better than they are.
 *
 *
 * WHY DOM AND NOT SDF TEXT
 * ────────────────────────
 * drei's `Text` was the obvious choice and it is wrong for this brief, which
 * asks for "precise typography". The values are numbers in a column — 8.31,
 * 12.4, 37.2 — and what makes a column of numbers read as an instrument rather
 * than as a caption is `font-variant-numeric: tabular-nums` plus the tracked-out
 * uppercase of the label above it. Both are already loaded and specified
 * (`.meta`, JetBrains Mono). An SDF atlas gives up the OpenType feature, the
 * hinting and the subpixel positioning, so at 11px it is visibly the worse of
 * the two — and 11px is the size "restrained" implies.
 *
 * The cost is that a label cannot be occluded by a leaf the way its dimension
 * line can. That is the right way round: an occluded *line* reads as depth, an
 * occluded *number* reads as a bug.
 *
 *
 * WHY THE MARKUP AND THE PER-FRAME WRITES ARE IN DIFFERENT COMPONENTS
 * ───────────────────────────────────────────────────────────────────
 * Two simpler shapes were tried first and both are broken:
 *
 *  1. A plain DOM component using `useSceneFrame`, projecting against
 *     `state.camera`. No three, no canvas involvement. Wrong: `CameraRig` damps
 *     toward `state.camera` at lambda 14, so the real camera trails the derived
 *     one whenever the scroll is moving. Labels projected from the derived value
 *     slide off their anchors during exactly the motion they exist to track,
 *     then snap back when the scroll stops.
 *
 *  2. An R3F component returning `react-dom`'s `createPortal`. Wrong for a
 *     structural reason: a portal is processed by the reconciler that encounters
 *     it, and inside the Canvas that is R3F's, which would try to construct
 *     `div` as a three object. This is why drei's `Html` spins up a whole
 *     separate `ReactDOM.createRoot` instead.
 *
 * So the markup lives in the normal tree (`AnnotationLabels`, a sibling of the
 * Canvas) and does nothing but register its elements; the projection and every
 * style write happen inside the Canvas (`AnnotationProjector`) against the real
 * camera. One frame loop, one React root.
 *
 * Splitting the write across two loops — R3F projecting into a ref, the gsap
 * ticker writing the DOM — was the third option and it is subtly worse than it
 * looks: both run on rAF in an order nothing guarantees, so the labels would be
 * up to one frame behind the leader lines they terminate. A few pixels of drift
 * between a line's tip and its number is precisely the kind of imprecision this
 * stage is claiming not to have.
 */

/** Shared between the two halves. Populated by the DOM half, written by the R3F half. */
export interface AnnotationLabelHandles {
  container: HTMLDivElement | null
  items: Array<HTMLDivElement | null>
  /** The `SCHEMATIC — NOT MEASURED` notice. See `PHENOTYPE_DISCLAIMER`. */
  note: HTMLDivElement | null
}

export const createAnnotationLabelHandles = (): AnnotationLabelHandles => ({
  container: null,
  items: [],
  note: null,
})

/** Gap between the projected anchor and the label's near edge, in CSS pixels. */
const GAP = 14

/**
 * The markup. Renders once and never again — there is no state here and no
 * frame loop, so React is out of the path entirely after mount.
 *
 * All seven are always in the DOM, including the ones a narrow viewport cannot
 * carry; those are simply held at opacity 0 by the projector. See
 * `annotationCapacity` for why the breakpoint is a per-frame read rather than a
 * render input.
 */
export function AnnotationLabels({
  handlesRef,
}: {
  handlesRef: React.RefObject<AnnotationLabelHandles>
}) {
  return (
    <div
      ref={(el) => {
        handlesRef.current.container = el
      }}
      className="annotation-layer"
      // Hidden until the projector has run at least once, so the first frame
      // cannot flash seven labels stacked at the top-left corner.
      style={{ visibility: 'hidden' }}
    >
      {ORDERED_MEASUREMENTS.map((m, i) => (
        <div
          key={m.id}
          ref={(el) => {
            handlesRef.current.items[i] = el
          }}
          className="annotation"
          style={{ opacity: 0 }}
        >
          <span className="annotation__label">{m.label}</span>
          {/* Unit in its own element so it can be set smaller and dimmer
              without joining the tabular run — inside the value span it would
              be measured as a figure and widen the column by a whole
              character. */}
          <span className="annotation__value">
            {formatValue(m)}
            <span className="annotation__unit">{m.unit}</span>
          </span>
        </div>
      ))}

      {/* The notice. Inside the layer rather than beside it, so it inherits the
          container's `visibility` gate and cannot outlive the readings it
          qualifies by one frame. It is not anchored to the specimen and takes no
          part in the projection — it is the only child here positioned by CSS
          alone, which is what keeps it clear of the label-collision budget
          `verify-phenotype.mjs` asserts. */}
      <div
        ref={(el) => {
          handlesRef.current.note = el
        }}
        className="annotation__note"
        style={{ opacity: 0 }}
      >
        {PHENOTYPE_DISCLAIMER}
      </div>
    </div>
  )
}

interface ProjectorProps {
  bounds: SpecimenBounds
  breakpointRef: React.RefObject<Breakpoint>
  weightsRef: React.RefObject<RepresentationWeights>
  handlesRef: React.RefObject<AnnotationLabelHandles>
}

/**
 * Projects each anchor and writes the result to the DOM. Lives inside the
 * Canvas because that is the only place the *real* camera exists.
 */
export function AnnotationProjector({
  bounds,
  breakpointRef,
  weightsRef,
  handlesRef,
}: ProjectorProps) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  /** Anchors in world space, resolved once — the specimen does not move. */
  const anchors = useMemo(
    () =>
      ORDERED_MEASUREMENTS.map((m) => {
        const v = new Vector3()
        resolveAnnotationPoint(m.anchor, bounds, v)
        return v
      }),
    [bounds],
  )

  const scratch = useRef(new Vector3())

  useFrame(() => {
    const handles = handlesRef.current
    const container = handles.container
    if (!container) return

    const stage = weightsRef.current.phenotype

    // `visibility`, not `display`. Both are free for a fixed, out-of-flow
    // element, but `display: none` drops the children's boxes and forces a
    // fresh layout of seven nodes on the frame the stage opens — which is
    // already the busiest frame in the sequence.
    const wanted = stage > 0.001 ? 'visible' : 'hidden'
    if (container.style.visibility !== wanted) container.style.visibility = wanted
    if (wanted === 'hidden') return

    const capacity = annotationCapacity(breakpointRef.current)
    const halfW = size.width / 2
    const halfH = size.height / 2

    // The strongest opacity any reading reaches this frame. The notice is
    // written at exactly this value, which is the whole of "visible whenever the
    // readouts are visible": it cannot appear before the first number is legible
    // and cannot survive the last one fading, because it is the same number.
    //
    // Accumulated at the point a label is actually painted rather than where its
    // alpha is computed — a reading clipped behind the camera plane is not on
    // screen, so it has nothing for the notice to qualify.
    let peak = 0

    for (let i = 0; i < ORDERED_MEASUREMENTS.length; i++) {
      const el = handles.items[i]
      if (!el) continue
      const m = ORDERED_MEASUREMENTS[i]!

      const reveal = m.priority < capacity ? annotationReveal(stage, m.at) : 0

      // The same gate the anchor marker uses in the shader. The number must not
      // be readable before the leader has reached the point it is written at,
      // or it reads as a floating caption rather than as the end of a
      // measurement.
      const alpha = smoothstep(0.86, 1, reveal)

      if (alpha < 0.004) {
        if (el.style.opacity !== '0') el.style.opacity = '0'
        continue
      }

      const v = scratch.current.copy(anchors[i]!).project(camera)

      // `project` returns a plausible-looking x/y for a point behind the lens,
      // so without this an anchor that swings past the camera plane produces a
      // label mirrored to the opposite side of the frame.
      if (v.z > 1) {
        if (el.style.opacity !== '0') el.style.opacity = '0'
        continue
      }

      const x = halfW + v.x * halfW
      const y = halfH - v.y * halfH

      // The percentage translate is relative to the element's own box, so
      // `side` flips the label around its anchor without measuring the text.
      if (alpha > peak) peak = alpha
      el.style.opacity = alpha.toFixed(3)
      el.style.transform =
        m.side === 'left'
          ? `translate3d(${(x - GAP).toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-100%, -50%)`
          : `translate3d(${(x + GAP).toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(0, -50%)`
    }

    const note = handles.note
    if (note) {
      const next = peak.toFixed(3)
      if (note.style.opacity !== next) note.style.opacity = next
    }
  })

  return null
}
