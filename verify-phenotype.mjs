// Do the seven annotations actually annotate the plant?
//
// Four independent questions, none of which a screenshot answers:
//
//   1. TIMING     does the stage draw progressively, or does it snap on?
//   2. STAGGER    do the seven arrive one at a time, and all finish in time?
//   3. ANCHORING  is each authored point on the specimen, or floating near it?
//   4. LAYOUT     do the labels fit the frame and clear each other — on every
//                 viewport, which is what "test responsiveness" means here?
//
// (3) is the one that cannot be faked. The annotations are authored in specimen
// space, so "is this anchor on a leaf" can only be answered by resolving it
// against the SAME normalisation the app applies and looking for a real sample
// nearby. That is why this harness parses the actual fixture PLY and reads the
// actual .env.local rather than trusting the numbers in a comment.
//
// Bundles are rebuilt here, not imported from an artifact. A harness that reads
// a stale bundle reports PASS against source that no longer exists.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

const build = (entry, out) => {
  execFileSync(
    'npx',
    ['esbuild', entry, '--bundle', '--format=esm', '--alias:@=./src', `--outfile=${out}`],
    { stdio: 'inherit' },
  )
  return import(`./${out}?t=${Date.now()}`)
}

const phenotype = await build('src/experience/phenotype.ts', 'bundle-phenotype.mjs')
const spline = await build('src/experience/cameraSpline.ts', 'bundle-camera.mjs')
const derive = await build('src/experience/deriveSceneState.ts', 'bundle-derive.mjs')
const normalize = await build('src/assets/normalize.ts', 'bundle-normalize.mjs')
// The copy, for section 5 — the notice that has to sit on the frame alongside
// the seven invented values.
const content = await build('src/content.ts', 'bundle-content.mjs')

const { PHENOTYPE_DISCLAIMER } = content
const {
  ORDERED_MEASUREMENTS,
  annotationReveal,
  annotationCapacity,
  measureSpecimenBounds,
  resolveAnnotationPoint,
  formatValue,
} = phenotype
const { sampleCameraSpline } = spline
const { track } = derive
const { resolveNormalizationMatrix } = normalize

const fail = []
const note = (m) => fail.push(m)

// ─────────────────────────────────────────────────────────────────────────────
// 1. TIMING
// ─────────────────────────────────────────────────────────────────────────────
// The same 0.03-per-0.001-progress continuity budget the transformation harness
// enforces. A weight that jumps faster than that is a pop at any plausible
// scroll speed, and it is invisible in a static screenshot.
console.log('\n═══ 1. timing ═══')

const STEP = 0.0001
let worstStage = 0
let worstStageAt = 0
for (let p = 0.84; p <= 1; p += STEP) {
  const d = Math.abs(track('phenotype', p + STEP) - track('phenotype', p)) * (0.001 / STEP)
  if (d > worstStage) {
    worstStage = d
    worstStageAt = p
  }
}
console.log(
  `  stage weight: worst Δ per 0.001 progress = ${worstStage.toFixed(4)} @p${worstStageAt.toFixed(4)}`,
)
if (worstStage > 0.03) {
  note(`stage weight jumps ${worstStage.toFixed(4)} per 0.001 at p${worstStageAt.toFixed(4)} (budget 0.03)`)
}

// The per-annotation reveal is what the eye actually reads, and it is the stage
// slope divided by the reveal window — i.e. several times steeper. If a whole
// line draws itself inside a couple of frames of ordinary scrolling, the
// "measurement being taken" is a measurement appearing.
let worstReveal = 0
let worstRevealId = ''
let worstRevealAt = 0
for (const m of ORDERED_MEASUREMENTS) {
  for (let p = 0.84; p <= 1; p += STEP) {
    const a = annotationReveal(track('phenotype', p), m.at)
    const b = annotationReveal(track('phenotype', p + STEP), m.at)
    const d = Math.abs(b - a) * (0.001 / STEP)
    if (d > worstReveal) {
      worstReveal = d
      worstRevealId = m.id
      worstRevealAt = p
    }
  }
}
console.log(
  `  reveal:       worst Δ per 0.001 progress = ${worstReveal.toFixed(4)} (${worstRevealId} @p${worstRevealAt.toFixed(4)})`,
)

// How much scroll each annotation's draw actually occupies. At a brisk flick of
// ~0.02 progress per frame, anything under ~0.01 draws in a single frame.
console.log('\n  id                   at    starts   completes   draw span (progress)')
for (const m of ORDERED_MEASUREMENTS) {
  let start = null
  let end = null
  for (let p = 0.84; p <= 1.00001; p += STEP) {
    const r = annotationReveal(track('phenotype', Math.min(p, 1)), m.at)
    if (start === null && r > 0.001) start = p
    if (end === null && r >= 0.999) end = p
  }
  const span = end === null ? null : end - start
  console.log(
    `  ${m.id.padEnd(20)} ${m.at.toFixed(2)}  ` +
      `${start === null ? '   —  ' : 'p' + start.toFixed(3)}   ` +
      `${end === null ? 'NEVER  ' : 'p' + end.toFixed(3)}     ` +
      `${span === null ? '—' : span.toFixed(4)}`,
  )
  if (end === null) note(`${m.id}: never completes before p=1`)
  else if (span < 0.008) note(`${m.id}: draws in ${span.toFixed(4)} of progress — snaps on rather than drawing`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STAGGER
// ─────────────────────────────────────────────────────────────────────────────
// Seven arriving at once is the "dashboard switching on" failure the stage is
// built to avoid, so the test is that no two are mid-draw at the same instant
// for most of their duration.
console.log('\n═══ 2. stagger ═══')

let prevAt = -1
for (const m of ORDERED_MEASUREMENTS) {
  if (m.at <= prevAt) note(`stagger not strictly increasing at ${m.id} (at ${m.at})`)
  prevAt = m.at
}

let maxConcurrent = 0
let maxConcurrentAt = 0
for (let s = 0; s <= 1; s += 0.001) {
  let drawing = 0
  for (const m of ORDERED_MEASUREMENTS) {
    const r = annotationReveal(s, m.at)
    if (r > 0.001 && r < 0.999) drawing++
  }
  if (drawing > maxConcurrent) {
    maxConcurrent = drawing
    maxConcurrentAt = s
  }
}
console.log(`  peak simultaneously drawing: ${maxConcurrent} @stage ${maxConcurrentAt.toFixed(3)}`)
// Two overlapping reads as a pass in motion. Four-plus reads as a batch.
if (maxConcurrent > 3) note(`${maxConcurrent} annotations drawing at once — reads as a batch, not a pass`)

const capacities = { desktop: annotationCapacity('desktop'), mobile: annotationCapacity('mobile') }
console.log(`  capacity: desktop ${capacities.desktop}, mobile ${capacities.mobile}`)
for (const bp of ['desktop', 'mobile']) {
  const kept = ORDERED_MEASUREMENTS.filter((m) => m.priority < capacities[bp])
  console.log(`  ${bp.padEnd(8)} keeps ${kept.length}: ${kept.map((m) => m.id).join(', ')}`)
  if (kept.length === 0) note(`${bp}: no annotations survive the capacity gate`)
  // Plant height is the whole-plant reading and the one that opens the stage.
  // Dropping it on mobile would leave the pass starting mid-sentence.
  if (!kept.some((m) => m.id === 'plant-height')) note(`${bp}: plant-height dropped`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ANCHORING
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n═══ 3. anchoring (against the real fixture) ═══')

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const transform = {
  upAxis: env.VITE_POINTCLOUD_UP_AXIS ?? 'y',
  targetHeight: Number(env.VITE_POINTCLOUD_TARGET_HEIGHT ?? 3.2),
  anchor: env.VITE_POINTCLOUD_ANCHOR ?? 'bounds',
  yOffset: Number(env.VITE_POINTCLOUD_Y_OFFSET ?? 0),
  yaw: Number(env.VITE_POINTCLOUD_YAW ?? 0),
}
console.log(`  transform: ${JSON.stringify(transform)}`)

const plyPath = 'public' + (env.VITE_POINTCLOUD_URL ?? '/models/fixture-scan.ply')
const buffer = readFileSync(plyPath)
const source = new PLYLoader().parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
)
const srcPos = source.getAttribute('position')

const box = new Box3()
const tmp = new Vector3()
for (let i = 0; i < srcPos.count; i++) box.expandByPoint(tmp.fromBufferAttribute(srcPos, i))
const matrix = resolveNormalizationMatrix(box, transform)

// Normalised world positions — exactly what the app uploads, minus decimation
// (which is a stride, so it cannot change the extent meaningfully).
const world = new Float32Array(srcPos.count * 3)
for (let i = 0; i < srcPos.count; i++) {
  tmp.fromBufferAttribute(srcPos, i).applyMatrix4(matrix)
  world[i * 3] = tmp.x
  world[i * 3 + 1] = tmp.y
  world[i * 3 + 2] = tmp.z
}

const bounds = measureSpecimenBounds(world)
console.log(
  `  ${srcPos.count.toLocaleString()} samples → bounds y ${bounds.minY.toFixed(3)}…${bounds.maxY.toFixed(3)}, plan half-extent ${bounds.planHalfExtent.toFixed(3)}`,
)

const nearest = (p) => {
  const target = { x: 0, y: 0, z: 0 }
  resolveAnnotationPoint(p, bounds, target)
  let best = Infinity
  for (let i = 0; i < world.length; i += 3) {
    const dx = world[i] - target.x
    const dy = world[i + 1] - target.y
    const dz = world[i + 2] - target.z
    const d = dx * dx + dy * dy + dz * dz
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

// Tolerances in world units on a specimen 3.2 tall.
//
// Two kinds of span, tested in opposite directions — this is what the
// `attachment` field is for, and getting it wrong makes the harness demand that
// a correct annotation be wrong:
//
//   surface    both endpoints are claims about where a caliper was placed, so
//              they must be ON the plant.
//   clearance  a datum line, dimensioned PAST the object the way total height is
//              on any engineering drawing. Its endpoints must be OFF the
//              silhouette — clearly enough to read as a datum, not so far that
//              it is dimensioning empty space.
//
// The anchor is always off-but-near regardless of kind: a label drawn over the
// leaf it describes is the failure mode the anchor exists to avoid.
const ON_TOL = 0.22
const CLEAR_MIN = 0.12
const CLEAR_MAX = 1.4
const ANCHOR_MIN = 0.02
const ANCHOR_MAX = 1.1

console.log('\n  id                   kind       start→plant  end→plant  anchor→plant')
for (const m of ORDERED_MEASUREMENTS) {
  const ds = nearest(m.startPoint)
  const de = nearest(m.endPoint)
  const da = nearest(m.anchor)
  console.log(
    `  ${m.id.padEnd(20)} ${m.attachment.padEnd(10)} ${ds.toFixed(3).padStart(10)} ${de.toFixed(3).padStart(10)} ${da.toFixed(3).padStart(13)}`,
  )

  if (m.attachment === 'surface') {
    if (ds > ON_TOL) note(`${m.id}: startPoint is ${ds.toFixed(3)} off the specimen (tol ${ON_TOL})`)
    if (de > ON_TOL) note(`${m.id}: endPoint is ${de.toFixed(3)} off the specimen (tol ${ON_TOL})`)
  } else {
    // Only the near end is checked for clearance. A base-to-apex datum's far
    // end is level with the apex, where the plant is a single stem tip, so its
    // distance to the nearest sample is dominated by the datum's lateral offset
    // and says nothing extra. min() is the honest test: does the line touch?
    const closest = Math.min(ds, de)
    if (closest < CLEAR_MIN) {
      note(`${m.id}: clearance datum passes ${closest.toFixed(3)} from the specimen — reads as touching it`)
    }
    if (closest > CLEAR_MAX) {
      note(`${m.id}: clearance datum stands ${closest.toFixed(3)} off — dimensioning empty space`)
    }
  }

  if (da > ANCHOR_MAX) note(`${m.id}: anchor floats ${da.toFixed(3)} from the specimen`)
  if (da < ANCHOR_MIN) note(`${m.id}: anchor sits ON the specimen (${da.toFixed(3)}) — label will overlap the plant`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LAYOUT / RESPONSIVENESS
// ─────────────────────────────────────────────────────────────────────────────
// The labels are DOM boxes positioned from a projected world point, so whether
// they fit and clear each other is a function of viewport size, fov and the
// camera's position at that moment — none of which a single screenshot covers.
//
// Box sizes are derived from the CSS in index.css rather than guessed: JetBrains
// Mono advances at 0.6em, the label is uppercase at font-size + letter-spacing,
// and the two lines stack with a 0.25rem gap.
console.log('\n═══ 4. label layout ═══')

const TYPE = {
  desktop: { labelPx: 9, labelTrack: 0.22, valuePx: 13, gapPx: 4 },
  mobile: { labelPx: 8, labelTrack: 0.16, valuePx: 12, gapPx: 4 },
}
const FOV = { desktop: 38, mobile: 52 }
const GAP = 14 // AnnotationLabels.tsx
const MARGIN = 8 // px of viewport edge a label may not cross

const VIEWPORTS = {
  desktop: [
    { name: '1440x900', w: 1440, h: 900 },
    { name: '1920x1080', w: 1920, h: 1080 },
    { name: '1280x1400', w: 1280, h: 1400 },
  ],
  mobile: [
    { name: '375x812', w: 375, h: 812 },
    { name: '430x932', w: 430, h: 932 },
  ],
}

const boxOf = (m, bp) => {
  const t = TYPE[bp]
  const labelW = m.label.length * t.labelPx * (0.6 + t.labelTrack)
  const valueW = (formatValue(m).length + m.unit.length + 1) * t.valuePx * 0.6
  return { w: Math.max(labelW, valueW), h: t.labelPx + t.gapPx + t.valuePx }
}

const camState = { position: [0, 0, 0], target: [0, 0, 0] }
const anchorWorld = ORDERED_MEASUREMENTS.map((m) => {
  const o = { x: 0, y: 0, z: 0 }
  resolveAnnotationPoint(m.anchor, bounds, o)
  return new Vector3(o.x, o.y, o.z)
})

for (const bp of ['desktop', 'mobile']) {
  console.log(`\n  ── ${bp} (fov ${FOV[bp]}) ──`)
  const capacity = capacities[bp]

  for (const vp of VIEWPORTS[bp]) {
    const cam = new PerspectiveCamera(FOV[bp], vp.w / vp.h, 0.1, 60)
    let worstOverlap = 0
    let worstOverlapPair = ''
    let worstOff = 0
    let worstOffId = ''
    let worstAt = 0

    // Every annotation is fully revealed well before the stage ends, and the
    // camera is still moving to p=1, so the crowded moment is not the end.
    for (let p = 0.85; p <= 1.0001; p += 0.002) {
      sampleCameraSpline(Math.min(p, 1), bp, camState)
      cam.position.set(...camState.position)
      cam.lookAt(camState.target[0], camState.target[1], camState.target[2])
      cam.updateMatrixWorld(true)
      cam.updateProjectionMatrix()

      const stage = track('phenotype', Math.min(p, 1))
      const boxes = []

      for (let i = 0; i < ORDERED_MEASUREMENTS.length; i++) {
        const m = ORDERED_MEASUREMENTS[i]
        if (m.priority >= capacity) continue
        // Only score boxes the projector has actually faded in — an invisible
        // label cannot collide with anything.
        if (annotationReveal(stage, m.at) < 0.9) continue

        const v = anchorWorld[i].clone().project(cam)
        if (v.z > 1) continue
        const x = vp.w / 2 + v.x * (vp.w / 2)
        const y = vp.h / 2 - v.y * (vp.h / 2)
        const { w, h } = boxOf(m, bp)
        const left = m.side === 'left' ? x - GAP - w : x + GAP
        const top = y - h / 2
        boxes.push({ id: m.id, left, top, right: left + w, bottom: top + h })
      }

      for (const b of boxes) {
        const off = Math.max(
          MARGIN - b.left,
          b.right - (vp.w - MARGIN),
          MARGIN - b.top,
          b.bottom - (vp.h - MARGIN),
        )
        if (off > worstOff) {
          worstOff = off
          worstOffId = b.id
          worstAt = p
        }
      }

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (ox > 0 && oy > 0) {
            const area = ox * oy
            if (area > worstOverlap) {
              worstOverlap = area
              worstOverlapPair = `${a.id} × ${b.id}`
            }
          }
        }
      }
    }

    console.log(
      `    ${vp.name.padEnd(10)} worst off-frame ${worstOff <= 0 ? 'none' : `${worstOff.toFixed(0)}px (${worstOffId} @p${worstAt.toFixed(3)})`}` +
        `   worst overlap ${worstOverlap <= 0 ? 'none' : `${worstOverlap.toFixed(0)}px² (${worstOverlapPair})`}`,
    )
    if (worstOff > 0) note(`${bp} ${vp.name}: ${worstOffId} runs ${worstOff.toFixed(0)}px off frame`)
    // A few px² of corner contact is not a legibility problem; a shared word is.
    if (worstOverlap > 120) note(`${bp} ${vp.name}: labels overlap ${worstOverlap.toFixed(0)}px² (${worstOverlapPair})`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE NOTICE
// ─────────────────────────────────────────────────────────────────────────────
// The seven values are invented, and they are kept because the layout above was
// tuned against them. What makes that defensible is `PHENOTYPE_DISCLAIMER` being
// on the frame whenever they are — so it is checked here, beside the numbers it
// qualifies, rather than left to survive on the good intentions of whoever next
// edits the annotation layer.
//
// This harness is data-level and cannot see the DOM, so it asserts the three
// things that are properties of the copy: that the notice exists, that it says
// the two words that matter, and that it does not fit in the same 375px frame
// budget by accident. The per-frame coupling to the readings' opacity is
// asserted by the CDP pass, which can see computed styles.
console.log('\n═══ 5. schematic notice ═══')

const REQUIRED = ['schematic', 'not measured']
const BANNED = /\b(measured data|validated|experimental|observed|actual|real)\b/i

const notice = (PHENOTYPE_DISCLAIMER ?? '').trim()
console.log(`  text          "${notice}"`)
if (!notice) {
  note('PHENOTYPE_DISCLAIMER is empty — the trait readout would ship unqualified')
} else {
  for (const word of REQUIRED) {
    if (!notice.toLowerCase().includes(word)) note(`notice does not contain "${word}" — "${notice}"`)
  }
  // Same rule the figure titles follow: the stylesheet uppercases, the copy does
  // not. Authored in caps it would be uppercased twice and impossible to restyle.
  if (notice === notice.toUpperCase()) {
    note(`notice is authored in caps — .annotation__note does that ("${notice}")`)
  }
  // It claims the opposite of what it means if a word like "measured" survives
  // outside the phrase "not measured".
  const stripped = notice.toLowerCase().replace('not measured', '')
  if (BANNED.test(stripped)) note(`notice contains a claim word — "${notice}"`)
}

// 0.5rem mono at 0.24em tracking, uppercase, against the narrowest viewport with
// the same 1.5rem gutter the stylesheet sets. A notice that ran off the frame
// would be a disclaimer nobody can read, which is worse than none.
const NOTICE_PX = 8
const NOTICE_TRACK = 0.24
const GUTTER = 24
const noticeW = notice.length * NOTICE_PX * (0.6 + NOTICE_TRACK)
const avail = 375 - GUTTER * 2
console.log(`  375px fit     ${noticeW.toFixed(0)}px of ${avail}px available`)
if (noticeW > avail) {
  note(`notice is ${noticeW.toFixed(0)}px wide, overruns a 375px viewport by ${(noticeW - avail).toFixed(0)}px`)
}

console.log('')
if (fail.length === 0) {
  console.log('PASS — stage draws progressively, staggers, anchors on the specimen, labels fit every viewport, readout is marked schematic')
} else {
  console.log('FAIL')
  for (const f of fail) console.log('  • ' + f)
  process.exitCode = 1
}
