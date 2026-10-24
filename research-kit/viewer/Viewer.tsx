/**
 * The 3D canvas: point clouds in the scanner's frame, re-oriented for the
 * screen, orbit controls always live. No narration, no scripted camera — this
 * is a researcher's viewer, and the data is the interface.
 *
 * AXES. The scans are +z-up with large x/y offsets (M05's y sits near −800);
 * three.js is y-up. The clouds are therefore wrapped in
 *   rotate(−90° about x) · scale(2/diagonal) · translate(−centre)
 * so the plant stands upright at the origin about two world units tall. The
 * check that the rotation is the right way round: growth must read on
 * world-y — the plant gets taller, not deeper.
 *
 * Colours: day t is blue, day t+1 is red, in every mode that shows them.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { DetJColoring, DisplacementColoring } from './colors'
import type { SpecimenArrays, SpecimenRecord } from './manifest'

export type ViewMode = 'day-t' | 'day-t1' | 'both' | 'registered' | 'displacement' | 'detj'

export const MODE_LABELS: Record<ViewMode, string> = {
  'day-t': 'day t',
  'day-t1': 'day t+1',
  both: 'both days',
  registered: 'registered',
  displacement: 'displacement',
  detj: 'det J',
}

const DAY_T_BLUE = '#4f9cf9'
const DAY_T1_RED = '#f25757'

function Controls() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const ref = useRef<OrbitControls | null>(null)
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    ref.current = controls
    return () => {
      controls.dispose()
      ref.current = null
    }
  }, [camera, gl])
  useFrame(() => ref.current?.update())
  return null
}

function useGeometry(positions: Float32Array, colors?: Float32Array): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [positions, colors])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Cloud(props: {
  positions: Float32Array
  color?: string
  colors?: Float32Array
  size?: number
  opacity?: number
}) {
  const geometry = useGeometry(props.positions, props.colors)
  const opacity = props.opacity ?? 1
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={props.size ?? 2.4}
        sizeAttenuation={false}
        color={props.colors ? undefined : props.color}
        vertexColors={Boolean(props.colors)}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </points>
  )
}

/**
 * The displacement vectors at TRUE length — each tip is a point of the warped
 * cloud. Never scaled up for legibility; zoom instead.
 */
function FieldLines(props: { coloring: DisplacementColoring }) {
  const geometry = useGeometry(props.coloring.linePositions, props.coloring.lineColors)
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </lineSegments>
  )
}

export function Viewer(props: {
  specimen: SpecimenRecord
  arrays: SpecimenArrays
  mode: ViewMode
  displacementColoring: DisplacementColoring
  detJColoring: DetJColoring
}) {
  const { specimen, arrays, mode } = props
  const bounds = specimen.diagnostics.bounds
  const scale = 2 / bounds.diagonal
  const centre = bounds.centre

  return (
    <Canvas
      // Positioned for a plant ~2 units tall centred on the origin after the
      // normalisation below.
      camera={{ position: [1.7, 1.1, 1.7], fov: 45, near: 0.01, far: 50 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#101216']} />
      <Controls />
      {/* scanner frame (+z up) → screen frame (+y up), unit size, origin centre */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group scale={scale}>
          <group position={[-centre[0], -centre[1], -centre[2]]}>
            {(mode === 'day-t' || mode === 'both') && (
              <Cloud positions={arrays.src} color={DAY_T_BLUE} />
            )}
            {(mode === 'day-t1' || mode === 'both') && (
              <Cloud positions={arrays.tgt} color={DAY_T1_RED} opacity={mode === 'both' ? 0.5 : 1} />
            )}
            {mode === 'registered' && (
              <>
                <Cloud positions={arrays.warped} color={DAY_T_BLUE} />
                <Cloud positions={arrays.tgt} color={DAY_T1_RED} opacity={0.5} />
              </>
            )}
            {mode === 'displacement' && (
              <>
                {/* Day t+1, faintest and furthest back. Every vector tip is a
                    point of the warped cloud — the thing the registration
                    fitted to this surface — so seeing the tips arrive on it is
                    the check that the fit did its job. Without it the field is
                    a shape in space with nothing to land on. */}
                <Cloud positions={arrays.tgt} color={DAY_T1_RED} size={3.4} opacity={0.3} />
                {/* Day t in its own blue, NOT turbo: colouring the surface by
                    magnitude made the points vanish into the equally-turbo
                    lines. Turbo belongs to the vectors alone; the clouds keep
                    the blue/red identity they have in every other mode. */}
                <Cloud positions={arrays.src} color={DAY_T_BLUE} size={2.6} opacity={0.65} />
                <FieldLines coloring={props.displacementColoring} />
              </>
            )}
            {mode === 'detj' && <Cloud positions={arrays.src} colors={props.detJColoring.point} size={3.0} />}
          </group>
        </group>
      </group>
    </Canvas>
  )
}
