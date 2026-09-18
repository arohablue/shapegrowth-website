import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type PerspectiveCamera } from 'three'
import { useProgressContext } from '@/progress/ProgressContext'
import { damp } from '@/experience/easing'
import { CAMERA_FOV, createCameraState, sampleCameraSpline } from '@/experience/cameraSpline'
import { solveFramingScale } from '@/experience/framing'
import type { Breakpoint } from '@/experience/types'

/** Preallocated. Nothing in the frame loop is permitted to allocate. */
const desiredPosition = new Vector3()
const desiredTarget = new Vector3()
const holdFraming = createCameraState()

/**
 * Applies the sampled camera curve to the real camera.
 *
 * The rig owns no timing of its own — it reads `state.camera`, which was already
 * derived from experienceProgress by the progress loop. A second smoothing pass
 * is applied here purely to absorb the one-frame boundary between the GSAP
 * ticker and the R3F loop.
 */
export function CameraRig() {
  const { stateRef, breakpointRef, reducedMotion } = useProgressContext()
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const currentTarget = useRef(new Vector3(0, 0, 0))
  const initialised = useRef(false)

  /**
   * Aspect-fit multiplier on the camera's distance from its target. See
   * `framing.ts` — the keyframe tables are chosen by a width breakpoint, but
   * what crops a subject is aspect, and the two disagree on portrait tablets.
   *
   * Recomputed only when the aspect or the breakpoint actually changes, in the
   * same compare-before-assign style as `fov` below. `camera.aspect` is
   * maintained by R3F on canvas resize, so this needs no second subscription
   * and no resize listener of its own.
   */
  const fit = useRef(1)
  const lastAspect = useRef(0)
  const lastBreakpoint = useRef<Breakpoint | null>(null)

  useFrame((_, delta) => {
    const { camera: desired } = stateRef.current
    const dt = Math.min(delta, 0.05)

    // The lens widens on mobile because a near-cubic subject in a 0.46 aspect
    // frame is width-bound; see CAMERA_FOV. Compared before assigning so this
    // costs one float test per frame and only rebuilds the projection matrix on
    // an actual breakpoint change.
    const breakpoint = breakpointRef.current
    const fov = CAMERA_FOV[breakpoint]
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    if (camera.aspect !== lastAspect.current || breakpoint !== lastBreakpoint.current) {
      lastAspect.current = camera.aspect
      lastBreakpoint.current = breakpoint
      fit.current = solveFramingScale(breakpoint, fov, camera.aspect)
    }

    desiredPosition.set(desired.position[0], desired.position[1], desired.position[2])
    desiredTarget.set(desired.target[0], desired.target[1], desired.target[2])

    if (reducedMotion) {
      // Hold a single framing; no scroll-driven camera motion at all. Sampled
      // from the same spline rather than hardcoded, so the mobile rig's much
      // greater working distance is respected — a fixed desktop z would clip
      // the specimen's sides on a phone.
      sampleCameraSpline(0.35, breakpointRef.current, holdFraming)
      desiredPosition.set(holdFraming.position[0], holdFraming.position[1], holdFraming.position[2])
      desiredTarget.set(holdFraming.target[0], holdFraming.target[1], holdFraming.target[2])
    }

    // Applied after the reduced-motion branch so the held framing is fitted
    // too — that is the one framing some readers will ever see. Scaling the
    // offset from the target rather than the position keeps the gesture's
    // shape and only changes its radius; `fit` is 1 on every phone, desktop
    // and ultrawide viewport, so those paths are arithmetically unchanged.
    if (fit.current !== 1) {
      desiredPosition.sub(desiredTarget).multiplyScalar(fit.current).add(desiredTarget)
    }

    if (!initialised.current) {
      camera.position.copy(desiredPosition)
      currentTarget.current.copy(desiredTarget)
      initialised.current = true
    } else {
      camera.position.x = damp(camera.position.x, desiredPosition.x, 14, dt)
      camera.position.y = damp(camera.position.y, desiredPosition.y, 14, dt)
      camera.position.z = damp(camera.position.z, desiredPosition.z, 14, dt)

      currentTarget.current.x = damp(currentTarget.current.x, desiredTarget.x, 14, dt)
      currentTarget.current.y = damp(currentTarget.current.y, desiredTarget.y, 14, dt)
      currentTarget.current.z = damp(currentTarget.current.z, desiredTarget.z, 14, dt)
    }

    camera.lookAt(currentTarget.current)
  }, -900)

  return null
}
