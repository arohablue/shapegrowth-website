import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  type ShaderMaterial,
} from 'three'
import { traverseAtPosition } from '@/experience/captureRig'
import type { RepresentationWeights } from '@/experience/representation'
import { usePalette } from '@/theme/ThemeContext'
import type { CaptureConfig } from './pointCloudConfig'
import { capturePointFragmentShader, capturePointVertexShader } from './shaders/capture'

interface Props {
  /** The scan's geometry. Tie points are drawn FROM it, never invented. */
  source: BufferGeometry
  config: CaptureConfig
  dpr: number
  weightsRef: React.RefObject<RepresentationWeights>
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * SPARSE TIE POINTS — "INFORMATION ACCUMULATES"
 * ────────────────────────────────────────────────────────────────────────────
 * The middle term of the sequence. Between "a camera is looking at a plant" and
 * "here is a dense point cloud" there has to be something that *is* the
 * information being gathered, or the cloud simply appears and the capture beat
 * was decoration.
 *
 * This is also the one part of the rig that is scientifically load-bearing
 * rather than illustrative. A multi-view pipeline genuinely produces a sparse
 * set of matched points first — a few hundred — and densifies afterwards. So
 * the beat is not a stylisation of the process; it is the process, at the right
 * order of magnitude, in the right order.
 *
 * Two decisions carry it:
 *
 *   • The points are a decimation of the real scan, not generated. They are
 *     therefore guaranteed to lie on the specimen, and when the dense cloud
 *     arrives it arrives *around them* — same object, more of it. Scattering
 *     invented points near the plant was the obvious cheaper approach and it
 *     fails at exactly the handoff, because the invented points and the real
 *     ones don't agree and the eye reads two different objects.
 *
 *   • Which point appears when is decided by its own azimuth, so the sparse set
 *     fills in behind the rig. Coverage is a consequence of where the sensor
 *     has been, which is the entire claim the capture sequence is making.
 */
export function TiePointLayer({ source, config, dpr, weightsRef }: Props) {
  const palette = usePalette()
  const materialRef = useRef<ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const src = source.getAttribute('position').array as Float32Array
    const total = Math.floor(src.length / 3)
    const wanted = Math.min(config.tiePointCount, total)
    // Uniform stride, not random. Deterministic means the same scan always
    // produces the same tie points, so this beat is reproducible frame to frame
    // and run to run — and a stride over a scan's storage order is arbitrary in
    // space, which is what we want, without needing an RNG.
    const stride = Math.max(1, Math.floor(total / wanted))
    const n = Math.floor((total - 1) / stride) + 1

    const positions = new Float32Array(n * 3)
    const at = new Float32Array(n)

    for (let i = 0; i < n; i++) {
      const s = i * stride * 3
      const x = src[s]!
      const y = src[s + 1]!
      const z = src[s + 2]!
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      // Exact inverse of the rig's placement, from the shared module. Written
      // out locally this was a standing hazard: if the two disagree the tie
      // points appear on the side of the plant the sensor is NOT looking at,
      // which reads as a broken reveal rather than as a sign convention.
      at[i] = traverseAtPosition(x, z)
    }

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aAt', new BufferAttribute(at, 1))
    return g
  }, [source, config.tiePointCount])

  useEffect(() => () => geometry.dispose(), [geometry])

  const initialUniforms = useMemo(
    () => ({
      uSize: { value: config.tiePointSize },
      uPixelRatio: { value: dpr },
      uMaxPixelSize: { value: 7 },
      uHead: { value: 0 },
      // Tighter than a station's. A viewpoint is *arrived at* and dwelt on; an
      // individual sample is just registered. Same mechanism, different
      // duration, and the difference is what makes them read as two kinds of
      // thing rather than two sizes of the same thing.
      uFlashWidth: { value: 0.014 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(palette.cloud) },
      uFlashColor: { value: new Color(palette.accent) },
    }),
    [],
  )

  useFrame(() => {
    const material = materialRef.current
    if (!material) return

    const w = weightsRef.current
    const u = material.uniforms
    const opacity = w.tiePoints

    u['uHead']!.value = w.rigAngle
    u['uOpacity']!.value = opacity
    u['uSize']!.value = config.tiePointSize
    u['uPixelRatio']!.value = dpr

    material.visible = opacity > 0.004
  })

  return (
    // renderOrder 2, same band as the point cloud: these are data about the
    // specimen and belong at the same depth in the stack, not on top of it.
    <points geometry={geometry} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={materialRef}
        uniforms={initialUniforms}
        vertexShader={capturePointVertexShader}
        fragmentShader={capturePointFragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={NormalBlending}
      />
    </points>
  )
}
