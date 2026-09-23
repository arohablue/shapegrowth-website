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
import {
  annotationCapacity,
  annotationReveal,
  ORDERED_MEASUREMENTS,
  resolveAnnotationPoint,
  type SpecimenBounds,
} from '@/experience/phenotype'
import type { RepresentationWeights } from '@/experience/representation'
import type { Breakpoint } from '@/experience/types'
import { PALETTE } from '@/theme/palette'
import {
  annotationLineFragmentShader,
  annotationLineVertexShader,
  annotationMarkerFragmentShader,
  annotationMarkerVertexShader,
} from './shaders/annotation'

interface Props {
  bounds: SpecimenBounds
  /** Read per frame, not per render — see `annotationCapacity`. */
  breakpointRef: React.RefObject<Breakpoint>
  dpr: number
  weightsRef: React.RefObject<RepresentationWeights>
}

/** Segments along the measured span. Enough that the draw-on reads as smooth. */
const SPAN_SEGMENTS = 20
/** Segments along the leader line out to the label anchor. */
const LEADER_SEGMENTS = 6
/** Fraction of an annotation's reveal spent drawing the span vs the leader. */
const SPAN_SHARE = 0.62

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE MEASUREMENT PASS, DRAWN
 * ────────────────────────────────────────────────────────────────────────────
 * Two draw calls for the whole set: one `lineSegments` for every dimension
 * line, tick and leader, one `points` for every marker. Adding an eighth trait
 * adds no draw calls.
 *
 * The geometry is built once from specimen-space coordinates resolved against
 * the specimen's measured bounds, so it is correct for any asset and any
 * `targetHeight`. Only `aReveal` is touched per frame — 500-odd floats, which
 * is far cheaper than rebuilding positions and, more importantly, keeps the
 * stagger curve in one place (`annotationReveal`) instead of reimplemented in
 * GLSL.
 *
 * Depth testing is ON and `renderOrder` is 3. That combination is the reason
 * these read as annotations *of* an object rather than an overlay on top of a
 * picture of one: a dimension line behind a leaf is occluded by it, so the
 * lines sit in the same space as the specimen.
 */
export function PhenotypeLayer({ bounds, breakpointRef, dpr, weightsRef }: Props) {
  const groupRef = useRef<Group>(null)
  const lineMatRef = useRef<ShaderMaterial>(null)
  const markerMatRef = useRef<ShaderMaterial>(null)

  const annotations = ORDERED_MEASUREMENTS

  /**
   * Line geometry, plus the vertex ranges each annotation owns so the frame
   * loop can write reveals without re-deriving anything.
   */
  const lines = useMemo(() => {
    const perAnnotation = SPAN_SEGMENTS + 1 + 4 + LEADER_SEGMENTS + 1
    const vertexCount = annotations.length * perAnnotation

    const positions = new Float32Array(vertexCount * 3)
    const span = new Float32Array(vertexCount)
    const reveal = new Float32Array(vertexCount)
    const indices: number[] = []

    const a = new Vector3()
    const b = new Vector3()
    const anchor = new Vector3()
    const dir = new Vector3()
    const tick = new Vector3()
    const up = new Vector3(0, 1, 0)
    const p = new Vector3()

    // Tick length scales with the specimen, not with a fixed world constant, so
    // it stays proportionate on a taller or shorter scan.
    const tickLength = bounds.planHalfExtent * 0.045

    annotations.forEach((m, ai) => {
      const base = ai * perAnnotation
      let v = base

      resolveAnnotationPoint(m.startPoint, bounds, a)
      resolveAnnotationPoint(m.endPoint, bounds, b)
      resolveAnnotationPoint(m.anchor, bounds, anchor)

      dir.subVectors(b, a)
      const length = dir.length()
      if (length > 1e-6) dir.multiplyScalar(1 / length)

      // Tick direction: perpendicular to the line, level with the ground. For a
      // vertical dimension line the cross product degenerates, so fall back to
      // world X — which is the correct answer there anyway, since a horizontal
      // tick is what caps a vertical dimension on a drawing.
      tick.crossVectors(dir, up)
      if (tick.lengthSq() < 1e-8) tick.set(1, 0, 0)
      tick.normalize().multiplyScalar(tickLength)

      // ── The measured span ──────────────────────────────────────────────
      const spanStart = v
      for (let i = 0; i <= SPAN_SEGMENTS; i++) {
        const t = i / SPAN_SEGMENTS
        p.lerpVectors(a, b, t)
        positions[v * 3] = p.x
        positions[v * 3 + 1] = p.y
        positions[v * 3 + 2] = p.z
        span[v] = t * SPAN_SHARE
        v++
      }
      for (let i = 0; i < SPAN_SEGMENTS; i++) {
        indices.push(spanStart + i, spanStart + i + 1)
      }

      // ── Tick caps ──────────────────────────────────────────────────────
      // Drawn at the instant their end of the span is reached, which is why
      // each pair carries that end's own `aSpan` rather than 0.
      const tickStart = v
      for (const [end, at] of [
        [a, 0],
        [b, SPAN_SHARE],
      ] as const) {
        for (const s of [-1, 1]) {
          positions[v * 3] = end.x + tick.x * s
          positions[v * 3 + 1] = end.y + tick.y * s
          positions[v * 3 + 2] = end.z + tick.z * s
          span[v] = at
          v++
        }
      }
      indices.push(tickStart, tickStart + 1, tickStart + 2, tickStart + 3)

      // ── Leader out to the label ────────────────────────────────────────
      // Leaves from the point on the span closest to the anchor, not from an
      // endpoint. A leader that starts at an endpoint crosses its own tick cap
      // and the junction reads as a mistake.
      const t0 = closestPointOnSegment(a, b, anchor)
      p.lerpVectors(a, b, t0)
      const leaderStart = v
      for (let i = 0; i <= LEADER_SEGMENTS; i++) {
        const t = i / LEADER_SEGMENTS
        positions[v * 3] = p.x + (anchor.x - p.x) * t
        positions[v * 3 + 1] = p.y + (anchor.y - p.y) * t
        positions[v * 3 + 2] = p.z + (anchor.z - p.z) * t
        span[v] = SPAN_SHARE + t * (1 - SPAN_SHARE)
        v++
      }
      for (let i = 0; i < LEADER_SEGMENTS; i++) {
        indices.push(leaderStart + i, leaderStart + i + 1)
      }
    })

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aSpan', new BufferAttribute(span, 1))
    g.setAttribute('aReveal', new BufferAttribute(reveal, 1))
    g.setIndex(indices)
    return { geometry: g, perAnnotation, revealAttr: g.getAttribute('aReveal') as BufferAttribute }
  }, [annotations, bounds])

  /** Three markers per annotation: both span ends, then the label anchor. */
  const markers = useMemo(() => {
    const n = annotations.length * 3
    const positions = new Float32Array(n * 3)
    const kind = new Float32Array(n)
    const reveal = new Float32Array(n)
    const v = new Vector3()

    annotations.forEach((m, ai) => {
      const pts = [m.startPoint, m.endPoint, m.anchor]
      pts.forEach((pt, k) => {
        const i = ai * 3 + k
        resolveAnnotationPoint(pt, bounds, v)
        positions[i * 3] = v.x
        positions[i * 3 + 1] = v.y
        positions[i * 3 + 2] = v.z
        kind[i] = k === 2 ? 1 : 0
      })
    })

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aKind', new BufferAttribute(kind, 1))
    g.setAttribute('aReveal', new BufferAttribute(reveal, 1))
    return { geometry: g, revealAttr: g.getAttribute('aReveal') as BufferAttribute }
  }, [annotations, bounds])

  useEffect(
    () => () => {
      lines.geometry.dispose()
      markers.geometry.dispose()
    },
    [lines, markers],
  )

  const lineUniforms = useMemo(
    () => ({
      uOpacity: { value: 0 },
      uColor: { value: new Color(PALETTE.cloud) },
      uHeadColor: { value: new Color(PALETTE.accent) },
    }),
    [],
  )

  const markerUniforms = useMemo(
    () => ({
      uSize: { value: 7 },
      uPixelRatio: { value: dpr },
      uOpacity: { value: 0 },
      uColor: { value: new Color(PALETTE.cloud) },
      uAnchorColor: { value: new Color(PALETTE.accent) },
    }),
    [],
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const stage = weightsRef.current.phenotype

    // Absent for 85% of the page. One test rather than two materials' worth of
    // transparent rasterising.
    const visible = stage > 0.001
    group.visible = visible
    if (!visible) return

    const lineReveal = lines.revealAttr
    const markerReveal = markers.revealAttr
    const per = lines.perAnnotation

    // Over-capacity annotations are revealed to 0 rather than filtered out of
    // the geometry, so a resize needs no re-render — see `annotationCapacity`.
    const capacity = annotationCapacity(breakpointRef.current)

    for (let ai = 0; ai < annotations.length; ai++) {
      const m = annotations[ai]!
      const r = m.priority < capacity ? annotationReveal(stage, m.at) : 0
      const base = ai * per
      for (let i = 0; i < per; i++) lineReveal.array[base + i] = r
      const mb = ai * 3
      markerReveal.array[mb] = r
      markerReveal.array[mb + 1] = r
      markerReveal.array[mb + 2] = r
    }
    lineReveal.needsUpdate = true
    markerReveal.needsUpdate = true

    if (lineMatRef.current) lineMatRef.current.uniforms['uOpacity']!.value = 0.78
    if (markerMatRef.current) {
      markerMatRef.current.uniforms['uOpacity']!.value = 0.9
      markerMatRef.current.uniforms['uPixelRatio']!.value = dpr
    }
  })

  return (
    // renderOrder 3: after the mesh (and the residual cloud at 2), so an
    // annotation in front of the specimen draws over it while one behind is
    // still correctly occluded by it.
    <group ref={groupRef} visible={false}>
      <lineSegments geometry={lines.geometry} frustumCulled={false} renderOrder={3}>
        <shaderMaterial
          ref={lineMatRef}
          uniforms={lineUniforms}
          vertexShader={annotationLineVertexShader}
          fragmentShader={annotationLineFragmentShader}
          transparent
          depthWrite={false}
          depthTest
          blending={NormalBlending}
        />
      </lineSegments>

      <points geometry={markers.geometry} frustumCulled={false} renderOrder={3}>
        <shaderMaterial
          ref={markerMatRef}
          uniforms={markerUniforms}
          vertexShader={annotationMarkerVertexShader}
          fragmentShader={annotationMarkerFragmentShader}
          transparent
          depthWrite={false}
          depthTest
          blending={NormalBlending}
        />
      </points>
    </group>
  )
}

/** Parameter of the point on segment ab nearest p, clamped to the segment. */
function closestPointOnSegment(a: Vector3, b: Vector3, p: Vector3): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const lenSq = abx * abx + aby * aby + abz * abz
  if (lenSq < 1e-9) return 0
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lenSq
  return t < 0 ? 0 : t > 1 ? 1 : t
}
