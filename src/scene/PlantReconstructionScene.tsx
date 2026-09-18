import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { ASSETS } from '@/assets/manifest'
import { AssetBoundary } from '@/assets/AssetBoundary'
import { usePointCloud, useReconstructedMesh } from '@/assets/loaders'
import { assignMorphTargets, buildWireframe, extractMeshVertices } from '@/assets/topology'
import type { NormalizedCloud } from '@/assets/normalize'
import type { NormalizedMesh } from '@/assets/loaders'
import { FALLBACK_BOUNDS, measureSpecimenBounds } from '@/experience/phenotype'
import type { SpecimenBounds } from '@/experience/phenotype'
import { createRepresentationWeights, resolveRepresentation } from '@/experience/representation'
import type { RepresentationWeights } from '@/experience/representation'
import type { Breakpoint } from '@/experience/types'
import { useProgressContext } from '@/progress/ProgressContext'
import { AnnotationProjector } from './AnnotationLabels'
import type { AnnotationLabelHandles } from './AnnotationLabels'
import { CaptureRig } from './CaptureRig'
import { MeshLayer } from './MeshLayer'
import { PhenotypeLayer } from './PhenotypeLayer'
import { PlaceholderSpecimen } from './PlaceholderSpecimen'
import { PointCloudLayer } from './PointCloudLayer'
import { TiePointLayer } from './TiePointLayer'
import { WireframeLayer } from './WireframeLayer'
import {
  DEFAULT_CAPTURE_CONFIG,
  DEFAULT_MESH_CONFIG,
  DEFAULT_POINT_CLOUD_CONFIG,
  DEFAULT_WIREFRAME_CONFIG,
  TIER_POINT_CLOUD_OVERRIDES,
} from './pointCloudConfig'
import type {
  CaptureConfig,
  MeshConfig,
  PointCloudConfig,
  WireframeConfig,
} from './pointCloudConfig'

export interface PlantReconstructionSceneProps {
  /**
   * Normalized 0 → 1.
   *
   * Omit it and the scene tracks the global scroll progress, which is the
   * production path. Supply it and that value is authoritative — used to park
   * the scene at a fixed point for inspection or a visual test without
   * synthesising a scroll position.
   */
  progress?: number
  tier: 'low' | 'medium' | 'high'
  dpr: number
  /**
   * Ceiling on drawn scan samples for this device, or `null` for the whole file.
   * The reduced-complexity fallback — see `TIER_SETTINGS` in `SceneCanvas.tsx`
   * for why the count, and not the resolution, is the lever that was chosen.
   */
  cloudPoints?: number | null
  pointCloud?: Partial<PointCloudConfig>
  mesh?: Partial<MeshConfig>
  wireframe?: Partial<WireframeConfig>
  capture?: Partial<CaptureConfig>
  /** Placeholder point budget, used while assets load or when none are configured. */
  placeholderPoints: number
  placeholderPointSize: number
  /**
   * Elements of the DOM label layer, which is a sibling of the Canvas. The
   * projection has to happen in here against the real camera; see
   * `AnnotationLabels.tsx`.
   */
  labelsRef: React.RefObject<AnnotationLabelHandles>
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE SCENE CONTROLLER
 * ────────────────────────────────────────────────────────────────────────────
 * Owns one question: given a normalized progress, which representation is
 * showing and how strongly?
 *
 * It has no knowledge of DOM sections, scroll, or the page's structure. The
 * mapping lives in `experience/representation.ts` as a pure function, so the
 * scene's behaviour can be asserted without a browser. Swap the five narrative
 * sections for eight tomorrow and nothing in here changes.
 *
 * Weights are fanned out through a ref rather than props. Progress changes
 * every frame; passing it as a prop would re-render the tree at 120 Hz. The ref
 * is written once per frame at high priority and read by each layer in its own
 * `useFrame`, so React renders only when the *structure* changes.
 */
export function PlantReconstructionScene({
  progress,
  tier,
  dpr,
  cloudPoints = null,
  pointCloud,
  mesh,
  wireframe,
  capture,
  placeholderPoints,
  placeholderPointSize,
  labelsRef,
}: PlantReconstructionSceneProps) {
  const { stateRef, breakpointRef, reducedMotion } = useProgressContext()
  const weightsRef = useRef(createRepresentationWeights())

  // Reduced motion kills the one remaining time-driven motion, the coherent
  // drift field. The transformation itself is scroll-driven, so it stays:
  // removing it would leave the user with no reconstruction at all.
  const pointCloudConfig = useMemo<PointCloudConfig>(
    () => ({
      ...DEFAULT_POINT_CLOUD_CONFIG,
      ...TIER_POINT_CLOUD_OVERRIDES[tier],
      ...pointCloud,
      ...(reducedMotion ? { driftAmount: 0 } : null),
    }),
    [tier, pointCloud, reducedMotion],
  )
  const meshConfig = useMemo<MeshConfig>(() => ({ ...DEFAULT_MESH_CONFIG, ...mesh }), [mesh])
  const wireframeConfig = useMemo<WireframeConfig>(
    () => ({ ...DEFAULT_WIREFRAME_CONFIG, ...wireframe }),
    [wireframe],
  )
  const captureConfig = useMemo<CaptureConfig>(
    () => ({ ...DEFAULT_CAPTURE_CONFIG, ...capture }),
    [capture],
  )

  // Priority -1000: ahead of the camera rig and every layer, so all consumers
  // read the same weights within a single frame.
  useFrame(() => {
    const p = progress ?? stateRef.current.experienceProgress
    resolveRepresentation(p, weightsRef.current)
  }, -1000)

  const placeholder = (
    <PlaceholderSpecimen pointCount={placeholderPoints} pointSize={placeholderPointSize} dpr={dpr} />
  )

  // The rig sits OUTSIDE the asset branches on purpose. It is the instrument,
  // not the specimen: it depends on no file, it is the same apparatus whichever
  // scan is loaded, and it must be present during loading — the capture beat
  // occupies the first 30% of the page, which is exactly when a large scan is
  // still being parsed. Gating it behind the assets would mean the one part of
  // the sequence that can always be drawn is the part that waits.
  const rig = <CaptureRig config={captureConfig} dpr={dpr} weightsRef={weightsRef} />

  const layerProps = {
    pointCloudConfig,
    meshConfig,
    wireframeConfig,
    captureConfig,
    cloudPoints,
    dpr,
    weightsRef,
    breakpointRef,
    labelsRef,
  }

  return (
    <>
      {rig}
      {/* Nothing configured: the normal state before a reconstruction has been
          supplied, not a failure. The placeholder carries the experience — and
          the rig above still orbits it, so the capture beat reads correctly
          even with no assets at all. */}
      {!ASSETS.pointCloud && !ASSETS.mesh ? (
        <>
          {placeholder}
          {/* The measurement pass annotates whatever specimen is present, and
              with no assets configured that is the placeholder. Bounds come
              from its generator instead of from a file — see FALLBACK_BOUNDS. */}
          <PhenotypePass
            bounds={FALLBACK_BOUNDS}
            breakpointRef={breakpointRef}
            dpr={dpr}
            weightsRef={weightsRef}
            labelsRef={labelsRef}
          />
        </>
      ) : (
        <AssetBoundary fallback={placeholder}>
          {/* The placeholder is also the loading state. A null fallback would
              leave a black frame for however long a large scan takes to parse. */}
          <Suspense fallback={placeholder}>
            {ASSETS.pointCloud && ASSETS.mesh ? (
              <BothAssets {...layerProps} />
            ) : ASSETS.pointCloud ? (
              <CloudOnly {...layerProps} />
            ) : (
              <MeshOnly {...layerProps} />
            )}
          </Suspense>
        </AssetBoundary>
      )}
    </>
  )
}

interface PhenotypePassProps {
  bounds: SpecimenBounds
  breakpointRef: React.RefObject<Breakpoint>
  dpr: number
  weightsRef: React.RefObject<RepresentationWeights>
  labelsRef: React.RefObject<AnnotationLabelHandles>
}

/**
 * Lines and readings travel together — a dimension line with no number is
 * unreadable and a number with no line is a caption — so they are never
 * rendered separately. Both halves need the same bounds, which is the only
 * reason this wrapper exists.
 */
function PhenotypePass({ bounds, breakpointRef, dpr, weightsRef, labelsRef }: PhenotypePassProps) {
  return (
    <>
      <PhenotypeLayer
        bounds={bounds}
        breakpointRef={breakpointRef}
        dpr={dpr}
        weightsRef={weightsRef}
      />
      <AnnotationProjector
        bounds={bounds}
        breakpointRef={breakpointRef}
        weightsRef={weightsRef}
        handlesRef={labelsRef}
      />
    </>
  )
}

interface AssemblyProps {
  pointCloudConfig: PointCloudConfig
  meshConfig: MeshConfig
  wireframeConfig: WireframeConfig
  captureConfig: CaptureConfig
  cloudPoints: number | null
  dpr: number
  weightsRef: React.RefObject<RepresentationWeights>
  breakpointRef: React.RefObject<Breakpoint>
  labelsRef: React.RefObject<AnnotationLabelHandles>
}

/**
 * Three wrappers instead of one, purely because a loader hook cannot be called
 * conditionally: `usePointCloud` suspends on a URL, so "load the mesh only if
 * one is configured" has to be a branch in the *tree*, not in a hook list.
 * Each wrapper is two lines; the assembly they share is below.
 *
 * The alternative was to require both assets and drop the single-asset paths.
 * Rejected: the manifest deliberately makes them independent, and a scan
 * without a reconstruction is a real state during authoring — you get the
 * particle stages and the surface stages simply never open.
 */
function BothAssets(props: AssemblyProps) {
  const cloud = usePointCloud(ASSETS.pointCloud!, props.cloudPoints)
  const mesh = useReconstructedMesh(ASSETS.mesh!)
  return <Assembly cloud={cloud} mesh={mesh} {...props} />
}

function CloudOnly(props: AssemblyProps) {
  const cloud = usePointCloud(ASSETS.pointCloud!, props.cloudPoints)
  return <Assembly cloud={cloud} mesh={null} {...props} />
}

function MeshOnly(props: AssemblyProps) {
  const mesh = useReconstructedMesh(ASSETS.mesh!)
  return <Assembly cloud={null} mesh={mesh} {...props} />
}

interface Assembled extends AssemblyProps {
  cloud: NormalizedCloud | null
  mesh: NormalizedMesh | null
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * WHERE THE THREE REPRESENTATIONS BECOME ONE OBJECT
 * ────────────────────────────────────────────────────────────────────────────
 * The scan and the reconstruction arrive as two unrelated files. What makes the
 * sequence a *transformation* rather than a crossfade is derived here, once, at
 * load:
 *
 *   • `assignMorphTargets` gives every retained sample the nearest vertex of
 *     the reconstruction, so a particle migrates onto the surface it will later
 *     be replaced by. This is the spatial continuity the sequence depends on.
 *   • `buildWireframe` turns the same mesh's triangle edges into growable line
 *     segments, so the edges that appear are literally the edges of the surface
 *     that closes over them.
 *
 * Both are O(load), not O(frame). Nothing below this line allocates or
 * recompiles during scroll.
 */
function Assembly({
  cloud,
  mesh,
  pointCloudConfig,
  meshConfig,
  wireframeConfig,
  captureConfig,
  dpr,
  weightsRef,
  breakpointRef,
  labelsRef,
}: Assembled) {
  /**
   * The specimen's real extent, measured from whatever actually loaded.
   *
   * Measured from the mesh in preference to the cloud: the annotations are
   * drawn against the finished surface, and a scan carries stray returns —
   * floor speckle, a bit of the rig — that the reconstruction has already
   * rejected. A single outlier 30% outside the plant inflates
   * `planHalfExtent` and pushes every anchor off the silhouette with it.
   */
  const bounds = useMemo<SpecimenBounds>(() => {
    if (mesh) {
      const vertices = extractMeshVertices(mesh.object)
      if (vertices.length > 0) return measureSpecimenBounds(vertices)
    }
    if (cloud) {
      return measureSpecimenBounds(cloud.geometry.getAttribute('position').array as Float32Array)
    }
    return FALLBACK_BOUNDS
  }, [cloud, mesh])

  useEffect(() => {
    console.info(
      `[phenotype] specimen bounds — y ${bounds.minY.toFixed(3)} → ${bounds.maxY.toFixed(3)}, ` +
        `plan half-extent ${bounds.planHalfExtent.toFixed(3)}`,
    )
  }, [bounds])

  const morphTargets = useMemo(() => {
    if (!cloud || !mesh) return undefined
    const vertices = extractMeshVertices(mesh.object)
    if (vertices.length === 0) return undefined
    const source = cloud.geometry.getAttribute('position').array as Float32Array
    const result = assignMorphTargets(source, vertices)
    const samples = source.length / 3
    const targets = vertices.length / 3
    const ratio = samples / targets
    console.info(
      `[assets] morph targets — mean travel ${result.meanTravel.toFixed(3)}, max ${result.maxTravel.toFixed(3)} scene units; ` +
        `${samples.toLocaleString()} samples → ${targets.toLocaleString()} vertices (${ratio.toFixed(1)}:1)`,
    )
    // The vertex stage draws every sample stacked on its nearest vertex, so this
    // ratio *is* how much of the frame that stage can fill. Around 2:1 — a real
    // scan against a real reconstruction — it looks like the point cloud. Past
    // ~20:1 the samples pile onto so few distinct positions that the stage
    // renders as a near-empty frame. That is a mismatched pair of assets, not a
    // bug in the scene, and it is worth saying out loud because it looks exactly
    // like a broken reveal.
    if (ratio > 20) {
      console.warn(
        `[assets] sample:vertex ratio is ${ratio.toFixed(0)}:1 — the vertex stage will render sparsely. ` +
          `Expect ~2:1 between a scan and its own reconstruction.`,
      )
    }
    return result.positions
  }, [cloud, mesh])

  const wireframeTopology = useMemo(() => {
    if (!mesh) return null
    return buildWireframe(mesh.object, wireframeConfig.maxEdges)
  }, [mesh, wireframeConfig.maxEdges])

  // Built here, so disposed here. The cloud geometry and the GLB scene are
  // owned by the loader hooks and must not be touched.
  useEffect(() => {
    const geometry = wireframeTopology?.geometry
    return () => geometry?.dispose()
  }, [wireframeTopology])

  useEffect(() => {
    if (!cloud) return
    const decimated =
      cloud.count < cloud.sourceCount ? ` (decimated from ${cloud.sourceCount.toLocaleString()})` : ''
    console.info(
      `[assets] point cloud ready — ${cloud.count.toLocaleString()} points${decimated}, vertex colours: ${cloud.hasVertexColors}`,
    )
  }, [cloud])

  useEffect(() => {
    if (!mesh) return
    console.info(`[assets] mesh ready — ${mesh.triangles.toLocaleString()} triangles`)
  }, [mesh])

  useEffect(() => {
    if (!wireframeTopology) return
    const capped =
      wireframeTopology.segments < wireframeTopology.sourceSegments
        ? ` (capped from ${wireframeTopology.sourceSegments.toLocaleString()})`
        : ''
    console.info(`[assets] wireframe ready — ${wireframeTopology.segments.toLocaleString()} edges${capped}`)
  }, [wireframeTopology])

  return (
    <>
      {/* Drawn from the scan, so they are measurements of this specimen rather
          than markers near it — which is what makes the handoff into the dense
          cloud read as the same object gaining detail. */}
      {cloud && (
        <TiePointLayer
          source={cloud.geometry}
          config={captureConfig}
          dpr={dpr}
          weightsRef={weightsRef}
        />
      )}
      {cloud && (
        <PointCloudLayer
          geometry={cloud.geometry}
          hasVertexColors={cloud.hasVertexColors}
          morphTargets={morphTargets}
          config={pointCloudConfig}
          dpr={dpr}
          weightsRef={weightsRef}
        />
      )}
      {wireframeTopology && (
        <WireframeLayer
          geometry={wireframeTopology.geometry}
          config={wireframeConfig}
          weightsRef={weightsRef}
        />
      )}
      {mesh && <MeshLayer object={mesh.object} config={meshConfig} weightsRef={weightsRef} />}
      <PhenotypePass
        bounds={bounds}
        breakpointRef={breakpointRef}
        dpr={dpr}
        weightsRef={weightsRef}
        labelsRef={labelsRef}
      />
    </>
  )
}
