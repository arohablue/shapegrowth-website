import { lazy, type ComponentType } from 'react'
import type { FigureAspect } from '@/evidence/figure'
// DEMO ONLY. Delete this import and the spread below to return the page to
// eleven labelled holes. See `demo.ts`.
import { DEMO_SOURCES } from '@/evidence/demo'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * WHERE REAL EVIDENCE GETS PLUGGED IN
 * ────────────────────────────────────────────────────────────────────────────
 * This file is the entire insertion point. It is empty on purpose, and the
 * emptiness is the deliverable: when a figure, a video or a WebGL visualisation
 * is ready, it is added to `EVIDENCE_SOURCES` under the matching step id and it
 * appears. No component is written, no layout is touched, no section is
 * reordered, and the only edit in `content.ts` is tightening the caption text to
 * the figure that actually landed.
 *
 * The alternative — which is what usually happens — is that each result gets its
 * own bespoke component wired into its own spot in the page, and by the fourth
 * one the section is a pile of one-off markup that cannot be reordered. Splitting
 * "what the step IS" (`content.ts`) from "what currently FILLS it" (here) is what
 * stops that.
 *
 *
 * WHY THE KEY IS A LOOSE STRING
 * ─────────────────────────────
 * `Partial<Record<string, …>>` rather than a union of the eleven step ids. A
 * union would be tighter, and it would also mean every real asset lands as two
 * edits in two files instead of one. The cost of the looser type is a typo
 * silently leaving a placeholder on screen — which is exactly the failure this
 * section is built to make visible, since the placeholder says in capitals that
 * it is a placeholder. The tight version protects against an error that is
 * already self-announcing.
 */

/**
 * The medium: how the browser is to draw this figure.
 *
 * Three cases, and the discriminant lives HERE rather than on the figure,
 * because it is a property of the file and not of the science. A photograph, a
 * plot, a micrograph, a segmentation overlay, a diagram and an exported map are
 * all `image` — they differ in what they show, which is `category`'s job, and
 * not at all in how they are drawn. See the `FigureCategory` docs for why those
 * two used to be one field and what went wrong with it.
 *
 * `image` covers every still format the page will be given — PNG, JPG, WebP,
 * AVIF and SVG — because `<img>` decodes all of them and the element does not
 * care which it got. There is deliberately no `format` field: it would be a
 * second copy of the file extension, able to disagree with it, and nothing in
 * the renderer would consult it. An `.svg` in an `<img>` renders and scales
 * correctly; an inline SVG that needs styling from the page is a `component`.
 * Calling either a separate case would be two ways to do one job.
 *
 * Every case carries `alt`. That is not a convention, it is the type: there is
 * no way to register a figure without describing it, including the `component`
 * case, where the thing on screen is a `<canvas>` with no accessible name of
 * its own. The figure's `summary` is not a substitute — it says what the figure
 * demonstrates, not what it looks like, so a screen reader would get the caption
 * twice and a description of the image never.
 *
 *
 * EVERY CASE ALSO CARRIES AN OPTIONAL `aspect`
 * ────────────────────────────────────────────
 * The figure's own `aspect` is the shape of the *hole*; this is the shape of the
 * *file*, and it wins. That is the one thing that makes a real asset a one-line
 * drop-in: without it, replacing a 16:9 demo with a 4:3 micrograph needs a
 * second edit, in `content.ts`, by someone who has to notice it is needed — and
 * until they do, `object-fit: contain` quietly letterboxes a real result into a
 * box whose proportions were set by a placeholder drawing.
 *
 * Authored rather than measured. Reading `naturalWidth` on load would need no
 * authoring at all, and was rejected: it resizes the frame *after* the asset
 * decodes, which on the sticky stage — where every plate shares one grid cell
 * and the cell is as tall as the tallest — makes the stage jump while the reader
 * is inside it. It also cannot answer for a `component` at all, and an SVG with
 * no intrinsic size reports zero. One line per asset buys a layout that is
 * correct on the first frame and correct for all three media.
 */
export type EvidenceSource =
  | {
      readonly type: 'image'
      readonly src: string
      readonly alt: string
      /** The file's own ratio. Overrides the figure's reserved box. */
      readonly aspect?: FigureAspect
    }
  | {
      readonly type: 'video'
      readonly src: string
      readonly alt: string
      /** Poster frame, shown before the first frame decodes. */
      readonly poster?: string
      /** The footage's own ratio. Overrides the figure's reserved box. */
      readonly aspect?: FigureAspect
    }
  | {
      readonly type: 'component'
      /**
       * Rendered inside the figure's reserved box, which already has the aspect
       * ratio and the hairline frame. The component draws content and nothing
       * else — no border, no label, no caption.
       *
       * Lazy this if it pulls in three: the offerings sit below the entire
       * reconstruction, so anything imported eagerly here lands in the critical
       * path of a page the reader may never scroll to. See the lazy boundary in
       * `App.tsx` for the same reasoning applied to the scene itself.
       *
       * `active` is passed by `Media`, and is true only for the plate currently
       * on the stage. Optional, because a view is free to ignore it — the point
       * cloud does, it turns whether or not it is the one being discussed.
       *
       * The two leaf-dynamics views do not ignore it, and the prop exists
       * because of them: six plates share one grid cell and five of them sit at
       * `opacity: 0`, so a view that animates unconditionally runs a render loop
       * and a 97-frame atlas for a figure nobody is looking at. It is also what
       * keeps their controls out of the tab order while they are invisible,
       * which is the same promise `.plate__expand` already makes by not
       * rendering at all when the plate is inactive.
       */
      readonly component: ComponentType<{ readonly active?: boolean; readonly beat?: string }>
      /**
       * Which of the view's representations this slot asks for, when several
       * slots are filled by ONE view.
       *
       * The field exists for offering 02 and is what makes that offering's
       * sequence possible at all. Six plates there are six readings of one pair
       * of scans, so they are filled by six entries that all name the same
       * `component` — `Offerings.tsx` recognises that and mounts the view once,
       * handing it the active slot's `beat` as the reader scrolls. Six separate
       * instances would be six WebGL contexts for one plant, on a page that
       * already holds two.
       *
       * It lives here rather than on the figure because it answers "what is
       * currently in this slot", which is this file's question. The figure says
       * what the step IS, and a step named `Registration` does not know that the
       * thing filling it happens to call that representation `registered`.
       *
       * Unset everywhere else, and a view that is given one it does not
       * recognise is expected to fall back to its own default rather than
       * render nothing.
       */
      readonly beat?: string
      /**
       * The accessible name for the rendered output. Applied to the wrapper as
       * `role="img"` + `aria-label`, because a canvas that draws a point cloud
       * is, to everything that is not a pair of eyes, an empty element.
       */
      readonly alt: string
      /**
       * The ratio the view wants to be drawn at. The one case where this is a
       * genuine authoring decision rather than a fact read off a file — a WebGL
       * view has whatever shape it is given — so leaving it unset and inheriting
       * the reserved box is usually right.
       */
      readonly aspect?: FigureAspect
    }

/**
 * Offering 02's one view, declared once and referenced by all six of its slots.
 *
 * Module scope rather than inline, and that is the whole mechanism behind the
 * continuous stage — see the note over those six entries. `lazy` for the reason
 * the type's own docs give: this reaches three and @react-three/fiber, and the
 * offerings sit below the entire reconstruction sequence.
 */
const GROWTH_FIELD_VIEW = lazy(() => import('@/evidence/views/plant-growth/GrowthFieldView'))

/**
 * Step id → the material that fills it.
 *
 * No real material yet. All eleven slots are currently held by the temporary
 * development schematics in `demo.ts` — see that file for what they are, what
 * they are not, and how to take them out.
 *
 * The demos are drawings of the TYPE of figure each slot expects, and they are
 * deliberately not good: uniform arrows, an empty plot, a faint DEMO mark in the
 * corner. That is the constraint the previous empty state was protecting. A
 * layout populated with convincing stand-in charts is indistinguishable at a
 * glance from one populated with real ones, and the day it gets screenshotted
 * into a slide deck is the day the distinction stops existing.
 *
 * To fill one for real:
 *
 *   export const EVIDENCE_SOURCES: Partial<Record<string, EvidenceSource>> = {
 *     'source-data': {
 *       type: 'image',
 *       src: '/evidence/source-data.jpg',
 *       alt: 'Twelve calibrated views of the specimen on a turntable',
 *       aspect: '4/3',
 *     },
 *   }
 *
 * That is the whole edit. `aspect` is what keeps it to one file: the frame, the
 * enlarged view and the sticky stage's height budget all re-derive from it, so a
 * portrait figure dropped into a slot the demos left at 16:9 reshapes the page
 * to fit rather than being letterboxed inside the placeholder's proportions.
 * Omit it and the figure's own reserved ratio stands.
 *
 * The same shape, for the other two media:
 *
 *   'leaf-observation': {
 *     type: 'video', src: '/evidence/leaf-timelapse.webm',
 *     poster: '/evidence/leaf-timelapse.jpg', aspect: '4/3',
 *     alt: 'Time-lapse of one leaf expanding over eleven days',
 *   },
 *   'reconstruction-output': {
 *     type: 'component', component: lazy(() => import('@/evidence/views/Cloud')),
 *     alt: 'Interactive point cloud of the reconstructed specimen',
 *   },
 *
 * then, on the matching figure in `content.ts`, tighten `label` and `summary` to
 * the figure that actually landed and add the apparatus it has: `caption` (the
 * panel key), `metadata` (instrument, scale, parameters), `reference` (where it
 * came from). Set `expandable: true` if it is dense enough to reward a closer
 * look.
 *
 * Those are undefined on every figure today on purpose, and `verify-narrative`
 * fails if one appears on a figure whose only source is a demo. A panel key or a
 * scale bar under a schematic is fabricated evidence, and it is the kind that
 * survives review because it looks like exactly what it is imitating. Adding a
 * REAL asset here is what earns the right to write them — the demo map is
 * explicitly not enough, which is why the harness reads both.
 */
export const EVIDENCE_SOURCES: Partial<Record<string, EvidenceSource>> = {
  // DEMO ONLY — temporary development visuals, spread in FIRST so that any real
  // entry written below supersedes the demo for that slot. Removing this one
  // line removes all nine that remain. See `demo.ts`.
  ...DEMO_SOURCES,

  /* ── REAL ────────────────────────────────────────────────────────────────
   * Both of these come out of the COLMAP sunflower reconstruction staged in
   * `data/colmap-sunflower/`, and their demo counterparts have been deleted
   * from `demo.ts` rather than left underneath, because a superseded demo is
   * dead code that still reads as a live placeholder.
   *
   * Only one of them is a built file now. `source-data` is rebuilt by
   *
   *   python3 scripts/build-capture-sheet.py
   *
   * while `reconstruction-output` has no build step at all: it reads the same
   * PLY the scroll scene reads, at runtime. `scripts/build-evidence-plate.py`
   * used to sit beside the capture-sheet builder and produce the still that
   * filled that slot; it went with the JPEG, because a generator for an asset
   * nothing loads is the most convincing kind of dead code — it runs.
   *
   * `aspect` is stated on both, which is the difference between a real entry
   * and a demo one: a demo takes whatever hole it is given, a real asset
   * declares the shape of the file and lets the page reshape to it. Both
   * happen to be 16:9, which is what the figures already reserved — that is a
   * coincidence of how they were built, not something to rely on.
   *
   * `phenotyping-output` is no longer a demo, and the line that used to stand
   * here said there would not be a trait extraction figure "until traits have
   * actually been measured". That is still the rule, and this entry does not
   * break it: what landed is the real specimen with the real CALIPER
   * PLACEMENTS drawn on it, carrying the same `SCHEMATIC — NOT MEASURED`
   * notice the scroll stage carries. The seven numbers are still invented. The
   * figure now shows the one thing about the pass that is a result — where
   * each measurement would be taken — instead of an outline drawing of a
   * plant that is not this plant. */

  'source-data': {
    type: 'image',
    src: '/capture/sunflower-views.jpg',
    alt:
      'Six photographs of the same potted sunflower against a white background, arranged three across and two down. Each is taken from a different position on a circle around the plant, and reading left to right and top to bottom the viewpoint travels the whole way round: the flower head starts turned away, swings through profile, comes to face the camera in the last frame. The same leaves, stem and pot recur in every frame, so the six read as one specimen recorded from six angles rather than as six plants.',
    aspect: 'wide',
  },

  /* The only `component` on the page, and the only slot where a still was the
   * wrong medium rather than merely a smaller one. A dense cloud photographed
   * from one angle is indistinguishable from a photograph of the plant — the
   * thing that makes it read as RECOVERED GEOMETRY is that it turns, and a
   * still cannot show that at any resolution. It was a two-up JPEG of the cloud
   * beside the mesh, which has been deleted rather than kept as a fallback: a
   * superseded asset that still loads is dead weight in the build.
   *
   * `lazy`, for the reason the type's own docs give. This reaches three and
   * @react-three/fiber, and the offerings sit below the entire reconstruction
   * sequence — imported eagerly it would put a second copy of the renderer in
   * the critical path of a page many readers never scroll to the bottom of.
   * The chunk is fetched when the plate mounts; the PLY inside it is already in
   * `useLoader`'s cache by then, because the scene above it asked for the same
   * URL. */
  'reconstruction-output': {
    type: 'component',
    component: lazy(() => import('@/evidence/views/DenseCloud')),
    alt:
      'An interactive three-dimensional view of the reconstructed sunflower, drawn as a dense cloud of individually coloured points recovered from the photographs. The stem, the leaf blades and the yellow flower head are all resolved, and the plant turns slowly so it is seen from every side. Dragging across it rotates the plant; a pinch moves the viewpoint closer or further away.',
    aspect: 'wide',
  },

  /* The same view as the plate above it, with the measurement pass drawn over
   * it — and a SEPARATE module rather than a second reference to `DenseCloud`,
   * which is load-bearing: `isContinuous` compares these `component`
   * references with `===` to decide a run of plates is one continuous figure.
   * See the note in `TraitCalipers.tsx`.
   *
   * It reads no new asset. The cloud is the PLY the plate above already
   * parsed, the caliper endpoints are `TRAIT_GEOMETRY`, and the bounds they
   * resolve against are measured from the same mesh the scroll stage measures
   * — so the seven placements here and the seven in the hero are the same
   * seven, by construction rather than by matching numbers twice. */
  'phenotyping-output': {
    type: 'component',
    component: lazy(() => import('@/evidence/views/TraitCalipers')),
    alt:
      'The same reconstructed sunflower, with a measurement pass drawn over it. Seven dimension lines are placed one after another against the geometry — the full height of the plant, the length and width of a leaf blade, the angle that leaf leaves the stem at, the gap between two leaf junctions, and the thickness of the stem near its base — each ending in a small marker with a label and a reading beside it. A notice in the corner reads SCHEMATIC — NOT MEASURED: the placements are taken from the reconstruction, the numbers beside them are not. Dragging across it rotates the plant and the lines turn with it, staying in the same space as the surfaces they measure.',
    aspect: 'wide',
  },

  /* ── 02 / PLANT GROWTH FIELDS ───────────────────────────────────────────
   * All six slots, filled by ONE view.
   *
   * The asset is neither an image nor a bundled model: `GrowthFieldView` reads
   * `public/evidence/plant-growth/manifest.json` and a 120 kB binary beside
   * it, both written by `scripts/build-plant-growth.py` from the Pheno4D
   * scans. Nothing about the registration is computed in the browser — the
   * arrays are the exporter's output, and `verify-plant-growth.mjs` checks
   * that what the loader reads back matches the statistics the exporter
   * published from the same arrays.
   *
   * `component` for the reason the dense cloud gives, with one addition. Every
   * representation here is only legible in motion or from a chosen angle: a
   * displacement field photographed head-on is a field of dots, and a
   * determinant map shown at one yaw hides whichever half of the plant is
   * behind the other.
   *
   * WHY THE SIX ENTRIES SHARE ONE `component` CONSTANT
   * ──────────────────────────────────────────────────
   * `GROWTH_FIELD_VIEW` is declared once above and referenced six times, and
   * that identity is load-bearing rather than tidy. `Offerings.tsx` decides a
   * sequence is one continuous figure by comparing these references, and React
   * only keeps the view mounted across a beat change because the element type
   * does not change. Six `lazy(...)` calls would be six distinct component
   * types: six WebGL contexts if they were all mounted, and a remount — a new
   * context, a refetch and a camera back at the opening shot — on every step
   * if they were not.
   *
   * Each entry still carries its own `alt`, because the whole point of the
   * sequence is that the thing on screen is different at each step, and an
   * accessible name describing all six at once would be accurate at none of
   * them. The wrapper takes the active slot's. */
  'scan-day-t': {
    type: 'component',
    component: GROWTH_FIELD_VIEW,
    beat: 'source',
    alt:
      'A three-dimensional view of one maize plant recorded as a cloud of three thousand points, drawn in blue against an empty background. The stem and the long arching leaves are resolved as surfaces of scattered points with the soil removed, and the plant turns slowly so it is seen from every side. Dragging across it rotates it.',
    aspect: 'wide',
  },

  'scan-day-t1': {
    type: 'component',
    component: GROWTH_FIELD_VIEW,
    beat: 'target',
    alt:
      'The same plant recorded again a day later, drawn as a second cloud of three thousand points in red. It is recognisably the same plant in the same pose, slightly taller, with the leaves held at somewhat different angles. Nothing marks which point here corresponds to which point in the earlier scan, because nothing does.',
    aspect: 'wide',
  },

  'non-rigid-registration': {
    type: 'component',
    component: GROWTH_FIELD_VIEW,
    beat: 'registered',
    alt:
      'The two scans drawn together: the later scan as larger red points, and over it, in the blue of the earlier scan, the earlier cloud after a non-rigid registration has carried it onto the later one. The two surfaces coincide almost everywhere, so most of the plant reads as a single speckled cloud of mixed blue and red; where they separate — at leaf tips and at the top of the stem — the earlier scan is visibly short of the later one.',
    aspect: 'wide',
  },

  'displacement-field': {
    type: 'component',
    component: GROWTH_FIELD_VIEW,
    beat: 'displacement',
    alt:
      'The earlier scan dimmed to a faint blue surface, with a line leaving each point along the displacement the registration estimated for it. Each line is drawn at true length and is violet throughout, faint where it leaves the surface and at full strength at its far end, so the field reads as flowing off the surface. The lines are short and roughly parallel over the stem and much longer at the leaf tips.',
    aspect: 'wide',
  },

  'local-deformation': {
    type: 'component',
    component: GROWTH_FIELD_VIEW,
    beat: 'deformation',
    alt:
      'The earlier scan again, with every point coloured by the determinant of the registration\u2019s Jacobian: red where the estimated map expands tissue, cyan where it compresses it, grey in between where it does neither, and a separate off-scale gold for points where the map folds and the value is not a deformation at all. A key beside the plant gives the bands and the share of points in each.',
    aspect: 'wide',
  },

  'growth-field-explorer': {
    type: 'component',
    component: GROWTH_FIELD_VIEW,
    beat: 'explore',
    alt:
      'The same view with its controls shown, so all five representations above can be chosen in any order and compared. The plant is chosen from four — three maize and one tomato, the last marked in the list as a problematic registration — and the density and drawn length of the displacement vectors can be changed. Dragging across the plant rotates it; holding Control and scrolling, or pinching, moves the viewpoint. A legend names the specimen on screen and reports how far its registration is to be trusted, in scan units, together with any caution the study attaches to that specimen and its own caveat about what the representation showing is not.',
    aspect: 'wide',
  },
}

/**
 * ── ARCHIVED — 02 / LEAF DYNAMICS ───────────────────────────────────────────
 * Not spread into `EVIDENCE_SOURCES`, so none of the six is reachable: the
 * figures that claimed them left `content.ts` when PLANT GROWTH FIELDS took
 * position 02, and they now live in `content.archive.ts`.
 *
 * Kept here, in the registry, rather than moved into the archive file beside
 * the copy. The split is the one this file already draws — what a figure says
 * is content, what currently fills it is registry — and collapsing it for the
 * archived offering would mean restoring the section reassembled a structure
 * that no longer exists anywhere to be checked against.
 *
 * Nothing is deleted. The built assets are still in
 * `public/evidence/leaf-dynamics/` and the two interactive views are still in
 * `evidence/views/leaf-dynamics/`; the `lazy` chunks below are simply never
 * requested, because nothing renders a figure with these ids.
 *
 * TO RESTORE: add `...ARCHIVED_LEAF_DYNAMICS_SOURCES,` to `EVIDENCE_SOURCES`
 * above, alongside putting `ARCHIVED_LEAF_DYNAMICS` back in `OFFERINGS`. Two
 * lines, and the section returns complete.
 *
 * It is exported rather than left as a module-local so that `tsc --noEmit`
 * does not strip it as unused — an archive the compiler stops reading is an
 * archive that rots silently.
 */
export const ARCHIVED_LEAF_DYNAMICS_SOURCES: Partial<Record<string, EvidenceSource>> = {
  /* All six come out of the PhenoLeaf-TS dataset, specimen Col-0 / rep_21,
   * staged in `data/leaf-morphology/` and built by
   *
   *   scripts/build-leaf-dynamics-plates.py
   *
   * (run through the isolated venv noted in that script's header — none of
   * numpy/scipy/scikit-image/matplotlib/triangle is installed in system
   * Python). One command writes all of it: four JPEG plates, the sprite atlas,
   * its poster, and the geometry manifest the two interactive views read. Their
   * demo counterparts have been deleted from `demo.ts` rather than left
   * underneath, for the same reason as offering 01's.
   *
   * `quantitative-validation` used to be the exception here, and the comment in
   * this place used to explain why it had to stay a demo: there was no
   * independent measurement to validate the predicted displacement against.
   * That turned out to be the right diagnosis and the wrong conclusion. There
   * is still no independent measurement — block matching cannot resolve a blade
   * that spans 84 × 115 px with no visible venation — but a prediction can be
   * held out against the dataset's OWN later mask, which is a real test that
   * needs no second instrument. The plate reports how that came out, including
   * the part where the conformal map does not separate from a much dumber
   * baseline. See the head of `conformal_growth.py`.
   *
   * TWO OF THE SIX ARE COMPONENTS, AND THE OTHER FOUR ARE NOT
   * ─────────────────────────────────────────────────────────
   * `leaf-observation` and `leaf-segmentation` are interactive because their
   * claims are about a sequence and about states of one frame — a strip of five
   * stills cannot show an irregular six-hourly cadence, and a fixed overlay
   * cannot show a leaf being separated from its neighbours.
   *
   * `leaf-tracking` was the third candidate and is deliberately still an image.
   * Its claim is "this identity persists and these numbers change", which is a
   * two-panel composite with a table under it; interactivity there buys a frame
   * selector whose only payoff is more rows of a table nobody holds in their
   * head, at the cost of a second hit-test and a second reduced-motion story. */

  /* Plate 01. The full 97-frame series as a sprite atlas, played or scrubbed.
   * Not a `<video>`: `currentTime` seeks snap to the nearest keyframe, so the
   * frame on screen would not be the frame the timestamp names — and with a
   * cadence that really runs 4.99–7.00 h between observations, the timestamp IS
   * the content. See the head of `views/leaf-dynamics/sheets.ts`. */
  'leaf-observation': {
    type: 'component',
    component: lazy(() => import('@/evidence/views/leaf-dynamics/ObserveSeries')),
    alt:
      'An interactive time series of one Arabidopsis plant photographed from directly above, ninety-seven times over twenty-four days. The sequence can be played or scrubbed frame by frame, and each frame shows its own recorded date and time. Across the series a pair of small round cotyledons on bare soil is joined by successively larger leaves until the pot is filled by a dense rosette, every leaf rocking slightly between one six-hourly observation and the next.',
    aspect: 'wide',
  },

  /* Plate 02. One frame in three states, over the same atlas the plate above
   * loads — the module-level bitmap cache in `sheets.ts` is what makes the
   * second of these two views cost nothing. */
  'leaf-segmentation': {
    type: 'component',
    component: lazy(() => import('@/evidence/views/leaf-dynamics/SegmentReveal')),
    alt:
      'An interactive view of one overhead photograph of a mature Arabidopsis rosette in three states. First the photograph alone; then every individually labelled leaf outlined and tinted in its own flat colour, each tagged L2, L4, L5 and upward; then one chosen leaf left in full colour while the rest of the rosette fades behind a pale scrim. A leaf can be chosen by clicking it or from a list, and its measured area and perimeter in pixels are shown beside it.',
    aspect: 'wide',
  },

  'leaf-tracking': {
    type: 'image',
    src: '/evidence/leaf-dynamics/leaf-tracking.jpg',
    alt:
      'Three panels. Left and centre: close crops of the same leaf at two dates a week apart, each outlined in yellow from its own instance mask and tagged L5; the later crop shows a blade several times larger on a long stalk. Right: the two outlines redrawn on a common centre and axis at their true relative sizes, the earlier one small and grey inside the later one in red, so the growth is a wide band of new tissue around the whole margin rather than an extension in one direction. A small table underneath gives area, perimeter and bounding box for both dates, in pixels.',
    aspect: 'wide',
  },

  'conformal-mapping': {
    type: 'image',
    src: '/evidence/leaf-dynamics/conformal-mapping.jpg',
    alt:
      'Three panels. Left and right: the same leaf at two dates thirty-five hours apart, each covered by a fine triangular mesh and shaded in a continuous wheel of colour — pale blue, violet, red and cream — that winds once around a dark point near the base of the blade. Centre: a circle shaded with the identical colour wheel. The colours are the correspondence: a patch of blade carrying a given hue on the left carries the same hue on the right, because both have been mapped onto that one shared disk.',
    aspect: 'wide',
  },

  'growth-field': {
    type: 'image',
    src: '/evidence/leaf-dynamics/growth-field.jpg',
    alt:
      'Three panels. Left: a leaf outlined in yellow, filled with long blue strokes that fan outward from the base across the whole blade — the displacement the conformal map predicts. Centre: the same leaf with short red strokes from block matching, sparser, much shorter, and pointing in markedly less consistent directions. Right: a scatter plot of the measured displacement over a long interval against the same measurement over the half interval, with the cloud of points lying along the dashed line marked \u2018if it did not scale at all\u2019 rather than the solid line marked \u2018if it scaled with time\u2019.',
    aspect: 'wide',
  },

  'quantitative-validation': {
    type: 'image',
    src: '/evidence/leaf-dynamics/quantitative-validation.jpg',
    alt:
      'Two panels. Left: four outlines of one leaf drawn over each other — a dotted earlier contour, a dashed later contour, a solid green filled shape that is the real mask of the middle date, and a blue line where the conformal map predicted that middle date would fall. The blue line sits outside the green shape nearly everywhere, over-predicting the margin. Right: a grouped bar chart of held-out overlap for eight such triples, with four bars each for the conformal map, an arc-length correspondence, uniform dilation and no growth at all. The first two bars are almost exactly level in every group.',
    aspect: 'wide',
  },
}
