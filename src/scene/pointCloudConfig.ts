import type { DepthMode, PointShape } from '@/assets/manifest'

/**
 * Every knob the point cloud exposes, in one place.
 *
 * Split deliberately from the asset manifest: the manifest says *what and where*
 * (a file, its units, its orientation), this says *how it looks*. A scan can be
 * swapped without touching these, and these can be tuned without touching the
 * scan.
 *
 * `shape` and `sizeAttenuation` compile into the shader as `#define`s rather
 * than branching per-fragment — changing them rebuilds the program, so they are
 * configuration, not animation. Everything else is a live uniform.
 */
export interface PointCloudConfig {
  /** Diameter in CSS pixels at one world-unit from the camera. */
  size: number
  /** Multiplies the whole cloud. 0 → invisible, 1 → as authored. */
  opacity: number
  /** When false, points are a constant pixel size regardless of distance. */
  sizeAttenuation: boolean
  /** Linear gain on the emitted colour. >1 pushes into bloom-adjacent territory. */
  brightness: number
  shape: PointShape
  /**
   * `additive` blends light-on-light with no depth writes — right for a luminous
   * scan, wrong for anything that has to occlude. `sorted` writes depth and uses
   * alpha blending, so the cloud can sit correctly against the mesh.
   */
  depthMode: DepthMode
  /** Points closer than this are at full alpha. */
  depthFadeNear: number
  /** Points beyond this fade out entirely. Gives the cloud volume. */
  depthFadeFar: number
  /**
   * 0 → every point equally bright, 1 → full per-point random variation.
   *
   * This is a depth cue, not a decoration. Enough of it and a flatly-lit scan
   * stops reading as sandpaper; too much and it reads as glitter, which is the
   * single fastest way to make a scientific instrument look like a screensaver.
   */
  sparkle: number
  /** Clamp so a close point can never become a screen-filling quad. */
  maxPixelSize: number

  // ── Transformation knobs ──────────────────────────────────────────────────
  /** Pixel size a sample shrinks to once it is reading as a vertex. */
  vertexSize: number
  /** Peak coherent drift amplitude, in world units. Above ~0.04 the cloud boils. */
  driftAmount: number
  /**
   * How far outside its true position an unmeasured sample sits, as a fraction
   * of its distance from the model origin. Radial and therefore coherent — the
   * cloud contracts onto itself as it resolves.
   */
  dispersion: number
}

/**
 * Sizes and fade distances below are calibrated to the camera's working range,
 * which the framing pass moved from ~5.8 out to ~7.5–10.2 world units (see
 * `experience/cameraSpline.ts`). Both are distance-coupled and both were silently
 * wrong after that move: with `sizeAttenuation` on, pushing the camera back 1.4×
 * shrinks every point by the same factor, and a fade calibrated to near 3.5 /
 * far 12 put the whole specimen deep into the falloff, dimming the cloud by
 * roughly a quarter for no reason anyone authored.
 *
 * If the camera distances change again, these change with them.
 */
export const DEFAULT_POINT_CLOUD_CONFIG: PointCloudConfig = {
  size: 18,
  opacity: 1,
  sizeAttenuation: true,
  brightness: 1,
  shape: 'soft',
  depthMode: 'additive',
  depthFadeNear: 6,
  depthFadeFar: 13.5,
  // Was 0.62 — alpha swinging 0.38→1.0 and size 0.55→1.0 per point. That is
  // glitter. 0.3 keeps the surface from flattening while letting the cloud read
  // as one measured body.
  sparkle: 0.3,
  maxPixelSize: 24,
  // Vertices must stay visibly smaller than scan returns — that size drop is
  // most of what sells "this is now a vertex". But `size` 18 at the working
  // distance lands at ~2.5 CSS px, so the old ratio put vertices at ~1.2 px:
  // below the point where a dot is a dot, and small enough to scintillate as
  // the camera moves. 11 keeps the contrast while clearing that floor.
  vertexSize: 11,
  driftAmount: 0.02,
  dispersion: 0.09,
}

/** Per-tier overrides. Weak GPUs get fewer, slightly larger points. */
export const TIER_POINT_CLOUD_OVERRIDES: Record<'low' | 'medium' | 'high', Partial<PointCloudConfig>> =
  {
    low: { size: 15, maxPixelSize: 16, vertexSize: 9 },
    medium: { size: 16.5, maxPixelSize: 20, vertexSize: 10 },
    high: { size: 18, maxPixelSize: 24, vertexSize: 11 },
  }

/**
 * The capture rig — the instrument, not the specimen.
 *
 * Everything here is sized against the measured specimen bounds (±1.447 x,
 * ±1.600 y, ±1.336 z) and the camera's working distance of 7.3–8.7 units.
 *
 * The orbit radius is squeezed from both sides, which is why it is not a round
 * number.
 *
 * Below, it has to clear the plant in plan view: the *measured* plan radius over
 * all 240k samples is 1.71, and 1.45 in the horizontal slab the orbit itself
 * occupies. (The bbox corner, `hypot(1.447, 1.336)` ≈ 1.97, is the figure I
 * sized against first and it is an overestimate — it assumes a sample sitting
 * exactly at the corner of the box, and none does.)
 *
 * Above, the ring has to stay inside the frame, and the binding constraint is
 * MOBILE, not desktop. That is the non-obvious part: mobile uses a wider fov
 * (52 vs 38) and pulls the camera back, which one would expect to give more
 * headroom, but the viewport is far narrower in aspect (0.46 vs 0.93) and the
 * orbit's extremes are horizontal. Measured worst-case |ndc.x| over the beat:
 *
 *   R      desktop   mobile
 *   2.45     1.063      —      clipped
 *   2.15     0.921    1.044    clipped on mobile only
 *   1.90       —      0.917    fits both
 *
 * Anything clipped has its extremes sliced off by the viewport edge for the
 * middle third of the beat, which reads as a broken ellipse rather than as a
 * circular path — the one thing the trajectory has to communicate. 1.90 fits
 * both breakpoints with margin, which is why this is a single number rather
 * than a responsive one: a per-breakpoint radius would be a config layer
 * earning nothing.
 */
export interface CaptureConfig {
  /**
   * Orbit radius in world units. Bounded below by the specimen's 1.71 measured
   * plan radius and above by the viewport edge — see the note above.
   */
  orbitRadius: number
  /** Height of the orbit plane, in world units from the specimen's centre. */
  orbitHeight: number
  /** Planned viewpoints marked on the trajectory. */
  stations: number
  /** Alpha of the orbit path at its faintest, before the rig has passed. */
  ringOpacity: number
  /** Alpha of the viewpoint frustum. */
  frustumOpacity: number
  /** How far the frustum's rays reach toward the specimen, as a fraction of the radius. */
  frustumReach: number
  /** Pixel size of a marked viewpoint. */
  stationSize: number
  /** How many sparse tie points are sampled out of the scan. */
  tiePointCount: number
  /** Pixel size of a tie point at one world unit. */
  tiePointSize: number
}

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  orbitRadius: 1.9,
  // Down at the specimen's base (its bounds are ±1.6 in y), not just below its
  // centre — and this is a projection constraint masquerading as a taste
  // decision, so it is worth being explicit about.
  //
  // The camera sits at y ≈ 0.2–0.4 looking at the origin, which is almost
  // exactly in the plane of a centred orbit. A circle viewed edge-on projects
  // to a line: at -0.35 the ring measures 675 x 62 px, a minor/major ratio of
  // 0.09, so the "trajectory" the beat depends on renders as a horizontal
  // streak through the plant's midriff and reads as a scanline. Dropping to the
  // base lifts that to 0.24 — enough perspective for the near and far halves to
  // separate, so the path reads as something going *around* the specimen and
  // the occlusion at the back becomes legible as depth rather than as a gap.
  // Lower still would read better as an ellipse but starts to look like a
  // turntable the plant is standing on rather than a rig travelling around it,
  // and past about -1.9 the near edge runs out of the bottom of the frame.
  orbitHeight: -1.6,
  // 12, not 24 or 60. These are *planned viewpoints* — marks on a trajectory —
  // and past a dozen they stop being countable and become a dotted line, which
  // is decoration. A reader should be able to see that there are a specific
  // number of them without counting.
  stations: 12,
  ringOpacity: 0.5,
  frustumOpacity: 0.42,
  // Stops well short of the specimen. Rays that reach the plant draw a hard
  // wireframe box over it and immediately read as a game HUD targeting bracket.
  frustumReach: 0.62,
  stationSize: 34,
  // Sparse on purpose, and this number is the story. Photogrammetry produces a
  // few hundred tie points before it produces millions of dense samples, so the
  // ratio to the 240k-point cloud that follows is roughly right at ~700. Raise
  // it much and the handoff loses its "and now there is vastly more of it"
  // moment, because there already was.
  tiePointCount: 720,
  tiePointSize: 26,
}

export interface MeshConfig {
  opacity: number
  wireframe: boolean
  /** Multiplies every material's emissive contribution — lets the mesh glow to match the cloud. */
  emissiveBoost: number

  // ── Transformation knobs ──────────────────────────────────────────────────
  /**
   * Vertical softness of the surface reveal front, in normalised model height.
   * Small values snap the surface on like a shutter; large values make it a
   * slow wash with no legible leading edge.
   */
  revealSoftness: number
  /** Brightness of the emissive band riding the reveal front. 0 disables it. */
  frontGlow: number
  /** Roughness at the start and end of the final-plant window. */
  roughnessFrom: number
  roughnessTo: number
}

export const DEFAULT_MESH_CONFIG: MeshConfig = {
  opacity: 1,
  wireframe: false,
  emissiveBoost: 0,
  revealSoftness: 0.2,
  // 0.55, not 1. An additive accent-coloured band on a near-monochrome frame is
  // the loudest thing in the piece; at full strength it announced itself louder
  // than the surface it was supposed to be describing.
  frontGlow: 0.55,
  roughnessFrom: 0.92,
  roughnessTo: 0.55,
}

export interface WireframeConfig {
  /** Multiplies the whole edge layer. */
  opacity: number
  /** Cap on drawn edges. A dense reconstruction is grey mush past a few tens of thousands. */
  maxEdges: number | null
}

export const DEFAULT_WIREFRAME_CONFIG: WireframeConfig = {
  opacity: 0.62,
  maxEdges: 60000,
}
