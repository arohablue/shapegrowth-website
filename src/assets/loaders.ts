import { useLoader } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Box3, Object3D } from 'three'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { ASSETS } from './manifest'
import type { MeshAsset, PointCloudAsset } from './manifest'
import { normalizePointCloud, resolveNormalizationMatrix } from './normalize'
import type { NormalizedCloud } from './normalize'

/**
 * Loading is Suspense-based on purpose.
 *
 * `useLoader` caches by URL, dedupes concurrent requests, throws the promise so
 * React can suspend, and re-throws load failures so an error boundary catches
 * them. Hand-rolling that gets you three states and a cache you have to
 * invalidate yourself. The one thing it does not give is progress, which comes
 * from `THREE.DefaultLoadingManager` via drei's `useProgress` instead.
 */

/**
 * Suspends until the PLY is parsed, then normalises it into scene space.
 *
 * `deviceMaxPoints` is the device tier's ceiling, kept separate from the
 * manifest's own `maxPoints` because they answer different questions — the
 * manifest caps what this *asset* should ever contribute, the tier caps what
 * this *machine* can draw. The effective limit is whichever is lower.
 *
 * It is a scalar argument rather than a field folded into `asset` on purpose:
 * `asset` is the memo key, so a per-render object would re-normalise 240k
 * points on every render.
 *
 * Note this trims what is *drawn*, not what is downloaded — the whole file is
 * still fetched and parsed. That is the right trade here, because the measured
 * bottleneck is fragment work rather than bandwidth, but it does mean a slow
 * connection is not helped by it.
 */
export function usePointCloud(
  asset: PointCloudAsset,
  deviceMaxPoints: number | null = null,
): NormalizedCloud {
  const source = useLoader(PLYLoader, asset.url)

  const cap = Math.min(asset.maxPoints ?? Infinity, deviceMaxPoints ?? Infinity)

  const normalized = useMemo(
    () =>
      normalizePointCloud(source, asset.transform, {
        maxPoints: Number.isFinite(cap) ? cap : null,
        vertexColors: asset.vertexColors,
      }),
    [source, asset, cap],
  )

  // The normalised geometry is ours, not the loader cache's, so we own its
  // lifetime. The cached source is left alone — other mounts may still need it.
  useEffect(() => () => normalized.geometry.dispose(), [normalized])

  return normalized
}

/**
 * One DRACOLoader per decoder path, not one per call.
 *
 * `configureDraco` runs once per GLTFLoader instance, and there are at least
 * two — `preloadAssets` constructs one and `useLoader` constructs another — so
 * the previous version built a second decoder and therefore a second pool of
 * decoder Web Workers, which nothing ever terminated.
 *
 * Deliberately NOT disposed on unmount. `useLoader` caches the GLTFLoader for
 * the lifetime of the page and hands it to every later consumer, so disposing
 * the decoder it points at would leave a cached loader that throws on the next
 * mount. A module-scoped instance matches the lifetime of the thing that holds
 * it. That is a real leak only if decoder paths are unbounded, and they come
 * from a build-time env var.
 */
const dracoLoaders = new Map<string, DRACOLoader>()

const configureDraco = (decoderPath: string) => (loader: GLTFLoader) => {
  let draco = dracoLoaders.get(decoderPath)
  if (!draco) {
    draco = new DRACOLoader()
    draco.setDecoderPath(decoderPath)
    dracoLoaders.set(decoderPath, draco)
  }
  loader.setDRACOLoader(draco)
}

export interface NormalizedMesh {
  object: Object3D
  triangles: number
}

/** Suspends until the GLB is parsed, then clones and normalises it. */
export function useReconstructedMesh(asset: MeshAsset): NormalizedMesh {
  const gltf = useLoader(
    GLTFLoader,
    asset.url,
    asset.dracoDecoderPath ? configureDraco(asset.dracoDecoderPath) : undefined,
  )

  return useMemo(() => {
    // Clone before touching anything: `useLoader` hands out the same scene
    // object to every consumer, and baking a transform into it would compound
    // on the second mount.
    const object = gltf.scene.clone(true)

    const bounds = new Box3().setFromObject(object)
    const matrix = resolveNormalizationMatrix(bounds, asset.transform)

    object.applyMatrix4(matrix)
    object.updateMatrixWorld(true)

    let triangles = 0
    object.traverse((child) => {
      const geometry = (child as { geometry?: { index?: { count: number } | null; attributes?: Record<string, { count: number }> } }).geometry
      if (!geometry) return
      const indexCount = geometry.index?.count
      const positionCount = geometry.attributes?.['position']?.count
      triangles += ((indexCount ?? positionCount ?? 0) / 3) | 0
    })

    // Same reasoning as the point cloud: an empty scene graph must surface as an
    // error the boundary can catch, not as an invisible mesh nobody notices.
    if (triangles === 0) {
      throw new Error('Reconstruction contains no geometry — check VITE_MESH_URL points at a valid GLB.')
    }

    return { object, triangles }
  }, [gltf, asset])
}

/**
 * Warms the HTTP cache and the parser before the scroll reaches the stage that
 * needs the asset. Fire-and-forget: a failure here is not an error, it just
 * means the real load will pay full price.
 */
export function preloadAssets(): void {
  if (ASSETS.pointCloud) useLoader.preload(PLYLoader, ASSETS.pointCloud.url)
  if (ASSETS.mesh) {
    const { url, dracoDecoderPath } = ASSETS.mesh
    useLoader.preload(GLTFLoader, url, dracoDecoderPath ? configureDraco(dracoDecoderPath) : undefined)
  }
}
