import type { Rect } from './geometry'
import type { SheetTier } from './manifest'
import { trackedFetch } from './manifest'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * WHY A SPRITE ATLAS AND NOT A VIDEO
 * ────────────────────────────────────────────────────────────────────────────
 * The obvious shape for 97 frames of a time-lapse is a `<video>`, and it was
 * rejected on a property of the data rather than on bytes. `currentTime` seeks
 * snap to the nearest keyframe, so the frame on screen is not the frame asked
 * for — and this series has an irregular cadence (17:03 → 23:03 → 06:03 →
 * 12:05) and a contour set registered to one *named* frame. A plate that prints
 * a timestamp next to a photograph has to be able to promise the two belong
 * together, and a video cannot make that promise.
 *
 * 97 separate JPEGs were also measured: 932 KB in 97 requests, which is *more*
 * bytes than the single atlas and ninety-six more round trips.
 *
 * So: one 10×10 sheet of 292×287 tiles, 2920×2870, q78, 779 KB, one request.
 * All 97 frames are kept — the 6 h cadence *is* the observation, and dropping
 * every other frame to save bytes erases the diurnal movement the plate exists
 * to show.
 */

export type Decoded = ImageBitmap | HTMLImageElement

/**
 * Module-level and keyed by URL. Six plates mount at once under the sticky
 * stage and the `ExpandedView` copy of a plate mounts a second instance of the
 * same component — without this the 779 KB sheet is fetched and decoded once
 * per mount instead of once per page.
 */
const sheetCache = new Map<string, Promise<Decoded>>()

/**
 * Decodes off the main thread where the browser has `createImageBitmap`, which
 * is the whole reason the blob is fetched by hand rather than handed to an
 * `<img>`: a 2920×2870 JPEG decoded on the main thread is a visible stall on
 * the scroll, and the scroll is the page.
 *
 * The `<img>` path is a real fallback rather than a formality — it is what
 * Safari before 15 takes, and it produces the same pixels a frame or two later.
 */
export function loadSheet(url: string): Promise<Decoded> {
  const hit = sheetCache.get(url)
  if (hit) return hit

  const job: Promise<Decoded> =
    typeof createImageBitmap === 'function'
      ? trackedFetch(url)
          .then((r) => r.blob())
          .then((b) => createImageBitmap(b))
      : new Promise<Decoded>((resolve, reject) => {
          const img = new Image()
          img.decoding = 'async'
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`${url} failed to decode`))
          img.src = url
        })

  // Not cached on failure: a sheet that lost a race with a flaky connection
  // should be retryable, and a rejected promise sitting in the map makes every
  // later mount fail for a reason that has already gone away.
  job.catch(() => sheetCache.delete(url))
  sheetCache.set(url, job)
  return job
}

export function loadTier(tier: SheetTier): Promise<Decoded[]> {
  return Promise.all(tier.urls.map(loadSheet))
}

/**
 * Picks the tile size to download.
 *
 * Today the exporter ships one tier and this returns it — which is the honest
 * state of the thing, not a stub. The two-tier plan (a 573 KB `compact` sheet
 * for coarse pointers) was costed and then not built, because the single
 * `full` sheet already lands inside the page's asset budget and a second
 * encode of the same 97 frames is 573 KB spent to avoid an upscale nobody had
 * complained about. The selection logic is here so that adding the tier later
 * is a change to the exporter alone.
 */
export function pickTier(tiers: readonly SheetTier[]): SheetTier {
  const first = tiers[0]
  if (!first) throw new Error('leaf-dynamics manifest ships no sheet tier')
  if (tiers.length === 1) return first

  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const small = typeof innerWidth === 'number' && innerWidth < 900
  return (coarse || small ? tiers.find((t) => t.tier === 'compact') : tiers.find((t) => t.tier === 'full')) ?? first
}

/**
 * Blits one frame of the atlas into `dest`.
 *
 * `index` is the frame number and also its position in row-major order on the
 * sheet, which is a contract the exporter holds up and this relies on: frame
 * `i` is at `(i % cols, floor(i / cols))` of sheet `floor(i / (cols * rows))`.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheets: readonly Decoded[],
  tier: SheetTier,
  index: number,
  dest: Rect,
): void {
  const perSheet = tier.cols * tier.rows
  const sheet = sheets[Math.floor(index / perSheet)]
  if (!sheet) return
  const local = index % perSheet
  ctx.drawImage(
    sheet,
    (local % tier.cols) * tier.tile.w,
    Math.floor(local / tier.cols) * tier.tile.h,
    tier.tile.w,
    tier.tile.h,
    dest.x,
    dest.y,
    dest.w,
    dest.h,
  )
}
