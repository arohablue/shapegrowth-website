/**
 * Pure easing functions. `(t: 0..1) => 0..1`.
 * No dependencies. Safe to unit-test in Node.
 */

export type EasingFn = (t: number) => number
export type EasingName = keyof typeof EASINGS

export const linear: EasingFn = (t) => t

export const easeOutCubic: EasingFn = (t) => 1 - Math.pow(1 - t, 3)

export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutExpo: EasingFn = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

export const easeInOutQuint: EasingFn = (t) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

export const EASINGS = {
  linear,
  easeOutCubic,
  easeInOutCubic,
  easeOutExpo,
  easeInOutQuint,
} as const

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Where does `v` sit between `a` and `b`, as 0..1? Guards against a === b. */
export const invLerp = (a: number, b: number, v: number): number => {
  const span = b - a
  return span === 0 ? 0 : (v - a) / span
}

/** Hermite smoothstep. Returns 0 below `edge0`, 1 above `edge1`. */
export const smoothstep = (edge0: number, edge1: number, v: number): number => {
  const t = clamp01(invLerp(edge0, edge1, v))
  return t * t * (3 - 2 * t)
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * A fixed-alpha lerp (`current += (target - current) * 0.1`) converges at a
 * different real-world rate on a 120Hz display than on a 60Hz one, which makes
 * the whole site feel materially different between machines. This form does not.
 *
 * @param lambda higher = snappier. ~6 is loose, ~14 is tight.
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))
