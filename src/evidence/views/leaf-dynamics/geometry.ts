/**
 * Pure geometry for the two leaf-dynamics plates. No React, no DOM lookups, no
 * module state — everything here is a function of its arguments, which is what
 * makes it the part that can be reasoned about without a browser.
 *
 * ONE COORDINATE RULE, STATED ONCE
 * ────────────────────────────────
 * Contours in the manifest are in CROP pixels — measured from the top-left of
 * the rosette crop the atlas tiles were cut to, not from the top-left of the
 * full 450×432 frame the dataset published. The exporter does the subtraction
 * once, in Python, and says why: the browser never sees an uncropped frame, so
 * a contour carrying an offset it must remember to apply is a contour that will
 * one day be drawn without it.
 *
 * This file previously subtracted the crop origin a *second* time, on the
 * strength of a comment here claiming source pixels. Every outline landed about
 * (111, 101) up and left of its leaf — and because the shapes were still leaf-
 * shaped and still arranged like a rosette, it read as a plausible plant rather
 * than as an error. That is the failure mode worth naming: a wrong transform on
 * biological outlines does not look wrong.
 *
 * So the only transform left is scale-and-place, it lives in exactly two
 * functions, `project` and `unproject`, and nothing else does the arithmetic.
 */

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** `x, y, w, h` of the crop every atlas tile was cut to, in source pixels. */
export type Crop = readonly [number, number, number, number]

/**
 * The largest centred rectangle of ratio `srcW/srcH` that fits in `boxW×boxH`.
 *
 * `contain`, matching `.evidence__media`'s `object-fit` — and for the same
 * reason the stylesheet gives there. Cropping a specimen to fill a box removes
 * leaf margin from the edge of the rosette, and removes it invisibly.
 */
export function fitRect(boxW: number, boxH: number, srcW: number, srcH: number): Rect {
  const scale = Math.min(boxW / srcW, boxH / srcH)
  const w = srcW * scale
  const h = srcH * scale
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h }
}

/** Crop pixel → canvas pixel. `crop` is read for its width, which sets scale. */
export function project(rect: Rect, crop: Crop, x: number, y: number): [number, number] {
  const s = rect.w / crop[2]
  return [rect.x + x * s, rect.y + y * s]
}

/** Canvas pixel → crop pixel. The inverse of `project`, for hit-testing. */
export function unproject(rect: Rect, crop: Crop, px: number, py: number): [number, number] {
  const s = rect.w / crop[2]
  return [(px - rect.x) / s, (py - rect.y) / s]
}

/**
 * Crossing-number test against a flat `[x0,y0,x1,y1,…]` ring in crop pixels.
 *
 * Tolerant of a ring whose last vertex repeats its first — the exporter writes
 * one, and a test that assumed otherwise would silently skip the closing edge.
 */
export function pointInPolygon(points: readonly number[], x: number, y: number): boolean {
  let inside = false
  const n = points.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2]!
    const yi = points[i * 2 + 1]!
    const xj = points[j * 2]!
    const yj = points[j * 2 + 1]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Quick reject before the crossing test. `bbox` is `x, y, w, h`. */
export function inBbox(bbox: readonly [number, number, number, number], x: number, y: number): boolean {
  return x >= bbox[0] && y >= bbox[1] && x <= bbox[0] + bbox[2] && y <= bbox[1] + bbox[3]
}

/** Lays a ring onto the 2D context as a closed path. Does not stroke or fill. */
export function tracePath(
  ctx: CanvasRenderingContext2D,
  points: readonly number[],
  rect: Rect,
  crop: Crop,
): void {
  ctx.beginPath()
  for (let i = 0; i < points.length; i += 2) {
    const [px, py] = project(rect, crop, points[i]!, points[i + 1]!)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export function rgba(color: readonly [number, number, number], alpha: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}
