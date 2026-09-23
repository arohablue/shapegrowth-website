import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Vector3,
  type Group,
  type ShaderMaterial,
} from 'three'
import { traverseToAzimuth } from '@/experience/captureRig'
import type { RepresentationWeights } from '@/experience/representation'
import { PALETTE } from '@/theme/palette'
import type { CaptureConfig } from './pointCloudConfig'
import {
  captureLineFragmentShader,
  captureLineVertexShader,
  capturePointFragmentShader,
  capturePointVertexShader,
} from './shaders/capture'

interface Props {
  config: CaptureConfig
  dpr: number
  weightsRef: React.RefObject<RepresentationWeights>
}

/** Preallocated. The frame loop is not permitted to allocate. */
const SPECIMEN_CENTRE = new Vector3(0, 0, 0)

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE INSTRUMENT
 * ────────────────────────────────────────────────────────────────────────────
 * A sensor on a circular trajectory around the specimen: the path it travels,
 * the viewpoints marked along it, and the field of view of the one it currently
 * occupies. Three draw calls, no clock, no state.
 *
 * All three read a single number — `rigAngle` — so there is one moving thing in
 * this beat and everything else is a consequence of where it is. The plant's
 * lit side (in the point cloud shader) and the tie points (in `TiePointLayer`)
 * read the same number, which is what makes the capture read as one instrument
 * doing one thing rather than four effects that happen to be simultaneous.
 *
 * The rig is geometry, not a post effect, so it occludes and is occluded
 * correctly: the far side of the orbit passes behind the plant. That single
 * property does most of the work of making it feel like apparatus in the same
 * room as the specimen rather than an overlay on a picture of one.
 */
export function CaptureRig({ config, dpr, weightsRef }: Props) {
  const groupRef = useRef<Group>(null)
  const frustumRef = useRef<Group>(null)
  const ringMatRef = useRef<ShaderMaterial>(null)
  const frustumMatRef = useRef<ShaderMaterial>(null)
  const stationMatRef = useRef<ShaderMaterial>(null)

  // ── Orbit path ───────────────────────────────────────────────────────────
  // Explicit segment pairs rather than a LineLoop so the closing segment can
  // carry aAt = 1.0. With a loop its final vertex is index 0, whose aAt is 0,
  // so the head brightening tears across the seam on the last few per cent of
  // the traverse — visible as a flicker at exactly the moment the pass
  // completes.
  const ringGeometry = useMemo(() => {
    const SEGMENTS = 192
    const positions = new Float32Array((SEGMENTS + 1) * 3)
    const at = new Float32Array(SEGMENTS + 1)
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS
      const a = traverseToAzimuth(t)
      positions[i * 3] = Math.sin(a) * config.orbitRadius
      positions[i * 3 + 1] = config.orbitHeight
      positions[i * 3 + 2] = Math.cos(a) * config.orbitRadius
      at[i] = t
    }
    const indices = new Uint16Array(SEGMENTS * 2)
    for (let i = 0; i < SEGMENTS; i++) {
      indices[i * 2] = i
      indices[i * 2 + 1] = i + 1
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aAt', new BufferAttribute(at, 1))
    g.setIndex(new BufferAttribute(indices, 1))
    return g
  }, [config.orbitRadius, config.orbitHeight])

  // ── Marked viewpoints ────────────────────────────────────────────────────
  const stationGeometry = useMemo(() => {
    const n = config.stations
    const positions = new Float32Array(n * 3)
    const at = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / n
      const a = traverseToAzimuth(t)
      positions[i * 3] = Math.sin(a) * config.orbitRadius
      positions[i * 3 + 1] = config.orbitHeight
      positions[i * 3 + 2] = Math.cos(a) * config.orbitRadius
      at[i] = t
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aAt', new BufferAttribute(at, 1))
    return g
  }, [config.stations, config.orbitRadius, config.orbitHeight])

  // ── Field of view of the current viewpoint ───────────────────────────────
  // Apex at the local origin, opening down +Z, so a single `lookAt` aims it.
  //
  // +Z, not -Z, and this is the one thing in the file most likely to be "fixed"
  // back into a bug. A camera's lookAt aims its local -Z at the target, so -Z
  // is the intuitive choice here and it is wrong: this is a plain Group, and
  // Object3D.lookAt aims local +Z. Built down -Z the cone opens 180° away from
  // the specimen — the apex still rides the orbit correctly, so the rig appears
  // to travel properly while its field of view splays off the far side of the
  // frame. It looks like a framing or radius problem, not an axis one.
  //
  // Portrait rather than landscape: the subject is 3.2 units tall and 2.9 wide,
  // and a rig framed for it would be turned on its side. It is a small detail
  // that costs one number and is the difference between "a camera" and "a
  // generic viewing cone".
  const frustumGeometry = useMemo(() => {
    const d = config.orbitRadius * config.frustumReach
    const hw = d * 0.27
    const hh = d * 0.36
    // apex, then the four far corners
    const pts: Array<[number, number, number]> = [
      [0, 0, 0],
      [-hw, -hh, d],
      [hw, -hh, d],
      [hw, hh, d],
      [-hw, hh, d],
    ]
    const at = [0, 1, 1, 1, 1]
    const segments = [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1],
    ]
    const positions = new Float32Array(pts.length * 3)
    pts.forEach((p, i) => positions.set(p, i * 3))
    const indices = new Uint16Array(segments.length * 2)
    segments.forEach((s, i) => {
      indices[i * 2] = s[0]!
      indices[i * 2 + 1] = s[1]!
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aAt', new BufferAttribute(new Float32Array(at), 1))
    g.setIndex(new BufferAttribute(indices, 1))
    return g
  }, [config.orbitRadius, config.frustumReach])

  useEffect(
    () => () => {
      ringGeometry.dispose()
      stationGeometry.dispose()
      frustumGeometry.dispose()
    },
    [ringGeometry, stationGeometry, frustumGeometry],
  )

  const lineUniforms = useMemo(
    () => ({
      uHead: { value: 0 },
      uTrail: { value: 1 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(PALETTE.cloud) },
      uHeadColor: { value: new Color(PALETTE.accent) },
    }),
    [],
  )

  const frustumUniforms = useMemo(
    () => ({
      uHead: { value: 0 },
      uTrail: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(PALETTE.cloud) },
      uHeadColor: { value: new Color(PALETTE.accent) },
    }),
    [],
  )

  const stationUniforms = useMemo(
    () => ({
      uSize: { value: config.stationSize },
      uPixelRatio: { value: dpr },
      uMaxPixelSize: { value: 9 },
      uHead: { value: 0 },
      uFlashWidth: { value: 0.045 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(PALETTE.cloud) },
      uFlashColor: { value: new Color(PALETTE.accent) },
    }),
    [],
  )

  useFrame(() => {
    const w = weightsRef.current
    const group = groupRef.current
    if (!group) return

    // One test, one early-out. The rig is absent for 70% of the page and
    // rasterising three fully transparent objects for all of it is waste that
    // shows up on the low tier.
    const visible = w.rigOpacity > 0.004
    group.visible = visible
    if (!visible) return

    const head = w.rigAngle

    if (ringMatRef.current) {
      ringMatRef.current.uniforms['uHead']!.value = head
      ringMatRef.current.uniforms['uOpacity']!.value = config.ringOpacity * w.rigOpacity
    }
    if (frustumMatRef.current) {
      frustumMatRef.current.uniforms['uHead']!.value = head
      frustumMatRef.current.uniforms['uOpacity']!.value = config.frustumOpacity * w.rigOpacity
    }
    if (stationMatRef.current) {
      const u = stationMatRef.current.uniforms
      u['uHead']!.value = head
      u['uOpacity']!.value = w.rigOpacity
      u['uSize']!.value = config.stationSize
      u['uPixelRatio']!.value = dpr
    }

    // The sensor's own pose. Continuous along the path even though the marked
    // viewpoints are discrete — a rig that teleported between stations would be
    // the "mechanical" motion this pass is meant to remove, and a real gantry
    // travels through the intermediate angles whether or not it captures there.
    const frustum = frustumRef.current
    if (frustum) {
      const a = traverseToAzimuth(head)
      frustum.position.set(
        Math.sin(a) * config.orbitRadius,
        config.orbitHeight,
        Math.cos(a) * config.orbitRadius,
      )
      frustum.lookAt(SPECIMEN_CENTRE)
    }
  })

  return (
    // renderOrder 0 with depth testing on: the instrument is in the room with
    // the specimen, so the far half of the orbit is correctly hidden behind it.
    <group ref={groupRef} visible={false}>
      <lineSegments geometry={ringGeometry} frustumCulled={false} renderOrder={0}>
        <shaderMaterial
          ref={ringMatRef}
          uniforms={lineUniforms}
          vertexShader={captureLineVertexShader}
          fragmentShader={captureLineFragmentShader}
          transparent
          depthWrite={false}
          depthTest
          blending={NormalBlending}
        />
      </lineSegments>

      <points geometry={stationGeometry} frustumCulled={false} renderOrder={0}>
        <shaderMaterial
          ref={stationMatRef}
          uniforms={stationUniforms}
          vertexShader={capturePointVertexShader}
          fragmentShader={capturePointFragmentShader}
          transparent
          depthWrite={false}
          depthTest
          blending={NormalBlending}
        />
      </points>

      <group ref={frustumRef}>
        <lineSegments geometry={frustumGeometry} frustumCulled={false} renderOrder={0}>
          <shaderMaterial
            ref={frustumMatRef}
            uniforms={frustumUniforms}
            vertexShader={captureLineVertexShader}
            fragmentShader={captureLineFragmentShader}
            transparent
            depthWrite={false}
            depthTest
            blending={NormalBlending}
          />
        </lineSegments>
      </group>
    </group>
  )
}
