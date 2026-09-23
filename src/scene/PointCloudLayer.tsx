import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  NormalBlending,
  Vector2,
  type BufferGeometry,
  type ShaderMaterial,
} from 'three'
import { sensorDirection } from '@/experience/captureRig'
import type { RepresentationWeights } from '@/experience/representation'
import { usePalette } from '@/theme/ThemeContext'
import type { PointCloudConfig } from './pointCloudConfig'
import { pointCloudFragmentShader, pointCloudVertexShader } from './shaders/pointCloud'

/** Preallocated. The frame loop is not permitted to allocate. */
const SENSOR_SCRATCH = { x: 0, z: 0 }

interface Props {
  geometry: BufferGeometry
  hasVertexColors: boolean
  /**
   * Per-sample destination on the reconstruction. Omit it and the migration
   * beat is compiled out entirely rather than degrading to a no-op lerp.
   */
  morphTargets?: Float32Array
  config: PointCloudConfig
  dpr: number
  weightsRef: React.RefObject<RepresentationWeights>
}

/**
 * One `THREE.Points` for the entire scan — a single draw call regardless of
 * point count. Nothing here scales with the number of points at the React
 * level; the component tree is O(1) whether the file holds ten thousand samples
 * or ten million.
 *
 * Three of the six transformation beats live in this one object (raw returns,
 * resolved cloud, vertices), driven entirely by uniforms. No geometry is swapped
 * and no material is rebuilt mid-scroll, which is what keeps the sequence free
 * of hitches under fast scrubbing.
 */
export function PointCloudLayer({
  geometry,
  hasVertexColors,
  morphTargets,
  config,
  dpr,
  weightsRef,
}: Props) {
  const materialRef = useRef<ShaderMaterial>(null)
  const elapsed = useRef(0)
  const palette = usePalette()

  // Attaching the targets to the geometry rather than passing them as a uniform
  // is the only workable option: it is one vec3 per point, which is buffer data,
  // not state. Written on the geometry we already own from `normalizePointCloud`.
  useEffect(() => {
    if (!morphTargets) return
    geometry.setAttribute('aTarget', new BufferAttribute(morphTargets, 3))
    return () => {
      geometry.deleteAttribute('aTarget')
    }
  }, [geometry, morphTargets])

  // Initial declaration only. R3F does NOT adopt this object: `applyProps`
  // copies it field-by-field into the material's own `uniforms` so the target
  // reference stays stable. Mutating this memo therefore has no effect on
  // rendering — the frame loop writes to `material.uniforms` instead.
  const initialUniforms = useMemo(
    () => ({
      uSize: { value: config.size },
      uPixelRatio: { value: dpr },
      uMaxPixelSize: { value: config.maxPixelSize },
      uSparkle: { value: config.sparkle },
      uTint: { value: new Color(palette.cloud) },
      uVertexTint: { value: new Color(palette.accent) },
      uOpacity: { value: 0 },
      uBrightness: { value: config.brightness },
      uDepthFadeNear: { value: config.depthFadeNear },
      uDepthFadeFar: { value: config.depthFadeFar },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uScan: { value: 0 },
      uSensorDir: { value: new Vector2(0, 1) },
      uSnap: { value: 0 },
      uDrift: { value: 1 },
      uDriftAmount: { value: config.driftAmount },
      uVertexEmphasis: { value: 0 },
      uVertexSize: { value: config.vertexSize },
      uDispersion: { value: config.dispersion },
    }),
    [],
  )

  // Changing a define rebuilds the shader, so these are grouped and memoised
  // separately from the live uniforms above.
  const defines = useMemo(() => {
    const d: Record<string, string> = {
      [`SHAPE_${config.shape.toUpperCase()}`]: '1',
    }
    if (config.sizeAttenuation) d['ATTENUATE'] = '1'
    if (morphTargets) d['MORPH'] = '1'
    return d
  }, [config.shape, config.sizeAttenuation, morphTargets])

  const additive = config.depthMode === 'additive'

  useFrame((_, delta) => {
    const material = materialRef.current
    if (!material) return

    // Clamped so a long tab-out does not jump the drift field by ten seconds on
    // the first frame back.
    elapsed.current += Math.min(delta, 0.05)

    const w = weightsRef.current
    const u = material.uniforms
    const opacity = config.opacity * w.cloudOpacity

    u['uOpacity']!.value = opacity
    u['uSize']!.value = config.size
    u['uPixelRatio']!.value = dpr
    u['uMaxPixelSize']!.value = config.maxPixelSize
    u['uSparkle']!.value = config.sparkle
    u['uBrightness']!.value = config.brightness
    u['uDepthFadeNear']!.value = config.depthFadeNear
    u['uDepthFadeFar']!.value = config.depthFadeFar

    u['uTime']!.value = elapsed.current
    u['uReveal']!.value = w.reveal
    u['uScan']!.value = w.scan
    // Plan-view direction, not the traverse. `sensorDirection` names its
    // components x/z because that is the plane they live in; the uniform is a
    // vec2 so z lands in .y. Written into the existing Vector2 rather than
    // replacing it — the frame loop does not allocate.
    sensorDirection(w.rigAngle, SENSOR_SCRATCH)
    const dir = u['uSensorDir']!.value as Vector2
    dir.set(SENSOR_SCRATCH.x, SENSOR_SCRATCH.z)
    u['uSnap']!.value = w.snap
    u['uDrift']!.value = w.drift
    u['uDriftAmount']!.value = config.driftAmount
    u['uVertexEmphasis']!.value = w.vertexEmphasis
    u['uVertexSize']!.value = config.vertexSize
    u['uDispersion']!.value = config.dispersion

    // Skip the draw entirely once the cloud has faded out, rather than
    // rasterising millions of fully transparent points.
    material.visible = opacity > 0.002
  })

  return (
    // renderOrder 2: after the surface, so revealed geometry occludes the
    // residual data behind it and the glints land only on the near side.
    <points geometry={geometry} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={materialRef}
        key={`${config.shape}-${config.sizeAttenuation}-${hasVertexColors}-${morphTargets ? 'morph' : 'static'}`}
        uniforms={initialUniforms}
        defines={defines}
        vertexShader={pointCloudVertexShader}
        fragmentShader={pointCloudFragmentShader}
        vertexColors={hasVertexColors}
        transparent
        depthWrite={!additive}
        depthTest
        blending={additive ? AdditiveBlending : NormalBlending}
      />
    </points>
  )
}
