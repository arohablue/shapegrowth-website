// Is the specimen actually inside the frame, for every frame?
//
// The preview browser cannot paint on its own, so framing is verified by
// projecting the subject's world-space bounding box through a real three camera
// driven by the real spline. Anything with |ndc| > 1 is off-screen; the previous
// keyframes reached 1.288, i.e. the apex was cropped for most of the page and
// nobody could see it in a screenshot because the screenshot was a stale frame.
//
// Sampling the spline densely (not just at the keyframes) matters: Catmull-Rom
// overshoots between control points, so the closest framing of the journey is
// generally NOT at a keyframe.
//
// The bundle is rebuilt here rather than by hand. A harness that imports a
// stale artifact reports PASS against keyframes that are no longer in the
// source, which is worse than having no harness at all.
import { PerspectiveCamera, Vector3 } from 'three'
import { buildSrc } from './lib/esbuild-src.mjs'

const { sampleCameraSpline, CAMERA_FOV } = await buildSrc(
  'src/experience/cameraSpline.ts',
  'bundle-camera.mjs',
)

// The aspect-fit solve is imported rather than reimplemented, so this harness
// tests the framing the runtime actually uses. `framing.ts` also owns the
// subject bounds, which used to be duplicated here — meaning the harness could
// pass against bounds the app no longer used.
const { solveFramingScale, SUBJECT_HALF_EXTENTS: HALF } = await buildSrc(
  'src/experience/framing.ts',
  'bundle-framing.mjs',
)

const CORNERS = []
for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
  CORNERS.push(new Vector3(sx * HALF.x, sy * HALF.y, sz * HALF.z))
}

// The five device classes the brief names, plus the rotations of each that a
// reader can actually produce. The breakpoint is NOT listed per viewport: it is
// derived by the app's own rule, because getting that mapping wrong is exactly
// the bug this table exists to catch (a portrait tablet is >767px wide, so it
// takes the desktop keyframes — see framing.ts).
const DEVICES = [
  { cls: 'narrow phone',    name: '320x568',   w: 320,  h: 568 },
  { cls: 'narrow phone',    name: '360x640',   w: 360,  h: 640 },
  { cls: 'narrow phone',    name: '375x812',   w: 375,  h: 812 },
  { cls: 'large phone',     name: '430x932',   w: 430,  h: 932 },
  { cls: 'large phone',     name: '414x896',   w: 414,  h: 896 },
  { cls: 'phone landscape', name: '844x390',   w: 844,  h: 390 },
  { cls: 'tablet',          name: '768x1024',  w: 768,  h: 1024 },
  { cls: 'tablet',          name: '820x1180',  w: 820,  h: 1180 },
  { cls: 'tablet',          name: '1024x1366', w: 1024, h: 1366 },
  { cls: 'tablet',          name: '1180x820',  w: 1180, h: 820 },
  { cls: 'desktop',         name: '1440x900',  w: 1440, h: 900 },
  { cls: 'desktop',         name: '1280x1400', w: 1280, h: 1400 },
  { cls: 'desktop',         name: '1920x1080', w: 1920, h: 1080 },
  { cls: 'very wide',       name: '2560x1080', w: 2560, h: 1080 },
  { cls: 'very wide',       name: '3440x1440', w: 3440, h: 1440 },
]

// The app's rule, from ProgressProvider's MOBILE_QUERY.
const breakpointFor = (w) => (w <= 767 ? 'mobile' : 'desktop')

const state = { position: [0, 0, 0], target: [0, 0, 0] }
const v = new Vector3()

function measure(breakpoint, viewport) {
  const aspect = viewport.w / viewport.h
  const fov = CAMERA_FOV[breakpoint]
  // Same scalar CameraRig applies. Projecting without it would test a camera
  // the app does not have.
  const fit = solveFramingScale(breakpoint, fov, aspect)
  const cam = new PerspectiveCamera(fov, aspect, 0.1, 60)
  let maxX = 0
  let maxY = 0
  let atX = 0
  let atY = 0
  let minZ = Infinity
  const samples = []
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000
    sampleCameraSpline(p, breakpoint, state)
    const [tx, ty, tz] = state.target
    const px = tx + (state.position[0] - tx) * fit
    const py = ty + (state.position[1] - ty) * fit
    const pz = tz + (state.position[2] - tz) * fit
    cam.position.set(px, py, pz)
    cam.lookAt(tx, ty, tz)
    cam.updateMatrixWorld(true)
    cam.updateProjectionMatrix()
    let fx = 0
    let fy = 0
    for (const c of CORNERS) {
      v.copy(c).project(cam)
      fx = Math.max(fx, Math.abs(v.x))
      fy = Math.max(fy, Math.abs(v.y))
    }
    if (fx > maxX) { maxX = fx; atX = p }
    if (fy > maxY) { maxY = fy; atY = p }
    minZ = Math.min(minZ, pz)
    if (i % 250 === 0) samples.push({ p, fx, fy, z: pz, x: px, y: py })
  }
  return { maxX, maxY, atX, atY, minZ, fit, aspect, fov, samples }
}

const fail = []

console.log('\n═══ framing, every device class ═══')
console.log('  class            viewport    asp   bp       fov  fit    |ndc.x| |ndc.y|  z range')
for (const d of DEVICES) {
  const breakpoint = breakpointFor(d.w)
  const r = measure(breakpoint, d)
  const worst = Math.max(r.maxX, r.maxY)
  console.log(
    `  ${d.cls.padEnd(16)} ${d.name.padEnd(11)} ${r.aspect.toFixed(2).padStart(4)}  ` +
    `${breakpoint.padEnd(8)} ${String(r.fov).padStart(3)}  ${r.fit.toFixed(3)}  ` +
    `${r.maxX.toFixed(3).padStart(6)}  ${r.maxY.toFixed(3).padStart(6)}  ${r.minZ.toFixed(2)}`,
  )

  // Off-frame is a hard failure. Above 0.88 means the subject is touching the
  // edge with no margin, which reads as an accident rather than a composition.
  if (r.maxX > 1 || r.maxY > 1) fail.push(`${d.name}: CROPPED (x ${r.maxX.toFixed(3)}, y ${r.maxY.toFixed(3)})`)
  else if (worst > 0.88) fail.push(`${d.name}: no breathing room (${worst.toFixed(3)})`)
  // And too small is its own defect — a specimen at 0.45 of the half-frame is
  // a diagram, not a subject.
  else if (worst < 0.55) fail.push(`${d.name}: subject too small (${worst.toFixed(3)})`)

  // The fit may only ever pull back to uncrop. If it drops below 1 it is
  // re-composing viewports that were already correct, which would silently
  // change the desktop design.
  if (r.fit < 1) fail.push(`${d.name}: fit ${r.fit.toFixed(3)} < 1 — would re-frame a working viewport`)
}

// Desktop and ultrawide must be arithmetically untouched by the fit, since the
// brief is that the desktop design does not change.
for (const d of DEVICES.filter((x) => x.cls === 'desktop' || x.cls === 'very wide')) {
  const fit = solveFramingScale(breakpointFor(d.w), CAMERA_FOV[breakpointFor(d.w)], d.w / d.h)
  if (fit !== 1) fail.push(`${d.name}: fit ${fit.toFixed(4)} — desktop framing must be unchanged`)
}

// Motion quality: the dolly and the lateral drift should each read as ONE
// intentional move. Counting sign changes in velocity is how "the camera is
// doing tricks" shows up numerically.
console.log('\n═══ motion character ═══')
for (const breakpoint of ['desktop', 'mobile']) {
  for (const axis of [0, 1, 2]) {
    const name = ['x (lateral)', 'y (height)', 'z (dolly)'][axis]
    let prev = null
    let sign = 0
    let reversals = 0
    let maxSpeed = 0
    let atSpeed = 0
    for (let i = 0; i <= 1000; i++) {
      sampleCameraSpline(i / 1000, breakpoint, state)
      const val = state.position[axis]
      if (prev !== null) {
        const d = val - prev
        const speed = Math.abs(d) * 1000
        if (speed > maxSpeed) { maxSpeed = speed; atSpeed = i / 1000 }
        if (Math.abs(d) > 1e-5) {
          const s = Math.sign(d)
          if (sign !== 0 && s !== sign) reversals++
          sign = s
        }
      }
      prev = val
    }
    console.log(`  ${breakpoint.padEnd(8)} ${name.padEnd(12)} reversals ${reversals}   peak speed ${maxSpeed.toFixed(2)} units/progress @p${atSpeed.toFixed(2)}`)
    if (reversals > 1) fail.push(`${breakpoint} ${name}: ${reversals} direction reversals — reads as fidgeting`)
  }
}

console.log('')
if (fail.length === 0) console.log('PASS — subject framed with margin on every viewport, camera moves are single gestures')
else {
  console.log('FAIL')
  for (const f of fail) console.log('  • ' + f)
  process.exitCode = 1
}
