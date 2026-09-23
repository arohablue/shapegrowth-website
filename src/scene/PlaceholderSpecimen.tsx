import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  WireframeGeometry,
  type LineBasicMaterial,
  type ShaderMaterial,
} from 'three'
import { useProgressContext } from '@/progress/ProgressContext'
import { usePalette } from '@/theme/ThemeContext'
import { specimenFragmentShader, specimenVertexShader } from './shaders/specimenPoints'

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * Deterministic PRNG rather than Math.random, so the specimen is byte-identical
 * across reloads. Otherwise every screenshot differs and visual regressions
 * become impossible to spot.
 */
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
 * An irregular spheroid, taller than wide. Explicitly a stand-in — this
 * milestone exists to prove the scroll → progress → scene chain, not to model a
 * plant. It is built as a Points cloud using the same attribute layout the real
 * reconstruction will use, so the shader path is already the production one.
 */
function buildSpecimen(count: number): BufferGeometry {
  const rand = mulberry32(20260831)

  const positions = new Float32Array(count * 3)
  const scatter = new Float32Array(count * 3)
  const revealOrder = new Float32Array(count)
  const seeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    // Fibonacci distribution — far more even than sampling triangle vertices.
    const unitY = 1 - (i / (count - 1)) * 2
    const radial = Math.sqrt(Math.max(0, 1 - unitY * unitY))
    const theta = i * GOLDEN_ANGLE

    const ux = Math.cos(theta) * radial
    const uz = Math.sin(theta) * radial

    // Low-frequency lobing so it reads as organic rather than as a ball.
    // Kept deliberately shallow: at ±0.30 the shell was thick enough that
    // additive blending washed the silhouette out entirely, and the resolved
    // state looked no tighter than the dispersed one.
    const lobe =
      0.10 * Math.sin(3.1 * ux + 1.7) * Math.cos(2.3 * unitY - 0.4) +
      0.055 * Math.sin(4.7 * uz + 2.1) +
      0.03 * Math.cos(6.2 * unitY + 0.9)

    const r = 1.3 * (1 + lobe)
    const jitter = 1 + (rand() - 0.5) * 0.035

    const py = unitY * r * 1.24 * jitter

    positions[i * 3 + 0] = ux * r * jitter
    positions[i * 3 + 1] = py
    positions[i * 3 + 2] = uz * r * jitter

    // Pre-registration scatter.
    //
    // Derived FROM the final position rather than sampled independently: a
    // uniform random shell reads as a starfield, which gives the hero no
    // subject at all. Pushing each sample radially outward and jittering it
    // keeps the silhouette faintly legible, so p=0 looks like an unresolved
    // scan of something rather than noise — and resolving it actually means
    // something.
    // Both terms are heavily biased toward small values (pow > 1). A uniform
    // spread put most samples outside the frustum, which just reads as a
    // starfield; concentrating them near the surface keeps a recognisable form
    // with a soft halo of outliers.
    const dispersion = 1.0 + Math.pow(rand(), 2.2) * 0.95
    const jTheta = rand() * Math.PI * 2
    const jPhi = Math.acos(2 * rand() - 1)
    const jR = Math.pow(rand(), 1.6) * 0.6

    scatter[i * 3 + 0] = ux * r * jitter * dispersion + Math.sin(jPhi) * Math.cos(jTheta) * jR
    scatter[i * 3 + 1] = py * dispersion + Math.cos(jPhi) * jR
    scatter[i * 3 + 2] = uz * r * jitter * dispersion + Math.sin(jPhi) * Math.sin(jTheta) * jR

    // 0 at the base, 1 at the apex, lightly jittered to avoid a visible seam.
    revealOrder[i] = Math.min(1, Math.max(0, py / 3.1 + 0.5 + (rand() - 0.5) * 0.08))
    seeds[i] = rand()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aScatter', new BufferAttribute(scatter, 3))
  geometry.setAttribute('aRevealOrder', new BufferAttribute(revealOrder, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  return geometry
}

interface SpecimenProps {
  pointCount: number
  pointSize: number
  dpr: number
}

export function PlaceholderSpecimen({ pointCount, pointSize, dpr }: SpecimenProps) {
  const palette = usePalette()
  const { stateRef, reducedMotion } = useProgressContext()
  const pointsMaterialRef = useRef<ShaderMaterial>(null)
  const shellMaterialRef = useRef<LineBasicMaterial>(null)
  const elapsed = useRef(0)

  const geometry = useMemo(() => buildSpecimen(pointCount), [pointCount])

  const shellGeometry = useMemo(() => {
    const base = new IcosahedronGeometry(1.62, 2)
    const wire = new WireframeGeometry(base)
    base.dispose()
    return wire
  }, [])

  // Initial declaration only. R3F's `applyProps` does NOT adopt this object —
  // it copies each entry into the material's own `uniforms` to keep that target
  // reference stable. Mutating this memo has no effect on what is drawn, so the
  // frame loop writes through `materialRef.current.uniforms` instead.
  const initialUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScan: { value: 0 },
      uPointCloud: { value: 0 },
      uMesh: { value: 0 },
      uPhenotype: { value: 0 },
      uSize: { value: pointSize },
      uPixelRatio: { value: dpr },
      uDrift: { value: 1 },
      uOpacity: { value: 1 },
      uColorBase: { value: new Color(palette.cloud) },
      uColorAccent: { value: new Color(palette.accent) },
    }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      shellGeometry.dispose()
    }
  }, [geometry, shellGeometry])

  useFrame((_, delta) => {
    const s = stateRef.current
    elapsed.current += Math.min(delta, 0.05)

    const u = pointsMaterialRef.current?.uniforms
    if (u) {
      u['uTime']!.value = elapsed.current
      u['uScan']!.value = s.scanProgress
      u['uPointCloud']!.value = s.pointCloudProgress
      u['uMesh']!.value = s.meshProgress
      u['uPhenotype']!.value = s.phenotypeProgress
      u['uSize']!.value = pointSize
      u['uPixelRatio']!.value = dpr
      u['uDrift']!.value = reducedMotion ? 0 : 1
    }

    if (shellMaterialRef.current) {
      // Structural shell resolves through GEOMETRY, then recedes as the surface closes.
      shellMaterialRef.current.opacity = s.geometryProgress * 0.17 * (1 - s.phenotypeProgress * 0.5)
    }
  })

  return (
    <group>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={pointsMaterialRef}
          uniforms={initialUniforms}
          vertexShader={specimenVertexShader}
          fragmentShader={specimenFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      <lineSegments geometry={shellGeometry} frustumCulled={false}>
        <lineBasicMaterial
          ref={shellMaterialRef}
          color={palette.accent}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}
