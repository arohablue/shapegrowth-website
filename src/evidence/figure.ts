import type { StageId } from '@/experience/types'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE FIGURE CONTRACT
 * ────────────────────────────────────────────────────────────────────────────
 * One data shape describes every plate on the page. Adding a figure means
 * writing one `ScientificFigure` in `content.ts` and one `EvidenceSource` in
 * `registry.ts` — no component, no layout, no stylesheet, no section edit.
 *
 * This file is only the contract. `registry.ts` holds what currently fills each
 * figure and `ui/Figure.tsx` holds the single renderer. Three files, and the
 * split between them is the point: what a figure IS outlives what is currently
 * in it, and neither of them is markup.
 *
 * It lives here rather than in `content.ts` because `content.ts` is the page's
 * copy. A type that describes a reusable figure system, buried in the file that
 * holds this month's wording, is a type nobody finds when they want to add a
 * figure. `StageId` comes from `experience/types`, which both this file and
 * `content.ts` sit downstream of — so the dependency runs one way and there is
 * no cycle between the copy and the contract.
 */

/**
 * What genre of figure this is — the reader-facing classification, and the
 * vocabulary a new figure gets sorted into.
 *
 *
 * WHY THIS IS NOT THE OLD `kind`
 * ──────────────────────────────
 * There used to be one field doing two jobs: `image | video | svg | webgl |
 * graph | figure` mixed *what the figure is* with *how the browser draws it*.
 * That conflation had a real failure mode — a step declaring `video` while the
 * registry supplied a `.png`, which is two files disagreeing about a fact only
 * one of them can actually know.
 *
 * So it is split. The step declares the genre, which is a property of the
 * science and is knowable before the asset exists. The registry declares the
 * medium, which is a property of the file and is only knowable once it does.
 * Nothing on the page has to guess.
 *
 * Nine categories, covering the material this work produces: a photograph of a
 * specimen, a plotted result, a microscopy-style image, a segmentation overlay,
 * a reconstructed point cloud, a surface mesh, a parameterised map, a vector or
 * scalar field, and a drawn diagram.
 *
 * `mesh` is the one that is not on the original list, and it is here because
 * offering 01 is four fifths about surfaces: a wireframe of recovered topology
 * and a closed organ-separated model are neither point clouds nor diagrams, and
 * filing them as either would have been a label chosen to avoid editing this
 * union. Adding the category was the smaller lie.
 *
 * Closed rather than a free string, so a tenth kind of figure is a deliberate
 * edit here — with a label written for it below — rather than a typo that
 * quietly becomes a synonym for one of these.
 */
export type FigureCategory =
  | 'photograph'
  | 'plot'
  | 'micrograph'
  | 'segmentation'
  | 'point-cloud'
  | 'mesh'
  | 'map'
  | 'field'
  | 'diagram'

/**
 * Shown in the corner of an unfilled frame. Not a badge — it is a note about
 * what the hole is waiting for, in the same register as the placeholder under
 * it, and it disappears the moment real material lands.
 */
export const CATEGORY_LABEL: Record<FigureCategory, string> = {
  photograph: 'Photograph',
  plot: 'Plot',
  micrograph: 'Micrograph',
  segmentation: 'Segmentation',
  'point-cloud': 'Point cloud',
  mesh: 'Surface mesh',
  map: 'Map',
  field: 'Field',
  diagram: 'Diagram',
}

/**
 * Three named ratios, because three cover almost everything and a name survives
 * being read aloud in review in a way that `1.7777` does not.
 */
export const ASPECT_PRESET = {
  wide: '16 / 9',
  square: '1 / 1',
  tall: '3 / 4',
} as const

export type AspectPreset = keyof typeof ASPECT_PRESET

/**
 * A preset name, or a raw ratio for the figures that have one of their own —
 * `'4/3'` for an instrument frame, `'21/9'` for a strip of time points, `'5/4'`
 * for a plot exported at whatever size the plotting library chose.
 *
 * The template-literal half is what keeps this from being `string`: `'4/3'`
 * type-checks and `'4:3'` does not, so the common typo is a compile error
 * rather than an invalid `aspect-ratio` that silently collapses the frame to
 * zero height and takes the page's spacing with it.
 */
export type FigureAspect = AspectPreset | `${number}/${number}`

/** Preset name → CSS, or a raw ratio spaced out into the CSS form. */
export function resolveAspect(aspect: FigureAspect): string {
  return aspect in ASPECT_PRESET
    ? ASPECT_PRESET[aspect as AspectPreset]
    : aspect.replace('/', ' / ')
}

/**
 * The same ratio as a number, for the one piece of arithmetic CSS cannot do on
 * its own: the sticky stage's height budget (see `aspectOf` and the
 * `--stage-aspect` note in `Offerings.tsx`).
 */
export function aspectValue(aspect: FigureAspect): number {
  const [w, h] = resolveAspect(aspect).split('/').map((n) => Number(n.trim()))
  return w / h
}

/**
 * One row of the figure's metadata block: instrument, magnification, scale bar,
 * sample size, units, acquisition parameter, method.
 *
 * Open-ended pairs rather than a fixed set of named fields, because the useful
 * metadata for a micrograph and for a point cloud have almost nothing in
 * common, and a schema wide enough for both is a schema of mostly-undefined
 * columns. The label is authored, so a figure says `Objective` where that is
 * the right word and `Baseline` where that is.
 */
export interface FigureMetadatum {
  readonly label: string
  readonly value: string
}

export interface ScientificFigure {
  /** Stable key. The anchor id, and the key into `EVIDENCE_SOURCES`. */
  readonly id: string
  /** Two-digit number within its offering. Shown, so it is authored not derived. */
  readonly index: string
  /**
   * The figure's short scientific title — what the figure IS, named the way it
   * would be named in a paper: `Multi-view image acquisition`, not `Source
   * data`. Set in caps by the stylesheet, so it is authored in sentence case.
   *
   * It names a procedure or an object, never an outcome. `Trait extraction` is
   * a title; `Accurate trait extraction` is a claim, and claims belong to the
   * figure, not to the label on it.
   */
  readonly label: string
  /**
   * The beat of the scroll experience this figure is the evidence *for*, as a
   * checked reference into `SECTION_COPY` — so a plate cannot be labelled with
   * a beat that does not exist, and renaming a beat updates the progress rail,
   * the scroll heading and the plate together.
   *
   * Optional because a study that does not re-walk the reconstruction's beats
   * has nothing true to point at. It names its own sequence in `phase`.
   * Exactly one of the two is set; `verify-narrative.mjs` asserts it.
   */
  readonly stage?: StageId
  /**
   * The same hairline, for a sequence the page does not already own. One word,
   * a verb: the six things *done* to the specimen, in order, so the rule above
   * a figure reads as a point in a procedure rather than a topic heading.
   */
  readonly phase?: string
  readonly category: FigureCategory
  /**
   * The ratio of the RESERVED BOX — the shape of the hole, not the shape of the
   * figure. It is what the empty frame holds open before anything lands in it,
   * and it is the fallback for a source that does not state its own.
   *
   * It is deliberately not the last word. An `EvidenceSource` may carry an
   * `aspect` of its own, and when it does that one wins, because the file knows
   * its own dimensions and this field was written before the file existed. All
   * eleven say `wide` today for exactly one reason — the demo schematics were
   * drawn at 16:9 — and a real micrograph arriving at 4:3 must not be letterboxed
   * into a shape chosen by a placeholder. See `aspectOf`.
   */
  readonly aspect: FigureAspect
  /**
   * One or two sentences on what the figure demonstrates — the caption's body
   * in the journal sense. It tells the reader what they are looking at, not why
   * it matters.
   *
   * Written to stay true of *any* real figure that could land in this slot,
   * because one will and this text was written before it existed. That rules
   * out quantities, species, instrument names, counts and anything about the
   * outcome: every one of those is a detail invented to fill a line, and it
   * survives the day the real figure arrives by being quietly wrong.
   */
  readonly summary: string
  /**
   * The bracketed notice shown until real material replaces it. Written in the
   * register of a lab note and kept in caps, so an unfilled slot is
   * unmistakably unfilled. A grey box with no text reads as a design choice;
   * this cannot.
   */
  readonly placeholder: string

  /**
   * ──────────────────────────────────────────────────────────────────────────
   * THE THREE OPTIONAL LEVELS, AND WHY THEY ARE THREE
   * ──────────────────────────────────────────────────────────────────────────
   * Everything above is required and can be written before the figure exists,
   * because it describes the *step* — a procedure that is already decided.
   * Everything below describes the *figure*, and none of it can be written
   * until there is one. All three are undefined on all eleven plates today,
   * and the harness fails the run if one appears on a figure with no source.
   *
   * That is not tidiness. These lines are precisely where a fabricated detail
   * would be least visible and most damaging: set in small type under a figure,
   * a panel key or a citation reads as fact rather than as copy, and
   * `Glasshouse trial, 2025` costs nothing to type and is indistinguishable
   * from a real one. An absent line is unremarkable. A plausible wrong one is
   * not recoverable, because nobody re-reads the small print.
   *
   * They are separate fields rather than one `detail` string because they are
   * read at different moments. The key is consulted *while* looking at the
   * figure; the metadata by someone deciding whether to believe it; the
   * reference by someone leaving the page. One string would set all three at
   * whichever weight suited the first.
   */

  /**
   * The figure's key: what is shown, where, and in what units. Panels, colour
   * ranges, arrows, scale bar — `Left: t₀. Right: t₁. Scale bar 10 mm.`
   *
   * The one line that is literally unwritable in advance, because it enumerates
   * parts of a specific image. Distinct from `summary`: the key is how to read
   * the plate, the summary is what reading it gets you.
   */
  readonly caption?: string
  /** Instrument, parameters, method — see `FigureMetadatum`. */
  readonly metadata?: readonly FigureMetadatum[]
  /**
   * Provenance: dataset, experiment, collaborator, or a citation once one
   * exists. The last line on the plate and the smallest, because it is the only
   * one addressed to a reader who is on their way somewhere else.
   */
  readonly reference?: string
  /**
   * Offers an enlarged view of the figure.
   *
   * Opt-in rather than on by default, because it is not free: a control in the
   * corner of every frame is eleven pieces of chrome on a page whose whole
   * argument is that the figures are the only things on it. It earns its place
   * on dense material — a micrograph, a point cloud, a field with fine
   * structure, a multi-panel plot — and not on a photograph that is already
   * running the full measure at 16:9.
   *
   * Ignored while the slot is unfilled. Enlarging a placeholder shows a bigger
   * placeholder.
   */
  readonly expandable?: boolean
}

/**
 * The ratio the frame actually gets: the asset's own, or the reserved box's if
 * the asset does not state one.
 *
 * This one expression is the whole of "the page accommodates the real figure's
 * shape". Three places need the same answer — the frame, the stage's height
 * budget, and `verify-narrative.mjs` — and three copies of `??` is how one of
 * them ends up a version behind.
 *
 * The parameter is structural rather than `EvidenceSource` on purpose. Typing it
 * as the registry's union would make the contract import the registry while the
 * registry imports the contract, and a cycle between "what a figure is" and
 * "what is currently in it" is precisely the coupling the two files were split
 * to avoid.
 */
export function aspectOf(
  figure: ScientificFigure,
  source: { readonly aspect?: FigureAspect } | undefined,
): FigureAspect {
  return source?.aspect ?? figure.aspect
}
