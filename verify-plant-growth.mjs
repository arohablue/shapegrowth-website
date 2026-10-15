// Verification of the Python ↔ TypeScript boundary for offering 02.
//
// The other harnesses check the scene and the narrative. This one checks that
// the browser reads the same numbers the exporter wrote — which is a failure
// mode none of them can see, and which `tsc` cannot see either, because both
// sides of the mistake are a Float32Array of exactly the right length.
//
// IT EXISTS BECAUSE THIS ALREADY HAPPENED
// ───────────────────────────────────────
// `loadSpecimen` was written to deinterleave record-major ten-float records.
// `write_bin` writes four contiguous blocks. Both produce 30,000 floats from
// 120,000 bytes and both yield 3,000 "points" whose first three coordinates are
// real numbers in the right range, so there is no length check, no NaN, no
// throw, and no type error anywhere on the path. What it renders is a cloud of
// nonsense that still turns, still has a legend under it, and still reports
// 3,000 points. A screenshot of it looks like a result.
//
// So the assertions below are deliberately not structural. They read the
// arrays and compare them against statistics the exporter published from the
// same arrays — the only check that can tell a correct read from a plausible
// one.
//
// Bundled from src on every run, like the others: a harness pointed at a stale
// bundle reports PASS for code that no longer exists.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'

const BUNDLE = 'bundle-plant-growth.mjs'
execFileSync(
  'npx',
  [
    'esbuild',
    'src/evidence/views/plant-growth/manifest.ts',
    '--bundle',
    '--format=esm',
    '--alias:@=./src',
    // three is imported only for `DefaultLoadingManager`, which this harness
    // never reaches — `trackedFetch` is stubbed below. Left external so the
    // bundle stays 3kb instead of pulling in the whole renderer.
    '--external:three',
    `--outfile=${BUNDLE}`,
  ],
  { stdio: 'inherit' },
)

const mod = await import(`./${BUNDLE}`)
const manifest = JSON.parse(readFileSync('public/evidence/plant-growth/manifest.json', 'utf8'))

// Serve `public/` off the filesystem. The loader's own byte-count assertion is
// part of what is under test, so the bytes have to be the real ones.
globalThis.fetch = async (url) => {
  const buf = readFileSync(`public${url}`)
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  }
}

let failures = 0
const near = (label, got, want, tol) => {
  const pass = Math.abs(got - want) <= tol
  if (!pass) failures++
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}  ${got.toFixed(4)} vs ${want.toFixed(4)}`)
}
const is = (label, pass, detail) => {
  if (!pass) failures++
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
}

for (const record of manifest.specimens) {
  console.log(`\n${record.id} — ${record.label} (${record.quality})`)
  const a = await mod.loadSpecimen(mod.specimenById(manifest, record.id))
  const n = record.diagnostics.n_points
  const d = record.diagnostics

  is(
    'array lengths follow n_points',
    a.src.length === n * 3 &&
      a.tgt.length === n * 3 &&
      a.displacement.length === n * 3 &&
      a.warped.length === n * 3 &&
      a.detJ.length === n,
    `n=${n}`,
  )

  // Displacement magnitudes. Distinctive because they are small — a mis-read
  // puts coordinate differences here, which run two orders of magnitude larger.
  const mags = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    mags[i] = Math.hypot(a.displacement[i * 3], a.displacement[i * 3 + 1], a.displacement[i * 3 + 2])
  }
  const sorted = Array.from(mags).sort((x, y) => x - y)
  near('|displacement| mean', sorted.reduce((s, v) => s + v, 0) / n, d.displacement.mean, 1e-3)
  near('|displacement| max ', sorted[n - 1], d.displacement.max, 1e-3)

  // Determinants. The sharpest signal: these sit around 1 and the coordinates
  // this dataset carries run to ±900.
  const dj = Array.from(a.detJ).sort((x, y) => x - y)
  near('detJ min         ', dj[0], d.detJ.min, 1e-4)
  near('detJ max         ', dj[n - 1], d.detJ.max, 1e-4)
  // Median over an even count is interpolated by numpy and taken as the upper
  // element here, so this is a looser comparison than the extremes by nature.
  near('detJ median      ', dj[Math.floor(n / 2)], d.detJ.median, 5e-3)

  // The three bands must partition the points, and the non-positive count is
  // the one the viewer is forbidden to fold into "compressing".
  let expanding = 0
  let compressing = 0
  let nonPositive = 0
  for (let i = 0; i < n; i++) {
    const v = a.detJ[i]
    if (v > 1) expanding++
    else if (v > 0) compressing++
    else nonPositive++
  }
  is('detJ bands partition', expanding + compressing + nonPositive === n)
  near('frac_expanding   ', expanding / n, d.detJ.frac_expanding, 1e-6)
  near('frac_compressing ', compressing / n, d.detJ.frac_compressing, 1e-6)
  is(
    'count_non_positive',
    nonPositive === d.detJ.count_non_positive,
    `${nonPositive} vs ${d.detJ.count_non_positive}`,
  )

  // `bounds` is over the union of both scans, not the source alone. A viewer
  // frames its camera on this, so a source-only box would let the day t+1 cloud
  // hang out of shot at the top — which is exactly where the growth is.
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const arr of [a.src, a.tgt]) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const v = arr[i * 3 + k]
        if (v < lo[k]) lo[k] = v
        if (v > hi[k]) hi[k] = v
      }
    }
  }
  is(
    'bounds span both scans',
    [0, 1, 2].every(
      (k) =>
        Math.abs(lo[k] - d.bounds.min[k]) < 1e-3 && Math.abs(hi[k] - d.bounds.max[k]) < 1e-3,
    ),
  )

  // The identity the manifest states, since `warped` is not in the file.
  // float32-relative: the sum is computed in float64 and stored as float32, so
  // it may differ from the exact sum by half an ulp. Near y = -800 that is
  // about 3e-5 absolute, which is why a flat 1e-5 tolerance is wrong here.
  let beyond = 0
  for (let i = 0; i < n * 3; i++) {
    const want = a.src[i] + a.displacement[i]
    const ulp = Math.abs(a.warped[i] - want) / (Math.abs(want) * 1.1920929e-7 + Number.MIN_VALUE)
    if (ulp > 0.5) beyond++
  }
  is('warped = src + displacement', beyond === 0, `${beyond} beyond half an ulp`)
}

// The manifest's own promises about itself, asserted once.
console.log('\nmanifest')
is('units are scan units, never mm', manifest.units === 'scan units', `"${manifest.units}"`)
is('calibration is an explicit null', manifest.calibration === null)
is('caveats are carried', manifest.caveats.length >= 4, `${manifest.caveats.length} of them`)
is(
  'every specimen with point data is listed',
  manifest.specimens.length === manifest.coverage.plants_with_point_data,
  `${manifest.specimens.length} of ${manifest.coverage.plants_in_study} studied`,
)
is(
  'the default specimen exists',
  manifest.specimens.some((s) => s.id === mod.DEFAULT_SPECIMEN),
  mod.DEFAULT_SPECIMEN,
)

// ── what the selector promises ──────────────────────────────────────────────
// The viewer offers `manifest.specimens` unfiltered, so the manifest is the
// selector. Every assertion above already proved each entry's bytes are
// readable and its statistics are its own, which is most of what "only
// specimens with usable, validated assets" means — these are the rest.

// Every id is distinct and resolvable through the same lookup the viewer uses.
// A duplicate id would give the `<select>` two options that cannot be told
// apart, and `specimenById` would silently return the first of them.
is(
  'specimen ids are unique and resolvable',
  manifest.specimens.every((s) => mod.specimenById(manifest, s.id) === s) &&
    new Set(manifest.specimens.map((s) => s.id)).size === manifest.specimens.length,
)

// Distinct labels, because the label is what the reader picks by and what the
// legend prints back. Two plants called the same thing is the selector failing
// at its only job.
is(
  'specimen labels are distinct and non-empty',
  manifest.specimens.every((s) => s.label.trim().length > 0) &&
    new Set(manifest.specimens.map((s) => s.label)).size === manifest.specimens.length,
)

// The intervals the plate prints. Never invented: the viewer reads `from`,
// `to` and `days` straight off the record, so an empty string would render as
// `03-24 →  ·  days apart`, which looks like a gap rather than a bug.
is(
  'every specimen carries a real interval',
  manifest.specimens.every(
    (s) => s.interval.from && s.interval.to && Number.isInteger(s.interval.days) && s.interval.days > 0,
  ),
)

// A `problematic` specimen MUST carry a note, because the viewer's flag is the
// note — an unflagged failure case is the trap the plan warns about. The study
// ships exactly one, and that is worth asserting rather than assuming: a
// selector with no failure case in it cannot show that one was found.
const problematic = manifest.specimens.filter((s) => s.quality === 'problematic')
is(
  'problematic specimens all carry a note',
  problematic.every((s) => s.note && s.note.trim().length > 0),
  `${problematic.length} of ${manifest.specimens.length}`,
)
is('the study ships its failure case', problematic.length >= 1, problematic.map((s) => s.id).join(', '))

// T02's note quotes its own chamfer figure. Checked against the record rather
// than trusted, since prose and statistics drift in opposite directions: a
// re-run that improves the fit leaves the sentence behind.
for (const s of problematic) {
  const quoted = s.note.match(/([0-9]+\.[0-9]+)/)
  is(
    `${s.id}: the note's quoted fit matches its record`,
    quoted !== null && Math.abs(Number(quoted[1]) - s.fit.chamfer_after) < 0.01,
    quoted ? `${quoted[1]} vs ${s.fit.chamfer_after.toFixed(2)}` : 'no figure quoted',
  )
}

// Each specimen is framed on its own bounds. Sharing one frame across four
// plants would put a tomato off-screen, so a degenerate diagonal — which would
// divide by zero in `frameOf` — has to be impossible rather than unlikely.
is(
  'every specimen can be framed on its own bounds',
  manifest.specimens.every((s) => s.diagnostics.bounds.diagonal > 0),
)

rmSync(BUNDLE, { force: true })

console.log(
  `\n${failures === 0 ? 'PASS' : `FAIL — ${failures} assertion${failures === 1 ? '' : 's'}`}` +
    ` · ${manifest.specimens.length} specimens read against the exporter's own statistics`,
)
process.exit(failures === 0 ? 0 : 1)
