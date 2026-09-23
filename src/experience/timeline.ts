import type { StageId, StageWindow } from './types'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE TIMELINE
 * ────────────────────────────────────────────────────────────────────────────
 * This file is the single authority for *when* anything happens.
 *
 * Two tables live here and they are deliberately coupled:
 *
 *   BLOCKS  — the vertical layout of the document, in vh. This drives both the
 *             CSS height of each section AND the progress window it owns, so
 *             the DOM and the 3D scene can never drift out of sync.
 *
 *   TRACKS  — the scene's derived sub-progress values. Overlaps between tracks
 *             are the ONLY place cross-stage blending is defined. If two things
 *             appear to fight each other, the fix belongs here, not in a
 *             component.
 *
 * Nothing in this file imports React or three. It is pure data + arithmetic.
 */

export interface Block {
  readonly id: StageId | 'hero' | 'outro'
  /** Height of this block in vh units. */
  readonly vh: number
}

/**
 * One block per beat. There used to be five beats and near-uniform heights;
 * `geometry` and `surface` have since been folded into `reconstruct` because
 * they were names for things the reconstruction does, not separate claims about
 * the product. See the note on `StageId`.
 *
 * The important property of the numbers below is what they preserve. 185 + 405 +
 * 120 = 710, which is what 140 + 140 + 140 + 140 + 150 came to, so TOTAL_VH is
 * still 910 and SCROLLABLE_VH is still 810. Every window in TRACKS and every
 * keyframe in the camera spline is authored in that progress space, so merging
 * three blocks into one moved not a single frame of the reconstruction. This was
 * a change to the document and the labels; the scene did not notice.
 *
 * Heights are no longer uniform, because with three beats they no longer can be.
 * The old uniformity was a way of admitting that the five names were evenly
 * spaced over unevenly spaced events; with the names gone the blocks can simply
 * match the events. Each one now covers exactly the tracks it is talking about —
 * see the alignment table under TRACKS, which for the first time needs no
 * apology about where a boundary falls.
 */
export const BLOCKS: readonly Block[] = [
  { id: 'hero', vh: 100 },
  { id: 'capture', vh: 185 },
  { id: 'reconstruct', vh: 405 },
  { id: 'phenotype', vh: 120 },
  { id: 'outro', vh: 100 },
] as const

export const STAGE_ORDER: readonly StageId[] = ['capture', 'reconstruct', 'phenotype'] as const

export const TOTAL_VH = BLOCKS.reduce((sum, b) => sum + b.vh, 0)

/**
 * Scroll progress reaches 1 when the *bottom* of the document meets the bottom
 * of the viewport — so the final 100vh is never "scrolled through". The usable
 * scroll distance is therefore TOTAL_VH - 100.
 */
export const SCROLLABLE_VH = TOTAL_VH - 100

export interface BlockRange {
  readonly id: Block['id']
  readonly vh: number
  /** Offset of this block's top edge, in vh from document top. */
  readonly startVh: number
  readonly endVh: number
  /** experienceProgress when this block's top edge hits the viewport top. */
  readonly startP: number
  readonly endP: number
}

export const BLOCK_RANGES: readonly BlockRange[] = (() => {
  let cursor = 0
  return BLOCKS.map((b) => {
    const startVh = cursor
    const endVh = cursor + b.vh
    cursor = endVh
    return {
      id: b.id,
      vh: b.vh,
      startVh,
      endVh,
      startP: startVh / SCROLLABLE_VH,
      endP: endVh / SCROLLABLE_VH,
    }
  })
})()

/** Convert experienceProgress back into "how far have we scrolled", in vh. */
export const progressToVh = (p: number): number => p * SCROLLABLE_VH

/**
 * ────────────────────────────────────────────────────────────────────────────
 * TRACKS
 * ────────────────────────────────────────────────────────────────────────────
 * Windows are authored in experienceProgress space. Overlaps are intentional
 * crossfades — see the comments. Keep them here; never re-derive them locally.
 *
 * THIS IS THE ONLY PLACE THE TRANSFORMATION'S TIMING IS DEFINED. Every stage of
 * the reconstruction — particles, vertices, wireframe, surface, finished plant —
 * reads its progress from a window below. Retiming the sequence means editing
 * numbers here and nothing else. There is deliberately no second table: two
 * tables is how you get animations that fight each other.
 *
 * Each section owns exactly the tracks it is talking about. Under the old
 * five-block layout this table needed caveats — `pointCloud` finished inside
 * RECONSTRUCT's block while belonging to the capture beat, and SURFACE had to
 * hold two tracks because there was no name for "the last third". With three
 * blocks sized to the events, the boundaries fall where the handoffs already
 * were:
 *
 *   section     owns p       the tracks that resolve inside it
 *   ───────────────────────────────────────────────────────────────────────
 *   CAPTURE     0.123→0.352  rig 0.00→0.30, scan 0.03→0.18, and the whole of
 *                            pointCloud 0.15→0.35 — a scan *produces* samples,
 *                            so watching them accumulate under the orbiting rig
 *                            is the capture beat, not a later one
 *   RECONSTRUCT 0.352→0.852  vertex 0.33→0.50, geometry 0.40→0.65,
 *                            mesh 0.55→0.75, finalPlant 0.70→0.85 — the four
 *                            tracks that turn a scatter of samples into one
 *                            solid plant, under one heading because they are
 *                            one act
 *   PHENOTYPE   0.852→1.000  phenotype 0.85→1.00, the measurement pass
 *
 * RECONSTRUCT is half the page under a single caption, and that is the cost of
 * the merge, paid deliberately. Three headings over this stretch described the
 * mechanism; one describes the outcome. The stretch is not silent — it is the
 * densest run of motion in the piece, four overlapping tracks with no gap
 * between them — and a reader scrolling it is watching the thing happen rather
 * than reading about it happening.
 *
 * On easing choice — this is not cosmetic. `easeInOutCubic` has zero slope at
 * BOTH ends, which is right for something that appears out of nothing and wrong
 * for a stage handed off to from the stage before it. Two consequences, both
 * measured rather than guessed:
 *   • two windows that merely abut (pointCloud out 0.35 / vertex in 0.35) leave a
 *     moment where nothing in the scene changes at all — a freeze under slow
 *     scroll, which is the "abrupt state change" failure in reverse;
 *   • two windows that nominally overlap produce almost no *visible* overlap,
 *     because the incoming track is still ~0 through the overlap region.
 * So the three construction stages use `easeOutCubic` — prompt onset, gentle
 * settle. Their softness comes from the per-element `smoothstep` inside each
 * shader (per-point on the snap, per-edge on the build, per-fragment on the
 * reveal), so the track does not need to soften the onset a second time.
 *
 * On the capture beat specifically — there is exactly ONE moving thing in it,
 * the rig, and everything else in that beat is derived from where the rig is.
 * The lit band on the specimen, the trail on the orbit path, which viewpoints
 * have been marked, which tie points exist: all of them read the rig's angle.
 * An earlier version had the band sweeping vertically while the rig orbited,
 * and two unexplained motions at once is precisely the thing this whole
 * single-source architecture exists to prevent — it looked like two effects
 * layered on a plant rather than one instrument measuring it.
 *
 * Reference block boundaries (from BLOCKS above; SCROLLABLE_VH = 810):
 *   hero         0.000 → 0.123
 *   capture      0.123 → 0.352
 *   reconstruct  0.352 → 0.852
 *   phenotype    0.852 → 1.000
 *   outro        1.000 → 1.123   (never scrolled through — see SCROLLABLE_VH)
 *
 * Each section's copy reaches full strength at its block's centre, which lands
 * at p = 0.238, 0.602, 0.926 respectively — the rig mid-orbit with the cloud
 * building, the wireframe complete with the surface starting to close, and the
 * measurement pass half drawn. Those three numbers are asserted against the
 * table above in `verify-narrative.mjs`; if a block height changes here and a
 * heading drifts out of its own beat, that harness fails.
 */
export const TRACKS = {
  /**
   * The capture rig's traverse around the specimen — one full orbit, 0 → 1.
   *
   * `linear`, and that is the whole point. Every other track here is eased,
   * because every other track is a *transformation* with a beginning and an end.
   * This one is a machine on a track. A gantry that accelerates into its first
   * viewpoint and coasts out of its last is a hand-animated flourish, and it
   * reads instantly as one — the eye is very good at spotting a camera move that
   * was authored rather than driven. Constant angular rate is what a rig does.
   *
   * Runs 0 → 0.30, which is wider than `scan` on both ends by design:
   *   • it starts at 0 so the instrument is already present and already moving
   *     in the hero, establishing that something is *being measured* before the
   *     first heading arrives;
   *   • it ends at 0.30, inside the `pointCloud` window, so the rig is still
   *     travelling as the dense cloud resolves and then leaves. Ending it at
   *     0.18 with `scan` froze the rig on-screen for the whole handoff, which
   *     looks like a stalled machine rather than a completed pass.
   */
  rig: { in: 0.0, out: 0.3, ease: 'linear' },

  /**
   * Sensor sweep. Leads everything: by the time the reader has left the hero the
   * rig has already passed over the specimen, so the point cloud has something
   * to resolve *from* rather than appearing out of nothing.
   *
   * This is now the *envelope* of the sweep, not its position — where the lit
   * band actually falls is a function of `rig`, because the band is the side of
   * the plant facing the sensor. See `representation.ts`.
   */
  scan: { in: 0.03, out: 0.18, ease: 'easeInOutCubic' },

  /** Raw returns resolve into discrete, legible samples. Overlaps scan 0.15–0.18. */
  pointCloud: { in: 0.15, out: 0.35, ease: 'easeInOutCubic' },

  /**
   * Samples migrate onto the reconstruction's actual vertices. This is the one
   * window where particle *positions* change; everything before and after moves
   * only opacity, size and colour.
   *
   * Opens at 0.33 rather than 0.35 so it is already moving while `pointCloud`
   * eases out. Abutting the two exactly leaves a measurable dead spot at 0.349
   * where both slopes are ~0 and the scene freezes.
   */
  vertex: { in: 0.33, out: 0.5, ease: 'easeOutCubic' },

  /**
   * Edges grow between the settled vertices. Overlaps vertex 0.40–0.50.
   *
   * Opens at 0.40, not 0.45. Abutting the end of `vertex` was defensible on the
   * weights — the harness showed no stall and no solo frame, because `snap`
   * stays pinned at 1 while the cloud is still fully visible — but it was wrong
   * on the pixels. Measured in the browser at p=0.45: 0.14% frame coverage,
   * effectively a blank page, because the samples had finished collapsing onto
   * a much smaller set of vertex positions and nothing else had started.
   *
   * That gap is structural, not a fixture accident. A reconstruction always has
   * far fewer vertices than the scan has samples — that is what reconstruction
   * *is* — so the vertex stage is always the sparsest moment in the sequence and
   * must never be left holding the frame alone. Starting the edges while the
   * last samples are still migrating also happens to be the truer story: the
   * structure is inferred *from* the samples, not after them.
   */
  geometry: { in: 0.4, out: 0.65, ease: 'easeOutCubic' },

  /** Surface closes over the wireframe, sweeping upward. Overlaps geometry 0.55–0.65. */
  mesh: { in: 0.55, out: 0.75, ease: 'easeOutCubic' },

  /**
   * Material, lighting and atmosphere resolve to the finished plant. Overlaps
   * mesh 0.70–0.75. Keeps the symmetric ease: this drives light intensity and
   * roughness directly, with no per-element smoothing underneath to absorb a
   * sudden onset.
   */
  finalPlant: { in: 0.7, out: 0.85, ease: 'easeInOutCubic' },

  /**
   * Measurement pass over the finished model. Overlaps finalPlant 0.85.
   *
   * `easeOutCubic`, not `easeOutExpo`, and the difference is measurable rather
   * than aesthetic. easeOutExpo's derivative at t=0 is 10·ln2 ≈ 6.93; over a
   * 0.15-wide window that is 46 per unit of page progress, or 0.046 per 0.001 —
   * past the 0.03 continuity budget, so the first scroll tick into the stage
   * pops. easeOutCubic's is 3, giving 0.02 per 0.001.
   *
   * It is also the right *shape*. This drives an accumulation — seven lines
   * being drawn one after another — and an exponential out spends most of its
   * range in the first sliver of the window, finishing the whole pass by p0.894
   * and leaving the last 10% of the page holding a static frame. Cubic spreads
   * it to ~p0.924. Same reasoning as the ease choice on every other
   * accumulating track here; expo belongs on things that illuminate, not on
   * things that fill.
   */
  phenotype: { in: 0.85, out: 1.0, ease: 'easeOutCubic' },
} as const satisfies Record<string, StageWindow>

export type TrackId = keyof typeof TRACKS
