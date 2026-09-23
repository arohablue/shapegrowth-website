import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { NormalBlending, Vector3 } from 'three'
import { usePointCloud } from '@/assets/loaders'
import { ASSETS } from '@/assets/manifest'
import { useProgressContext } from '@/progress/ProgressContext'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE DENSE RECONSTRUCTION, TURNED BY HAND
 * ────────────────────────────────────────────────────────────────────────────
 * Plate 02 of Offering 01, as a `component` source. The same file the scroll
 * scene draws — `VITE_POINTCLOUD_URL`, the fused COLMAP cloud — put in the
 * reader's hands instead of rendered once and photographed.
 *
 * It is the same URL on purpose, and that is most of why this is cheap:
 * `useLoader` caches by URL, so by the time anyone scrolls this far the PLY has
 * already been fetched and parsed for the scene above. This mount re-normalises
 * it (one pass over the buffer) and uploads a second, smaller vertex buffer.
 * No second download.
 *
 *
 * THIS IS NOT A SECOND CAMERA SYSTEM
 * ──────────────────────────────────
 * Worth stating plainly, because "an interactive 3D view on a scroll-driven
 * page" is normally exactly that mistake. There is no shared camera to compete
 * over: this is a separate `<Canvas>` root with its own renderer, its own
 * scene graph and its own camera, mounted inside a figure frame in normal
 * document flow. It cannot read or write the scroll scene's `CameraRig`, which
 * lives in the fixed full-viewport canvas and is driven by page progress. The
 * two never touch, and there is no code path by which dragging here can move
 * the plant above.
 *
 *
 * THE PAGE SCROLL IS NEVER TAKEN
 * ──────────────────────────────
 * The one hard rule. A reader scrolling past this plate must scroll past it,
 * on every input device, with no exception — a 3D view that swallows the wheel
 * is the reason readers distrust them.
 *
 *   • Plain wheel is not listened for at all. It scrolls the page.
 *   • `touch-action: pan-y` hands every vertical touch drag to the browser, so
 *     a thumb moving up the plate scrolls. Horizontal drags are left to us,
 *     which is where the rotation comes from.
 *   • Zoom is bound to the two gestures that are unambiguously zoom and are
 *     never scroll: a two-pointer pinch, and `wheel` WITH `ctrlKey`, which is
 *     what a trackpad pinch arrives as. A plain wheel event is ignored even
 *     while a drag is in progress.
 *
 * So the vertical axis always belongs to the document and the horizontal axis
 * always belongs to the model. Nothing has to arbitrate between them.
 *
 *
 * THE MODEL CANNOT LEAVE THE FRAME
 * ────────────────────────────────
 * Not by clamping a position after the fact — by construction. The camera
 * orbits a fixed target at the origin and always looks at it, so the only
 * degrees of freedom are two angles and a radius. The specimen is normalised
 * to 3.2 units tall and centred there by `resolveNormalizationMatrix`, the
 * radius is clamped to a range measured to keep that height inside the frame
 * at both ends, and the pitch is clamped short of the poles. There is no
 * panning, so there is no way to push the plant off the edge.
 */

/**
 * The orbit's limits, and the reason each one is where it is.
 *
 * `RADIUS_*` are derived rather than chosen. The frame is 16:9 and the plate is
 * at most ~960 CSS px wide on this layout, so the vertical FOV is the binding
 * constraint on a subject that is 3.2 tall and 2.6 wide: at 34°, fitting 3.2
 * plus a margin needs r ≥ 3.2 / (2·tan(17°)) ≈ 5.23, and 5.4 is that with the
 * margin made explicit. The far end is where the specimen stops being legible
 * rather than where anything breaks — past ~11 the plant is a smudge in the
 * middle of a lot of paper.
 *
 * `PITCH_*` stop short of the poles in both directions. At the top the orbit
 * degenerates (`lookAt` has no stable up vector looking straight down) and at
 * the bottom the reader ends up under the pot, which is a view of the
 * reconstruction's worst-sampled region — the underside of a plant that was
 * never photographed from below. Neither limit is decoration: +1.15 rad is
 * about 66° above the horizon, which is as far as the capture actually went.
 */
const RADIUS_MIN = 5.4
const RADIUS_MAX = 11
const PITCH_MIN = -0.35
const PITCH_MAX = 1.15
const FOV = 34

/**
 * The view the plate opens on: slightly above eye level, facing the flower.
 *
 * 6.2 rather than the 7.2 this started at. The plate is 830x466 in the layout
 * and the subject is tall and narrow, so width is never the constraint — at
 * 7.2 the plant filled about 70% of the frame height and read as a small
 * object dropped into a lot of paper. 6.2 puts it at ~82%, close enough to
 * RADIUS_MIN that the reader can still pull in a little further but not so
 * close that a broadside leaf spread runs out of room. Vertical extent is
 * nearly yaw-invariant here, which is what makes a fixed home radius safe:
 * the plant does not get taller when it turns.
 */
const HOME = { yaw: 0, pitch: 0.16, radius: 6.2 }

/**
 * Point budget for the plate, which is NOT the scene's budget.
 *
 * The scroll scene draws into a full viewport; this draws into a 16:9 box at
 * most ~960 px wide, so it is covering roughly a fifth of the pixels and is
 * nowhere near the fill limit the scene is tuned against. The constraint here
 * is legibility rather than frame time: below about 60k the flower's disc
 * starts reading as scattered dots rather than as a surface, and above about
 * 120k nothing visibly improves at this size. 90k sits in the middle of that.
 *
 * Halved on a coarse pointer — a phone is drawing this into ~340 px of width,
 * where the same reasoning lands proportionally lower, and it is also the
 * device most likely to already be carrying the scene's own cloud.
 */
const PLATE_POINTS = 90_000

/** Preallocated. The frame loop does not allocate. */
const ORIGIN = new Vector3(0, 0, 0)

interface Orbit {
  yaw: number
  pitch: number
  radius: number
  /** Residual angular velocity after a drag, in radians per second. */
  spin: number
  /** Cleared the first time the reader touches it; see `Rig`. */
  idle: boolean
}

/**
 * The cloud itself. One `THREE.Points`, one draw call.
 *
 * SORTED, NOT ADDITIVE, AND THE SCROLL SCENE IS NOT THE PRECEDENT HERE
 * ───────────────────────────────────────────────────────────────────
 * Additive was the first thing tried, on the reasoning that it matches the
 * scene above. It is wrong in this frame and visibly so: the plate's backdrop
 * is paper — `#f2f0e8` in light theme — and adding colour to something already
 * at 95% luminance can only drive it to white. The plant came out bleached and
 * translucent, a ghost of a sunflower rather than a recovered one, and the
 * darkest parts of the canopy suffered most because that is where the most
 * samples stack up.
 *
 * The scene above gets away with it because its cloud is drawn through a shader
 * that carries its own opacity, depth attenuation and brightness terms, tuned
 * against a full-bleed field. None of that applies to an 830px box on paper.
 *
 * So: depth-tested, depth-written, no blending to speak of. The near sample
 * wins, the far side of the plant is correctly hidden behind the near side, and
 * the colours are the ones COLMAP actually recovered rather than a sum of them.
 * That also makes the rotation legible — an additive cloud looks much the same
 * from any angle, because you are always seeing all of it.
 */
function Cloud() {
  const asset = ASSETS.pointCloud!
  const coarse =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const { geometry, hasVertexColors } = usePointCloud(
    asset,
    coarse ? PLATE_POINTS / 2 : PLATE_POINTS,
  )

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        // World-space sizing, so a point that is further away is smaller and
        // the cloud has depth. A screen-space size would make the back of the
        // plant as dense as the front and flatten it.
        //
        // 0.022 is a coverage number, not a taste one: 90k samples spread over
        // a plant 3.2 tall need roughly this much area each to close the gaps
        // between them at the plate's size. Smaller and the leaves read as
        // stippling; larger and the individual samples merge into a blob and
        // the figure stops being recognisable as a point cloud at all — which
        // is the one thing this plate has to show.
        size={0.022}
        sizeAttenuation
        vertexColors={hasVertexColors}
        depthWrite
        depthTest
        blending={NormalBlending}
      />
    </points>
  )
}

/**
 * Drives the camera from the orbit ref every frame.
 *
 * Deliberately never calls `setState`. The whole interaction — drag, inertia,
 * pinch — writes into a mutable ref and is read here, so turning the model
 * causes zero React renders. That is the same discipline the scroll scene
 * follows and it is not premature: a `setState` per pointermove would re-render
 * the offering subtree at pointer frequency, which on a touch device is faster
 * than the display.
 */
function Rig({ orbit, reducedMotion }: { orbit: React.RefObject<Orbit>; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera)

  useFrame((_, delta) => {
    const o = orbit.current
    const dt = Math.min(delta, 0.05)

    if (o.idle && !reducedMotion) {
      // A slow drift before anyone has touched it. This is the affordance —
      // a still 3D view is indistinguishable from an image, and the reader has
      // no reason to try dragging something that looks like a photograph.
      o.yaw += 0.12 * dt
    } else if (o.spin !== 0) {
      // Inertia, and then it STOPS WHERE IT WAS LEFT. No spring back to `HOME`,
      // no resumed auto-rotation: once the reader has chosen a viewpoint, the
      // plate holding it is the difference between a model and a carousel.
      o.yaw += o.spin * dt
      o.spin *= Math.exp(-6 * dt)
      if (Math.abs(o.spin) < 0.002) o.spin = 0
    }

    camera.position.set(
      Math.sin(o.yaw) * Math.cos(o.pitch) * o.radius,
      Math.sin(o.pitch) * o.radius,
      Math.cos(o.yaw) * Math.cos(o.pitch) * o.radius,
    )
    camera.lookAt(ORIGIN)
  })

  return null
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

export default function DenseCloud() {
  const { reducedMotion } = useProgressContext()
  const hostRef = useRef<HTMLDivElement>(null)
  const orbit = useRef<Orbit>({ ...HOME, spin: 0, idle: true })

  /**
   * Live pointers, keyed by id, so one finger rotates and two pinch without a
   * mode flag. A `Map` rather than an array because `pointercancel` can arrive
   * for a pointer that is not the most recent one.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef(0)

  /**
   * Render only while the plate is on screen.
   *
   * This is a second WebGL context on a page that already has one, and the
   * plate sits below the entire reconstruction sequence — a reader may spend
   * the whole visit above it. `frameloop="never"` means the context exists but
   * costs nothing until it is looked at.
   *
   * State, not a ref, because `frameloop` is a prop R3F reads on render. It
   * changes twice per visit, not per frame.
   */
  const [live, setLive] = useState(false)
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof IntersectionObserver !== 'function') {
      setLive(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setLive(e?.isIntersecting ?? false), {
      // A little early, so the first frame is already drawn by the time the
      // plate is properly in view rather than appearing as it arrives.
      rootMargin: '200px',
    })
    io.observe(host)
    return () => io.disconnect()
  }, [])

  /**
   * `ctrlKey` and nothing else.
   *
   * A trackpad pinch is delivered as a `wheel` event with `ctrlKey` set — that
   * is the platform convention, not a heuristic — and it is the only wheel this
   * listener acts on. A plain wheel falls straight through to the page. The
   * listener is non-passive because the pinch case does need
   * `preventDefault()`, or the browser zooms the whole document on top of us.
   */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const o = orbit.current
      o.idle = false
      o.radius = clamp(o.radius * Math.exp(e.deltaY * 0.01), RADIUS_MIN, RADIUS_MAX)
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    orbit.current.idle = false
    orbit.current.spin = 0
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const o = orbit.current

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      if (pinch.current > 0 && d > 0) {
        o.radius = clamp(o.radius * (pinch.current / d), RADIUS_MIN, RADIUS_MAX)
      }
      pinch.current = d
      return
    }

    // 0.008 rad per px: a drag across a 900px plate turns the plant about 7.2
    // radians, so a little over one full revolution edge to edge. Pitch is
    // deliberately less sensitive — it has a third of the range and hits its
    // clamp, and matching the rates would make it feel stuck.
    o.yaw -= dx * 0.008
    o.pitch = clamp(o.pitch + dy * 0.004, PITCH_MIN, PITCH_MAX)
    // Remembered so releasing mid-drag carries through instead of stopping
    // dead. Scaled to per-second at an assumed ~60Hz sample rate; it only has
    // to feel proportionate, and it decays within a third of a second.
    o.spin = -dx * 0.008 * 60
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = 0
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const camera = useMemo(
    () => ({ fov: FOV, near: 0.1, far: 60, position: [0, HOME.pitch * HOME.radius, HOME.radius] as [number, number, number] }),
    [],
  )

  return (
    <div
      ref={hostRef}
      className="cloud-view"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        frameloop={live ? 'always' : 'never'}
        // Transparent, so the frame's own tinted background shows through and
        // the plate follows the theme with no palette wiring here at all.
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        dpr={[1, 2]}
        camera={camera}
      >
        <Rig orbit={orbit} reducedMotion={reducedMotion} />
        {/* Nothing is rendered until the PLY resolves. `null` rather than a
            spinner: the frame is already a visible empty box with a caption
            under it, and a loader inside it would be a second thing to look at
            for the half second before the cached parse returns. */}
        <Suspense fallback={null}>
          <Cloud />
        </Suspense>
      </Canvas>
    </div>
  )
}
