// Verification of the pure transformation layer. Bundled from src by esbuild —
// rebuilt on every run, because a harness pointed at a stale bundle reports
// PASS for code that no longer exists.
import { buildSrc } from './lib/esbuild-src.mjs'

const { createRepresentationWeights, resolveRepresentation } = await buildSrc(
  'src/experience/representation.ts',
  'bundle-representation.mjs',
)

const w = createRepresentationWeights()
const at = (p) => ({ ...resolveRepresentation(p, w) })

const KEYS = [
  'cloudOpacity',
  'reveal',
  'scan',
  'rigAngle',
  'rigOpacity',
  'tiePoints',
  'snap',
  'vertexEmphasis',
  'drift',
  'wireBuild',
  'wireOpacity',
  'surface',
  'finalPlant',
  'phenotype',
]

// ── 1. Table at the nine progress points that matter ────────────────────────
const POINTS = [0, 0.1, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 1]
console.log('p     ' + KEYS.map((k) => k.slice(0, 7).padStart(8)).join(''))
for (const p of POINTS) {
  const s = at(p)
  console.log(p.toFixed(2).padEnd(6) + KEYS.map((k) => s[k].toFixed(3).padStart(8)).join(''))
}

const fail = []

// ── 2. No dead frame: something is always visible ───────────────────────────
let minPresence = Infinity
let minAt = 0
for (let i = 0; i <= 1000; i++) {
  const p = i / 1000
  const s = at(p)
  // What the eye can actually see at this progress.
  const presence = s.cloudOpacity + s.wireOpacity + s.surface
  if (presence < minPresence) {
    minPresence = presence
    minAt = p
  }
}
console.log(`\nminimum total presence ${minPresence.toFixed(3)} at p=${minAt.toFixed(3)}`)
if (minPresence < 0.15) fail.push(`dead frame at p=${minAt} (presence ${minPresence})`)

// ── 3. wireBuild is monotone: an inferred edge never un-grows ───────────────
let prev = -1
for (let i = 0; i <= 2000; i++) {
  const v = at(i / 2000).wireBuild
  if (v < prev - 1e-9) {
    fail.push(`wireBuild decreased at p=${i / 2000}: ${prev} → ${v}`)
    break
  }
  prev = v
}

// ── 4. Exact reversibility: forward and backward sweeps must agree ──────────
// Every weight is a pure function of p, so scrubbing backwards is exact rather
// than an approximate unwind. This asserts nothing has crept in that integrates.
let maxDelta = 0
const forward = []
for (let i = 0; i <= 500; i++) forward.push(at(i / 500))
for (let i = 500; i >= 0; i--) {
  const back = at(i / 500)
  for (const k of KEYS) maxDelta = Math.max(maxDelta, Math.abs(back[k] - forward[i][k]))
}
console.log(`forward/backward max delta ${maxDelta.toExponential(2)}`)
if (maxDelta > 1e-12) fail.push(`not reversible: max delta ${maxDelta}`)

// ── 5. Jump equivalence: a jump lands exactly where a sweep would ───────────
// Same assertion from the other direction — order of evaluation is irrelevant.
const sweepEnd = at(0.62)
at(0.05)
at(0.99)
const jumped = at(0.62)
const jumpDelta = Math.max(...KEYS.map((k) => Math.abs(jumped[k] - sweepEnd[k])))
console.log(`jump delta ${jumpDelta.toExponential(2)}`)
if (jumpDelta > 1e-12) fail.push(`jump not equivalent: ${jumpDelta}`)

// ── 6. Continuity: no weight steps by more than a small amount per 0.001 ────
let maxStep = 0
let stepKey = ''
let stepAt = 0
let previous = at(0)
for (let i = 1; i <= 1000; i++) {
  const s = at(i / 1000)
  for (const k of KEYS) {
    const d = Math.abs(s[k] - previous[k])
    if (d > maxStep) {
      maxStep = d
      stepKey = k
      stepAt = i / 1000
    }
  }
  previous = s
}
console.log(`largest per-0.001 step ${maxStep.toFixed(5)} (${stepKey} at p=${stepAt.toFixed(3)})`)
if (maxStep > 0.03) fail.push(`abrupt change in ${stepKey} at p=${stepAt}: ${maxStep}`)

// ── 7. Stage ordering: each representation peaks in its declared window ─────
const peakOf = (key) => {
  let best = -1
  let bestP = 0
  for (let i = 0; i <= 1000; i++) {
    const v = at(i / 1000)[key]
    if (v > best) {
      best = v
      bestP = i / 1000
    }
  }
  return { bestP, best }
}
const order = ['reveal', 'snap', 'wireBuild', 'surface', 'finalPlant', 'phenotype']
const peaks = order.map((k) => ({ k, ...peakOf(k) }))
console.log('\npeaks: ' + peaks.map((x) => `${x.k}@${x.bestP.toFixed(2)}`).join('  '))
for (let i = 1; i < peaks.length; i++) {
  if (peaks[i].bestP < peaks[i - 1].bestP) {
    fail.push(`out of order: ${peaks[i].k} peaks before ${peaks[i - 1].k}`)
  }
  if (peaks[i].best < 0.999) fail.push(`${peaks[i].k} never reaches 1 (max ${peaks[i].best})`)
}

// ── 8. Coexistence: transitions must show more than one representation ──────
// The right metric is what is *on screen* (the composite opacities), not the
// drive weights: `snap` can be pinned at 1 while the cloud it moved is still
// fully visible underneath a growing wireframe.
let soloFrames = 0
for (let i = 0; i <= 1000; i++) {
  const s = at(i / 1000)
  const visible = [s.cloudOpacity, s.wireOpacity, s.surface].filter((v) => v > 0.05).length
  if (visible < 2 && i / 1000 > 0.46 && i / 1000 < 0.8) soloFrames++
}
console.log(`\nsingle-representation frames inside 0.46–0.80: ${soloFrames}`)
if (soloFrames > 0) fail.push(`${soloFrames} frames in the handoff region show only one layer`)

// ── 9. No stall: the sequence must never stop moving mid-transformation ─────
// easeInOutCubic has zero slope at both ends, so two windows that merely *abut*
// produce a moment where nothing at all changes — a visible freeze under slow
// scroll even though no value jumps.
let minRate = Infinity
let minRateAt = 0
const STEP = 0.001
for (let i = 0; i <= 1000 - 1; i++) {
  const p = i / 1000
  // Bounded to the construction region. Outside it a low rate is correct:
  // before 0.16 nothing has started, and after 0.78 the plant is finished and
  // settling to rest so the phenotype overlay can take over.
  if (p < 0.16 || p > 0.78) continue
  const a = at(p)
  const b = at(p + STEP)
  let rate = 0
  for (const k of KEYS) rate += Math.abs(b[k] - a[k])
  if (rate < minRate) {
    minRate = rate
    minRateAt = p
  }
}
console.log(`slowest total rate ${(minRate / STEP).toFixed(3)} /unit progress at p=${minRateAt.toFixed(3)}`)
if (minRate / STEP < 0.5) fail.push(`sequence stalls at p=${minRateAt.toFixed(3)} (rate ${(minRate / STEP).toFixed(3)})`)

// ── 10. The capture beat ────────────────────────────────────────────────────
// This beat has a different failure mode from the rest of the sequence. Its job
// is to make the point cloud feel *caused* rather than announced, and the ways
// that break are all about the handoff rather than about any single value.
console.log('\n═══ capture beat ═══')
console.log('p      rigAngle  rigOpac  tiePts  cloudOp   scan')
for (const p of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]) {
  const s = at(p)
  console.log(
    p.toFixed(2).padEnd(7) +
      [s.rigAngle, s.rigOpacity, s.tiePoints, s.cloudOpacity, s.scan]
        .map((v) => v.toFixed(3).padStart(8))
        .join(''),
  )
}

// 10a. The rig traverses at a CONSTANT rate. A gantry that accelerates reads as
// hand-animated; this is the assertion that keeps the `linear` ease honest if
// someone later "improves" it to an ease-in-out.
{
  let minR = Infinity
  let maxR = -Infinity
  for (let i = 0; i < 300; i++) {
    const p = 0.005 + (i / 300) * 0.28
    const r = (at(p + 0.001).rigAngle - at(p).rigAngle) / 0.001
    minR = Math.min(minR, r)
    maxR = Math.max(maxR, r)
  }
  console.log(`\nrig traverse rate ${minR.toFixed(3)} → ${maxR.toFixed(3)} /unit progress`)
  if (maxR - minR > 1e-6) fail.push(`rig traverse is not constant-rate (${minR} → ${maxR})`)
}

// 10b. The rig completes exactly one full pass, and completes it. A traverse
// that stops at 0.93 leaves a wedge of the specimen never measured — and that
// wedge is permanently dimmer, which looks like a rendering fault.
{
  const done = at(0.3).rigAngle
  const endOfPage = at(1).rigAngle
  console.log(`traverse at p=0.30: ${done.toFixed(4)}   at p=1: ${endOfPage.toFixed(4)}`)
  if (done < 0.999) fail.push(`rig pass incomplete at p=0.30 (${done})`)
}

// 10c. rigAngle is monotone — measurement accumulates, it is never un-measured.
{
  let prevA = -1
  for (let i = 0; i <= 2000; i++) {
    const v = at(i / 2000).rigAngle
    if (v < prevA - 1e-9) {
      fail.push(`rigAngle decreased at p=${i / 2000}`)
      break
    }
    prevA = v
  }
}

// 10d. The instrument leaves. It must be gone before the reconstruction starts,
// or the orbit path is still drawn over a mesh being built, which is nonsense —
// the capture already happened.
{
  const stillThere = at(0.36).rigOpacity
  console.log(`rig opacity at p=0.36: ${stillThere.toFixed(4)}`)
  if (stillThere > 0.001) fail.push(`rig still visible at p=0.36 (${stillThere})`)
  if (at(0).rigOpacity < 0.1) fail.push('rig absent in the hero — capture beat has no setup')
}

// 10e. The handoff. Tie points and the dense cloud must not both be loud at the
// same time: the whole point of the beat is "a few hundred points, then vastly
// more", and if the sparse set is still at full strength when the cloud lands
// the frame just reads as undifferentiated noise.
{
  let worstOverlap = 0
  let worstAt = 0
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000
    const s = at(p)
    // Both above half strength is the failure. Cloud presence at the floor
    // (0.24) is the faint unresolved haze, which is fine to have underneath.
    const overlap = Math.min(s.tiePoints, Math.max(0, (s.cloudOpacity - 0.5) / 0.5))
    if (overlap > worstOverlap) {
      worstOverlap = overlap
      worstAt = p
    }
  }
  console.log(`worst tie-point / dense-cloud overlap ${worstOverlap.toFixed(3)} at p=${worstAt.toFixed(3)}`)
  if (worstOverlap > 0.62) fail.push(`tie points and dense cloud fight at p=${worstAt} (${worstOverlap})`)
}

// 10f. Continuity through the capture window specifically. The earlier no-stall
// check deliberately skips p < 0.16 because nothing had started there. Now
// something has: the rig. So the first 30% gets its own assertion, and it must
// never stop moving.
{
  let minRate2 = Infinity
  let minAt2 = 0
  for (let i = 0; i < 300; i++) {
    const p = i / 1000
    const a = at(p)
    const b = at(p + 0.001)
    let rate = 0
    for (const k of KEYS) rate += Math.abs(b[k] - a[k])
    if (rate < minRate2) {
      minRate2 = rate
      minAt2 = p
    }
  }
  console.log(`slowest rate inside capture ${(minRate2 / 0.001).toFixed(3)} /unit at p=${minAt2.toFixed(3)}`)
  if (minRate2 / 0.001 < 0.5) fail.push(`capture beat stalls at p=${minAt2.toFixed(3)}`)
}

console.log('')
if (fail.length === 0) console.log('PASS — all assertions hold')
else {
  console.log('FAIL')
  for (const f of fail) console.log('  • ' + f)
  process.exitCode = 1
}
