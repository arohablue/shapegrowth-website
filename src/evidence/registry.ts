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
       */
      readonly component: ComponentType
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
   * `phenotyping-output` is deliberately still a demo. There is no trait
   * extraction figure yet, and there will not be one until traits have
   * actually been measured. */

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
}
