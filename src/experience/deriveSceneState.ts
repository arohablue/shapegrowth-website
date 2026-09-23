import { EASINGS, clamp01, invLerp } from './easing'
import { BLOCK_RANGES, SCROLLABLE_VH, STAGE_ORDER, TRACKS } from './timeline'
import type { TrackId } from './timeline'
import { sampleCameraSpline, createCameraState } from './cameraSpline'
import type { Breakpoint, SceneState, StageId } from './types'

/**
 * experienceProgress → the complete scene state.
 *
 * Pure. Imports no React, no three, no DOM. That is the point: the entire
 * choreography of the site can be asserted in a plain Node test —
 * "at p = 0.55 the mesh is 14% materialised and the camera sits above the
 * canopy" — with no browser and no renderer.
 *
 * It also guarantees reversibility. Because every visual is a function of p and
 * nothing integrates over time, scrolling up reproduces exactly the state that
 * scrolling down produced. No drift, no "it looks broken backwards".
 */

/** Evaluate one track's 0→1 progress at the given experienceProgress. */
export const track = (id: TrackId, p: number): number => {
  const w = TRACKS[id]
  return EASINGS[w.ease](clamp01(invLerp(w.in, w.out, p)))
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE STAGE API
 * ────────────────────────────────────────────────────────────────────────────
 * Named accessors for the transformation's five beats. They are thin on
 * purpose: each is `track()` against a window in `TRACKS`, so the timing stays
 * configurable in exactly one place while callers get a readable name instead of
 * a string key.
 *
 * All five are pure, total functions of progress. That is what makes the
 * sequence correct under fast scrolling, backwards scrolling and jumping: there
 * is no state to get out of sync, no "where were we" to reconstruct. p = 0.62
 * produces identical output whether it was reached from 0.61 or from 1.0.
 */
export const getPointCloudProgress = (p: number): number => track('pointCloud', p)
export const getVertexProgress = (p: number): number => track('vertex', p)
export const getGeometryProgress = (p: number): number => track('geometry', p)
export const getMeshProgress = (p: number): number => track('mesh', p)
export const getFinalPlantProgress = (p: number): number => track('finalPlant', p)

/**
 * Which section owns the *viewport centre* right now.
 * Using the centre rather than the top edge is what makes the progress rail
 * agree with what the reader actually perceives as the current section.
 */
export const resolveActiveStage = (p: number): StageId => {
  const centreVh = clamp01(p) * SCROLLABLE_VH + 50
  for (const range of BLOCK_RANGES) {
    if (range.id === 'hero' || range.id === 'outro') continue
    if (centreVh >= range.startVh && centreVh < range.endVh) return range.id
  }
  // Only reachable in the hero and the outro, which own no beat: clamp to the
  // nearest end of the narrative rather than inventing a sixth stage.
  return centreVh < BLOCK_RANGES[1]!.startVh ? 'capture' : 'phenotype'
}

export const createSceneState = (): SceneState => ({
  experienceProgress: 0,
  rawProgress: 0,
  velocity: 0,
  scanProgress: 0,
  pointCloudProgress: 0,
  vertexProgress: 0,
  geometryProgress: 0,
  meshProgress: 0,
  finalPlantProgress: 0,
  phenotypeProgress: 0,
  camera: createCameraState(),
  activeStage: 'capture',
  activeStageIndex: 0,
})

/**
 * Mutates `out` in place. No allocation in the hot path.
 */
export function deriveSceneState(
  p: number,
  raw: number,
  velocity: number,
  breakpoint: Breakpoint,
  out: SceneState,
): SceneState {
  const clamped = clamp01(p)

  out.experienceProgress = clamped
  out.rawProgress = raw
  out.velocity = velocity

  out.scanProgress = track('scan', clamped)
  out.pointCloudProgress = getPointCloudProgress(clamped)
  out.vertexProgress = getVertexProgress(clamped)
  out.geometryProgress = getGeometryProgress(clamped)
  out.meshProgress = getMeshProgress(clamped)
  out.finalPlantProgress = getFinalPlantProgress(clamped)
  out.phenotypeProgress = track('phenotype', clamped)

  sampleCameraSpline(clamped, breakpoint, out.camera)

  out.activeStage = resolveActiveStage(clamped)
  out.activeStageIndex = STAGE_ORDER.indexOf(out.activeStage)

  return out
}
