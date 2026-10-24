/**
 * The Python ↔ TypeScript boundary.
 *
 * `pipeline/export.py` writes `public/specimens/manifest.json` and one `.bin`
 * per specimen; this file is the only place allowed to describe their shape.
 * Adapted from the website's loader with two deliberate changes:
 *
 *   1. URLs are BASE_URL-relative, and a specimen's `asset.url` is resolved
 *      against the manifest's own directory. The website hardcoded
 *      `/evidence/plant-growth/...`, which breaks the moment the app is served
 *      from anywhere but the server root — a package meant to be unzipped and
 *      run cannot carry that assumption.
 *
 *   2. The types admit the third provenance, `"new"`, and the `validated`
 *      flag. On the website every specimen had passed the published-table
 *      gate by construction; here a reader can add their own plant, and the
 *      difference between "checked against the study" and "nothing has
 *      checked this" must survive the trip into the browser.
 *
 * THREE FIELDS EXIST TO STOP A READER INVENTING A QUANTITY. `units` is
 * `'scan units'` and never `'mm'` — Pheno4D's documentation states no unit.
 * `unit_evidence` carries the circumstantial case for millimetres, recorded as
 * an inference and not applied. `calibration` is an explicit `null` rather
 * than an absent key, because an absent key reads like an oversight and a
 * present `null` reads like a finding.
 */

/** Every length in this manifest and in every `.bin`. Never `'mm'`. */
export type ScanUnits = 'scan units'

/**
 * `'unvalidated'` is what a `provenance: "new"` specimen gets: nobody has
 * judged the fit, which is different from the fit being bad. `'problematic'`
 * is a first-class value, not an omission — T02 ships BECAUSE it is the
 * study's weakest registration.
 */
export type SpecimenQuality = 'featured' | 'clean' | 'problematic' | 'unvalidated'

/**
 * `archive`     — the original study's own arrays.
 * `recomputed`  — re-registered here from raw scans, validated against the
 *                 published table.
 * `new`         — registered by this package's user. No published row exists,
 *                 so nothing has checked the fit.
 */
export type SpecimenProvenance = 'archive' | 'recomputed' | 'new'

/**
 * One named block of a `.bin`, in order. Float32, little-endian, no header.
 *
 * The file is COMPONENT-MAJOR: all `n` source points, then all `n` target
 * points, then all `n` displacements, then all `n` determinants — four
 * contiguous blocks, not `n` interleaved ten-float records. Both layouts have
 * the same byte count, which makes getting it wrong silent: a record-major
 * read returns the right number of points with the wrong numbers in them.
 * `assertLayout` below is what catches it.
 */
export interface BinaryComponent {
  readonly name: 'src' | 'tgt' | 'displacement' | 'detJ'
  readonly components: number
}

export interface SpecimenAsset {
  /** Relative to the manifest's own directory. */
  readonly url: string
  readonly bytes: number
  readonly layout: readonly BinaryComponent[]
  readonly dtype: 'float32'
  readonly endianness: 'little'
  /**
   * `{ warped: 'src + displacement' }`. The registered cloud is not in the
   * file: the exporter defines displacement as `warped - src`, so shipping
   * both would be a second copy of a number that can disagree with the first.
   */
  readonly derived: { readonly warped: string }
}

/**
 * Chamfer distance before and after registration — the only fit measure
 * available. The scans are independent samplings with no shared point
 * identity, so there is no correspondence to score against; this asks the
 * weaker question of whether the two SURFACES ended up in the same place.
 */
export interface SpecimenFit {
  readonly chamfer_before: number
  readonly chamfer_after: number
  readonly chamfer_reduction: number
}

export interface DisplacementStats {
  readonly mean: number
  readonly median: number
  readonly p95: number
  readonly max: number
}

/**
 * det J summarised. The three fractions are counted in separate bands:
 * `frac_non_positive` is points where the map FOLDS — they carry no readable
 * expansion or compression, and a view must not quietly clip them into the
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
 * Extent of BOTH scans — the plant grows between them, so a box around day t
 * alone would crop the growth out of frame at exactly the top.
 *
 * AXES: this is the scanner's frame, in which +z is up and x/y carry the
 * scanner's own large offsets (M05's y lives around −800). Three's world is
 * y-up, so the view rotates the cloud; growth must read on world-y afterwards.
 */
export interface SpecimenBounds {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
  readonly centre: readonly [number, number, number]
  readonly extent: readonly [number, number, number]
  readonly diagonal: number
}

export interface SpecimenRecord {
  readonly id: string
  /** `null` for new specimens whose id does not start with Pheno4D's M/T. */
  readonly species: string | null
  readonly label: string
  readonly quality: SpecimenQuality
  /** A caveat that travels with the specimen, or `null` — which for a new
   *  specimen means "nobody has looked", not "nothing is wrong". */
  readonly note: string | null
  readonly provenance: SpecimenProvenance
  /** True only when every statistic reproduced the published table to 1e-9. */
  readonly validated: boolean
  readonly interval: { readonly from: string | null; readonly to: string | null; readonly days: number }
  readonly asset: SpecimenAsset
  readonly fit: SpecimenFit
  readonly diagnostics: {
    readonly n_points: number
    readonly displacement: DisplacementStats
    readonly detJ: DeformationStats
    readonly bounds: SpecimenBounds
  }
}

export interface GrowthManifest {
  readonly schema: 1
  readonly dataset: string
  readonly reference: string
  readonly method: string
  readonly units: ScanUnits
  readonly unit_evidence: string
  readonly calibration: null
  readonly parameters: Readonly<Record<string, number | boolean>>
  readonly interval_note: string
  /** The four sentences this study is not allowed to drop. Put them on screen. */
  readonly caveats: readonly string[]
  readonly coverage: {
    readonly plants_in_study: number
    readonly plants_with_point_data: number
    readonly new_specimens: number
    readonly note: string
  }
  readonly provenance: Partial<
    Record<SpecimenProvenance, { readonly specimens: readonly string[]; readonly note: string }>
  >
  readonly rigid_prealignment_evidence?: {
    readonly plant: string
    readonly without_rigid: Record<string, number>
    readonly with_rigid: Record<string, number>
    readonly note: string
  }
  readonly specimens: readonly SpecimenRecord[]
}

// BASE_URL-relative, so the viewer works served from any base path, not only
// the server root. `asset.url` entries are then resolved against this
// directory — the manifest never states an absolute path.
const SPECIMENS_DIR = `${import.meta.env.BASE_URL}specimens/`
const MANIFEST_URL = `${SPECIMENS_DIR}manifest.json`

export function assetUrl(specimen: SpecimenRecord): string {
  return SPECIMENS_DIR + specimen.asset.url
}

/**
 * The specimen the viewer opens on when present: the cleanest registration in
 * the study. A fallback to the first entry exists because this package's user
 * can export their own manifest that does not contain M05 — an empty screen
 * over a preference would be absurd. An EXPLICITLY selected id that is missing
 * still fails loudly in `specimenById`.
 */
export const PREFERRED_DEFAULT = 'M05'

export function defaultSpecimenId(manifest: GrowthManifest): string {
  const first = manifest.specimens[0]
  if (!first) throw new Error('the manifest contains no specimens')
  return manifest.specimens.some((s) => s.id === PREFERRED_DEFAULT) ? PREFERRED_DEFAULT : first.id
}

let pending: Promise<GrowthManifest> | null = null

/** Module-level cache; a rejected promise is cleared so a failed load can retry. */
export function loadManifest(): Promise<GrowthManifest> {
  pending ??= fetch(MANIFEST_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`${MANIFEST_URL} responded ${res.status}`)
      return res.json() as Promise<GrowthManifest>
    })
    .catch((err: unknown) => {
      pending = null
      throw err
    })
  return pending
}

/**
 * The specimen's arrays as views onto one buffer — no copy, no decode. Only
 * `warped` is allocated, reconstructed from the identity the manifest states
 * (`src + displacement`), in the one place that knows it is not in the file.
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
 * A component-major file read as record-major yields the right point count
 * and real-looking coordinates, so nothing downstream throws — the plant
 * renders as plausible nonsense. Determinants sit around 1; coordinates in
 * this dataset run to ±900, so checking the block's extremes against the
 * manifest's published min/max separates the two by orders of magnitude.
 * Thrown rather than logged: a view that renders the wrong arrays is worse
 * than a view that renders an error, because only one is noticeable.
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
  const res = await fetch(assetUrl(specimen))
  if (!res.ok) throw new Error(`${assetUrl(specimen)} responded ${res.status}`)
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

  // Walked from `layout` rather than read at hard-coded offsets, so the
  // manifest stays the single statement of what is in the file.
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

/** Lookup that fails loudly — an unknown id is a wiring mistake, and returning
 *  `undefined` would render an empty frame that looks like a load in flight. */
export function specimenById(manifest: GrowthManifest, id: string): SpecimenRecord {
  const found = manifest.specimens.find((s) => s.id === id)
  if (!found) {
    throw new Error(
      `no specimen "${id}" in the manifest — have ${manifest.specimens.map((s) => s.id).join(', ')}`,
    )
  }
  return found
}
