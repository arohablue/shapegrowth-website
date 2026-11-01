import { DefaultLoadingManager } from 'three'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE PYTHON ↔ TYPESCRIPT BOUNDARY
 * ────────────────────────────────────────────────────────────────────────────
 * `scripts/build-plant-growth-assets.py` writes `plant-growth/manifest.json`
 * and one `.bin` per specimen; this file is the only place allowed to describe
 * their shape. Everything offering 02 knows about the study arrives through
 * here.
 *
 * Nothing renders any of this yet. The five plates of PLANT GROWTH FIELDS are
 * still holes — see the note in `evidence/demo.ts` about why they are not
 * covered by schematics — and the view that reads these types is the next piece
 * of work. The loader exists ahead of it because it is the contract, not the
 * implementation: it is what fixes the fact that `warped` is not in the file
 * and has to be reconstructed, that every length is in unnamed scan units, and
 * that four of the study's fourteen plants are here while ten are not.
 *
 * THREE FIELDS EXIST TO STOP A READER INVENTING A QUANTITY
 * ───────────────────────────────────────────────────────
 * `units` is `'scan units'` and not `'mm'`. The Pheno4D documentation describes
 * its files only as x, y, z and a label, and never states a unit. `unitEvidence`
 * carries the circumstantial case for millimetres — the scanner reports in them
 * and the plants are the right size — recorded as an inference and deliberately
 * not applied. `calibration` is an explicit `null` rather than an absent key,
 * because an absent key reads like an oversight and a present `null` reads like
 * a finding.
 *
 * `caveats` is not small print. It is four sentences the exporter writes from
 * the same source as the plate copy in `content.ts`, and any view built on this
 * manifest is expected to put them on screen rather than beside the code.
 */

/** Every length in this manifest and in every `.bin`. Never `'mm'`. */
export type ScanUnits = 'scan units'

/**
 * How far a specimen is to be trusted, decided by the exporter from the fit
 * statistics rather than by the page.
 *
 * `'problematic'` is a first-class value and not an omission: T02 is the
 * study's weakest registration and it ships for that reason. A selector
 * containing only the specimens that worked is a selector that cannot be used
 * to find out that one did not.
 */
export type SpecimenQuality = 'featured' | 'clean' | 'problematic'

/**
 * One named block of a `.bin`, in order. Float32, little-endian, no header.
 *
 * The file is COMPONENT-MAJOR: all `n` source points, then all `n` target
 * points, then all `n` displacements, then all `n` determinants — four
 * contiguous blocks, not `n` interleaved ten-float records. `components` is the
 * width of one row *within* a block, so a block is `n * components` floats long
 * and the whole file is `n * Σcomponents`.
 *
 * Both layouts have the same byte count, which is what makes getting this wrong
 * silent: a record-major read of this file returns the right number of points
 * with the wrong numbers in them, and the first three coordinates it hands back
 * are a real point, so even a spot check looks plausible. It was wrong here for
 * exactly that reason. What catches it is `assertLayout` below, which reads the
 * determinant block and compares it against statistics the exporter published
 * from the same array.
 */
export interface BinaryComponent {
  readonly name: 'src' | 'tgt' | 'displacement' | 'detJ'
  readonly components: number
}

export interface SpecimenAsset {
  readonly url: string
  readonly bytes: number
  readonly layout: readonly BinaryComponent[]
  readonly dtype: 'float32'
  readonly endianness: 'little'
  /**
   * `{ warped: 'src + displacement' }`.
   *
   * The registered cloud is not in the file. It is omitted rather than shipped
   * because the producing script defines displacement as `warped - src`, so the
   * two are bit-identical and a fourth array would be a second copy of a number
   * that can disagree with the first after an edit. Stated here so a reader
   * does not conclude the warped cloud was lost.
   */
  readonly derived: { readonly warped: string }
}

/**
 * Chamfer distance between the two clouds, before and after registration.
 *
 * The only fit measure available. The scans are independent samplings of the
 * plant with no shared point identity, so there is no correspondence to score
 * against — this asks the weaker question of whether the two surfaces ended up
 * in the same place, which is the question that can actually be answered.
 */
export interface SpecimenFit {
  readonly chamfer_before: number
  readonly chamfer_after: number
  /** `1 - after / before`. Carried rather than recomputed, so one answer exists. */
  readonly chamfer_reduction: number
}

export interface DisplacementStats {
  readonly mean: number
  readonly median: number
  readonly p95: number
  readonly max: number
}

/**
 * Jacobian determinant of the estimated deformation, summarised.
 *
 * The three fractions are counted in separate bands and not derived from the
 * percentiles: `frac_expanding` is strictly above one, `frac_compressing` is
 * above zero and at most one, and `frac_non_positive` is at most zero — points
 * where the map folds, which carry no readable expansion at all. They sum to
 * one, and `frac_non_positive` is the one a view must not quietly clip into the
 * compressing band.
 */
export interface DeformationStats {
  readonly median: number
  readonly p5: number
  readonly p95: number
  readonly min: number
  readonly max: number
  readonly frac_expanding: number
  readonly frac_compressing: number
  readonly frac_non_positive: number
  readonly count_non_positive: number
}

/**
 * Axis-aligned extent of BOTH scans, for framing a camera without reading the
 * arrays.
 *
 * Over the union of source and target, not the source alone — the exporter is
 * explicit about why, and it matters to anything that frames a shot: the plant
 * grows between the two scans, so a box drawn around day t alone would let the
 * day t+1 cloud hang out of frame at exactly the top, which is where the growth
 * is. For M05 that is 23 scan units of new stem.
 *
 * `centre` is the midpoint of the box rather than a centroid of the points: a
 * camera aims at a volume, not at a mass.
 *
 * NOTE ON AXES: this is the scanner's frame, in which **+z is up**. The ground
 * sits near z = 0 and the plant extends to positive z, while x and y are the
 * horizontal plane and carry the scanner's own large offset — M05's y lives
 * around −800. Three's world is y-up, so a view must rotate this; the growth
 * between M05's two scans reads on z and nowhere else, which is the check that
 * the rotation is the right way round.
 */
export interface SpecimenBounds {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
  readonly centre: readonly [number, number, number]
  readonly extent: readonly [number, number, number]
  readonly diagonal: number
}

export interface SpecimenRecord {
  /** Pheno4D's own plant id — `'M05'`, `'T02'`. */
  readonly id: string
  readonly species: 'Maize' | 'Tomato'
  readonly label: string
  readonly quality: SpecimenQuality
  /** Why this specimen is worth a second look, or `null` when there is nothing to say. */
  readonly note: string | null
  readonly interval: { readonly from: string; readonly to: string; readonly days: number }
  readonly asset: SpecimenAsset
  readonly fit: SpecimenFit
  readonly diagnostics: {
    readonly n_points: number
    readonly displacement: DisplacementStats
    readonly detJ: DeformationStats
    readonly bounds: SpecimenBounds
  }
}

export interface PlantGrowthManifest {
  readonly schema: 1
  readonly dataset: 'Pheno4D'
  readonly reference: string
  readonly units: ScanUnits
  readonly unit_evidence: string
  readonly calibration: null
  readonly interval_note: string
  /** The four sentences this study is not allowed to drop. */
  readonly caveats: readonly string[]
  /**
   * Fourteen plants were processed; four have point arrays. The other ten exist
   * only as summary statistics, and are absent rather than listed — a selector
   * entry that cannot be opened is a promise the page cannot keep.
   */
  readonly coverage: {
    readonly plants_in_study: number
    readonly plants_with_point_data: number
    readonly note: string
  }
  readonly specimens: readonly SpecimenRecord[]
  /**
   * The evidence for applying a rigid pre-alignment to every specimen when it
   * changes the outcome for exactly one of them. Kept in the manifest because a
   * parameter chosen on the strength of one plant should carry that plant.
   */
  readonly rigid_prealignment_evidence: {
    readonly plant: string
    readonly without_rigid: Record<string, number>
    readonly with_rigid: Record<string, number>
    readonly note: string
  }
}

const MANIFEST_URL = '/evidence/plant-growth/manifest.json'

/**
 * The specimen a view opens on.
 *
 * M05 and not the first entry: it is the cleanest registration in the study —
 * the only one of the four with no folded points and the tightest det J spread
 * — so it is the specimen that shows what the method does when it works. The
 * others are reached from the selector, which is where a reader meets T02.
 *
 * Asserted against the manifest by `specimenById` rather than trusted, because
 * a default naming a specimen the exporter stopped writing would silently fall
 * back to an empty view.
 */
export const DEFAULT_SPECIMEN = 'M05'

/**
 * `fetch`, announced to three's `DefaultLoadingManager`.
 *
 * Same mechanism as `views/leaf-dynamics/manifest.ts`, and for the same reason:
 * drei's `useProgress` reads that manager and `AssetLoadingIndicator` already
 * reads `useProgress`, so bracketing the request puts these bytes on the
 * progress line the page already shows. A second progress mechanism for a
 * handful of files would be visually identical to the first and guaranteed to
 * disagree with it eventually.
 */
export async function trackedFetch(url: string): Promise<Response> {
  DefaultLoadingManager.itemStart(url)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url} responded ${res.status}`)
    DefaultLoadingManager.itemEnd(url)
    return res
  } catch (err) {
    DefaultLoadingManager.itemError(url)
    DefaultLoadingManager.itemEnd(url)
    throw err
  }
}

/**
 * Module-level, so every plate that needs the manifest — and the `ExpandedView`
 * copy of any of them — shares one request. Five plates mount simultaneously
 * under the sticky stage.
 *
 * A rejected promise is cleared rather than cached, so a view that failed on a
 * dropped connection can retry. Caching the rejection would make one bad
 * request permanent for the life of the page.
 */
let pending: Promise<PlantGrowthManifest> | null = null

export function loadManifest(): Promise<PlantGrowthManifest> {
  pending ??= trackedFetch(MANIFEST_URL)
    .then((r) => r.json() as Promise<PlantGrowthManifest>)
    .catch((err: unknown) => {
      pending = null
      throw err
    })
  return pending
}

/**
 * The specimen's four arrays as views onto one buffer — no copy, no decode.
 *
 * `src`, `tgt`, `displacement` and `detJ` are `subarray` views and share the
 * fetched `ArrayBuffer`; only `warped` is allocated. It is reconstructed here
 * and only here, from the identity the manifest states, so the one place that
 * knows the registered cloud is not in the file is the one place that rebuilds
 * it.
 *
 * Every length is in `scan units`. Nothing here is millimetres.
 */
export interface SpecimenArrays {
  readonly src: Float32Array
  readonly tgt: Float32Array
  readonly warped: Float32Array
  readonly displacement: Float32Array
  readonly detJ: Float32Array
}

/**
 * Does the determinant block actually contain determinants?
 *
 * The one assertion that distinguishes a correct read of this file from a
 * plausible one. A component-major file read as record-major yields the right
 * point count and real-looking coordinates, so nothing downstream throws — the
 * plant simply renders as a cloud of nonsense that still turns and still has a
 * legend under it. The only cheap way to catch it is to read a block whose
 * published statistics are distinctive and check them.
 *
 * `detJ` is that block. Determinants sit around 1; coordinates in this dataset
 * run to ±900, and the bug this guards against lands a y-coordinate here. So
 * comparing the extremes against the manifest's own `min`/`max` separates the
 * two by three orders of magnitude, and a 1% tolerance is far tighter than it
 * needs to be while still absorbing float32 rounding.
 *
 * Thrown rather than logged. A view that renders the wrong arrays is worse than
 * a view that renders an error, because only one of the two is noticeable.
 */
function assertLayout(specimen: SpecimenRecord, detJ: Float32Array): void {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < detJ.length; i++) {
    const v = detJ[i]!
    if (v < min) min = v
    if (v > max) max = v
  }
  const want = specimen.diagnostics.detJ
  const tol = Math.max(1e-3, Math.abs(want.max) * 0.01)
  if (Math.abs(min - want.min) > tol || Math.abs(max - want.max) > tol) {
    throw new Error(
      `${specimen.id}: the detJ block of ${specimen.asset.url} spans ` +
        `[${min.toFixed(4)}, ${max.toFixed(4)}] but the manifest says ` +
        `[${want.min.toFixed(4)}, ${want.max.toFixed(4)}]. The file is ` +
        `component-major — four contiguous blocks, not interleaved records.`,
    )
  }
}

export async function loadSpecimen(specimen: SpecimenRecord): Promise<SpecimenArrays> {
  const res = await trackedFetch(specimen.asset.url)
  const buffer = await res.arrayBuffer()
  if (buffer.byteLength !== specimen.asset.bytes) {
    throw new Error(
      `${specimen.id}: ${specimen.asset.url} is ${buffer.byteLength} bytes, ` +
        `manifest says ${specimen.asset.bytes}`,
    )
  }
  const stride = specimen.asset.layout.reduce((n, c) => n + c.components, 0)
  const all = new Float32Array(buffer)
  const n = all.length / stride
  if (!Number.isInteger(n)) {
    throw new Error(
      `${specimen.id}: ${all.length} floats is not a whole number of ${stride}-float points`,
    )
  }

  // Four contiguous blocks, in the order `layout` gives. Walked rather than
  // read at hard-coded offsets so that the manifest stays the single statement
  // of what is in the file — a literal `n * 3` here would be a second copy of
  // `components` that could disagree with it.
  const blocks = new Map<string, Float32Array>()
  let at = 0
  for (const c of specimen.asset.layout) {
    blocks.set(c.name, all.subarray(at, at + n * c.components))
    at += n * c.components
  }
  const take = (name: BinaryComponent['name']): Float32Array => {
    const block = blocks.get(name)
    if (!block) {
      throw new Error(
        `${specimen.id}: no "${name}" block in ${specimen.asset.url} — layout is ` +
          `${specimen.asset.layout.map((c) => c.name).join(', ')}`,
      )
    }
    return block
  }

  const src = take('src')
  const tgt = take('tgt')
  const displacement = take('displacement')
  const detJ = take('detJ')

  assertLayout(specimen, detJ)

  const warped = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) warped[i] = src[i]! + displacement[i]!

  return { src, tgt, warped, displacement, detJ }
}

/**
 * Lookup that fails loudly. An unknown id is a wiring mistake — a stale default
 * or a hand-typed selector value — and returning `undefined` would render an
 * empty frame that looks like a load still in flight.
 */
export function specimenById(manifest: PlantGrowthManifest, id: string): SpecimenRecord {
  const found = manifest.specimens.find((s) => s.id === id)
  if (!found) {
    throw new Error(`no specimen "${id}" in the manifest — have ${manifest.specimens.map((s) => s.id).join(', ')}`)
  }
  return found
}
