/**
 * ────────────────────────────────────────────────────────────────────────────
 * ASSET CONFIGURATION LAYER
 * ────────────────────────────────────────────────────────────────────────────
 * The ONLY place in the application where an asset filename appears.
 *
 * Nothing here is a guess at your production filenames. Every path is read from
 * a `VITE_*` environment variable and is `null` when unset — an unconfigured
 * asset is a first-class state, not an error, and the scene falls back to the
 * placeholder specimen. Copy `.env.example` to `.env.local` and point it at
 * your files.
 *
 * Why env vars rather than a runtime-fetched JSON manifest: Vite inlines them
 * at build time, so there is no extra round-trip and no runtime failure mode to
 * handle. The cost is that changing one needs a dev-server restart.
 *
 * The transform fields exist because a reconstruction arrives in whatever units
 * and orientation the capture rig produced. Rather than baking a corrective
 * matrix into a component, the scan is normalised on load into the framing the
 * camera rig already expects: a subject roughly 3.2 world-units tall, centred
 * on the origin.
 */

export type UpAxis = 'y' | 'z'
export type Anchor = 'bounds' | 'base'
export type PointShape = 'disc' | 'soft' | 'square' | 'ring'
export type DepthMode = 'additive' | 'sorted'

/** How a raw scan is brought into scene space. Shared by both asset kinds. */
export interface AssetTransform {
  /** Capture rigs and CloudCompare exports are usually Z-up; three is Y-up. */
  readonly upAxis: UpAxis
  /** The scan is uniformly scaled so its bounding box reaches this height. */
  readonly targetHeight: number
  /** `bounds` centres the bounding box on the origin; `base` plants it at y=0. */
  readonly anchor: Anchor
  /** Applied after anchoring, in world units. */
  readonly yOffset: number
  /**
   * Yaw in radians about the scene's vertical, applied LAST — after the
   * up-axis correction, the scale and the centring, so it spins the asset on
   * the spot instead of swinging it around its own untransformed origin.
   * Frames the best side; see the order note in `resolveNormalizationMatrix`.
   */
  readonly yaw: number
}

export interface PointCloudAsset {
  readonly url: string
  readonly transform: AssetTransform
  /** `auto` uses the PLY's vertex colours when present, the palette tint when not. */
  readonly vertexColors: boolean | 'auto'
  /**
   * Hard ceiling on point count. Decimation is a deterministic stride, not a
   * random sample, so the same file always yields the same cloud.
   * `null` keeps every point.
   */
  readonly maxPoints: number | null
}

export interface MeshAsset {
  readonly url: string
  readonly transform: AssetTransform
  /** Directory containing the Draco decoder, if the GLB is Draco-compressed. */
  readonly dracoDecoderPath: string | null
}

export interface AssetManifest {
  readonly pointCloud: PointCloudAsset | null
  readonly mesh: MeshAsset | null
}

// ── env readers ──────────────────────────────────────────────────────────────

const raw = (key: string): string | null => {
  const v = (import.meta.env as Record<string, unknown>)[key]
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

const num = (key: string, fallback: number): number => {
  const v = raw(key)
  if (v === null) return fallback
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : fallback
}

const flag = (key: string, fallback: boolean): boolean => {
  const v = raw(key)
  return v === null ? fallback : v === 'true' || v === '1'
}

const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  const v = raw(key)
  return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

/**
 * The default framing. 3.2 units tall, centred on the origin — the same volume
 * the placeholder occupies, so the camera spline needs no changes when the real
 * scan arrives.
 */
const DEFAULT_TRANSFORM: AssetTransform = {
  upAxis: 'y',
  targetHeight: 3.2,
  anchor: 'bounds',
  yOffset: 0,
  yaw: 0,
}

const readTransform = (prefix: string): AssetTransform => ({
  upAxis: oneOf(`${prefix}_UP_AXIS`, ['y', 'z'] as const, DEFAULT_TRANSFORM.upAxis),
  targetHeight: num(`${prefix}_TARGET_HEIGHT`, DEFAULT_TRANSFORM.targetHeight),
  anchor: oneOf(`${prefix}_ANCHOR`, ['bounds', 'base'] as const, DEFAULT_TRANSFORM.anchor),
  yOffset: num(`${prefix}_Y_OFFSET`, DEFAULT_TRANSFORM.yOffset),
  yaw: num(`${prefix}_YAW`, DEFAULT_TRANSFORM.yaw),
})

const pointCloudUrl = raw('VITE_POINTCLOUD_URL')
const meshUrl = raw('VITE_MESH_URL')

export const ASSETS: AssetManifest = {
  pointCloud: pointCloudUrl
    ? {
        url: pointCloudUrl,
        transform: readTransform('VITE_POINTCLOUD'),
        vertexColors: raw('VITE_POINTCLOUD_VERTEX_COLORS') === null
          ? 'auto'
          : flag('VITE_POINTCLOUD_VERTEX_COLORS', true),
        maxPoints: raw('VITE_POINTCLOUD_MAX_POINTS') === null
          ? null
          : num('VITE_POINTCLOUD_MAX_POINTS', 0) || null,
      }
    : null,

  mesh: meshUrl
    ? {
        url: meshUrl,
        transform: readTransform('VITE_MESH'),
        dracoDecoderPath: raw('VITE_MESH_DRACO_PATH'),
      }
    : null,
}

export const hasRealAssets = ASSETS.pointCloud !== null || ASSETS.mesh !== null
