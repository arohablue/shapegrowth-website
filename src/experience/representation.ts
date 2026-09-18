import { clamp01, smoothstep } from './easing'
import {
  getFinalPlantProgress,
  getGeometryProgress,
  getMeshProgress,
  getPointCloudProgress,
  getVertexProgress,
  track,
} from './deriveSceneState'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * STAGE PROGRESS → RENDER WEIGHTS
 * ────────────────────────────────────────────────────────────────────────────
 * `deriveSceneState` answers "how far through each stage are we". This file
 * answers the different question "therefore what does each layer draw". The
 * split matters: the stage windows are narrative timing the user tunes, while
 * the weights below are rendering decisions — which layer occludes which, how
 * much of the previous representation survives into the next.
 *
 * Every field maps 1:1 onto a shader uniform. Nothing here allocates, and
 * nothing integrates over time: the entire visual state is a pure function of
 * `progress`. That is the whole reason the sequence survives fast scrolling,
 * reverse scrolling and jumping — there is no accumulated state to desync, and
 * p = 0.62 renders identically however it was reached.
 */

export interface RepresentationWeights {
  /** Particle layer alpha. */
  cloudOpacity: number
  /** Progressive base→apex appearance of samples, 0 → 1. */
  reveal: number
  /**
   * Strength of the sensor's illuminated band — not its position. Where the
   * band falls is derived from `rigAngle` in the shader, because the lit side
   * of the specimen is the side facing the sensor.
   */
  scan: number

  // ── Capture rig ───────────────────────────────────────────────────────────
  /**
   * Rig traverse, 0 → 1 = one full orbit. The single input the entire capture
   * beat is derived from: the orbit trail, which viewpoints are marked, which
   * tie points have been measured, and which side of the plant is lit all read
   * this one number.
   */
  rigAngle: number
  /** Alpha of the instrument itself — orbit path, viewpoint marks, frustum. */
  rigOpacity: number
  /** Sparse tie-point presence. Peaks during capture, hands off to the cloud. */
  tiePoints: number
  /** 0 = particle sits at its scanned position, 1 = snapped to its mesh vertex. */
  snap: number
  /** Particles read as sharp geometric vertices rather than soft returns. */
  vertexEmphasis: number
  /** How much subtle coherent drift is left in the cloud. */
  drift: number
  /** Monotone edge-growth parameter. Never reverses, so edges never un-grow. */
  wireBuild: number
  /** Edge alpha — falls away as the surface takes over, but never to zero. */
  wireOpacity: number
  /** Upward surface reveal, 0 → 1. */
  surface: number
  /** Material, lighting and atmosphere polish. */
  finalPlant: number

  // ── Phenotyping ───────────────────────────────────────────────────────────
  /**
   * The measurement pass, 0 → 1. Drives dimension lines, markers and labels.
   *
   * One weight for the whole stage; *which* annotation is showing at a given
   * moment is a per-annotation function of this value (`annotationReveal` in
   * `phenotype.ts`), not seven more weights. Keeping the stagger in the data
   * means adding an eighth trait needs no change here.
   */
  phenotype: number
}

export const createRepresentationWeights = (): RepresentationWeights => ({
  cloudOpacity: 0,
  reveal: 0,
  scan: 0,
  rigAngle: 0,
  rigOpacity: 0,
  tiePoints: 0,
  snap: 0,
  vertexEmphasis: 0,
  drift: 1,
  wireBuild: 0,
  wireOpacity: 0,
  surface: 0,
  finalPlant: 0,
  phenotype: 0,
})

/** Mutates `out`. Called every frame — allocation here would be GC pressure. */
export function resolveRepresentation(
  progress: number,
  out: RepresentationWeights,
): RepresentationWeights {
  const p = clamp01(progress)

  const scan = track('scan', p)
  const rig = track('rig', p)
  const cloud = getPointCloudProgress(p)
  const vertex = getVertexProgress(p)
  const wire = getGeometryProgress(p)
  const surface = getMeshProgress(p)
  const final = getFinalPlantProgress(p)

  // ── Particles ────────────────────────────────────────────────────────────
  // Presence, not the raw track. The `pointCloud` window opens at 0.15, so
  // gating alpha on it alone leaves the hero empty. The samples are the subject
  // from the first pixel; the stages control how *resolved* they look, not
  // whether anything is there. Monotone by construction: 0.40 at p=0, 0.62 once
  // the sweep has passed, 1.0 once the cloud has resolved.
  //
  // The floor was 0.24, and that number was wrong for a reason worth recording:
  // it is not the only floor. The shader applies a SECOND one — `vAppear`, which
  // floors the per-point reveal so unmeasured samples still draw — and the two
  // multiply. Each was authored independently as "about a quarter", so the
  // opening frame actually rendered at 0.24 x 0.30 = 0.072 of full strength.
  // Measured on the real framebuffer, the specimen contributed 0.19% bright
  // pixels at p=0 against its own peak of 2.83% at p=0.30: the first thing a
  // reader sees was running at 7% of the presence the piece is capable of, so
  // the plant read as a smudge behind the type rather than as the subject.
  //
  // Raised so the two floors together land near a third of full strength. The
  // opening is still unmistakably an *unresolved* capture — dispersion is at its
  // maximum, drift is unattenuated and the reveal has not swept — but it is a
  // legible specimen while it is unresolved, which is the whole claim of the
  // hero. See the matching note on `vAppear` in shaders/pointCloud.ts; the two
  // numbers are a pair and must be read together.
  const presence = 0.4 + 0.22 * scan + 0.38 * cloud

  // The cloud is never fully extinguished. A scan that vanishes the instant a
  // surface appears throws away the point of the story — the residual ~9% keeps
  // the samples legible as the data the surface was inferred from.
  out.cloudOpacity = presence * (1 - 0.8 * surface) * (1 - 0.55 * final)
  out.reveal = cloud
  out.scan = scan

  // ── Capture rig ──────────────────────────────────────────────────────────
  out.rigAngle = rig

  /**
   * How far into "actively gathering" the instrument is, as a function of its
   * own traverse — not of `scan`.
   *
   * Both of these used to be driven by `scan`, and that was a real bug rather
   * than a stylistic choice. `scan` is the *illumination* envelope: eased in and
   * out, which is exactly right for a lighting effect and exactly wrong for
   * accumulation. Because `easeInOutCubic` has zero slope at its start, the
   * envelope was still 0.009 once the rig had already travelled a sixth of its
   * orbit — so the first stations gathered nothing, and the tie points then
   * faded up as an already-populated arc. That reads as "these were always
   * here" instead of "these are being recorded", which inverts the one claim
   * the whole capture beat is making.
   *
   * A quarter of the traverse is the ramp, and it is not arbitrary: the
   * per-frame continuity budget is 0.03 per 0.001 of progress, and the rig
   * covers its orbit at 3.33 traverse per unit progress, so anything sharper
   * than about a fifth of a turn registers as a pop. Which points are present
   * is decided per-point in the shader anyway (`aAt` vs `uHead`); this term
   * only answers "is the instrument gathering", and from the moment it starts
   * moving the honest answer is yes.
   */
  const gathering = smoothstep(0, 0.25, rig)

  // Present but idle at p = 0 (0.32), full while the pass runs, gone once the
  // cloud has resolved. The floor is deliberate: an instrument that materialises
  // out of nothing is a UI element, whereas one that was already there and then
  // starts moving is a machine. `(1 - cloud)` is the exit — the rig's job is
  // finished exactly when the data it produced becomes legible, so it leaves
  // rather than lingering as decoration over the reconstruction.
  out.rigOpacity = (0.32 + 0.68 * gathering) * (1 - cloud)

  // Sparse tie points: the first thing a real multi-view pipeline actually
  // produces. They accumulate behind the rig and then hand off — the dense
  // cloud coming up is the same specimen at a different order of magnitude, so
  // the two must never be at full strength simultaneously or the frame just
  // reads as noise. Shares `gathering` with the instrument's own alpha, so tie
  // points can never be bright while the rig that recorded them is faint.
  out.tiePoints = gathering * (1 - cloud)

  // The one window where particle positions move. Kept strictly equal to the
  // vertex track so the migration is exactly reversible under back-scrolling.
  out.snap = vertex

  // Emphasis holds through the wireframe build — the vertices are what the
  // edges are being drawn between — then relaxes once the surface is closing.
  out.vertexEmphasis = vertex * (1 - 0.65 * surface)

  // Motion ceases as samples lock onto vertices. A cloud that keeps breathing
  // after it has become geometry reads as noise, not as measurement.
  out.drift = 1 - 0.92 * vertex

  // ── Wireframe ────────────────────────────────────────────────────────────
  // Build and opacity are deliberately separate. Build is monotone in progress
  // so an edge that has grown never retracts; opacity is free to fall as the
  // surface takes priority.
  out.wireBuild = wire
  out.wireOpacity = wire * (1 - 0.72 * surface) * (1 - 0.75 * final)

  // ── Surface & finish ─────────────────────────────────────────────────────
  out.surface = surface
  out.finalPlant = final

  // ── Phenotyping ──────────────────────────────────────────────────────────
  // Note what is deliberately NOT here: nothing above is attenuated by
  // `phenotype`. The measurement pass annotates the finished plant, so the
  // plant has to still be at full strength underneath it — `out.surface` and
  // `out.finalPlant` both hold at 1 through the end of the page. Dimming the
  // specimen to make the labels pop would turn the stage into a dashboard with
  // a picture of a plant behind it, which is the one outcome the brief rules
  // out.
  out.phenotype = track('phenotype', p)

  return out
}
