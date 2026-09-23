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
 * `{ x: -1.08, y: 0.0, z: 0.1 }` is only editable by someone reading the
 * comment above it about clearing the widest broadside leaf at x = -0.996,
 * whereas a label and a number are copy. `TRAIT_READOUT` being a
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
 * Anchors are authored against the specimen's actual anatomy — phyllotactic
 * leaves off a leaning stem — and then verified against the loaded geometry
 * (see `verify-phenotype.mjs`, which asserts every anchor is within a
 * tolerance of a real sample rather than floating in space).
 *
 * Sides alternate and heights are kept apart on purpose. That is not
 * decoration: it is the entire collision-avoidance strategy. A general 2D label
 * solver is the obvious alternative and it is the wrong tool here — the set is
 * fixed, small, and authored, so laying it out by hand the way a botanical
 * plate is laid out costs nothing at runtime and cannot oscillate between
 * frames the way an iterative solver can when the camera moves.
 */
const TRAIT_GEOMETRY: readonly TraitGeometry[] = [
  {
    id: 'plant-height',
    // The one clearance span: a datum line beside the plant, base to apex, the
    // way total height is dimensioned on a drawing. x = -1.08 is chosen, not
    // eyeballed — the widest broadside leaf reaches x = -0.996, so this clears
    // the silhouette by ~0.08 of the plan extent and no closer.
    startPoint: { x: -1.08, y: 0.0, z: 0.1 },
    endPoint: { x: -1.08, y: 1.0, z: 0.1 },
    // Near the apex and opening to the RIGHT, into the gap between the datum
    // line and the stem tip. Hanging it at mid-height on the left put the label
    // off the left edge of a 375px viewport — 1 world unit is ~119px there and
    // "PLANT HEIGHT" is ~73px wide, so there is simply no room outboard of a
    // datum at -1.08. Inboard there is, and it is empty.
    anchor: { x: -0.8, y: 0.96, z: 0.1 },
    attachment: 'clearance',
    side: 'right',
    at: 0.0,
    priority: 0,
  },
  {
    id: 'leaf-length',
    // Leaf 8: attach point on the stem to blade tip, one of the three leaves
    // presenting broadside to the camera at this point on the spline.
    startPoint: { x: -0.035, y: 0.686, z: -0.117 },
    endPoint: { x: 0.66, y: 0.701, z: -0.371 },
    anchor: { x: 0.78, y: 0.7, z: -0.371 },
    attachment: 'surface',
    side: 'right',
    at: 0.16,
    priority: 1,
  },
  {
    id: 'leaf-width',
    // Leaf 4's widest chord — across the blade, not along it. Both ends at the
    // same height because the chord is perpendicular to the midrib.
    startPoint: { x: -0.477, y: 0.413, z: -0.19 },
    endPoint: { x: -0.422, y: 0.413, z: 0.119 },
    // Below the blade rather than beside its midpoint, so the label does not
    // sit on the leaf it is describing.
    anchor: { x: -0.62, y: 0.3, z: -0.03 },
    attachment: 'surface',
    side: 'left',
    at: 0.28,
    priority: 2,
  },
  {
    id: 'leaf-area',
    // A trait of a surface, not of a span. Both ends sit on leaf 5's blade so
    // the marker pair reads as sampling a region rather than measuring a length.
    startPoint: { x: 0.14, y: 0.487, z: 0.212 },
    endPoint: { x: 0.301, y: 0.487, z: -0.041 },
    anchor: { x: 0.52, y: 0.6, z: 0.08 },
    attachment: 'surface',
    side: 'right',
    at: 0.42,
    priority: 4,
  },
  {
    id: 'leaf-angle',
    // From leaf 9's node outward along the first part of the midrib: the angle
    // the blade leaves the stem at. Reads as an angle because it starts on the
    // axis and departs from it.
    startPoint: { x: -0.05, y: 0.762, z: -0.117 },
    endPoint: { x: -0.3, y: 0.812, z: -0.22 },
    anchor: { x: -0.54, y: 0.88, z: -0.22 },
    attachment: 'surface',
    side: 'left',
    at: 0.55,
    priority: 5,
  },
  {
    id: 'internode-distance',
    // Leaf 6's node to leaf 7's, so it runs vertically along the axis rather
    // than out into the canopy. Both ends are on the stem surface, which leans
    // — hence the x and z drift over 0.074 of the height.
    startPoint: { x: -0.074, y: 0.538, z: -0.124 },
    endPoint: { x: -0.067, y: 0.612, z: -0.096 },
    anchor: { x: -0.42, y: 0.575, z: -0.11 },
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
    // Across the stem low on the axis, where a caliper would go. This is the
    // shortest span in the set by an order of magnitude — 0.06 of the plan
    // extent — which is why the leader line, not the span, carries the label.
    startPoint: { x: -0.127, y: 0.22, z: -0.086 },
    endPoint: { x: -0.065, y: 0.22, z: -0.086 },
    anchor: { x: 0.2, y: 0.2, z: -0.086 },
    attachment: 'surface',
    side: 'right',
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
