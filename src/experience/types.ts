import type { EasingName } from './easing'

/**
 * The three beats of the pipeline, in order. These are the narrative AND the
 * scene: each one owns a document block and a group of tracks in `timeline.ts`,
 * and the two are deliberately the same list so a beat cannot exist in the copy
 * without existing in the reconstruction.
 *
 * There were five. `geometry` and `surface` were beats of their own, each with a
 * heading and a rail entry, and naming them made the page a five-concept
 * explanation of a three-concept product. A reader does not buy a wireframe
 * stage; they buy "photograph the plant, rebuild it, measure it". So the two
 * middle names were removed and their *motion* was not: the wireframe still
 * builds and the surface still closes, inside `reconstruct`, as things the
 * reconstruction visibly does rather than as separate claims. The track table
 * below is untouched — see the note over BLOCKS in `timeline.ts`.
 */
export type StageId = 'capture' | 'reconstruct' | 'phenotype'

export type Breakpoint = 'mobile' | 'desktop'

export interface StageWindow {
  /** experienceProgress at which this stage begins. */
  readonly in: number
  /** experienceProgress at which this stage completes. */
  readonly out: number
  readonly ease: EasingName
}

/** A plain 3-tuple. Deliberately not THREE.Vector3 — this layer must stay engine-free. */
export type Vec3 = readonly [number, number, number]

export interface CameraKeyframe {
  readonly at: number
  readonly position: Vec3
  readonly target: Vec3
}

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * The complete, derived state of the experience at a single moment.
 * Every value here is a pure function of `experienceProgress`.
 */
export interface SceneState {
  /** The single source of truth. 0 → 1 across the entire page. */
  experienceProgress: number
  /** Undamped scroll progress. Useful for anything that must not lag. */
  rawProgress: number
  /** Signed rate of change, in progress-units per second. */
  velocity: number

  /** Sensor sweep across the specimen. */
  scanProgress: number
  /** Raw returns resolving into discrete samples. */
  pointCloudProgress: number
  /** Samples migrating onto the reconstruction's vertices. */
  vertexProgress: number
  /** Edges growing between vertices — the wireframe. */
  geometryProgress: number
  /** Surface closing over the wireframe. */
  meshProgress: number
  /** Material, lighting and atmosphere resolving to the finished plant. */
  finalPlantProgress: number
  /** Measurement pass over the finished model. */
  phenotypeProgress: number

  camera: CameraState
  activeStage: StageId
  /** Index of activeStage within STAGE_ORDER. */
  activeStageIndex: number
}
