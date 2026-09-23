import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, NormalBlending, type BufferGeometry, type ShaderMaterial } from 'three'
import type { RepresentationWeights } from '@/experience/representation'
import { PALETTE } from '@/theme/palette'
import type { WireframeConfig } from './pointCloudConfig'
import { wireframeFragmentShader, wireframeVertexShader } from './shaders/wireframe'

interface Props {
  geometry: BufferGeometry
  config: WireframeConfig
  weightsRef: React.RefObject<RepresentationWeights>
}

/**
 * The edges of the reconstruction, as one `LineSegments` draw call.
 *
 * Independent of both neighbours: it takes its own config and its own two
 * weights, so it can be tuned or disabled without touching the particles or the
 * surface. What ties it to them is not code but shared *direction* — edges grow
 * upward from the base in the same order the samples snapped and the same order
 * the surface will close, and that shared direction is what makes three
 * overlapping windows read as one process instead of three effects.
 *
 * `wireBuild` and `wireOpacity` are separate on purpose. Build is monotone in
 * progress so an edge that has grown never retracts; opacity is free to fall
 * away as the surface takes priority. Collapsing them into one number makes
 * back-scrolling look like the mesh is being un-built, which is wrong — the
 * structure is a fact once inferred.
 */
export function WireframeLayer({ geometry, config, weightsRef }: Props) {
  const materialRef = useRef<ShaderMaterial>(null)

  const initialUniforms = useMemo(
    () => ({
      uBuild: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(PALETTE.cloud) },
      uFrontColor: { value: new Color(PALETTE.accent) },
    }),
    [],
  )

  // No clock. This layer is now a pure function of scroll progress — nothing in
  // it advances with time — which is why scrubbing it backwards is exact.
  useFrame(() => {
    const material = materialRef.current
    if (!material) return

    const w = weightsRef.current
    const u = material.uniforms
    const opacity = config.opacity * w.wireOpacity

    u['uBuild']!.value = w.wireBuild
    u['uOpacity']!.value = opacity

    material.visible = opacity > 0.002 && w.wireBuild > 0.001
  })

  return (
    // renderOrder 1: between surface and particles. depthWrite off so edges
    // never occlude each other, depthTest on so the surface hides the far side
    // once it has closed.
    <lineSegments geometry={geometry} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        ref={materialRef}
        uniforms={initialUniforms}
        vertexShader={wireframeVertexShader}
        fragmentShader={wireframeFragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={NormalBlending}
      />
    </lineSegments>
  )
}
