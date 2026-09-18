import { Matrix4, Vector3 } from 'three'
import { sampleCameraSpline } from './cameraSpline'
import type { Breakpoint } from './types'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * WHY FRAMING CANNOT BE A BREAKPOINT
 * ────────────────────────────────────────────────────────────────────────────
 * `cameraSpline.ts` owns two keyframe tables, one per breakpoint, and the
 * breakpoint is a *width* query — `(max-width: 767px)`. That is the right rule
 * for typography and the wrong one for a camera, because what crops a subject
 * is the frame's ASPECT, not its pixel width.
 *
 * The two disagree exactly on portrait tablets. An iPad Air in portrait is
 * 820x1180 — far too wide to be "mobile", so it is handed the desktop table,
 * which was composed against 1440x900 (aspect 1.60). At aspect 0.69 the same
 * vertical fov gives less than half the horizontal coverage, and the specimen's
 * flank leaves the frame: measured |ndc.x| = 1.017 at p=0.52, i.e. the plant is
 * clipped through the middle third of the page. 768x1024 and 1024x1366 reach
 * 0.942 and 0.943 — inside the frame, but with no breathing room left.
 *
 * Three fixes were measured before this one was chosen:
 *
 *   • a third keyframe table for tablets — more config, and still wrong, since
 *     "tablet" spans 0.69 to 1.44 aspect depending on rotation;
 *   • selecting the table by aspect instead of width — hands portrait tablets
 *     the phone's table, whose 10-unit working distance is solved for a 0.46
 *     frame. Subject collapses to 0.51 of the half-frame: not cropped, but
 *     tiny;
 *   • widening the fov to restore horizontal coverage — needs 73-77° at the
 *     desktop's distance, which shrinks the subject to 0.44 AND introduces the
 *     wide-angle distortion the 38° lens was chosen to avoid.
 *
 * What actually works is to keep each table's authored gesture and change only
 * its RADIUS: scale the camera's distance from its target by one scalar solved
 * from the real aspect. The gesture's shape, direction and timing are untouched,
 * so nothing about the composition is re-authored — it is the same move, framed
 * for the glass it is being shown through.
 *
 * The scalar is clamped to >= 1, so it can only ever pull the camera back to
 * uncrop. Every phone, desktop and ultrawide viewport solves to exactly 1.000
 * and is therefore bit-identical to before; only portrait tablets move
 * (k = 1.12 at 768x1024, 1.20 at 820x1180).
 *
 *
 * WHY THIS IS CLOSED-FORM AND NOT A SEARCH
 * ────────────────────────────────────────
 * The first version bisected on k, re-projecting the whole spline each step.
 * That is unnecessary: the camera looks AT its target from `target + k·offset`,
 * so as k varies the eye slides along a fixed ray and the view direction never
 * changes. The lookAt basis is therefore independent of k, which means a
 * corner's camera-space x and y are independent of k too, and only its depth
 * moves — linearly, by k·|offset|.
 *
 * So for each corner the smallest k that keeps it inside the frame can be solved
 * directly. With e = corner − target and depth d = k·|offset| + e·forward, the
 * horizontal constraint |x| / d <= t · tan(fov/2) · aspect rearranges to
 *
 *     k >= ( |x| / (t · tan(fov/2) · aspect) − e·forward ) / |offset|
 *
 * and the vertical one likewise without the aspect factor. The answer is the
 * maximum over every sample and every corner — one pass, no iteration.
 */

/**
 * World-space half-extents of the loaded subject, measured from matrixWorld.
 * The point cloud is very slightly larger than the mesh — dispersion pushes
 * samples outward — so the cloud is the binding case.
 *
 * Exported because `verify-framing.mjs` asserts against these same numbers.
 * They were duplicated in the harness before, which meant the harness could
 * pass against bounds the runtime no longer used.
 */
export const SUBJECT_HALF_EXTENTS = { x: 1.447, y: 1.6, z: 1.336 } as const

/**
 * The fraction of the half-frame the subject is allowed to reach.
 *
 * 0.82 rather than 1.0 because "not cropped" is not the requirement — the
 * phenotype pass draws hull, leader lines and labels *outside* the silhouette,
 * and those need somewhere to go. It sits just above the desktop's natural
 * worst case (0.791) so that desktop stays untouched.
 */
export const COMPOSITION_CEILING = 0.82

const CORNERS: readonly Vector3[] = (() => {
  const out: Vector3[] = []
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push(
          new Vector3(
            sx * SUBJECT_HALF_EXTENTS.x,
            sy * SUBJECT_HALF_EXTENTS.y,
            sz * SUBJECT_HALF_EXTENTS.z,
          ),
        )
      }
    }
  }
  return out
})()

/**
 * Catmull-Rom overshoots between control points, so the tightest framing of the
 * journey is generally not at a keyframe. 160 samples resolves the extremum to
 * better than 0.001 of progress, which is far finer than the 0.03 continuity
 * budget the timeline works to.
 */
const SAMPLES = 160

const UP = new Vector3(0, 1, 0)

// Scratch. This runs on resize, not per frame, but allocating eight Vector3s
// per call for something invoked from a frame-loop guard is still wrong.
const state = { position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
const eye = new Vector3()
const target = new Vector3()
const offset = new Vector3()
const basisX = new Vector3()
const basisY = new Vector3()
const basisZ = new Vector3()
const e = new Vector3()
const view = new Matrix4()

/**
 * Smallest distance multiplier that keeps the subject within
 * `COMPOSITION_CEILING` of the half-frame across the entire spline. Always >= 1.
 *
 * Pure and cheap — ~1300 corner tests, no iteration — but memoised anyway
 * because the caller checks it from inside the frame loop's change guard, and a
 * device that reports a new aspect on every scroll tick (some mobile browsers
 * do this as the URL bar collapses) must not pay for it repeatedly.
 *
 * ONE SLOT, not a Map, and the reason is the scenario in the paragraph above.
 * This was a `Map<string, number>` keyed on `aspect.toFixed(4)`, which grows by
 * one entry for every distinct aspect the page ever reports — so the exact
 * device the cache exists for, a phone collapsing its URL bar through hundreds
 * of intermediate heights while the reader scrolls, is the device that makes it
 * grow without bound for the lifetime of the page. Each entry is small, but
 * nothing ever evicts one and the growth is driven by user input, which is the
 * shape of a leak rather than a cache.
 *
 * A single slot is both the fix and the simpler thing: the caller only ever asks
 * about the aspect it currently has, so entries for aspects the viewport has
 * already left can never be read again. Retaining them bought nothing.
 */
let lastKey = ''
let lastValue = 1

export function solveFramingScale(breakpoint: Breakpoint, fov: number, aspect: number): number {
  if (!(aspect > 0) || !(fov > 0)) return 1

  const key = `${breakpoint}|${fov.toFixed(2)}|${aspect.toFixed(4)}`
  if (key === lastKey) return lastValue

  const tanHalf = Math.tan((fov / 2) * (Math.PI / 180))
  const limitY = COMPOSITION_CEILING * tanHalf
  const limitX = limitY * aspect

  let k = 1

  for (let i = 0; i <= SAMPLES; i++) {
    sampleCameraSpline(i / SAMPLES, breakpoint, state)

    target.set(state.target[0], state.target[1], state.target[2])
    eye.set(state.position[0], state.position[1], state.position[2])
    offset.copy(eye).sub(target)

    const dist = offset.length()
    if (dist < 1e-6) continue

    // three's own lookAt, so this cannot drift from what the renderer does.
    // Column z is normalize(eye - target), i.e. the NEGATIVE view direction.
    view.lookAt(eye, target, UP)
    const m = view.elements
    basisX.set(m[0]!, m[1]!, m[2]!)
    basisY.set(m[4]!, m[5]!, m[6]!)
    basisZ.set(m[8]!, m[9]!, m[10]!)

    for (const corner of CORNERS) {
      e.copy(corner).sub(target)

      // Independent of k, per the derivation above.
      const x = Math.abs(e.dot(basisX))
      const y = Math.abs(e.dot(basisY))
      // e·forward, where forward = -basisZ.
      const alongView = -e.dot(basisZ)

      const needX = (x / limitX - alongView) / dist
      const needY = (y / limitY - alongView) / dist

      if (needX > k) k = needX
      if (needY > k) k = needY
    }
  }

  lastKey = key
  lastValue = k
  return k
}
