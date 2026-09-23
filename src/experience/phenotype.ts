/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE MEASUREMENT SET
 * ────────────────────────────────────────────────────────────────────────────
 * What the phenotyping pass actually claims about the specimen: seven traits,
 * each with the span it was measured across and the point its label hangs from.
 *
 * Pure — imports neither React nor three — so the geometry of the annotation
 * layout can be asserted in plain Node rather than by looking at pixels.
 *
 *
 * WHY THE POINTS ARE NOT IN WORLD UNITS
 * ─────────────────────────────────────
 * This is the one decision in the file that is not obvious and cannot be
 * changed later without re-authoring every annotation.
 *
 * Every asset is normalised on load by `assets/normalize.ts`, which scales the
 * scan so its bounding box reaches `transform.targetHeight` and then centres or
 * plants it according to `transform.anchor`. Both of those are read from
 * `VITE_*` environment variables. So world coordinates are not a property of
 * the specimen at all — they are a property of the *current configuration*.
 * Hard-coding `y = 1.42` would mean that raising VITE_MESH_TARGET_HEIGHT, or
 * switching anchor from `bounds` to `base`, silently detaches all seven
 * annotations from the plant they are annotating. Nothing would error; the lines
 * would simply float.
 *
 * Worse, the real scan will not have the fixture's proportions. An anchor
 * authored against a fixture leaf is meaningless on a different plant unless it
 * is expressed relative to that plant's own extent.
 *
 * So points are in SPECIMEN SPACE:
 *
 *   y  0 → 1     base → apex, as a fraction of the specimen's height
 *   x  -1 → 1    fraction of its plan half-extent
 *   z  -1 → 1    likewise
 *
 * `resolveAnnotationPoint` converts to world using bounds measured from the
 * geometry that actually loaded. The annotations therefore track the specimen
 * under any transform config and any asset, which is the whole point of having
 * a data structure here rather than a list of vectors in a component.
 *
 *
 * WHERE REAL DATA PLUGS IN
 * ────────────────────────
 * `value` is the only placeholder. Every other field is either geometry
 * (authored against the anatomy) or presentation. A real phenotyping pipeline
 * replaces `value` — and, where it does instance segmentation, `startPoint` and
 * `endPoint` too — without touching the layer that draws any of it. That is why
 * `value` is a plain number with a separate `precision` rather than a
 * preformatted string: real pipelines emit numbers.
 *
 * `value` and the label it sits under are in `content.ts`, not here. This file
 * keeps the coordinates and the anatomical reasoning behind them; see the note
 * on `TraitGeometry` below for why the two are split.
 */

import { TRAIT_READOUT } from '@/content'
import type { TraitId, TraitReadout } from '@/content'

/**
 * A position on the specimen, independent of scale and framing. See the note
 * above — these are fractions, not world units.
 */
export interface SpecimenPoint {
  /** Fraction of the plan half-extent, -1 → 1. */
  x: number
  /** 0 = base of the specimen, 1 = apex. */
  y: number
  /** Fraction of the plan half-extent, -1 → 1. */
  z: number
}

/** Which way the label sits from its anchor. Keeps leader lines off the plant. */
export type LabelSide = 'left' | 'right'

/**
 * Whether the span's endpoints sit on the specimen or deliberately beside it.
 *
 * Not decoration — it is the difference between two kinds of measurement, and
 * `verify-phenotype.mjs` needs it to test them differently. A leaf length is
 * measured ALONG the organ, so both endpoints must be within a tolerance of a
 * real sample or the annotation is lying. A plant height is measured PAST the
 * object, on an offset datum line, the way it is on any engineering drawing —
 * its endpoints are supposed to be a clear distance off the silhouette, and
 * asserting they sit on the plant would fail the one annotation that is right.
 */
export type SpanAttachment = 'surface' | 'clearance'

/**
 * Where each trait is measured, as distinct from what it is called.
 *
 * The label, value, unit and precision are NOT here — they live in
 * `content.ts` with the rest of the screen copy, joined to this table by `id`.
 * The split is along the line of who can safely edit what: an anchor like
 * `{ x: -1.15, y: 0.0, z: 0.1 }` is only editable by someone reading the
 * comment above it about clearing the widest leaf at x = -1.272, whereas a
 * label and a number are copy. `TRAIT_READOUT` being a
 * `Record<TraitId, …>` means the compiler rejects a trait that appears in one
 * file and not the other.
 */
interface TraitGeometry {
  /** Stable across re-authoring; the DOM label and the buffer slot both key on it. */
  id: TraitId
  /** The measured span. Drawn as the dimension line. */
  startPoint: SpecimenPoint
  endPoint: SpecimenPoint
  /** Whether that span lies on the specimen or on an offset datum. */
  attachment: SpanAttachment
  /**
   * Where the leader line leaves the specimen and the label attaches.
   *
   * Deliberately separate from the span's midpoint. A label at the midpoint of
   * a leaf-length line sits *on* the leaf, and the type competes with the
   * geometry it is describing; a label pulled out to the silhouette's edge
   * reads as an annotation of the plant rather than a sticker on it.
   */
  anchor: SpecimenPoint
  side: LabelSide
  /**
   * Reveal order within the phenotype window, 0 → 1.
   *
   * Seven annotations arriving together is the "dashboard" failure the whole
   * stage is trying to avoid — it reads as a UI panel switching on. Staggering
   * them reads as a pass being taken. Ordered whole-plant → organ → fine
   * detail, which is also the order a real measurement protocol runs in.
   */
  at: number
  /**
   * Mobile keeps only the lowest `priority` values. See `annotationsFor`.
   *
   * Not a styling flag: 375px of width cannot carry seven leader lines and
   * seven two-line labels without them overlapping each other, and an
   * unreadable annotation is worse than an absent one.
   */
  priority: number
}

/**
 * The default set.
 *
 * Every point below was READ OFF THE SCAN, not eyeballed against a render.
 * `public/models/sunflower-cloud.ply` is loaded, put through the same
 * `resolveNormalizationMatrix` the app applies, and then probed: the stem axis
 * is found per height band by shrinking a disc onto the densest core, blades
 * are isolated as connected components at a 0.016 hop radius, and every
 * endpoint quoted here is either a real sample or a point whose distance to the
 * nearest sample was measured. `verify-phenotype.mjs` re-derives those
 * distances from the same file on every run, so a re-scan that moves the plant
 * fails the harness rather than silently detaching the labels.
 *
 * WHAT THE REAL SPECIMEN IS, AND WHY THAT MATTERS HERE
 * ───────────────────────────────────────────────────
 * A bushy potted sunflower, ~1.27 plan half-extent against a 3.2 height, with
 * leaves reaching full width from y = -1.25 upward and a near-vertical stem at
 * roughly (0.00, +0.09) that drifts to (-0.45, +0.36) in the top fifth. It is
 * not the sparse, well-spaced specimen these seven were first authored against,
 * and the difference is the whole reason they had to be redone: on a plant this
 * dense, "just outside the silhouette" is a much longer push than it looks, and
 * anchors that used to sit in clear air now sit inside the canopy.
 *
 * So the anchors are not offsets from their spans. Each one is placed by
 * marching outward along the annotation's own direction until its label box
 * clears the plant ON SCREEN, then adding a little. That is why the anchor
 * coordinates look unrelated to the endpoints they belong to.
 *
 * "On screen" is the part that matters and it is why these were all re-derived
 * when the asset gained its 86-degree yaw. A 3D clearance is rotation-
 * invariant, so rotating the old anchors with the plant kept every one of them
 * the same distance from the nearest sample — and broke three of them anyway,
 * because the yaw swung them from beside the specimen to in front of or behind
 * it, where they project straight onto the canopy. `leaf-area`'s rotated anchor
 * sat at z = -1.05, a full plan extent behind the plant and dead centre on it
 * in the render. The clearance that has to hold is a 2D one.
 *
 * The derivation is therefore a projection: the cloud is rasterised to a
 * coverage mask through the real camera at six points across the phenotype
 * window (p = 0.85 … 1.00, 1440x900, FOV 38 — the tightest framing the spline
 * reaches), and the anchor marches outboard until the label box it would carry
 * lands on under 0.5% covered pixels at EVERY one of the six. Six and not one
 * because the camera is still moving while the labels are up; an anchor placed
 * against a single frame drifts onto a leaf halfway through the beat.
 *
 * Two floors are imposed on top of that. The march is at least 0.22 of the plan
 * extent, or the leader line comes out zero-length and the label sits on its
 * own anchor dot; and the anchor stays at least 0.12 from the nearest sample in
 * 3D, or it reads as touching the plant even when the projection says it is
 * clear. Both were added after a first pass returned three traits with a 0.00
 * march that passed the ink test honestly — the offset label box was indeed
 * over clean paper, while the dot it hung from was buried in a leaf.
 *
 * Heights stay laddered so the seven separate vertically on screen, and the
 * pairs that land closest take opposite sides. That is not decoration: it is
 * the entire collision-avoidance strategy. A general 2D label solver is the
 * obvious alternative and it is the wrong tool here — the set is fixed, small,
 * and authored, so laying it out by hand the way a botanical plate is laid out
 * costs nothing at runtime and cannot oscillate between frames the way an
 * iterative solver can when the camera moves.
 *
 * None of this makes the NUMBERS real. `TRAIT_READOUT` is still invented and
 * still carries `PHENOTYPE_DISCLAIMER`. What is now real is only where each
 * caliper is shown being placed.
 */
const TRAIT_GEOMETRY: readonly TraitGeometry[] = [
  {
    id: 'plant-height',
    // The one clearance span: a datum line beside the plant, base to apex, the
    // way total height is dimensioned on a drawing.
    //
    // This is the trait the yaw hurt most, and the only one that could not be
    // fixed by moving its anchor. Rotating the old datum took it to z = +1.11,
    // which is not beside the plant at all — it is a full plan extent in FRONT
    // of it, so it projects as a vertical line drawn straight down the middle
    // of the specimen. A height datum crossing the thing it measures is not a
    // datum, so the line was re-placed rather than rotated: swept inboard from
    // x = -1.60 until the first x whose whole length clears the silhouette by
    // 6px in all six frames, sampled at 41 stations up the line and not just at
    // the two ends, because a datum that grazes the canopy in the middle reads
    // as touching it even though both endpoints are clear. That is x = -1.00,
    // and it holds 0.275 of real 3D clearance at its tightest point.
    //
    // z = 0 rather than the old 0.1: the offset existed to dodge a leaf that
    // the rotation has moved, and the plane of the page is where a drawing
    // would put it.
    startPoint: { x: -1.0, y: 0.0, z: 0.0 },
    endPoint: { x: -1.0, y: 1.0, z: 0.0 },
    // At the FOOT of the datum, not the apex, and opening OUTWARD across it.
    //
    // This is the one label in the set that sits on a line rather than beside
    // everything. It is not a compromise made to dodge a collision — the sweep
    // was run for both sides at every 0.02 of x and 0.01 of y against all five
    // viewports the harness checks, and `side: 'right'` has NO solution at all:
    // the pocket beside the pot is wide enough at 1440 and is not at 375, where
    // the label is the same 89px but the plant is not the same size. Opening
    // left has 602, and every one of them crosses the datum, necessarily —
    // anything inboard of the line with its label to the left must pass over
    // it. So the choice is between crossing a hairline and crossing a leaf.
    //
    // A drawing crosses the hairline. Dimension text sits ON the dimension line
    // by convention, and here that convention happens to also be the only thing
    // that fits. x = -0.68 is the innermost of the 602 — further out and the
    // label runs off the left edge at 375.
    anchor: { x: -0.68, y: 0.02, z: 0.0 },
    attachment: 'clearance',
    side: 'left',
    at: 0.0,
    priority: 0,
  },
  {
    id: 'leaf-length',
    // The upper blade that the yaw has swung toward the viewer: from just off
    // its node on the stem out to the tip, 0.85 of a world unit. Chosen over
    // the longer lower leaves because it is the straightest — the endpoints
    // here sit 0.027 and 0.010 from real samples, where a node-to-tip line on
    // the drooping lower blades departs by 0.16. A "length" that visibly floats
    // off the organ is worse than a shorter one.
    //
    // Same two samples as before the yaw, carried through Ry(1.5010) and
    // rescaled by 0.96308 — the plan half-extent grows from 1.25406 to 1.30214
    // when the plant turns, and these are FRACTIONS of it, so rotating them
    // without the rescale would have walked every endpoint 3.7% outboard.
    startPoint: { x: 0.078, y: 0.869, z: 0.224 },
    endPoint: { x: -0.249, y: 0.868, z: 0.78 },
    // Straight on past the tip, the minimum 0.22 march. The canopy has already
    // ended here so there is nothing to clear — 0.00% ink at all six frames —
    // and this is the outermost label on the set, so at 375px the frame margin
    // and not the leaf is what stops it going further.
    anchor: { x: -0.469, y: 0.868, z: 0.78 },
    attachment: 'surface',
    side: 'left',
    at: 0.16,
    priority: 1,
  },
  {
    id: 'leaf-width',
    // A chord across the mid-canopy blade, perpendicular in plan to its midrib
    // — the widest of four stations sampled along it. The two y values differ
    // by 0.02 because the blade droops: a level chord would be the authored
    // idea of a leaf rather than this leaf. Endpoints land 0.020 and 0.013 from
    // real samples after the rotation.
    startPoint: { x: 0.68, y: 0.342, z: 0.228 },
    endPoint: { x: 0.412, y: 0.324, z: 0.528 },
    // Outboard of the blade along the chord's own direction rather than below
    // it — this specimen has more canopy underneath than beside.
    anchor: { x: 0.9, y: 0.342, z: 0.228 },
    attachment: 'surface',
    // LEFT before the yaw, right after it. This blade used to sit on -x and the
    // rotation carried it across to +x; the side has to follow the organ or the
    // leader line reaches back across the whole plant to find its own anchor.
    // It is the only one of the seven whose side changed.
    side: 'right',
    at: 0.28,
    priority: 2,
  },
  {
    id: 'leaf-area',
    // A trait of a surface, not of a span. Two stations partway along the long
    // +x blade, so the marker pair reads as sampling a region rather than
    // measuring a length — which is why it stops partway along a blade rather
    // than reaching the tip.
    //
    // The start is the loosest endpoint in the set at 0.113 from the nearest
    // sample, well inside the 0.22 tolerance but the one to watch: this blade
    // is thin where the upper station falls, so the rotated point passes
    // through a gap between samples rather than onto one.
    startPoint: { x: 0.151, y: 0.716, z: -0.29 },
    endPoint: { x: 0.216, y: 0.714, z: -0.616 },
    // The trait whose old anchor the yaw broke outright — rotated, it landed
    // at z = -1.05, behind the plant and projecting onto the middle of the
    // canopy. Re-marched outboard 0.51 to the first position clear in all six
    // frames, which still leaves 0.47% ink: the highest of the seven, and the
    // reason the ceiling is 0.5% rather than zero. There is no fully empty
    // pocket at this height on a plant this bushy.
    anchor: { x: 0.726, y: 0.714, z: -0.616 },
    attachment: 'surface',
    side: 'right',
    at: 0.42,
    priority: 4,
  },
  {
    id: 'leaf-angle',
    // From a node low on the stem outward along the first stretch of a midrib:
    // the angle the blade leaves the stem at. Reads as an angle because it
    // starts on the axis and departs from it, so it is kept short — 0.33 — and
    // stops before the blade droops away from the straight line. This is the
    // lower leaf rather than one of the mid-canopy ones: its first third is
    // the straightest stretch on the plant, never more than 0.096 off material,
    // where the mid-canopy blades bend away by 0.24 within the same distance.
    startPoint: { x: 0.045, y: 0.202, z: -0.058 },
    endPoint: { x: 0.011, y: 0.198, z: -0.305 },
    // The longest march in the set, 0.70, and it has to be: the span sits in
    // the middle of the canopy and the first clear position is past the
    // blade's own tip. Held at the start point's height and depth rather than
    // continuing along the span, because extending the span's own direction
    // drives it further behind the plant, not out of it.
    anchor: { x: 0.745, y: 0.202, z: -0.058 },
    attachment: 'surface',
    side: 'right',
    at: 0.55,
    priority: 5,
  },
  {
    id: 'internode-distance',
    // Two nodes apart on the stem surface, so it runs vertically along the axis
    // rather than out into the canopy. The axis drifts slightly over this
    // stretch, which is why x and z are not equal at the two ends.
    startPoint: { x: 0.036, y: 0.506, z: 0.024 },
    endPoint: { x: 0.059, y: 0.594, z: 0.039 },
    // Straight out to -x at the foot of the span, 0.52. This one crosses the
    // canopy to reach clear air, so it is the second-highest ink at 0.21%; the
    // alternative was pushing it past the frame edge at 375px.
    anchor: { x: -0.484, y: 0.506, z: 0.024 },
    attachment: 'surface',
    side: 'left',
    at: 0.68,
    // Third rather than sixth: mobile keeps four, and the other three are all
    // in the upper canopy. `priority` orders by *spatial separation* under a
    // reduced set, `at` by protocol order — conflating them is what put four
    // mobile labels in the same corner.
    priority: 3,
  },
  {
    id: 'stem-diameter',
    // Across the trunk just above the pot, below everything, where a caliper
    // would actually reach. The half-width is the 75th percentile of the radial
    // distance of every sample within 0.20 of the axis — the stem's own surface
    // rather than a guess. This is the shortest span in the set by a wide
    // margin, 0.14 of the plan extent, which is why the leader line and not the
    // span carries the label.
    startPoint: { x: -0.004, y: 0.125, z: 0.102 },
    endPoint: { x: 0.005, y: 0.125, z: -0.032 },
    // Left, and a long way out — 0.74, the second-longest march. Right is
    // taken by leaf-angle at a similar height, and the extra distance is what
    // keeps the label off the POT rather than merely off the plant; the pot is
    // in the coverage mask too, which is why this one had to travel so far.
    anchor: { x: -0.744, y: 0.125, z: 0.102 },
    attachment: 'surface',
    side: 'left',
    at: 0.8,
    priority: 6,
  },
] as const

/** How many annotations each breakpoint can carry legibly. */
const BREAKPOINT_CAPACITY = { desktop: 7, mobile: 4 } as const

/**
 * One trait, complete: where it is measured plus what it is called.
 *
 * Every consumer wants both halves at once, so they are rejoined here rather
 * than at each call site. The two source tables are keyed by the same `TraitId`
 * union, so a trait present in one and absent from the other is a compile
 * error, not a blank label discovered in a screenshot.
 */
export type MeasurementAnnotation = TraitGeometry & TraitReadout

/**
 * The whole set, in reveal order. Both the line layer and the label layer
 * iterate this, so buffer slot `i` and DOM node `i` describe the same trait.
 */
export const ORDERED_MEASUREMENTS: readonly MeasurementAnnotation[] = TRAIT_GEOMETRY.map((g) => ({
  ...g,
  ...TRAIT_READOUT[g.id],
})).sort((a, b) => a.at - b.at)

/**
 * How many of them the viewport can carry legibly.
 *
 * Mobile drops the highest `priority` numbers rather than scaling everything
 * down, because the constraint is the label's own line-height and the leader
 * line's minimum useful length — neither of which shrinks with the viewport.
 *
 * This is a *runtime* gate rather than a filter applied when the geometry is
 * built, and that is the whole reason responsiveness costs nothing here: both
 * layers always carry all seven, and an annotation over capacity is simply
 * revealed to 0. So the breakpoint can be read from a ref inside the frame loop
 * — no React re-render, no second `matchMedia` listener duplicating the one in
 * `ProgressProvider`, and a live resize is correct on the next frame instead of
 * on the next mount. Seven annotations is ~500 floats of geometry; filtering to
 * save four of them would be a re-render to save nothing.
 */
export function annotationCapacity(breakpoint: 'desktop' | 'mobile'): number {
  return BREAKPOINT_CAPACITY[breakpoint]
}

/** 0 → not drawn at this breakpoint. Combined with the stagger by each layer. */
export function annotationVisible(m: MeasurementAnnotation, breakpoint: 'desktop' | 'mobile'): boolean {
  return m.priority < BREAKPOINT_CAPACITY[breakpoint]
}

/**
 * The specimen's extent in world units, measured from whatever actually loaded.
 *
 * `planHalfExtent` is a single number rather than separate x and z because the
 * annotations are authored as fractions of "how wide the plant is", and a
 * specimen that is wider in x than z would otherwise skew every anchor
 * differently depending on which axis it happened to lean along.
 */
export interface SpecimenBounds {
  minY: number
  maxY: number
  planHalfExtent: number
}

/**
 * Bounds for the procedural placeholder, and the guard for a degenerate asset.
 *
 * Derived from `PlaceholderSpecimen`'s own generator rather than guessed: its
 * samples sit at radius `1.3 * (1 + lobe)` with the lobe reaching about ±0.19,
 * and y is scaled by a further 1.24. So the plan half-extent is ~1.55 and the
 * height ~±1.92. Worth deriving rather than eyeballing — every annotation is a
 * fraction of these two numbers, so an over-generous plan extent pushes all
 * seven off the silhouette and it looks like an anchoring bug.
 */
export const FALLBACK_BOUNDS: SpecimenBounds = {
  minY: -1.92,
  maxY: 1.92,
  planHalfExtent: 1.55,
}

/**
 * Bounds measured from the positions that actually loaded.
 *
 * `planHalfExtent` is `max(|x|, |z|)` over every sample, not the bounding box's
 * diagonal. The diagonal — `hypot(halfWidth, halfDepth)` — assumes a sample
 * sitting at the corner of the box and none does; on the fixture it overstates
 * the plan radius by about 15%, which would push every anchor authored at
 * x = ±0.9 that much further off the silhouette. This is the same distinction
 * that mattered when the orbit radius was sized.
 *
 * Takes a plain Float32Array so this file stays engine-free and the measurement
 * can be asserted in Node against the fixture.
 */
export function measureSpecimenBounds(positions: Float32Array): SpecimenBounds {
  let minY = Infinity
  let maxY = -Infinity
  let plan = 0

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!
    const y = positions[i + 1]!
    const z = positions[i + 2]!
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    const ax = x < 0 ? -x : x
    const az = z < 0 ? -z : z
    if (ax > plan) plan = ax
    if (az > plan) plan = az
  }

  // A single-point or empty cloud would otherwise emit Infinity into the scene
  // graph, where it silently kills the whole render rather than erroring.
  if (!(maxY > minY)) return FALLBACK_BOUNDS
  return { minY, maxY, planHalfExtent: plan > 1e-4 ? plan : FALLBACK_BOUNDS.planHalfExtent }
}

/** Specimen space → world. Mutates `out`; the frame loop must not allocate. */
export function resolveAnnotationPoint(
  p: SpecimenPoint,
  bounds: SpecimenBounds,
  out: { x: number; y: number; z: number },
): void {
  out.x = p.x * bounds.planHalfExtent
  out.y = bounds.minY + p.y * (bounds.maxY - bounds.minY)
  out.z = p.z * bounds.planHalfExtent
}

/**
 * Per-annotation reveal, 0 → 1, from the stage's overall progress.
 *
 * `phenotype` is already eased by the track, so this stays linear and only
 * handles the stagger.
 *
 * The window width is the whole design of the stagger, and 0.36 was too wide.
 * `at` values are spaced ~0.107 apart in stage units after the 0.64 compression,
 * so a 0.36 window has 0.36 / 0.107 ≈ 3.4 annotations open at any moment — and
 * measured, the peak was five. Five lines growing at once is the "dashboard"
 * read the stage exists to avoid: it is a panel switching on, not a pass being
 * taken. 0.24 gives ≈ 2.2, peaking at three, which is few enough that the eye
 * follows individual lines.
 *
 * It cannot go much below that. Each line has to draw over enough scroll to be
 * seen growing; snap it in and it is a UI element appearing.
 *
 * Bounds: the last annotation is at 0.8, so it completes at 0.8 * 0.64 + 0.24 =
 * 0.752 of the stage — comfortably before the end, which matters because the
 * stage is the last thing on the page and an annotation still mid-draw at
 * p = 1 would read as broken rather than as unfinished.
 */
export function annotationReveal(stage: number, at: number): number {
  const start = at * 0.64
  const t = (stage - start) / 0.24
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/**
 * The value as shown.
 *
 * Fixed decimals, never trimmed: "8.30" not "8.3". A column of numbers whose
 * decimal count varies reads as sloppy on an instrument, and with tabular
 * figures a trailing zero costs nothing in width while a missing one shifts the
 * whole string.
 */
export function formatValue(m: MeasurementAnnotation): string {
  return m.value.toFixed(m.precision)
}
