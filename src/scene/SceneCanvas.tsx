import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useCallback, useRef, useState } from 'react'
import { PALETTE } from '@/theme/palette'
import { CAMERA_FOV } from '@/experience/cameraSpline'
import { useProgressContext } from '@/progress/ProgressContext'
import { AnnotationLabels, createAnnotationLabelHandles } from './AnnotationLabels'
import { CameraRig } from './CameraRig'
import { PlantReconstructionScene } from './PlantReconstructionScene'
import { SceneInspector } from '@/dev/SceneInspector'
import { hudEnabled } from '@/dev/TimelineHUD'

/**
 * Quality tiers are probed from the device, not inferred from viewport width.
 * A flagship phone should get the high tier with mobile camera framing; a weak
 * laptop should get the low tier with desktop framing. The two are orthogonal.
 *
 * ABSENT SIGNALS ARE SKIPPED, NOT SCORED AS BAD ONES
 * ──────────────────────────────────────────────────
 * `navigator.deviceMemory` is Chromium-only. The previous `?? 4` defaulted it to
 * the exact value the next line tests as weak, so `memory <= 4` was true on
 * every browser that does not implement it — putting all of Safari and Firefox
 * in the low tier regardless of hardware, and, through `antialias: tier !==
 * 'low'`, disabling MSAA for all of them. On the machine this was measured on
 * (11 cores, Chrome) the same code correctly returns `high`, which is why it
 * survived: the bug is invisible in the browser you develop in.
 *
 * So a tier is now only ever lowered by evidence, never by silence. Note also
 * that the spec caps `deviceMemory` at 8 and quantises to powers of two, so it
 * can confirm a weak device but never confirm a strong one.
 */
function detectTier(): 'low' | 'medium' | 'high' {
  if (typeof navigator === 'undefined') return 'medium'

  const cores = navigator.hardwareConcurrency
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory

  // Coarse pointer with no hover, rather than a width query: it asks about the
  // input device, so a half-width desktop window is not mistaken for a phone.
  // Kept orthogonal to camera framing, which stays a breakpoint concern.
  const mobile =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (hover: none)').matches

  if (cores !== undefined && cores <= 4) return 'low'
  if (memory !== undefined && memory <= 4) return 'low'
  // A phone that clears the low bar still has a phone's fill rate, and this
  // scene is fill-bound — see `cloudPoints` below. Mobile never reaches high.
  if (mobile) return 'medium'
  if (cores !== undefined && cores <= 8) return 'medium'
  return cores === undefined ? 'medium' : 'high'
}

/**
 * `cloudPoints` is the reduced-complexity lever, and it is the point count
 * rather than the resolution because that is what measurement said.
 *
 * The scene is fill-bound and the scan is almost all of it: clipping
 * rasterisation to a 2x2px scissor drops the 240k-point cloud from 3.69ms to
 * 0.19ms a frame, and hiding it drops a full frame from 5.96ms to 0.10ms — so
 * ~95% of the cloud's cost is fragment work and the cloud is ~98% of the
 * scene's. Cost is then exactly linear in point count (240k/120k/60k/30k
 * measured at 6.38/3.02/1.33/0.64ms), which makes a count cap a direct,
 * predictable dial on the only thing that matters.
 *
 * `null` on high tier: the desktop design is unchanged, which is the brief.
 * The caps below only ever apply to devices that would otherwise miss frame.
 */
const TIER_SETTINGS = {
  low: { points: 9000, maxDpr: 1.25, pointSize: 11, cloudPoints: 60000 },
  medium: { points: 20000, maxDpr: 1.6, pointSize: 12, cloudPoints: 120000 },
  high: { points: 34000, maxDpr: 2, pointSize: 13, cloudPoints: null },
} as const

export function SceneCanvas() {
  const { reducedMotion } = useProgressContext()
  const [tier] = useState(detectTier)
  const settings = TIER_SETTINGS[tier]

  const [dpr, setDpr] = useState(() => Math.min(settings.maxDpr, 1.5))
  const [inspect] = useState(hudEnabled)
  /**
   * The measurement labels are DOM, but their position depends on the real
   * camera, which only exists inside the Canvas. This ref is the seam: the
   * sibling `<AnnotationLabels>` registers its elements here, and
   * `AnnotationProjector` inside the Canvas writes their transforms during the
   * same frame the dimension lines are drawn. See `AnnotationLabels.tsx` for why
   * the alternatives — projecting from the derived camera, or a react-dom portal
   * inside the R3F tree — do not work.
   */
  const labelsRef = useRef(createAnnotationLabelHandles())

  // There was an IntersectionObserver here that gated `frameloop` on the canvas
  // being scrolled into view. It was dead code and could never have fired:
  // `.scene-canvas` is `position: fixed; inset: 0`, so its rect is measured
  // against the viewport it fills. Confirmed in the browser — at scrollY 3281 of
  // 8190 the bounding rect is still exactly [0, 0, 1440, 900]. The observer
  // reported `isIntersecting` forever, `visible` was permanently true, and the
  // component paid a React state slot and an observer for a branch with one
  // outcome.
  //
  // Nothing replaces it, because there is nothing to gate: a fixed full-viewport
  // canvas is never off-screen. The case it was presumably written for — a
  // backgrounded tab — is already handled by the browser throttling rAF to a
  // standstill, and gating on `document.visibilityState` instead would freeze
  // the scene in any context that reports itself hidden (headless capture, some
  // embeds, prerendering), which is a real regression for an imagined win.

  /**
   * Adaptive resolution is the right lever for THIS scene, which is worth
   * stating because it is usually the lazy one. The bottleneck here is measured
   * to be fragment work — 95% of the point cloud's cost survives when its vertex
   * count is untouched but rasterisation is clipped away — and fill scales with
   * the square of the pixel ratio. So stepping dpr genuinely buys frame time
   * back, rather than just blurring the image while the real cost sits in vertex
   * or draw-call overhead.
   *
   * Each step is expensive, though: a React state change re-rendering the scene
   * subtree, plus a WebGL framebuffer reallocation that at 4x MSAA and 1440x900
   * means discarding and rebuilding a 2160x1350 multisampled target.
   */
  const onIncline = useCallback(() => {
    setDpr((d) => Math.min(settings.maxDpr, Math.round((d + 0.25) * 100) / 100))
  }, [settings.maxDpr])

  const onDecline = useCallback(() => {
    setDpr((d) => Math.max(1, Math.round((d - 0.25) * 100) / 100))
  }, [])

  /**
   * A device that sits exactly on the threshold declines, inclines, declines
   * forever, paying that reallocation every time and never settling — and drei's
   * default `flipflops` is `Infinity`, so nothing stops it. Three reversals is
   * enough evidence that this machine has no stable answer; after that
   * `onFallback` pins the floor and the monitor shuts itself off.
   */
  const onFallback = useCallback(() => setDpr(1), [])

  return (
    <>
      <div className="scene-canvas" aria-hidden="true">
        <Canvas
          dpr={dpr}
          gl={{
            // MSAA on everything but the weakest tier.
            //
            // Two aliasing cases here are unforgiving: the mesh silhouette and
            // the hairline wireframe, both against a near-black field. That is
            // the artifact that reads as "unfinished" regardless of how good the
            // lighting is, and nothing else in this pipeline cleans it — there
            // is no post chain.
            //
            // Tiering on `maxDpr < 2` was the obvious rule and it was wrong. It
            // reasons about the tier's *ceiling*, but the renderer starts at
            // `min(maxDpr, 1.5)` and only climbs if PerformanceMonitor says it
            // may. Measured on this machine: high tier, ceiling 2, actual dpr
            // 1.499 — so the rule disabled MSAA in exactly the case it was
            // written to cover. Tier is the honest input; `antialias` is a
            // context-creation flag and cannot follow the runtime dpr anyway.
            antialias: tier !== 'low',
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          camera={{
            fov: CAMERA_FOV.desktop,
            near: 0.1,
            far: 60,
            // Matches the spline's p=0 desktop keyframe. A mismatch here is a
            // visible lurch on the first frame, before CameraRig initialises.
            position: [0.55, 0.42, 8.55],
          }}
        >
          <PerformanceMonitor
            flipflops={3}
            onIncline={onIncline}
            onDecline={onDecline}
            onFallback={onFallback}
          />
          <color attach="background" args={[PALETTE.void]} />
          {/* No scene fog: the points use an additive ShaderMaterial that does
              not compile the fog chunks. Depth attenuation is in the shader. */}

          {inspect && <SceneInspector />}
          <CameraRig />
          <PlantReconstructionScene
            tier={tier}
            dpr={dpr}
            cloudPoints={settings.cloudPoints}
            placeholderPoints={reducedMotion ? Math.min(settings.points, 14000) : settings.points}
            placeholderPointSize={settings.pointSize}
            labelsRef={labelsRef}
          />
        </Canvas>
      </div>

      {/* Outside the canvas wrapper, and deliberately not inside it: that
          wrapper is aria-hidden, which is right for the drawn layers and wrong
          for a measured value. */}
      <AnnotationLabels handlesRef={labelsRef} />
    </>
  )
}
