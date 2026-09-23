import { Box3, BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three'
import type { AssetTransform } from './manifest'

/**
 * Brings a raw capture into scene space.
 *
 * A reconstruction arrives in whatever units, orientation and origin the rig
 * produced — millimetres from a turntable, metres from a field scanner, Z-up
 * from almost anything that is not a game engine. Rather than scatter
 * corrective matrices through the components, every asset is normalised once
 * on load into the volume the camera spline already frames.
 */

/** Deterministic PRNG. The same file must always produce the same cloud. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The matrix that takes raw asset space to scene space, derived from the
 * asset's own bounds. Returned separately so the mesh and the point cloud can
 * share one implementation despite having completely different geometry.
 */
export function resolveNormalizationMatrix(bounds: Box3, transform: AssetTransform): Matrix4 {
  const upCorrection = new Matrix4()
  if (transform.upAxis === 'z') {
    // Z-up → Y-up. Rotating the *bounds* rather than the geometry first means
    // the height measurement below is taken along the correct axis.
    upCorrection.makeRotationX(-Math.PI / 2)
  }

  const corrected = bounds.clone().applyMatrix4(upCorrection)
  const size = corrected.getSize(new Vector3())
  const centre = corrected.getCenter(new Vector3())

  // Guard a degenerate or empty scan rather than emitting Infinity into the
  // scene graph, where it silently kills the whole render.
  const height = size.y > 1e-6 ? size.y : 1
  const scale = transform.targetHeight / height

  const translateY =
    transform.anchor === 'base' ? -corrected.min.y * scale + transform.yOffset : -centre.y * scale + transform.yOffset

  // ORDER MATTERS, AND IT USED TO BE WRONG.
  //
  // Read right to left: stand the asset up, scale it, move its centre to the
  // origin, and only then yaw it. The yaw has to be OUTSIDE the centring,
  // because `centre` is measured in the asset's own frame — with the yaw
  // inboard, the matrix rotated the geometry and then subtracted an
  // unrotated offset, so any non-zero yaw slid the plant off the origin by
  // |centre| * scale * 2sin(yaw/2). For this scan that is ~0.85 units at 90
  // degrees, over half the plant's radius, which would have read as "the
  // rotation moved the plant" rather than as the bug it was.
  //
  // It was invisible until now only because every asset shipped with yaw 0.
  // Yawing outboard also leaves `translateY` alone, which is what we want:
  // a rotation about the scene's vertical cannot change a height.
  return new Matrix4()
    .makeRotationY(transform.yaw)
    .multiply(new Matrix4().makeTranslation(-centre.x * scale, translateY, -centre.z * scale))
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(upCorrection)
}

export interface NormalizedCloud {
  geometry: BufferGeometry
  /** Points actually uploaded, after any decimation. */
  count: number
  /** Points in the source file. */
  sourceCount: number
  hasVertexColors: boolean
}

/**
 * Produces a fresh geometry rather than mutating the loader's. `useLoader`
 * caches by URL and hands the *same* object to every consumer — mutating it in
 * place would corrupt the cache on a hot reload or a second mount.
 */
export function normalizePointCloud(
  source: BufferGeometry,
  transform: AssetTransform,
  options: { maxPoints: number | null; vertexColors: boolean | 'auto' },
): NormalizedCloud {
  // An empty cloud has to be an error, not a silent black frame. PLYLoader does
  // not reject on garbage input — it just yields nothing — and a dev server's
  // SPA fallback answers a mistyped asset URL with 200 + index.html, so a wrong
  // path arrives here as a valid-looking parse with zero vertices.
  const srcPosition = source.getAttribute('position')
  if (!srcPosition || srcPosition.count === 0) {
    throw new Error('Point cloud contains no vertices — check VITE_POINTCLOUD_URL points at a valid PLY.')
  }

  const srcColor = source.getAttribute('color')
  const wantColor = options.vertexColors === 'auto' ? srcColor != null : options.vertexColors
  const useColor = wantColor && srcColor != null

  const sourceCount = srcPosition.count

  // Deterministic stride decimation. A random sample of a scan produces a
  // different cloud on every reload, which makes visual regressions
  // unspottable; a stride keeps the spatial distribution and the determinism.
  const stride =
    options.maxPoints && sourceCount > options.maxPoints ? Math.ceil(sourceCount / options.maxPoints) : 1
  const count = stride === 1 ? sourceCount : Math.floor((sourceCount + stride - 1) / stride)

  if (!source.boundingBox) source.computeBoundingBox()
  const matrix = resolveNormalizationMatrix(source.boundingBox!, transform)

  const positions = new Float32Array(count * 3)
  const colors = useColor ? new Float32Array(count * 3) : null
  const seeds = new Float32Array(count)
  const revealOrder = new Float32Array(count)

  const v = new Vector3()
  const rand = mulberry32(0x5eed_1eaf)
  let minY = Infinity
  let maxY = -Infinity

  for (let i = 0, s = 0; i < count; i++, s += stride) {
    v.fromBufferAttribute(srcPosition, s).applyMatrix4(matrix)

    positions[i * 3 + 0] = v.x
    positions[i * 3 + 1] = v.y
    positions[i * 3 + 2] = v.z

    if (v.y < minY) minY = v.y
    if (v.y > maxY) maxY = v.y

    if (colors && srcColor) {
      colors[i * 3 + 0] = srcColor.getX(s)
      colors[i * 3 + 1] = srcColor.getY(s)
      colors[i * 3 + 2] = srcColor.getZ(s)
    }

    seeds[i] = rand()
  }

  // Base → apex, 0 → 1. The reveal transition will consume this; computing it
  // here costs one pass over data already in cache.
  const span = maxY - minY > 1e-6 ? maxY - minY : 1
  for (let i = 0; i < count; i++) {
    revealOrder[i] = (positions[i * 3 + 1]! - minY) / span
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aRevealOrder', new BufferAttribute(revealOrder, 1))
  if (colors) geometry.setAttribute('color', new BufferAttribute(colors, 3))

  // Points are frustum-culled against this; without it three culls using a
  // stale sphere from the source geometry and the cloud vanishes at some
  // camera angles.
  geometry.computeBoundingSphere()

  return { geometry, count, sourceCount, hasVertexColors: useColor }
}
