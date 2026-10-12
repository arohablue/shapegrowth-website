import { DefaultLoadingManager } from 'three'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE PYTHON ↔ TYPESCRIPT BOUNDARY
 * ────────────────────────────────────────────────────────────────────────────
 * `scripts/build-leaf-dynamics-plates.py` writes `leaf-dynamics.json`; this file
 * is the only place that is allowed to describe its shape. Everything the two
 * interactive plates know about the specimen arrives through here.
 *
 * Two fields exist purely to stop a reader — or a later caller — inventing a
 * physical quantity. `units` is stated rather than assumed, and `calibration` is
 * an explicit `null` rather than an absent key, because the dataset has no
 * mm/px scale and an absent key reads like an oversight while a present `null`
 * reads like a finding. Every length on these plates is pixels.
 *
 * `FrameRecord.file` is provenance and is never fetched. The frames ship as one
 * sprite atlas; the original filename is carried so that a timestamp on screen
 * can be traced back to a file in the 5.2 GB archive that does not ship.
 */

export interface FrameRecord {
  readonly i: number
  /** Original PNG name. Provenance only — nothing fetches this. */
  readonly file: string
  /** Dataset clock, no zone suffix: `'2022-08-09T17:00:00'`. */
  readonly t: string
  readonly epoch: number
  /** Precomputed, because the cadence is nominally 6 h and actually irregular. */
  readonly hoursFromStart: number
}

export interface SheetTier {
  readonly tier: string
  readonly tile: { readonly w: number; readonly h: number }
  readonly cols: number
  readonly rows: number
  readonly urls: readonly string[]
  readonly bytes: number
}

export interface LeafRecord {
  /** `Leaf number` from `leaves_unique_colours.xlsx`. */
  readonly id: number
  readonly tag: string
  /** The palette RGB. The single source of identity colour, shared with Python. */
  readonly color: readonly [number, number, number]
  readonly firstFrame: number
  readonly lastFrame: number
  /**
   * Below `lastFrame - firstFrame + 1` means the instance has holes in it —
   * leaf 1 does. Shipped so the UI can show the gap instead of implying
   * continuity it does not have.
   */
  readonly framesPresent: number
}

export interface LeafContour {
  readonly leaf: number
  readonly frame: number
  /**
   * Flat `[x0,y0,x1,y1,…]`, integers, CROP pixels — measured from the top-left
   * of `LeafDynamicsManifest.crop`, which is what the atlas tiles show. Ring
   * closed by the writer. `bbox` and `centroid` are in the same frame.
   */
  readonly points: readonly number[]
  readonly bbox: readonly [number, number, number, number]
  readonly centroid: readonly [number, number]
  readonly areaPx2: number
  readonly perimeterPx: number
}

export interface SegmentPlate {
  readonly frame: number
  /** The `LeafRecord.id` the plate opens on. */
  readonly focus: number
  readonly contours: readonly LeafContour[]
}

export interface LeafDynamicsManifest {
  readonly schema: 1
  readonly dataset: string
  readonly specimen: string
  readonly units: 'px'
  readonly calibration: null
  readonly source: { readonly w: number; readonly h: number }
  /** `x, y, w, h` of the rosette crop every atlas tile was cut to. */
  readonly crop: readonly [number, number, number, number]
  readonly poster: string
  readonly frames: readonly FrameRecord[]
  readonly tiers: readonly SheetTier[]
  readonly leaves: readonly LeafRecord[]
  readonly segment: SegmentPlate
}

const MANIFEST_URL = '/evidence/leaf-dynamics/leaf-dynamics.json'

/**
 * Frame 0, cropped, ~9 KB. Named here as well as in the manifest because it is
 * what both plates fall back to when the manifest itself is the thing that
 * failed — a fallback that has to load its own description first is not one.
 */
export const POSTER_URL = '/evidence/leaf-dynamics/observe-poster.jpg'

/**
 * `fetch`, announced to three's `DefaultLoadingManager`.
 *
 * drei's `useProgress` reads that manager, and `AssetLoadingIndicator` already
 * reads `useProgress` — so bracketing the request is the whole of "the page's
 * existing loading line also covers the atlas and the JSON". The alternative
 * was a second progress mechanism for two files, visually identical to the one
 * already on screen and guaranteed to disagree with it at some point.
 *
 * `three` is already a resolved chunk for the point cloud and Vite dedupes it,
 * so this costs no bytes.
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
 * Module-level, so the two plates — and the `ExpandedView` copy of either —
 * share one request. Six plates mount simultaneously under the sticky stage;
 * without this the manifest would be fetched once per mount.
 */
let pending: Promise<LeafDynamicsManifest> | null = null

export function loadManifest(): Promise<LeafDynamicsManifest> {
  pending ??= trackedFetch(MANIFEST_URL).then((r) => r.json() as Promise<LeafDynamicsManifest>)
  return pending
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * `'2022-08-09T17:00:00'` → `'09 Aug 2022 · 17:00'`.
 *
 * Sliced rather than parsed through `Date`. The stamp is the dataset's own wall
 * clock with no zone on it, so handing it to `Date` makes the reader's timezone
 * part of the answer and a plate in Sydney would caption the same photograph
 * with a different hour than the same plate in Berlin.
 */
export function formatStamp(t: string): string {
  const month = MONTHS[Number(t.slice(5, 7)) - 1] ?? t.slice(5, 7)
  return `${t.slice(8, 10)} ${month} ${t.slice(0, 4)} \u00b7 ${t.slice(11, 16)}`
}

/**
 * `'09 Aug · 17:00'` — the rail is narrower than the readout at 375px.
 *
 * Non-breaking between the day and the month, so the only place this is allowed
 * to wrap is at the separator. Same reasoning as `formatElapsed`: it is rewritten
 * on every scrubbed frame, and a rail that changes height mid-drag moves the
 * image.
 */
export function formatStampShort(t: string): string {
  const month = MONTHS[Number(t.slice(5, 7)) - 1] ?? t.slice(5, 7)
  return `${t.slice(8, 10)}\u00a0${month} \u00b7 ${t.slice(11, 16)}`
}

/**
 * Elapsed time as the reader would say it: `'0 h'`, `'18 h'`, `'4 d 6 h'`.
 *
 * The spaces inside are non-breaking. The rail this lands in is about 150px of
 * content width, and an ordinary space lets the line break between a number and
 * its unit — leaving `h` alone on a second line, and, worse, changing the rail's
 * height on a readout that is rewritten on every scrubbed frame. `measurePlate`
 * reads that height, so a stray wrap re-fits the image mid-drag.
 */
export function formatElapsed(hours: number): string {
  const whole = Math.round(hours)
  if (whole < 48) return `${whole}\u00a0h`
  return `${Math.floor(whole / 24)}\u00a0d\u00a0${whole % 24}\u00a0h`
}
