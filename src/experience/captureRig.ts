/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE RIG'S GEOMETRY OF TIME
 * ────────────────────────────────────────────────────────────────────────────
 * One number — the traverse, 0 → 1 — has to mean the same thing in four
 * places: the orbit path, the marked viewpoints, the sensor's pose, and which
 * side of the specimen is lit. This module is that agreement, and it exists
 * only because I got it wrong first: the mapping was written out twice (once in
 * the rig component, once inverted inside a GLSL shader) and the two disagreed
 * by a quarter turn. The result was a lit patch trailing the sensor by 90°,
 * which looks exactly like a lighting bug and not at all like a sign error.
 *
 * Pure, importing neither React nor three, so the convention can be asserted
 * in plain Node rather than by looking at pixels.
 */

/**
 * Where the traverse begins, as an azimuth offset.
 *
 * +π/2 puts traverse 0 at screen-left (x = -1, z = 0) and makes the traverse
 * sweep across the *near* face first: left at t = 0, dead front at t = 0.25,
 * screen-right at 0.5, behind at 0.75. Both alternatives are worse for the same
 * reason from opposite directions. Offset 0 starts the sensor at z = -R, dead
 * behind the specimen, so the object whose whole job is to establish "this is
 * being measured" is occluded while it does it. Starting at the front parks the
 * apparatus between the reader and the subject on the very first frame.
 *
 * The sign is worth stating explicitly because it is not guessable: the camera
 * sits at +Z looking toward the origin, so world +X is screen-RIGHT. -π/2 —
 * which is what I wrote first — therefore starts the rig on the right and sends
 * it round the back, covering the near face last, in the half of the traverse
 * where the point cloud has already resolved and the rig has faded out. The
 * whole pass happened where it could not be seen.
 */
export const RIG_PHASE = Math.PI / 2

/** Traverse (0 → 1) → azimuth in radians, with `x = sin`, `z = cos`. */
export const traverseToAzimuth = (t: number): number => (t - 0.5) * Math.PI * 2 + RIG_PHASE

/**
 * The sensor's direction from the specimen centre, as a unit (x, z).
 *
 * This is the form the point cloud shader wants. Handing the shader a direction
 * rather than an angle means the shader never re-derives the convention — it
 * just asks "is this sample on the side the sensor is on?" via a dot product,
 * which cannot be a quarter turn out.
 */
export const sensorDirection = (t: number, out: { x: number; z: number }): void => {
  const a = traverseToAzimuth(t)
  out.x = Math.sin(a)
  out.z = Math.cos(a)
}

/**
 * Inverse: at what traverse value does the sensor pass this position's azimuth?
 *
 * Wrapped into [0, 1) so it is directly comparable with the traverse. Height is
 * irrelevant — the rig orbits, so a sample's capture time depends only on where
 * it sits in plan view.
 */
export const traverseAtPosition = (x: number, z: number): number => {
  const t = (Math.atan2(x, z) - RIG_PHASE) / (Math.PI * 2) + 0.5
  return t - Math.floor(t)
}
