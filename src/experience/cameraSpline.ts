import { clamp01, invLerp } from './easing'
import type { Breakpoint, CameraKeyframe, CameraState, Vec3 } from './types'

/**
 * The camera is NOT an animation. It is a sampled curve — a pure function of
 * experienceProgress, exactly like every other value in the scene.
 *
 * This is deliberate. In most scroll-driven sites the camera is the one thing
 * that ends up on its own tween system, and that is precisely where competing
 * animations start. Keeping it here means it cannot desynchronise.
 *
 * Movement is intentionally restrained: sub-unit drift and a slow dolly. The
 * subject should feel observed, not flown around.
 *
 * Interpolation is Catmull-Rom, NOT eased-linear-per-segment. An ease with zero
 * derivative at its endpoints (easeInOutCubic and friends) makes the camera
 * decelerate to a dead stop at every keyframe and then accelerate away again —
 * it reads as stutter. Catmull-Rom is C1-continuous, so velocity stays smooth
 * across segment boundaries and simply tracks the scroll.
 */

/**
 * ────────────────────────────────────────────────────────────────────────────
 * FRAMING
 * ────────────────────────────────────────────────────────────────────────────
 * The subject is authored to a fixed 3.2 scene units tall and centred on the
 * origin; measured world bounds are ±1.447 x, ±1.600 y, ±1.336 z (the point
 * cloud is marginally wider than the mesh, so it is the binding case).
 *
 * That z extent is the trap. The near corners sit 1.336 closer to the lens than
 * the centre does, so the naive `height / 2·tan(fov/2)` working distance
 * under-shoots badly. Every distance here was solved against the projected
 * corners of that box, not against its height — see verify-framing.mjs, which
 * samples the spline at 1000 points and asserts |ndc| stays inside the frame
 * with margin on five viewports.
 *
 * Composition target: the specimen reaches roughly 0.63–0.78 of the half-frame.
 * It is a specimen on a plate, not a hero product shot — the air around it is
 * doing work, and the phenotype pass at the end draws hull and annotation
 * outside the silhouette, so the last frame is deliberately the widest.
 *
 * The gesture is one move, not a tour: descend and draw in through the
 * reconstruction, then rise and step back for the finished body. Lateral drift
 * is a single uninterrupted sweep across the whole page — roughly 10° of arc —
 * which reads as parallax rather than an orbit.
 */
const DESKTOP_KEYFRAMES: readonly CameraKeyframe[] = [
  // Hero. Furthest back: the display type is the subject here, the specimen is
  // a presence behind it.
  { at: 0.0, position: [0.55, 0.42, 8.55], target: [0, 0.05, 0] },
  { at: 0.25, position: [0.28, 0.22, 7.7], target: [0, 0.02, 0] },
  // Closest framing of the journey, and the lowest — level with the specimen
  // while individual samples are snapping onto vertices.
  { at: 0.5, position: [-0.02, -0.04, 7.3], target: [0, -0.02, 0] },
  { at: 0.75, position: [-0.34, 0.14, 7.85], target: [0, 0.01, 0] },
  // Widest. The plant is finished and about to be measured; the annotations
  // need room outside the silhouette.
  { at: 1.0, position: [-0.62, 0.34, 8.7], target: [0, 0.04, 0] },
]

/**
 * Mobile is width-constrained, not height-constrained: at 375×812 the subject's
 * width binds long before its height does. Fitting a near-cubic subject into a
 * 0.46 aspect frame at the desktop's 38° would put the camera ~14 units out,
 * which flattens the perspective to almost orthographic and destroys the depth
 * cue the point cloud depends on. So mobile widens the lens instead (see
 * CAMERA_FOV) and stays at a comparable working distance.
 *
 * The consequence is vertical air above and below the specimen. That is correct
 * rather than unfortunate — it is where the stacked typography sits, and a
 * scientific piece must not crop the organism it claims to measure.
 *
 * Lateral drift is scaled down: on a narrow frame the same world-space offset
 * is a much larger fraction of the visible width.
 */
const MOBILE_KEYFRAMES: readonly CameraKeyframe[] = [
  { at: 0.0, position: [0.22, 0.3, 10.05], target: [0, 0.06, 0] },
  { at: 0.25, position: [0.11, 0.16, 9.45], target: [0, 0.03, 0] },
  { at: 0.5, position: [-0.01, -0.02, 9.15], target: [0, 0.0, 0] },
  { at: 0.75, position: [-0.14, 0.1, 9.55], target: [0, 0.02, 0] },
  { at: 1.0, position: [-0.26, 0.24, 10.2], target: [0, 0.05, 0] },
]

/**
 * Vertical field of view per breakpoint. Owned here rather than at the Canvas
 * because it is inseparable from the keyframe distances above — changing one
 * without the other re-crops the subject.
 */
export const CAMERA_FOV: Record<Breakpoint, number> = {
  desktop: 38,
  mobile: 52,
}

const KEYFRAMES: Record<Breakpoint, readonly CameraKeyframe[]> = {
  desktop: DESKTOP_KEYFRAMES,
  mobile: MOBILE_KEYFRAMES,
}

/** Uniform Catmull-Rom through p1→p2, with p0/p3 as tangent context. */
const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

const at = (keys: readonly CameraKeyframe[], i: number): CameraKeyframe =>
  keys[Math.max(0, Math.min(keys.length - 1, i))]!

const sampleChannel = (
  keys: readonly CameraKeyframe[],
  i: number,
  local: number,
  channel: 'position' | 'target',
  axis: 0 | 1 | 2,
): number => {
  const c = (k: CameraKeyframe): number => (k[channel] as Vec3)[axis]!
  return catmullRom(c(at(keys, i - 1)), c(at(keys, i)), c(at(keys, i + 1)), c(at(keys, i + 2)), local)
}

/**
 * Writes into `out` rather than allocating. Called every frame — a fresh object
 * here would be dozens of short-lived allocations per second, and GC pauses
 * read to the user as scroll stutter.
 */
export function sampleCameraSpline(p: number, breakpoint: Breakpoint, out: CameraState): void {
  const keys = KEYFRAMES[breakpoint]
  const t = clamp01(p)

  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1]!.at) i++

  // Linear local parameter: velocity should track scroll, not be re-shaped here.
  const local = clamp01(invLerp(keys[i]!.at, keys[i + 1]!.at, t))

  out.position[0] = sampleChannel(keys, i, local, 'position', 0)
  out.position[1] = sampleChannel(keys, i, local, 'position', 1)
  out.position[2] = sampleChannel(keys, i, local, 'position', 2)

  out.target[0] = sampleChannel(keys, i, local, 'target', 0)
  out.target[1] = sampleChannel(keys, i, local, 'target', 1)
  out.target[2] = sampleChannel(keys, i, local, 'target', 2)
}

const clone = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]]

export const createCameraState = (): CameraState => ({
  position: clone(DESKTOP_KEYFRAMES[0]!.position),
  target: clone(DESKTOP_KEYFRAMES[0]!.target),
})
