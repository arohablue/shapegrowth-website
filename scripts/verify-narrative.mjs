// Verification of the editorial layer: does the copy say the right thing at the
// right moment, and does it get on and off screen cleanly?
//
// The other three harnesses check the scene. This one checks the *narrative* —
// which is a different failure mode. A page can have a flawless transformation
// and still read as documentation with an animation embedded in it, or as a
// slideshow of cross-dissolving cards, or as five captions arriving next to
// motion they do not describe. Those are the things asserted here.
//
// Bundled from src on every run, for the same reason as the others: a harness
// pointed at a stale bundle reports PASS for code that no longer exists.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { buildSrc, fromRoot } from './lib/esbuild-src.mjs'

const { BLOCK_RANGES, SCROLLABLE_VH, TRACKS, STAGE_ORDER } = await buildSrc(
  'src/experience/timeline.ts',
  'bundle-timeline.mjs',
)
const { EASINGS, clamp01, invLerp, smoothstep } = await buildSrc(
  'src/experience/easing.ts',
  'bundle-easing.mjs',
)
const { SECTION_COPY, OFFERINGS } = await buildSrc('src/content.ts', 'bundle-content.mjs')
// Registry / figure / demo are bundled separately so assertion 12 can tell an
// empty slot from a filled one, and a demo schematic from a real figure.
const { EVIDENCE_SOURCES } = await buildSrc('src/evidence/registry.ts', 'bundle-registry.mjs')
const { CATEGORY_LABEL, resolveAspect } = await buildSrc(
  'src/evidence/figure.ts',
  'bundle-figure.mjs',
)
const { DEMO_SOURCES } = await buildSrc('src/evidence/demo.ts', 'bundle-demo.mjs')

// Compared by value, NOT by `===`. esbuild bundles each entry independently, so
// `bundle-registry.mjs` carries its own inlined copy of `demo.ts` and the object
// reached through `EVIDENCE_SOURCES` is never the same object as the one reached
// through `DEMO_SOURCES` — an identity test silently reported all eleven demo
// slots as real figures, which is precisely backwards from the direction this
// harness is supposed to fail in.
const sameSource = (a, b) =>
  a !== undefined &&
  b !== undefined &&
  a.type === b.type &&
  (a.type === 'component' ? a.component === b.component : a.src === b.src)
const fail = []
const note = (m) => fail.push(m)

// ── the two functions under test, reconstructed from the real tables ─────────
// `track` lives in deriveSceneState.ts and `blockFocus` in progress/hooks.ts.
// Both are three lines over data imported above, and the data is what can drift.
// The one literal duplicated here is the falloff constant; if it changes in
// hooks.ts it must change here, and assertion 0 below is what catches that.
const FALLOFF_PAD = 45

const track = (id, p) => {
  const w = TRACKS[id]
  return EASINGS[w.ease](clamp01(invLerp(w.in, w.out, p)))
}

const RANGE = new Map(BLOCK_RANGES.map((r) => [r.id, r]))
const signedOffset = (id, p) => {
  const r = RANGE.get(id)
  const raw =
    (p * SCROLLABLE_VH + 50 - (r.startVh + r.endVh) / 2) / (r.vh / 2 + FALLOFF_PAD)
  return raw < -1 ? -1 : raw > 1 ? 1 : raw
}
const focus = (id, p) => 1 - clamp01(Math.abs(signedOffset(id, p)))

// The opacity ramps from StageSection.tsx. Duplicated deliberately: these are
// the numbers the assertions below are *about*, so the harness has to name them.
const headOpacity = (f) => smoothstep(0.22, 0.54, f)
const ledeOpacity = (f) => smoothstep(0.34, 0.66, f)
const specOpacity = (f) => smoothstep(0.46, 0.78, f)

// Which track each section's sentence is a claim about. Straight from the
// alignment table in the header of timeline.ts.
const OWNS = {
  capture: ['scan', 'pointCloud'],
  reconstruct: ['vertex'],
  geometry: ['geometry'],
  surface: ['mesh', 'finalPlant'],
  phenotype: ['phenotype'],
}

// ── 0. Sanity: the constants this harness assumes ───────────────────────────
console.log(`SCROLLABLE_VH ${SCROLLABLE_VH}   sections ${STAGE_ORDER.length}`)
for (const id of STAGE_ORDER) {
  if (!RANGE.has(id)) note(`${id} has no block in BLOCKS`)
  if (!OWNS[id]) note(`${id} is not in the harness's section→track table`)
}
for (const id of STAGE_ORDER) {
  for (const t of OWNS[id] ?? []) {
    if (!TRACKS[t]) note(`${id} claims track "${t}", which does not exist in TRACKS`)
  }
}

// ── 1. Where each beat's copy actually lands ────────────────────────────────
const SAMPLES = 4000
const sweep = []
for (let i = 0; i <= SAMPLES; i++) sweep.push(i / SAMPLES)

const beats = STAGE_ORDER.map((id) => {
  const r = RANGE.get(id)
  let peakP = 0
  let peak = -1
  let loudIn = null
  let loudOut = null
  for (const p of sweep) {
    const f = focus(id, p)
    if (f > peak) {
      peak = f
      peakP = p
    }
    if (ledeOpacity(f) >= 0.999) {
      if (loudIn === null) loudIn = p
      loudOut = p
    }
  }
  return { id, r, peakP, peak, loudIn, loudOut }
})

console.log('\nbeat         block p        peak p   lede full-opacity span   owning track advance')
console.log('─'.repeat(88))
for (const b of beats) {
  const adv = (OWNS[b.id] ?? []).map((t) => {
    const a = track(t, b.loudIn)
    const z = track(t, b.loudOut)
    return { t, a, z, d: z - a }
  })
  const best = adv.reduce((m, x) => (x.d > m.d ? x : m), { d: -1, t: '—', a: 0, z: 0 })
  console.log(
    b.id.padEnd(13) +
      `${b.r.startP.toFixed(3)}→${b.r.endP.toFixed(3)}`.padEnd(15) +
      b.peakP.toFixed(3).padEnd(9) +
      `${b.loudIn.toFixed(3)}→${b.loudOut.toFixed(3)}`.padEnd(25) +
      `${best.t} ${best.a.toFixed(2)}→${best.z.toFixed(2)} (+${best.d.toFixed(2)})`,
  )
}

// ── 2. Every heading peaks inside its own block, in order ───────────────────
for (let i = 0; i < beats.length; i++) {
  const b = beats[i]
  if (b.peak < 0.999) note(`${b.id} never reaches full focus (max ${b.peak.toFixed(3)})`)
  if (b.peakP < b.r.startP || b.peakP > b.r.endP) {
    note(`${b.id} peaks at p=${b.peakP.toFixed(3)}, outside its own block`)
  }
  if (i > 0 && b.peakP <= beats[i - 1].peakP) {
    note(`${b.id} peaks at or before ${beats[i - 1].id} — the narrative is out of order`)
  }
}

// ── 3. The sentence describes something that is happening NOW ───────────────
// This is the assertion the two comments in timeline.ts promise. A caption that
// reads "points become structure" while the wireframe track is pinned at 0 or
// already at 1 is a caption next to a static frame, which is the exact failure
// the old `introduction` block caused for the whole page.
const MIN_ADVANCE = 0.25
for (const b of beats) {
  const best = Math.max(
    ...(OWNS[b.id] ?? []).map((t) => track(t, b.loudOut) - track(t, b.loudIn)),
  )
  if (best < MIN_ADVANCE) {
    note(
      `${b.id}: while its sentence is fully opaque (p ${b.loudIn.toFixed(3)}→${b.loudOut.toFixed(3)}) ` +
        `no owning track advances more than ${best.toFixed(3)} — the copy is not describing the scene`,
    )
  }
}

// ── 4. One sentence at a time ───────────────────────────────────────────────
// Blocks are 140vh apart and the focus falloff is 115vh, so at every boundary
// both neighbours read focus 0.391. That is *why* the lede ramp starts at 0.34:
// below it, two ledes would be fully opaque at every one of the four boundaries.
let worstPair = 0
let worstPairAt = 0
let worstPairIds = ''
for (const p of sweep) {
  const lit = STAGE_ORDER.map((id) => ({ id, o: ledeOpacity(focus(id, p)) }))
    .filter((x) => x.o > 0.001)
    .sort((a, b) => b.o - a.o)
  if (lit.length < 2) continue
  const second = lit[1].o
  if (second > worstPair) {
    worstPair = second
    worstPairAt = p
    worstPairIds = `${lit[0].id}+${lit[1].id}`
  }
}
console.log(
  `\nsecond-loudest sentence anywhere: ${worstPair.toFixed(3)} at p=${worstPairAt.toFixed(3)} (${worstPairIds})`,
)
if (worstPair > 0.35) {
  note(`two sentences are legible at once at p=${worstPairAt.toFixed(3)} (${worstPair.toFixed(3)})`)
}

// ── 5. …but the page is never wordless for long ─────────────────────────────
// The counterpart to 4. A crossover breath is intended; a long silent stretch
// between beats is a hole in the narrative. Measured across the narrative span
// only — the hero and outro own the ends and are not in STAGE_ORDER.
{
  const from = beats[0].peakP
  const to = beats[beats.length - 1].peakP
  let run = 0
  let worstRun = 0
  let worstRunAt = 0
  for (const p of sweep) {
    if (p < from || p > to) continue
    const loudest = Math.max(...STAGE_ORDER.map((id) => ledeOpacity(focus(id, p))))
    if (loudest < 0.5) {
      run += 1 / SAMPLES
      if (run > worstRun) {
        worstRun = run
        worstRunAt = p
      }
    } else run = 0
  }
  const vh = worstRun * SCROLLABLE_VH
  console.log(
    `longest stretch with no sentence above half strength: ${vh.toFixed(1)}vh (ends p=${worstRunAt.toFixed(3)})`,
  )
  if (vh > 45) note(`${vh.toFixed(1)}vh of scroll with no legible sentence at p≈${worstRunAt.toFixed(3)}`)
}

// ── 6. The block assembles in order, every time ─────────────────────────────
// Label, then sentence, then specification. If these ever cross, the block
// fades in as one flat card, which is the slideshow failure.
{
  const reaches = (fn) => {
    for (let i = 0; i <= 1000; i++) {
      const f = i / 1000
      if (fn(f) >= 0.5) return f
    }
    return Infinity
  }
  const h = reaches(headOpacity)
  const l = reaches(ledeOpacity)
  const s = reaches(specOpacity)
  console.log(`stagger thresholds (focus at half opacity): head ${h} → lede ${l} → spec ${s}`)
  if (!(h < l && l < s)) note(`stagger is out of order: head ${h}, lede ${l}, spec ${s}`)
  if (s >= 1) note('the spec never reaches half opacity — it is dead type')
}

// ── 7. The caption band does not move ───────────────────────────────────────
// The whole measurement in the header of StageSection.tsx — specimen in rows
// 2-6 of 9, copy in the clear bottom band — is only true if the copy STAYS in
// the band. A sticky band does not: a 100vh sticky child inside a 140vh section
// releases after 140−100 = 40vh of scroll and then travels up and out with the
// section, so for 71% of each section the caption is somewhere else, and
// `blockFocus`'s peak (section centre) lands 30vh *after* the pin has already
// ended. The counterfactual below is the size of that mistake.
//
// A Node harness cannot observe CSS, so the invariant is held the only way it
// can be from here: by reading the component. Crude, and worth it — this is the
// assertion that stops `sticky` coming back, and nothing else in the repo would
// notice if it did.
{
  const CHILD_VH = 100
  let worst = 0
  let worstId = ''
  let worstAt = 0
  for (const b of beats) {
    const pinEndsVh = b.r.endVh - CHILD_VH
    for (const p of sweep) {
      const vh = p * SCROLLABLE_VH
      if (vh <= pinEndsVh) continue
      // How far the caption would have travelled up out of the band, 0→1 over
      // the section's remaining scroll, under a sticky layout.
      const travel = clamp01((vh - pinEndsVh) / (b.r.endVh - pinEndsVh))
      const wasted = travel * ledeOpacity(focus(b.id, p))
      if (wasted > worst) {
        worst = wasted
        worstId = b.id
        worstAt = p
      }
    }
  }
  const src = await readFile(fromRoot('src/ui/StageSection.tsx'), 'utf8')
  const band = src.match(/className="([^"]*\bbottom-0\b[^"]*)"/)
  console.log(
    `\ncaption band: ${band ? `"${band[1]}"` : 'NOT FOUND'}` +
      `\n  (a sticky band would spend up to ${worst.toFixed(3)} opacity off-band — ${worstId} at p=${worstAt.toFixed(3)})`,
  )
  if (!band) note('cannot find the caption band element in StageSection.tsx')
  else {
    if (!/\bfixed\b/.test(band[1])) note(`caption band is not \`fixed\`: "${band[1]}"`)
    if (/\bsticky\b/.test(band[1])) note(`caption band is \`sticky\` — it will travel out of the band`)
  }
}

// ── 8. The copy is the brief, verbatim ──────────────────────────────────────
// Five sentences are small enough to assert exactly, and "someone reworded the
// narrative" is otherwise invisible to every other check in the repo.
const BRIEF = {
  capture: 'We observe the plant from multiple viewpoints.',
  reconstruct: 'Image streams become spatial information.',
  geometry: 'Points become structure.',
  surface: 'Structure becomes a measurable 3D representation.',
  phenotype: 'The reconstructed plant becomes quantitative data.',
}
for (const id of STAGE_ORDER) {
  if (SECTION_COPY[id].lede !== BRIEF[id]) {
    note(`${id} lede has drifted from the brief:\n      got  "${SECTION_COPY[id].lede}"\n      want "${BRIEF[id]}"`)
  }
}

// ── 9. Copy discipline: "use very little text" is a measurable claim ────────
{
  let words = 0
  for (const [i, id] of STAGE_ORDER.entries()) {
    const c = SECTION_COPY[id]
    words += c.lede.trim().split(/\s+/).length

    if (c.index !== String(i + 1).padStart(2, '0')) {
      note(`${id}: plate number is "${c.index}", expected "${String(i + 1).padStart(2, '0')}"`)
    }
    if (/\s/.test(c.title)) note(`${id}: title "${c.title}" is more than one word`)
    // One sentence, one full stop, at the end. No semicolons, no em-dash
    // subclauses — those are how a caption turns into a paragraph.
    if ((c.lede.match(/[.!?]/g) ?? []).length !== 1 || !c.lede.endsWith('.')) {
      note(`${id}: lede is not exactly one sentence — "${c.lede}"`)
    }
    if (/[;:—]/.test(c.lede)) note(`${id}: lede has a subclause — "${c.lede}"`)
    if (c.lede.length > 60) note(`${id}: lede is ${c.lede.length} chars, over the 60 budget`)
    // The spec is a fragment. A full stop here promotes it to a second sentence
    // and the section suddenly has a body paragraph. Terminal punctuation only —
    // the decimal point in "2.4M samples" is a numeral, not a sentence.
    if (/[.!?](\s|$)/.test(c.spec)) note(`${id}: spec is punctuated as a sentence — "${c.spec}"`)
    if (c.spec.length > 34) note(`${id}: spec is ${c.spec.length} chars, over the 34 budget`)
  }
  console.log(`\ntotal words across all five sentences: ${words}`)
  if (words > 40) note(`${words} words of narrative — over the 40-word budget`)
}

// ── 10. Not a marketing landing page ───────────────────────────────────────
// Encoded as a check because it is the one instruction that is easy to violate
// by accident, one word at a time, and impossible to see in a diff.
const BANNED = [
  'discover', 'unlock', 'revolution', 'powerful', 'seamless', 'solution',
  'cutting-edge', 'state-of-the-art', 'game-chang', 'effortless', 'empower',
  'learn more', 'get started', 'contact us', 'sign up', 'book a demo',
  'trusted by', 'leading', 'innovat',
]
{
  for (const id of STAGE_ORDER) {
    const c = SECTION_COPY[id]
    const hay = `${c.title} ${c.lede} ${c.spec}`.toLowerCase()
    for (const b of BANNED) {
      if (hay.includes(b)) note(`${id}: "${b}" is landing-page language — "${hay.trim()}"`)
    }
  }
  console.log('no call-to-action or marketing vocabulary in SECTION_COPY')
}

// ── 11. The two ends hand off cleanly ──────────────────────────────────────
// The hero and the outro are not in STAGE_ORDER but they share the same bottom
// band as the captions, and the outro shares it with PHENOTYPE specifically.
// Both windows are hand-authored in their components rather than derived, so
// this is where they get checked against the sections they abut.
{
  const heroExit = (p) => 1 - smoothstep(0, 0.85, signedOffset('hero', p))
  const outroEnter = (p) => smoothstep(-0.42, -0.02, signedOffset('outro', p))

  // The hero is compared on GEOMETRY, not on opacity. It is the one block still
  // in normal flow — deliberately, because a full-screen title should scroll
  // away — so it vacates the band by moving, and an opacity-only comparison
  // would report a clash that does not exist in pixels. Its bottom copy sits one
  // padding step above the fold of a 100vh block at the document top, so in vh:
  //   viewport y = 100 - pad - scrollTop
  const HERO_PAD_VH = 8 // py-8 / md:py-12, as a share of a 900px viewport
  const BAND_TOP_VH = 72 // measured: captions occupy y 691-857 of 900
  let handoffVh = null
  let captureArrivesAt = null
  for (const p of sweep) {
    const head = headOpacity(focus('capture', p))
    if (head > 0.2 && captureArrivesAt === null) {
      captureArrivesAt = p
      handoffVh = 100 - HERO_PAD_VH - p * SCROLLABLE_VH
    }
  }
  console.log(
    `hero copy sits at ${handoffVh.toFixed(1)}vh when the CAPTURE label arrives ` +
      `(p=${captureArrivesAt.toFixed(3)}, band starts ${BAND_TOP_VH}vh)`,
  )
  if (handoffVh > BAND_TOP_VH) {
    note(
      `the hero's bottom copy is still at ${handoffVh.toFixed(1)}vh — inside the caption band — ` +
        `when CAPTURE arrives at p=${captureArrivesAt.toFixed(3)}`,
    )
  }
  if (heroExit(0.12) > 0.05) note(`the hero has not faded out by p=0.12 (${heroExit(0.12).toFixed(3)})`)

  // The outro, by contrast, IS fixed, so opacity overlap is visual overlap. It
  // shares the band with PHENOTYPE, whose label lingers longer than its
  // sentence — so the label is what the outro has to clear.
  let worstOutro = 0
  let worstOutroAt = 0
  for (const p of sweep) {
    const pheno = Math.max(headOpacity(focus('phenotype', p)), ledeOpacity(focus('phenotype', p)))
    const o = Math.min(outroEnter(p), pheno)
    if (o > worstOutro) {
      worstOutro = o
      worstOutroAt = p
    }
  }
  console.log(`outro × phenotype overlap in the band ${worstOutro.toFixed(3)} @p${worstOutroAt.toFixed(3)}`)
  if (worstOutro > 0.2) note(`the outro and the PHENOTYPE caption share the band at p=${worstOutroAt.toFixed(3)}`)
  if (outroEnter(1) < 0.999) note(`the outro never fully arrives (${outroEnter(1).toFixed(3)} at p=1)`)
}

// ── 12. The evidence plates say nothing that is not yet true ────────────────
// Everything above this point is about the scroll experience. This is about the
// eleven plates underneath it, and it exists because that section's entire claim
// to credibility is that it contains no results — the placeholders are honest
// only for as long as nothing beside them quietly stops being a placeholder.
//
// The failure it is really guarding against is gradual: a number added to a
// caption to make it read better, a dataset name typed in to see how the line
// looks, a title edited from naming a procedure to asserting an outcome. Each is
// a one-word diff and none of them look wrong in review.
{
  const seenIds = new Set()
  let plates = 0

  for (const [oi, o] of OFFERINGS.entries()) {
    const want = String(oi + 1).padStart(2, '0')
    if (o.index !== want) note(`offering ${o.id}: index is "${o.index}", expected "${want}"`)

    // The chain printed at the offering's head is derived in content.ts — from
    // SECTION_COPY for 01, from the plates themselves for 02. Asserted here
    // because "derived" is a property of the current code, not of the file.
    const chain = o.spec.split('→').map((s) => s.trim())
    if (chain.length !== o.evidence.length) {
      note(
        `offering ${o.id}: spec names ${chain.length} stages but there are ` +
          `${o.evidence.length} plates — the chain and the sequence disagree`,
      )
    }
    // The chain is also the section's only wayfinding: it is printed once at the
    // head and each plate then names its own position in it. If a chain segment
    // and the rubric on the plate at that position differ, a reader has no way
    // to place the plate at all. Term-for-term, not just a count.
    for (const [ci, term] of chain.entries()) {
      const s = o.evidence[ci]
      if (!s) continue
      const rubric = s.stage ? SECTION_COPY[s.stage].title : s.phase
      if (rubric !== term) {
        note(`offering ${o.id}: chain says "${term}" at ${ci + 1} but the plate says "${rubric}"`)
      }
    }

    const stagesSeen = []
    for (const [si, s] of o.evidence.entries()) {
      plates++

      if (seenIds.has(s.id)) note(`duplicate step id "${s.id}" — ids are anchor targets`)
      seenIds.add(s.id)

      const wantIdx = String(si + 1).padStart(2, '0')
      if (s.index !== wantIdx) {
        note(`${s.id}: figure number is "${s.index}", expected "${wantIdx}" for its position`)
      }

      // Exactly one rubric. Both would render one label and silently drop the
      // other; neither leaves the plate floating outside its own sequence.
      const hasStage = s.stage !== undefined
      const hasPhase = s.phase !== undefined
      if (hasStage && hasPhase) note(`${s.id}: sets both \`stage\` and \`phase\``)
      if (!hasStage && !hasPhase) note(`${s.id}: sets neither \`stage\` nor \`phase\``)
      if (hasStage) {
        if (!STAGE_ORDER.includes(s.stage)) note(`${s.id}: stage "${s.stage}" is not a real beat`)
        stagesSeen.push(s.stage)
      }
      if (hasPhase && !s.phase.trim()) note(`${s.id}: \`phase\` is empty`)

      // A title names a procedure or an object. A full stop turns it into a
      // sentence, and a sentence about a figure that does not exist is a claim.
      if (/[.!?]$/.test(s.label)) note(`${s.id}: title ends in punctuation — "${s.label}"`)
      if (s.label === s.label.toUpperCase()) {
        note(`${s.id}: title is authored in caps — the stylesheet does that ("${s.label}")`)
      }

      // The caption body: at most two sentences, and no invented quantity. `3D`
      // is the one numeral the copy is allowed, because it is part of a name.
      const sentences = (s.summary.match(/[.!?](\s|$)/g) ?? []).length
      if (sentences < 1 || sentences > 2) {
        note(`${s.id}: interpretation is ${sentences} sentences, budget is 1–2`)
      }
      const digits = s.summary.replace(/\b3D\b/g, '')
      if (/\d/.test(digits)) {
        note(`${s.id}: interpretation contains a numeral — "${s.summary}"`)
      }

      // The category has to be one the renderer has a label for, and the aspect
      // has to resolve to something CSS will accept. A bad ratio is the worst of
      // the two: `aspect-ratio: 4:3` is invalid, so the frame collapses to zero
      // height and takes the whole section's spacing with it, silently.
      if (!(s.category in CATEGORY_LABEL)) {
        note(`${s.id}: category "${s.category}" has no label in CATEGORY_LABEL`)
      }
      const ratio = resolveAspect(s.aspect)
      if (!/^\d+(\.\d+)? \/ \d+(\.\d+)?$/.test(ratio)) {
        note(`${s.id}: aspect "${s.aspect}" resolves to "${ratio}", which is not a CSS ratio`)
      }

      const source = EVIDENCE_SOURCES[s.id]
      // Not presence — presence stopped meaning "this slot has a figure" the
      // moment `demo.ts` was spread in, because a demo schematic IS a registered
      // source. Everything below turns on `real`, and a real entry written under
      // the same id in `registry.ts` supersedes the demo object, which flips
      // this with no other edit anywhere.
      const isDemo = sameSource(source, DEMO_SOURCES[s.id])
      const real = source !== undefined && !isDemo
      // A demo path reached any way other than through `demo.ts` — typed
      // straight into the registry to get something on screen. It would be
      // treated as real by everything above, which means it could carry a
      // caption and a citation.
      if (real && source.type !== 'component' && source.src.startsWith('/demo/')) {
        note(`${s.id}: registry points into /demo/ but is not a DEMO_SOURCES entry`)
      }
      // Every registered source carries an accessible name, including the
      // `component` case, where the thing on screen is a canvas with none of its
      // own. The type already requires it; this catches an empty string, which
      // the type does not. Demos included — a placeholder drawing that is
      // invisible to a screen reader is worse than no placeholder.
      if (source !== undefined && !source.alt?.trim()) {
        note(`${s.id}: registered source has no alt text`)
      }
      // An asset may override the reserved box's ratio, which is what lets a real
      // figure of any shape drop into a slot the demos left at 16:9. Same check
      // as the figure's own aspect, and for the same reason: an unparseable ratio
      // collapses the frame to zero height. This one additionally feeds
      // `--stage-aspect`, where a NaN would take out the whole stage's width cap.
      if (source?.aspect !== undefined) {
        const srcRatio = resolveAspect(source.aspect)
        if (!/^\d+(\.\d+)? \/ \d+(\.\d+)?$/.test(srcRatio)) {
          note(`${s.id}: source aspect "${source.aspect}" resolves to "${srcRatio}"`)
        }
        // The demos are drawn to fit whatever box they are given; one asserting a
        // ratio means the schematic has started dictating the layout that real
        // material has to inherit. See the header of `demo.ts`.
        if (isDemo) note(`${s.id}: DEMO source declares an aspect`)
      }
      if (!real) {
        // Still the fallback the moment the demos come out, so it has to stay
        // on-pattern even while something is covering it.
        if (!/^\[REAL .+ — TO BE INSERTED\]$/.test(s.placeholder)) {
          note(`${s.id}: placeholder is off-pattern — "${s.placeholder}"`)
        }
        // The apparatus describes the figure, so none of it can exist before the
        // figure does. This is the check that makes `registry.ts` the gate: a
        // panel key, a method line or a citation under an empty rectangle is
        // fabricated evidence dressed as small print — and under a schematic
        // that merely looks like a figure it is worse, because there the small
        // print is the only thing claiming to be specific.
        for (const f of ['caption', 'metadata', 'reference']) {
          if (s[f] !== undefined) {
            note(`${s.id}: has a \`${f}\` but no real figure in EVIDENCE_SOURCES to carry it`)
          }
        }
      }

      const hay = `${s.phase ?? ''} ${s.label} ${s.summary}`.toLowerCase()
      for (const b of BANNED) {
        if (hay.includes(b)) note(`${s.id}: "${b}" is landing-page language — "${hay.trim()}"`)
      }
    }

    // Offering 01 re-walks the scroll, so its plates must be in beat order and
    // must not repeat one. A plate labelled CAPTURE after one labelled GEOMETRY
    // breaks the only thing tying the record to the argument.
    const positions = stagesSeen.map((s) => STAGE_ORDER.indexOf(s))
    if (new Set(stagesSeen).size !== stagesSeen.length) {
      note(`offering ${o.id}: repeats a stage — ${stagesSeen.join(', ')}`)
    }
    if (positions.some((p, i) => i > 0 && p <= positions[i - 1])) {
      note(`offering ${o.id}: stages are out of beat order — ${stagesSeen.join(' → ')}`)
    }

    // `bridge` is one string per line, so join before matching — the banned
    // phrases are multi-word and one could otherwise straddle a line boundary.
    const oHay = `${o.title} ${o.lede} ${o.spec} ${(o.bridge ?? []).join(' ')}`.toLowerCase()
    for (const b of BANNED) {
      if (oHay.includes(b)) note(`offering ${o.id}: "${b}" is landing-page language`)
    }
  }

  // ── The demo map itself ─────────────────────────────────────────────────
  // Temporary material gets the strictest handling in the harness, not the
  // loosest, because it is the material nobody will re-read. Two ways it can rot
  // silently, and both are checked here.
  const ids = new Set(OFFERINGS.flatMap((o) => o.evidence.map((e) => e.id)))
  for (const [id, src] of Object.entries(DEMO_SOURCES)) {
    // A key that matches no figure is not an error anywhere else: the lookup
    // just returns undefined, the placeholder stays up, and the page looks
    // exactly as it did before the demo was added. Renaming a step id would do
    // this to a slot and nothing would say so.
    if (!ids.has(id)) note(`DEMO_SOURCES has "${id}", which is not a figure id in content.ts`)
    if (src.type !== 'image' && src.type !== 'video') continue
    // A typo in the path is a broken <img>, which in a dark frame at 16:9 is
    // very close to invisible. Resolve it against public/ the way Vite will.
    if (!src.src.startsWith('/')) {
      note(`DEMO_SOURCES["${id}"]: src "${src.src}" is not a root-relative path`)
    } else if (!existsSync(fromRoot(`public${src.src}`))) {
      note(`DEMO_SOURCES["${id}"]: no file at public${src.src}`)
    }
  }

  const demoCount = Object.entries(EVIDENCE_SOURCES).filter(([id, s]) =>
    sameSource(s, DEMO_SOURCES[id]),
  ).length
  const realCount = Object.keys(EVIDENCE_SOURCES).length - demoCount
  console.log(
    `\n${OFFERINGS.length} offerings, ${plates} plates, ${realCount} real, ${demoCount} demo — ` +
      `no numerals, no provenance and no marketing vocabulary on any plate without a real figure`,
  )
}

console.log('')
if (fail.length === 0) console.log('PASS — all assertions hold')
else {
  console.log('FAIL')
  for (const f of fail) console.log('  • ' + f)
  process.exitCode = 1
}
