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
import { usePalette } from '@/theme/ThemeContext'
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
 * How far forward of the orbit the camera is mounted, as a fraction of
 * `bodyLength`. Equivalently: which point on the body actually rides the path.
 *
 * It was 0 — the lens front sat on the orbit and the whole body hung outboard of
 * it — and that is a mobile framing bug, not a matter of taste. Local -Z is the
 * outward radial direction, so a body of length L puts its housing at an
 * effective radius of `orbitRadius + L`. Measured max |ndc.x| across the beat at
 * 375x812, sweeping radius:
 *
 *   r      1.90   1.95   2.00   2.05   2.10   2.15   2.20   2.32
 *   |x|   0.878  0.901  0.925  0.949  0.973  0.998  1.022  1.082
 *
 * 1.90 is the orbit (`orbitRadius`, chosen against exactly this constraint) and
 * 2.32 is where the housing reached. So for roughly p 0.115–0.165 the camera was
 * sliced by the right edge of the frame at full opacity — the rays converged on
 * a vertex that was not there. Desktop never showed it: 0.535 at its worst.
 *
 * 0.62 is not tuned to the table, it is `zYoke`. Putting the mount on the
 * trajectory is what a rig actually does — the yoke rides the gantry and the
 * lens reaches in past it — and it lands the housing at r = 2.06, which
 * measures 0.980 rather than the 0.949 the table predicts: the housing's back
 * corners are `hw` off-axis, and at the orbit's extremes that tangential width
 * leaks into ndc.x too. In frame, but by about four CSS pixels at 375.
 *
 * That is thin, and it is thin because both ends are now binding — the body has
 * to fit between the specimen's 1.45 measured plan radius in the orbit's
 * horizontal slab and the frame's ~2.05, a 0.6-wide window that a 0.42 body
 * leaves 0.18 of. Buying margin means a shorter camera (the range `bodyLength`
 * documents is already near its floor) or a tighter orbit (`orbitRadius` is at
 * its own floor for the same specimen reason), so there is no cheap 0.02 here.
 * Anything narrower than 375 will grip the housing's back corner.
 */
const MOUNT_Z = 0.62

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE INSTRUMENT
 * ────────────────────────────────────────────────────────────────────────────
 * A camera on a circular trajectory around the specimen: the path it travels,
 * the viewpoints marked along it, the field of view of the one it currently
 * occupies, and the instrument itself. Four draw calls, no clock, no state.
 *
 * All four read a single number — `rigAngle` — so there is one moving thing in
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
  const palette = usePalette()
  const groupRef = useRef<Group>(null)
  const frustumRef = useRef<Group>(null)
  const ringMatRef = useRef<ShaderMaterial>(null)
  const frustumMatRef = useRef<ShaderMaterial>(null)
  const bodyMatRef = useRef<ShaderMaterial>(null)
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
  // Apex at `MOUNT_Z` on the local +Z axis, opening further down +Z, so a single
  // `lookAt` aims it.
  //
  // Not at the local origin, which is where it started and which cost the beat
  // its worst frame on mobile — see `MOUNT_Z`. The far rectangle has not moved:
  // `d` is still measured from the origin, so the rays stop exactly where they
  // always did and only the apex slid forward. The cone therefore widens from
  // ~30° to ~38° full, which is still an ordinary lens.
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
      [0, 0, MOUNT_Z * config.bodyLength],
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
  }, [config.orbitRadius, config.frustumReach, config.bodyLength])

  // ── The camera itself ────────────────────────────────────────────────────
  // Built in the same local frame as the frustum and parented to it, so it is
  // carried around the orbit and aimed by the one `lookAt` already in the frame
  // loop. Nothing new reads the rig's angle; the instrument stays a single
  // moving thing.
  //
  // The frustum apex and the lens are the same point, so the field of view
  // visibly originates at the glass — but that point is `MOUNT_Z` forward of the
  // orbit, not on it. The body still extends down -Z, away from the specimen;
  // it just no longer hangs entirely outboard of the path.
  //
  // Drawn as edges rather than shaded solids, which is the decision that keeps
  // this from becoming a prop. A lit box next to an unlit point cloud reads as
  // an object from a different render, and the whole rig's vocabulary is thin
  // constant-width lines. What makes it legible as equipment is not shading, it
  // is the three parts being recognisable: a round barrel on a square housing on
  // a yoke. That silhouette is a machine-vision camera on a gantry mount and
  // nothing else, at any size, from any angle.
  const bodyGeometry = useMemo(() => {
    const L = config.bodyLength
    const pts: Array<[number, number, number]> = []
    const segments: Array<[number, number]> = []
    // Every vertex slides forward by the mount offset, so the numbers below can
    // stay written in the natural frame — lens front at 0, housing back at -L.
    const zMount = MOUNT_Z * L
    const push = (p: [number, number, number]) =>
      pts.push([p[0], p[1], p[2] + zMount]) - 1

    // Lens barrel — two octagonal rings joined by eight runners. Octagonal, not
    // a real circle: at this size a 32-gon costs 32 extra segments to render as
    // the same handful of pixels, and eight facets read as a machined part
    // rather than as a low-poly approximation of a smooth one.
    const FACETS = 8
    const rFront = 0.3 * L
    const rBack = 0.33 * L
    const zBarrel = -0.26 * L
    const front: number[] = []
    const back: number[] = []
    for (let i = 0; i < FACETS; i++) {
      const a = (i / FACETS) * Math.PI * 2
      front.push(push([Math.cos(a) * rFront, Math.sin(a) * rFront, 0]))
      back.push(push([Math.cos(a) * rBack, Math.sin(a) * rBack, zBarrel]))
    }
    for (let i = 0; i < FACETS; i++) {
      const j = (i + 1) % FACETS
      segments.push([front[i]!, front[j]!], [back[i]!, back[j]!], [front[i]!, back[i]!])
    }

    // Housing — the sensor box behind the lens. The barrel's rear ring sits
    // inside the box's front face, both at zBarrel, so no connecting edges are
    // needed: an octagon inscribed in a rectangle already reads as a lens
    // mounted on a plate, and drawing the join would only add clutter at the
    // busiest part of the silhouette.
    const hw = 0.42 * L
    const hh = 0.32 * L
    const zBack = -1 * L
    const box: number[] = []
    for (const z of [zBarrel, zBack])
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const)
        box.push(push([sx * hw, sy * hh, z]))
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      segments.push([box[i]!, box[j]!], [box[4 + i]!, box[4 + j]!], [box[i]!, box[4 + i]!])
    }

    // Yoke — two arms dropping from the housing's flanks to a crossbar beneath
    // it. `-MOUNT_Z * L` puts the crossbar at the group origin once `push`
    // applies the offset, so the yoke is the part sitting on the trajectory,
    // which is the whole reason `MOUNT_Z` is this number and not another.
    //
    // It is on the path in plan but still hangs below it in y, which is the
    // distinction that matters. A mount that terminates *on* the line draws
    // attention to the fact that the path is infinitely thin with no rail under
    // it; one that stops short reads as the head of a support continuing out of
    // frame, which is what the eye expects of apparatus it can only partly see.
    const zYoke = -MOUNT_Z * L
    const yFoot = -0.58 * L
    const footL = push([-hw, yFoot, zYoke])
    const footR = push([hw, yFoot, zYoke])
    const hipL = push([-hw, -hh, zYoke])
    const hipR = push([hw, -hh, zYoke])
    segments.push([hipL, footL], [hipR, footR], [footL, footR])

    const positions = new Float32Array(pts.length * 3)
    pts.forEach((p, i) => positions.set(p, i * 3))
    const indices = new Uint16Array(segments.length * 2)
    segments.forEach((s, i) => {
      indices[i * 2] = s[0]
      indices[i * 2 + 1] = s[1]
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    // Every vertex at aAt = 0 so the shared line shader's `ray` term evaluates
    // to 1 and the body draws at even strength, instead of fading along its
    // length the way a frustum edge is supposed to. See `bodyUniforms` for the
    // other half of that — a fixed uHead, which is what stops the body flashing
    // accent as the traverse passes its own position.
    g.setAttribute('aAt', new BufferAttribute(new Float32Array(pts.length), 1))
    g.setIndex(new BufferAttribute(indices, 1))
    return g
  }, [config.bodyLength])

  useEffect(
    () => () => {
      ringGeometry.dispose()
      stationGeometry.dispose()
      frustumGeometry.dispose()
      bodyGeometry.dispose()
    },
    [ringGeometry, stationGeometry, frustumGeometry, bodyGeometry],
  )

  const lineUniforms = useMemo(
    () => ({
      uHead: { value: 0 },
      uTrail: { value: 1 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(palette.cloud) },
      uHeadColor: { value: new Color(palette.accent) },
    }),
    [],
  )

  const frustumUniforms = useMemo(
    () => ({
      uHead: { value: 0 },
      uTrail: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(palette.cloud) },
      uHeadColor: { value: new Color(palette.accent) },
    }),
    [],
  )

  // The camera body reuses the frustum's shader but never animates: `uHead` is
  // pinned at 1 and never written. With every vertex at aAt = 0 that makes
  // `since` a constant 1, so the head term is exp(-38) ≈ 0 and the body stays
  // `uColor` at full `ray`. Leaving uHead live instead would have flushed the
  // whole camera accent-green for the first few per cent of the traverse — the
  // shader would have been reading "the rig has just arrived at the camera",
  // which is true and meaningless, because the camera is the thing arriving.
  const bodyUniforms = useMemo(
    () => ({
      uHead: { value: 1 },
      uTrail: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new Color(palette.cloud) },
      uHeadColor: { value: new Color(palette.cloud) },
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
      uColor: { value: new Color(palette.cloud) },
      uFlashColor: { value: new Color(palette.accent) },
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
    // Opacity only. `uHead` stays where it was built — see `bodyUniforms`.
    if (bodyMatRef.current) {
      bodyMatRef.current.uniforms['uOpacity']!.value = config.bodyOpacity * w.rigOpacity
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

      {/* Both children share this group's pose, which is the whole reason the
          camera needed no new state: the frame loop already puts this origin on
          the orbit and aims it at the specimen. */}
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

        <lineSegments geometry={bodyGeometry} frustumCulled={false} renderOrder={0}>
          <shaderMaterial
            ref={bodyMatRef}
            uniforms={bodyUniforms}
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
