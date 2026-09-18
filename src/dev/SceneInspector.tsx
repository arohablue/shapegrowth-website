import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Publishes the three renderer, scene and camera on `window.__scene` when
 * `?debug` is present.
 *
 * R3F keeps no public handle on its root, so without this the only way to
 * answer "is the geometry actually where I think it is?" is to read pixels —
 * and in a throttled or headless browser the framebuffer is usually a stale
 * frame, which makes it worse than useless. This turns rendering questions into
 * data questions.
 *
 * Tree-shaken from production builds: the import is behind the same `?debug`
 * flag as the timeline HUD, and nothing references it otherwise.
 */
export function SceneInspector() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const advance = useThree((s) => s.advance)

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>

    // `advance` is the important one. Reading uniforms or pixels is useless on
    // its own in any context that does not schedule rAF — headless capture, a
    // backgrounded tab, an embedded preview — because every value in this scene
    // is written from a `useFrame` callback. Calling `gl.render()` by hand there
    // draws a scene whose uniforms are all still at their construction defaults,
    // which looks exactly like a blank frame and is easy to misread as a bug in
    // the scene rather than an absent clock.
    //
    // There are TWO clocks and both are rAF-driven, so both must be pumped or
    // the measurement lies in a different way at each layer:
    //
    //   gsap.ticker  → ProgressProvider's damped progress and every derived
    //                  weight. Frozen, so the scene sits at progress 0 no matter
    //                  where the scrollbar is.
    //   R3F frameloop → the useFrame subscribers that push those weights into
    //                  uniforms and onto the camera.
    //
    // `settle` deliberately BUSY-WAITS, which needs justifying twice over.
    //
    // First, why real time is required at all: the progress smoothing (DAMPING 9)
    // and the camera rig (14) are exponential decays driven by a *measured*
    // wall-clock delta. gsap.ticker.tick() reads performance.now() itself and
    // cannot be handed a synthetic dt. Pumping it in a tight loop therefore
    // delivers ~0 ms per step and converges nothing — while looking successful,
    // because values still drift slowly away from their initial state, which is
    // easy to misread as correct tracking. It is not; it is a stalled damp.
    //
    // Second, why not just await a timer: this page reports visibilityState
    // 'hidden', and chained setTimeouts there are clamped to ~1000 ms after the
    // first (measured: 142, 1139, 2141, 3140). Sixteen awaited steps is sixteen
    // seconds per sample. A spin loop is not throttled, and blocking the main
    // thread costs nothing here because both clocks are already being driven by
    // hand — there is nothing else that needs to run between steps.
    //
    // 50 ms is the largest useful step (both damp() call sites clamp dt there),
    // so the default is ~0.8 s of simulated settling.
    const spin = (ms: number) => {
      const until = performance.now() + ms
      while (performance.now() < until) {
        /* burn real time so the tickers see a real delta */
      }
    }

    w['__scene'] = {
      gl,
      scene,
      camera,
      advance,
      settle: (steps = 16, dtMs = 50) => {
        let clock = (w['__t'] as number | undefined) ?? 0
        for (let i = 0; i < steps; i++) {
          spin(dtMs)
          clock += dtMs
          // Inside the loop, not before it. ScrollTrigger caches the scroll
          // position and refreshes it here; hoisting this out reads the position
          // from before the caller's `scrollTo` had committed.
          ScrollTrigger.update()
          gsap.ticker.tick()
          advance(clock, true)
        }
        w['__t'] = clock
      },
    }

    // If `window.__scene` is missing on a page that is clearly rendering DOM,
    // suspect the host rather than this effect. R3F only builds its root once
    // ResizeObserver reports a non-zero size, and RO notifications — like rAF —
    // are delivered in the rendering steps. In a page the embedder reports as
    // `visibilityState: 'hidden'` those steps can stop entirely, so the canvas
    // stays at its default 300×150, no child of `<Canvas>` ever mounts, and
    // nothing errors. Check `canvas.width === 300` before debugging anything here.
    return () => {
      delete w['__scene']
    }
  }, [gl, scene, camera, advance])

  return null
}
