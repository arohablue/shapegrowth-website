/**
 * Colour mappings for the two quantitative modes, kept out of the components
 * so the canvas and the sidebar legend read from ONE computation — a legend
 * drawn from a second copy of the scale is a legend that can lie.
 *
 * Both scales follow `pipeline/plots.py` deliberately, so the browser view and
 * the diagnostic PNG of the same specimen are comparable by eye:
 *
 *   displacement — turbo over [min, max] of |displacement|.
 *   det J        — log scale centred on 1, clipped to [1/v, v] with
 *                  v = clip(p90 of max(d, 1/d), 1.5, 4). Expansion by 2x and
 *                  compression to 1/2 sit the same distance from the middle;
 *                  a linear scale would show compression as a narrow band
 *                  beside a wide expansion range.
 *
 * Non-positive det J is NOT on the scale. The map folds there, the local
 * transformation is not invertible, and no expansion or compression can be
 * read off it — so those points get a colour that is on neither end of the
 * ramp instead of being clipped into "strong compression".
 */

export const FOLD_COLOR: readonly [number, number, number] = [1.0, 0.1, 0.85]

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Google's polynomial approximation of the turbo colormap. */
export function turbo(t: number): [number, number, number] {
  const x = clamp01(t)
  return [
    clamp01(0.13572138 + x * (4.6153926 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))))),
    clamp01(0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))))),
    clamp01(0.1066733 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))))),
  ]
}

/** Three-stop approximation of matplotlib's coolwarm. t = 0.5 is the neutral middle. */
export function coolwarm(t: number): [number, number, number] {
  const x = clamp01(t)
  const blue: readonly number[] = [0.23, 0.299, 0.754]
  const mid: readonly number[] = [0.865, 0.865, 0.865]
  const red: readonly number[] = [0.706, 0.016, 0.15]
  const [a, b, s] = x < 0.5 ? [blue, mid, x * 2] : [mid, red, (x - 0.5) * 2]
  return [a[0]! + (b[0]! - a[0]!) * s, a[1]! + (b[1]! - a[1]!) * s, a[2]! + (b[2]! - a[2]!) * s]
}

export interface DisplacementColoring {
  /** (2n*3) positions: base, tip, base, tip … one segment per point. */
  readonly linePositions: Float32Array
  /** (2n*3) colours: dim at the base, full at the tip, like the exported PLY. */
  readonly lineColors: Float32Array
  readonly min: number
  readonly max: number
}

/**
 * |displacement| → turbo, plus the line segments of the field itself.
 * Each segment is the TRUE vector: base at the source point, tip at
 * source + displacement, which is by definition a point of the warped cloud.
 * Nothing is scaled for legibility — a legible exaggeration is a wrong number.
 */
export function displacementColoring(src: Float32Array, displacement: Float32Array): DisplacementColoring {
  const n = src.length / 3
  const mag = new Float32Array(n)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < n; i++) {
    const dx = displacement[3 * i]!
    const dy = displacement[3 * i + 1]!
    const dz = displacement[3 * i + 2]!
    const m = Math.sqrt(dx * dx + dy * dy + dz * dz)
    mag[i] = m
    if (m < min) min = m
    if (m > max) max = m
  }
  const span = max - min || 1

  const linePositions = new Float32Array(n * 6)
  const lineColors = new Float32Array(n * 6)
  for (let i = 0; i < n; i++) {
    const [r, g, b] = turbo((mag[i]! - min) / span)
    for (let k = 0; k < 3; k++) {
      linePositions[6 * i + k] = src[3 * i + k]!
      linePositions[6 * i + 3 + k] = src[3 * i + k]! + displacement[3 * i + k]!
    }
    lineColors[6 * i] = r * 0.35
    lineColors[6 * i + 1] = g * 0.35
    lineColors[6 * i + 2] = b * 0.35
    lineColors[6 * i + 3] = r
    lineColors[6 * i + 4] = g
    lineColors[6 * i + 5] = b
  }
  return { linePositions, lineColors, min, max }
}

export interface DetJColoring {
  readonly point: Float32Array
  /** Colour range is [1/v, v] on a log scale. */
  readonly v: number
  readonly nFold: number
}

export function detJColoring(detJ: Float32Array): DetJColoring {
  const n = detJ.length
  // v = clip(p90 of max(d, 1/d) over positive points, 1.5, 4) — plots.py's rule.
  const ratio: number[] = []
  for (let i = 0; i < n; i++) {
    const d = detJ[i]!
    if (d > 0) ratio.push(Math.max(d, 1 / d))
  }
  ratio.sort((a, b) => a - b)
  const p90 = ratio.length ? ratio[Math.min(ratio.length - 1, Math.floor(0.9 * ratio.length))]! : 1.5
  const v = Math.min(4, Math.max(1.5, p90))
  const logV = Math.log(v)

  const point = new Float32Array(n * 3)
  let nFold = 0
  for (let i = 0; i < n; i++) {
    const d = detJ[i]!
    let r: number, g: number, b: number
    if (d <= 0) {
      nFold++
      ;[r, g, b] = FOLD_COLOR
    } else {
      // log(d) in [-logV, logV] → [0, 1], 1.0 (no volume change) at the middle.
      ;[r, g, b] = coolwarm(clamp01(Math.log(d) / (2 * logV) + 0.5))
    }
    point[3 * i] = r
    point[3 * i + 1] = g
    point[3 * i + 2] = b
  }
  return { point, v, nFold }
}

/** CSS gradient stops for the sidebar legends, from the same functions. */
export function cssGradient(map: (t: number) => [number, number, number], stops = 9): string {
  const parts: string[] = []
  for (let i = 0; i < stops; i++) {
    const t = i / (stops - 1)
    const [r, g, b] = map(t)
    parts.push(`rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${Math.round(t * 100)}%`)
  }
  return `linear-gradient(to right, ${parts.join(', ')})`
}
