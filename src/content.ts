import type { StageId } from './experience/types'
import type { ScientificFigure } from './evidence/figure'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * EVERY WORD ON THE SCREEN
 * ────────────────────────────────────────────────────────────────────────────
 * This is the only file you need to open to change copy. Nothing here does
 * anything except hold strings — no logic, no imports beyond one type — so it
 * cannot break the scene, the scroll or the layout by being edited.
 *
 * Before this file, the copy was spread across six modules: the beats in
 * `experience/timeline.ts`, the headline and standfirst in `ui/Hero.tsx`, the
 * closing line in `ui/Outro.tsx`, the loading line in
 * `ui/AssetLoadingIndicator.tsx`, and the seven trait readouts inline in
 * `experience/phenotype.ts`. Each was in a sensible place for the *code*, and
 * collectively they made "reword the page" a six-file archaeology exercise.
 *
 *
 * THE ONE THING THAT IS NOT HERE
 * ──────────────────────────────
 * The browser tab title and the meta description live in `index.html` and stay
 * there deliberately. Both are read by crawlers and by the tab strip before any
 * JavaScript has run, so moving them into this file would mean setting them
 * with `document.title = …` after hydration — later, and invisible to anything
 * that does not execute scripts. Two strings in the HTML head is the correct
 * place for them; they are just not *screen* copy.
 *
 *
 * WHAT WILL PUSH BACK IF YOU CHANGE IT
 * ────────────────────────────────────
 * Some of this text is load-bearing on layout, and rather than leave that as a
 * trap the constraints are enforced by `verify-narrative.mjs` and
 * `verify-phenotype.mjs`. Run `node verify-narrative.mjs` after a copy edit.
 * It will tell you, by name, if:
 *
 *   • a lede runs past 60 characters or a spec past 34 (they are set in a fixed
 *     band and will wrap onto the specimen);
 *   • the ledes together run past 40 words (currently 20, across three);
 *   • a plate index stops matching its position;
 *   • marketing vocabulary appears — `discover`, `unlock`, `seamless`,
 *     `learn more`, `contact us` and a dozen others are rejected outright,
 *     because the page's whole register depends on not addressing the reader.
 *
 * `verify-phenotype.mjs` separately checks that all seven trait labels still fit
 * on a 375px viewport. `INTERNODE DIST.` is abbreviated for exactly that reason.
 *
 * Assertion 8 of the narrative harness pins the ledes to the brief
 * *verbatim*. That is intentional — it makes an accidental reword visible — so
 * a deliberate reword means updating the `BRIEF` table in that harness too. It
 * will print both strings and tell you which is which.
 */

/**
 * The specimen's designation. Referenced twice on screen — the hero header and
 * the closing colophon — so it is one constant rather than two literals that
 * can drift apart.
 */
const SPECIMEN = 'Specimen 04'

/** The opening frame. */
export const HERO_COPY = {
  /**
   * Uppercased and tracked out by CSS. The non-breaking spaces around the slash
   * keep it from ever wrapping mid-rule; write them as `\u00a0`.
   */
  eyebrow: 'Phenotyping\u00a0/\u00a0Reconstruction Lab',
  specimen: SPECIMEN,

  /**
   * Three lines, and they are three separate strings because the third is set
   * differently — editorial serif, italic, not uppercased, with an accent full
   * stop. It is not a styling accident: the sentence names the arc of the page,
   * and `growth` is the end it is promising, so it is the word that changes
   * voice.
   *
   * Length matters here. `.display` sizes at `clamp(3rem, 11.4vw, 13.5rem)`,
   * which is tuned for roughly a dozen characters per line. Words much longer
   * than these will overflow a narrow viewport; much shorter and the measure
   * collapses. Adding a fourth line means retuning that clamp.
   */
  headline: {
    lead: 'From',
    middle: 'Images to',
    editorial: 'growth',
    stop: '.',
  },

  /**
   * Sits under the headline, bottom-left. One sentence, ≤30ch measure.
   *
   * Was 'From sensor returns to measurable geometry.' — which named the same two
   * ends the headline already names, in the same register. This one spans the
   * whole page instead: `images` is where offering 01 starts and `growth` is
   * where offering 02 ends, so the line now states the arc the reader is about
   * to be taken through rather than restating the claim above it.
   *
   * Set in sentence case despite being a tagline. Nothing in the hero is
   * uppercased except `.eyebrow` and `.meta`, both of which are mono — putting
   * this line in caps would move it into that instrumentation register and
   * stand it against `SCROLL` on the opposite side of the same row, when it is
   * meant to read as writing.
   */
  standfirst: 'From images to growth.',

  /** The scroll affordance. One word beside a hairline. */
  scrollCue: 'Scroll',
} as const

/**
 * The accessible name for the hero landmark, composed from the headline above
 * rather than written out again. It was previously a fourth copy of the same
 * sentence hardcoded in a JSX attribute, which is the kind of duplication that
 * silently goes stale the first time the headline is reworded — a screen reader
 * would then announce the old wording with no visible symptom.
 */
export const HERO_ARIA = `${HERO_COPY.headline.lead} ${HERO_COPY.headline.middle.toLowerCase()} ${HERO_COPY.headline.editorial}`

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE FIVE BEATS
 * ────────────────────────────────────────────────────────────────────────────
 * One line per beat, and the shortness is the design rather than a placeholder.
 * The scene already shows the samples accumulating, the cloud registering, the
 * wireframe building, the surface closing and the calipers landing. A paragraph
 * restating any of that competes with the thing it is describing and makes the
 * page into documentation with an animation embedded in it.
 *
 * So each section carries exactly three pieces of type:
 *
 *   index + title  a plate number and the beat's name, set as a label
 *   lede           the single sentence that names the transformation
 *   spec           a specification fragment, not a sentence
 *
 * `spec` is what keeps the register scientific without adding prose. It is set
 * in the same tracked mono as the measurement annotations on purpose — the
 * editorial layer and the measurement layer are then visibly the same document,
 * which is the cheapest way to make three sections read as one narrative.
 *
 * There is deliberately no call to action anywhere in this table.
 */
export interface SectionCopy {
  /** Plate number. Tabular, accent, always two digits, must match position. */
  readonly index: string
  /** The beat's name, uppercased by CSS. Also what the progress rail lists. */
  readonly title: string
  /** The sentence. The only place a full stop appears. ≤60 chars. */
  readonly lede: string
  /** A fragment: counts, units, method. Never a sentence. ≤34 chars. */
  readonly spec: string
}

/**
 * Keyed by `StageId`. The keys are structural — they are wired to camera
 * keyframes and shader tracks in `experience/timeline.ts` — so rename a
 * `title`, never a key.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EVERY NUMBER IN A `spec` IS READ OFF THE SCAN
 * ────────────────────────────────────────────────────────────────────────────
 * These three lines sit directly beneath a real reconstruction, which makes
 * them read as its provenance. They therefore have to BE its provenance.
 *
 * All three were wrong when this offering still rendered a synthetic fixture
 * and nobody re-checked them against the drop: "24 viewpoints · structured
 * light" (the capture is 66 registered RGB frames, and there is no structured
 * light anywhere in this pipeline), and "2.4M samples · watertight" (the dense
 * cloud is 560,012 points, and the surface has 1,646 boundary edges across 35
 * components — `is_watertight()` returns False). Plausible-sounding hardware
 * specs under a real scan are the exact failure this project exists to avoid.
 *
 * Sources, all re-checkable:
 *
 *   66, 102   `data/colmap-sunflower/run_config.json` — `registered_images`
 *             and `total_images`. COLMAP dropped 36 frames it could not place.
 *   RGB       the same file's `image_source`.
 *   560k      `fused.ply` vertex count, printed by `scripts/rebuild-mesh.py`.
 *             The DENSE cloud as COLMAP produced it — not the 468k that
 *             survive matte-bleed removal, and not the 234k the browser draws
 *             after decimation. This line describes the reconstruction, and
 *             those two are delivery decisions made downstream of it.
 *   36k       `meshed-rebuilt.ply` triangle count, the decimation target in
 *             `rebuild-mesh.py`.
 *   7         `TRAIT_GEOMETRY.length` in `experience/phenotype.ts`.
 *
 * "Non-destructive" stays: it is a property of imaging a plant rather than
 * cutting it up, which is true of this method and is not a measurement.
 *
 * Re-run the pipeline on a new scan and these go stale silently — nothing
 * validates copy against `run_config.json`. Check them by hand.
 */
export const SECTION_COPY: Record<StageId, SectionCopy> = {
  capture: {
    index: '01',
    title: 'Capture',
    lede: 'We observe the plant from multiple viewpoints.',
    spec: '66 of 102 views registered · RGB',
  },
  // The middle beat absorbed two that used to stand alone — GEOMETRY ("Points
  // become structure") and SURFACE ("Structure becomes a measurable 3D
  // representation"). Both were true and both were mechanism. A reader does not
  // need to be told that a reconstruction triangulates before it closes; they
  // need to be told that photographs come in and a measurable plant comes out,
  // which is what this one line now says. The triangulation and the closing are
  // still on screen underneath it, which is the right place for a mechanism.
  reconstruct: {
    index: '02',
    title: '3D Reconstruction',
    lede: 'Image streams become one measurable 3D plant.',
    spec: '560k dense points · 36k triangles',
  },
  phenotype: {
    index: '03',
    title: 'Phenotyping',
    lede: 'The reconstructed plant becomes quantitative data.',
    spec: '7 traits · non-destructive',
  },
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE TRAIT READOUTS
 * ────────────────────────────────────────────────────────────────────────────
 * The text of the seven measurements. Their *geometry* — where each span is
 * measured across and where its label hangs from — stays in
 * `experience/phenotype.ts`, next to the anatomical reasoning that explains why
 * each anchor sits where it does.
 *
 * That split is the one judgement call in this file, so here is the reasoning:
 * an anchor like `{ x: -1.08, y: 0.0, z: 0.1 }` is only editable by someone
 * reading the paragraph above it about clearing the widest broadside leaf at
 * x = -0.996. It is not copy, and putting it here would make this file
 * dangerous to edit. A label and a number are copy. The two are joined by
 * `TraitId`, and because `TRAIT_READOUT` is a `Record<TraitId, …>` the compiler
 * rejects a missing or misspelled trait in either file.
 *
 * `value` is the only genuinely placeholder data in the project. A real
 * phenotyping pipeline overwrites these seven numbers and touches nothing else,
 * which is why they are plain numbers with a separate `precision` rather than
 * preformatted strings.
 */
export type TraitId =
  | 'plant-height'
  | 'leaf-length'
  | 'leaf-width'
  | 'leaf-area'
  | 'leaf-angle'
  | 'internode-distance'
  | 'stem-diameter'

export interface TraitReadout {
  /**
   * Shown above the value, uppercase and tracked out.
   *
   * Budgeted: `verify-phenotype.mjs` asserts every label fits a 375px viewport,
   * which is why `INTERNODE DIST.` is abbreviated. Roughly 15 characters is the
   * ceiling.
   */
  readonly label: string
  /** PLACEHOLDER — the one field a real pipeline overwrites. */
  readonly value: number
  /** Rendered verbatim, so it carries its own superscript: `cm²`, not `cm2`. */
  readonly unit: string
  /** Decimal places. Trait-dependent: an angle reads to 0.1°, an area to 0.1cm². */
  readonly precision: number
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE NOTICE THAT TRAVELS WITH THE READOUT
 * ────────────────────────────────────────────────────────────────────────────
 * Shown on the annotation layer for exactly as long as any trait value is
 * legible, and never on its own.
 *
 * The seven values below are invented. They are kept — they are the instrument
 * the annotation layout was tuned against, and `verify-phenotype.mjs` sizes
 * every label box from them — but a column of tabular figures with leader lines
 * into a specimen reads as instrument output to anyone who did not write it.
 * `8.31cm` is the worst of them: two decimal places is invented *precision*,
 * which is more convincing than an invented round number would be.
 *
 * So the notice is not a caveat bolted on, it is the thing that makes keeping
 * the numbers defensible. A screenshot of this frame carries it, which is the
 * failure mode that mattered — the values were never going to mislead the person
 * who wrote them, only the slide deck they end up in.
 *
 * Authored in sentence case. `.annotation__note` sets it in caps, the same way
 * every other label on this page is authored lowercase and uppercased by the
 * stylesheet — `verify-narrative.mjs` fails figure titles that arrive
 * pre-capitalised for the same reason.
 *
 * The em dash is the character, not a hyphen: it is set in the same mono face as
 * `.evidence__kind`, where the demo plates already use one.
 */
export const PHENOTYPE_DISCLAIMER = 'Schematic — not measured'

export const TRAIT_READOUT: Record<TraitId, TraitReadout> = {
  'plant-height': { label: 'PLANT HEIGHT', value: 82.4, unit: 'cm', precision: 1 },
  'leaf-length': { label: 'LEAF LENGTH', value: 8.31, unit: 'cm', precision: 2 },
  'leaf-width': { label: 'LEAF WIDTH', value: 2.94, unit: 'cm', precision: 2 },
  'leaf-area': { label: 'LEAF AREA', value: 12.4, unit: 'cm²', precision: 1 },
  'leaf-angle': { label: 'LEAF ANGLE', value: 37.2, unit: '°', precision: 1 },
  'internode-distance': { label: 'INTERNODE DIST.', value: 4.75, unit: 'cm', precision: 2 },
  'stem-diameter': { label: 'STEM DIAMETER', value: 6.2, unit: 'mm', precision: 1 },
}

/**
 * The closing frame.
 *
 * Deliberately not a call to action: the last thing on screen is the specimen,
 * intact, with its measurements beside it, and asking the reader to "get in
 * touch" here would convert the whole document into an ad for itself. The two
 * meta fragments are the colophon of a plate — what was examined, what came off
 * it.
 *
 * There was a closing line above them, `'Nothing was cut.'`, set large against a
 * 16ch measure. It is gone and nothing replaced it. It was the payoff of an
 * argument the page no longer makes out loud, and read on its own — which is how
 * it read, as the last words on screen — it was a claim about what the method
 * avoids rather than about what it produces. The colophon says what was examined
 * and what came off it, which is the whole ending the piece needs.
 */
export const OUTRO_COPY = {
  colophonLeft: `${SPECIMEN} — reconstruction complete`,
  /**
   * Counted from `TRAIT_READOUT` rather than written as "7", so adding or
   * removing a trait cannot leave the closing line contradicting the
   * annotations the reader just scrolled past.
   */
  colophonRight: `${Object.keys(TRAIT_READOUT).length} traits extracted`,
} as const

/**
 * Shown only while a reconstruction is streaming, bottom-right.
 *
 * Not a blocking overlay and not a spinner — the page is fully readable during
 * the load, so an overlay would be interrupting the reader to say nothing is
 * wrong. This just accounts for the bytes.
 */
export const LOADING_COPY = {
  failed: 'Reconstruction unavailable',
  /** `progress` is already rounded by the caller. */
  active: (progress: number) => `Loading reconstruction ${progress}%`,
} as const

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE OFFERINGS
 * ════════════════════════════════════════════════════════════════════════════
 * Everything below describes the section that follows the reconstruction. It is
 * a separate concern from everything above and deliberately so.
 *
 *
 * WHAT THIS IS AND WHAT IT IS NOT
 * ───────────────────────────────
 * Above: one continuous scroll-driven transformation, three beats, one specimen.
 * Below: an index of two offerings, each a sequence of evidence steps. The
 * reconstruction is the *argument*; this is the *record*. They are different
 * kinds of reading and the code keeps them apart — nothing here reads
 * experienceProgress, subscribes to a frame, or appears in `BLOCKS`.
 *
 * That separation is the whole reason this could be added without retiming the
 * reconstruction. See the two-slot note in `progress/ProgressProvider.tsx`.
 *
 *
 * THE POINT OF THE `evidence` ARRAYS
 * ──────────────────────────────────
 * Every figure below is a hole with a label on it. None of them contain a
 * result, because there are no results yet — and inventing plausible-looking
 * numbers to fill a layout is how a page ends up shipping with fiction in it.
 * `category` says what genre of figure will eventually occupy the hole;
 * `placeholder` says, in the page's own voice, what is missing. When the real
 * material arrives, the change is:
 *
 *   1. add the asset and register it in `evidence/registry.ts`,
 *   2. tighten `label` and `summary` to the figure that actually landed,
 *   3. add `caption`, `metadata` and `reference` if the figure has them.
 *
 * No new component, no layout change, no reordering, no stylesheet edit. `Figure`
 * already renders every category — that is what makes this structure rather than
 * markup.
 *
 * Steps 2 and 3 are the reason `summary` is written the way it is. Every one of
 * them is true of any figure that could plausibly fill its slot, so nothing on
 * the page is *wrong* while the slots are empty — it is only unspecific, and
 * unspecific becomes specific by editing one string next to the asset.
 *
 * PCA is deliberately absent. It is not part of this version, and there is no
 * commented-out stub for it either: a placeholder for something that is not
 * being built is just a stale note that someone eventually has to ask about.
 */

/**
 * The figure contract itself now lives in `evidence/figure.ts`, alongside the
 * registry that fills it and next to nothing else. It moved out of this file
 * when it stopped being a detail of this page and became a reusable system: a
 * type describing how to add a research figure, buried in the file that holds
 * this month's wording, is a type nobody finds when they want to add one.
 *
 * What stays here is what this page says. What a figure IS, and what is
 * currently inside one, are two other files.
 */


/**
 * There used to be a second setting here — `index`, a compact two-column listing
 * — and offering 02 used it, on the reasoning that eleven full-measure empty
 * rectangles would imply both studies were equally far along.
 *
 * It is gone. Offering 02 is now a sequence of plates like offering 01, because
 * the two are the same argument at different scales: geometry at one instant,
 * then geometry through time. Setting the second one as a two-column grid of
 * equal boxes made it read as a list of capabilities appended to a study, which
 * is the feature-section shape the whole page is built to avoid. Whatever the
 * grid bought in honesty about progress, it spent on genre.
 *
 * With one setting there is one way for an evidence step to look, which is the
 * same reason `EvidenceSlot` is a single component: two renderers for one kind of
 * thing drift apart the moment either is touched.
 */
export interface Offering {
  readonly id: string
  /** `01`, `02` — the offering's number in the index. */
  readonly index: string
  readonly title: string
  /** The offering's one-line statement of what it produces. */
  readonly lede: string
  /** Method note. Same `.meta` treatment as the plate specs above. */
  readonly spec: string
  /**
   * The hand-off, shown once at the head of the evidence sequence, on its own
   * rule. It carries the turn in the argument — what the previous section
   * established, and what this one adds — so the reader does not re-orient from
   * scratch at each offering.
   *
   * One string per line, not one string per paragraph. The hand-off is set in
   * short declarative sentences and each is given its own line, so the turn in
   * the argument reads as a sequence of statements rather than as a paragraph
   * that happens to break wherever the measure runs out. Splitting a single
   * string on `.` at render time would do the same thing, but it guesses at
   * sentence ends, and the one place a full stop is not a sentence end is an
   * abbreviation — which is exactly what this page is full of.
   */
  readonly bridge?: readonly string[]
  readonly evidence: readonly ScientificFigure[]
}

/**
 * The turn from the demonstration into the evidence.
 *
 * `Offerings` was the wrong word and it was the loudest thing at the seam. It is
 * a catalogue heading — it announces a menu, which invites the reader to compare
 * items and pick one, and it is the only commercial noun anywhere in this file.
 * Underneath it sat a full front matter: eyebrow, a heading set at 48px, a
 * standfirst, and then immediately `01 / 3D Reconstruction` with a lede and a
 * bridge. Five introductions before the first figure. That is what made the seam
 * read as a new document rather than the next movement of this one, and no
 * amount of work on the transition above it would have fixed a masthead that
 * reopens the page.
 *
 * What replaces it is one turn, stated in the shape the section actually has:
 * above is the method, below is what the method produces. `Above` and `Below`
 * are doing real work — they are the only two words on the page that tell the
 * reader the thing they just scrolled through and the thing they are about to
 * read are the same subject. The register is the page's own throughout: no
 * address, no call to action, no claim about quality.
 *
 * `title` is still an `h2` and still the section's accessible name, so it has to
 * survive being read on its own in a landmark list — which is why it names the
 * relationship ("what the method produces") rather than being a fragment that
 * only parses next to the standfirst.
 */
export const OFFERINGS_COPY = {
  /** Scientific, not commercial. Names the genre of what follows. */
  eyebrow: 'Evidence',
  title: 'What the method produces',
  /**
   * Two clauses in deliberate parallel, because the parallel IS the transition.
   * The count stays here rather than in the title: how many programmes there are
   * is orientation, not the point, and putting it in the heading made the
   * section an index of two things instead of the second half of an argument.
   */
  standfirst:
    'Above, one specimen carried through three stages. Below, two measurement programmes and the figures each of them produces.',
} as const

/**
 * `Capture → 3D Reconstruction → Phenotyping`, built from the beat titles rather
 * than typed out.
 *
 * Offering 01's whole structure is a second pass over those three beats, so the
 * chain printed at its head has to be the same three words the progress rail
 * showed during the scroll. Deriving it means renaming a beat updates the rail,
 * the section heading and this chain together; a hand-typed string would make
 * that rename a silent inconsistency between the two halves of the page — and it
 * is what made collapsing five beats into three a change to one table instead of
 * a hunt through the copy.
 *
 * Reads `SECTION_COPY` in declaration order, which is beat order — the same
 * property `verify-narrative.mjs` already asserts when it checks that each plate
 * index matches its position.
 */
const STAGE_CHAIN = Object.values(SECTION_COPY)
  .map((s) => s.title)
  .join(' → ')

/**
 * ────────────────────────────────────────────────────────────────────────────
 * OFFERING 02'S SIX PLATES
 * ────────────────────────────────────────────────────────────────────────────
 * Lifted out of the `OFFERINGS` literal only so the chain printed at the
 * offering's head can be derived from it rather than typed twice. Offering 01
 * gets the same guarantee for free — its chain comes from `SECTION_COPY`,
 * because its six-word spine already exists elsewhere in the page. This one's
 * does not exist anywhere else, so it has to come from the plates themselves.
 *
 *
 * WHAT THE SEQUENCE HAS TO SAY, IN ORDER
 * ──────────────────────────────────────
 * OBSERVE → SEGMENT → TRACK → MAP → GROWTH → QUANTIFY.
 *
 * A rosette as it was actually recorded; one frame of it resolved into labelled
 * organs; one of those organs followed across the series and measured; the two
 * observations of it carried onto a shared disk so their points correspond; the
 * difference between them resolved as a displacement field; the field put to a
 * test it can fail.
 *
 * WHY MAP NO LONGER COMES BEFORE TRACK
 * ────────────────────────────────────
 * It used to, and the note in this place argued for it at some length: two
 * observations of a leaf differ in size, posture and camera angle at once, so
 * correspondence is only well posed after both have been carried into a frame
 * where those differences are gone — which made the map the thing that gives
 * TRACK an answer, and therefore the thing to read first.
 *
 * That argument is sound about *point* correspondence and wrong about this
 * dataset. Nothing on these plates tracks anything: the leaf is followed by the
 * dataset's own ground-truth instance labels, which are given, and which owe
 * nothing to any map. Ordering MAP first to justify a step that does not need
 * justifying put the hardest plate third and left the reader meeting a Riemann
 * map before they had been shown a single leaf measured twice. TRACK now
 * establishes the identity and the two dates; MAP is what gets asked next,
 * which is how the two frames of one leaf are put into correspondence.
 *
 * WHAT CHANGED IN THE COPY
 * ────────────────────────
 * The note that used to end this block said nothing here is measured — no
 * species, no interval, no count, no unit — because every sentence had to stay
 * true of whatever figure eventually landed above it. Six figures have now
 * landed. The constraint has not been relaxed so much as discharged: `summary`
 * still carries no quantity, because it is the line that has to survive the
 * plate being rebuilt for another specimen, and the measurements have moved to
 * `caption` and `metadata`, which describe a particular figure and are checked
 * by `verify-narrative.mjs` against a real entry in `registry.ts`.
 *
 * Every number in those fields is computed by `scripts/build-leaf-dynamics-
 * plates.py` from these frames. None is quoted from a paper — specifically, the
 * 92% agreement Alim et al. report is nowhere on this page, and the number that
 * is here instead is a tie the conformal map did not win. Units are px and px²
 * throughout, because PhenoLeaf-TS ships no spatial calibration and a growth
 * rate in mm per day would be invented at the point of writing it down.
 */
const DYNAMICS_EVIDENCE: readonly ScientificFigure[] = [
  {
    id: 'leaf-observation',
    index: '01',
    phase: 'Observe',
    label: 'Rosette growth time series',
    summary:
      'The whole recorded series for one rosette, playable and scrubbable, with every frame carrying its own timestamp. The nominally six-hourly cadence drifts by up to an hour either way, which is a property of the experiment rather than noise to be tidied.',
    category: 'photograph',
    // No `expandable`, on the same reasoning as `dense-reconstruction`: this
    // slot holds a view the reader already drives, so the control would open a
    // modal containing a second copy of the thing that was already answering
    // the question. `aspect: 'wide'` is load-bearing rather than cosmetic —
    // `stageStyle` takes the *minimum* ratio across the offering, so a near-
    // square declared here would shrink the desktop stage for all six plates.
    // The crop is near-square and pillarboxes inside this frame; that side
    // gutter is where the controls live, which is why no image pixel is ever
    // covered. Below 900px there is no gutter and 16/9 leaves too little
    // height for a rail, so the stylesheet squares this frame up on its own —
    // see `.plate:is(#leaf-observation, #leaf-segmentation) .evidence__frame`.
    // That override is deliberately not authored here, because it must not
    // reach `stageStyle`.
    aspect: 'wide',
    caption:
      'Every recorded frame at its own timestamp, read from the filename. Play runs the series; the scrubber steps one observation at a time; Compare sets the first frame beside the current one. Nothing is interpolated — each position is a photograph that was taken.',
    metadata: [
      { label: 'Specimen', value: 'PhenoLeaf-TS, Col-0 / rep_21' },
      { label: 'Series', value: '97 frames, 2022-08-09 17:03 to 2022-09-02 17:05 (24 days)' },
      { label: 'Cadence', value: 'nominally 6 h; measured interval 4.99\u20137.00 h' },
      { label: 'Delivery', value: 'one 2920\u00d72870 sprite atlas, 779 KB, decoded off the main thread' },
      { label: 'Units', value: 'px \u2014 the dataset carries no spatial calibration' },
    ],
    reference:
      'PhenoLeaf-TS dataset, Col-0 rep_21 \u2014 Sari\u0107, Azam, Khan & \u010custovi\u0107, ECCV 2026',
    placeholder: '[REAL LEAF OBSERVATION \u2014 TO BE INSERTED]',
  },
  {
    id: 'leaf-segmentation',
    index: '02',
    phase: 'Segment',
    label: 'Instance segmentation of the rosette',
    summary:
      'One frame in three states: the photograph, the dataset\u2019s own instance labels drawn over it, and a single leaf separated from its neighbours. No segmentation model was run here \u2014 the masks are ground truth that ships with the dataset.',
    category: 'segmentation',
    // No `expandable`, and `aspect: 'wide'` for the same two reasons spelled
    // out on `leaf-observation` above.
    aspect: 'wide',
    caption:
      'Outline colours are the dataset\u2019s own label RGBs, so the tint identifying a leaf here is the same one identifying it on the plates below. A leaf can be chosen on the image or from the list; its area and perimeter are measured from the mask. Instances present in fewer than three frames are dropped \u2014 one such blip exists in this series, a 22 px\u00b2 label appearing in a single frame of 97.',
    metadata: [
      { label: 'Specimen', value: 'PhenoLeaf-TS, Col-0 / rep_21' },
      { label: 'Frame shown', value: '96 of 97 \u2014 2022-09-02 17:05' },
      { label: 'Instances shown', value: '15 on this frame, of 17 that survive the 3-frame filter' },
      { label: 'Mask source', value: 'dataset ground-truth instance labels, exact-RGB' },
      { label: 'Contours', value: 'marching squares, Douglas\u2013Peucker simplified to 1.2 px' },
    ],
    reference:
      'PhenoLeaf-TS dataset, Col-0 rep_21 \u2014 Sari\u0107, Azam, Khan & \u010custovi\u0107, ECCV 2026',
    placeholder: '[REAL SEGMENTATION OVERLAY \u2014 TO BE INSERTED]',
  },
  {
    id: 'leaf-tracking',
    index: '03',
    phase: 'Track',
    label: 'One leaf measured at two dates',
    summary:
      'The same blade is followed across widely separated frames by the dataset\u2019s own ground-truth instance labels, not by a tracker run in this study. Its area, perimeter and bounding box are measured from the masks and reported in pixels.',
    category: 'segmentation',
    expandable: true,
    aspect: 'wide',
    caption:
      'Left and centre: leaf 5 at frames 27 and 56, outlined from its instance mask. Right: the two contours on a common centroid and long axis at their true relative sizes \u2014 not rescaled, so the grey ring inside the red one is the whole of the earlier leaf. Growth is a band around the entire margin rather than extension in one direction.',
    metadata: [
      { label: 'Specimen', value: 'PhenoLeaf-TS, Col-0 / rep_21, leaf 5' },
      { label: 'Correspondence', value: 'dataset ground-truth instance labels (not computed here)' },
      { label: 'Frames', value: '27 and 56 \u2014 2022-08-16 12:03 to 2022-08-23 17:03, 173 h apart' },
      { label: 'Area', value: '917 \u2192 3962 px\u00b2' },
      { label: 'Perimeter', value: '132 \u2192 352 px' },
      { label: 'Continuity', value: '17 instances pass the 3-frame filter; 16 have no gaps' },
    ],
    reference:
      'PhenoLeaf-TS dataset, Col-0 rep_21 \u2014 Sari\u0107, Azam, Khan & \u010custovi\u0107, ECCV 2026',
    placeholder: '[REAL TRACKING RESULT \u2014 TO BE INSERTED]',
  },
  {
    id: 'conformal-mapping',
    index: '04',
    phase: 'Map',
    label: 'Riemann map between successive outlines',
    summary:
      'Each blade is carried onto the unit disk by its own Riemann map, and the two disks are rotated into register so the composition sends the earlier leaf to the later one. This is the construction Alim and colleagues used to ask whether leaf growth is conformal.',
    category: 'map',
    expandable: true,
    aspect: 'wide',
    caption:
      'Left and right: the two blades, each meshed and shaded by where its Riemann map sends it. Centre: the shared disk \u2014 matching hue is the same point of it, so the colours are the correspondence rather than decoration. Both maps wind exactly once around the boundary with no inverted triangles, which is what makes them bijections onto the disk rather than merely harmonic.',
    metadata: [
      { label: 'Specimen', value: 'PhenoLeaf-TS, Col-0 / rep_21, leaf 5' },
      { label: 'Frames', value: '50 \u2192 56 \u2014 35 h apart, +10.5% area' },
      {
        label: 'Method',
        value: 'Green\u2019s-function Riemann map: one cotangent-Laplacian Dirichlet solve for u, one Poisson solve for its harmonic conjugate',
      },
      { label: 'Meshes', value: '664 and 742 vertices; winding 1.000, 0.000% inverted on both' },
      {
        label: 'Alignment',
        value: 'two landmarks \u2014 petiole attachment and tip \u2014 with the remaining rotation least-squares fitted over the margin at \u22126.6\u00b0',
      },
      {
        label: 'Departure from the paper',
        value: 'Alim et al. pin three landmarks and exhaust the M\u00f6bius group; two are robust on these masks, so the composed map is harmonic-exact and only approximately conformal',
      },
    ],
    reference:
      'Method after Alim, Armon, Shraiman & Boudaoud, Phys. Biol. 13(5) 05LT01 (2016). Specimen: PhenoLeaf-TS, Col-0 rep_21 \u2014 Sari\u0107, Azam, Khan & \u010custovi\u0107, ECCV 2026',
    placeholder: '[REAL CONFORMAL MAP \u2014 TO BE INSERTED]',
  },
  {
    id: 'growth-field',
    index: '05',
    phase: 'Growth',
    label: 'Predicted and measured displacement',
    summary:
      'The aligned map predicts where every interior point of the earlier blade should travel; block matching measures where the texture actually went. Both are shown with rigid motion removed, and the measured field is shown because it was run, not because it is evidence.',
    category: 'field',
    expandable: true,
    aspect: 'wide',
    caption:
      'Left: displacement predicted by the composed conformal map. Centre: displacement measured by block matching over the same interval. Right: the measurement tested against itself \u2014 the same field measured over an interval twice as long should come out about twice as large, and it comes out the same size. A displacement that barely depends on how long you waited is not measuring a rate, so the two fields are not correlated against each other on this page.',
    metadata: [
      { label: 'Specimen', value: 'PhenoLeaf-TS, Col-0 / rep_21, leaf 5, frames 50 \u2192 56' },
      { label: 'Predicted', value: 'f = \u03c6\u207b\u00b9 \u2218 M \u2218 \u03c6 at 548 of 552 interior vertices' },
      { label: 'Measured', value: 'block matching, 16 px window / 4 px step / \u00b112 px search; 157 of 189 windows kept' },
      { label: 'Nested-interval test', value: 'direction r = +0.65, magnitude 0.99\u00d7 where 2.1\u00d7 was expected' },
      {
        label: 'Why the correlation is withheld',
        value: 'the blade spans 84\u00d7115 px with no resolvable venation; correlation peaks are high (median 0.91) but clear their nearest rival by only 0.03 and are ambiguous at 67% of sites',
      },
    ],
    reference:
      'Method after Alim, Armon, Shraiman & Boudaoud, Phys. Biol. 13(5) 05LT01 (2016). Specimen: PhenoLeaf-TS, Col-0 rep_21 \u2014 Sari\u0107, Azam, Khan & \u010custovi\u0107, ECCV 2026',
    placeholder: '[REAL GROWTH FIELD \u2014 TO BE INSERTED]',
  },
  {
    id: 'quantitative-validation',
    index: '06',
    phase: 'Quantify',
    label: 'Held-out test of the conformal map',
    summary:
      'The map is built from two frames and asked to predict a third it was never shown, scored against that frame\u2019s real mask and against three baselines that encode no growth model at all. The result is reported as it came out.',
    category: 'plot',
    expandable: true,
    aspect: 'wide',
    caption:
      'Left: one triple \u2014 the dotted and dashed contours are what the map was given, the green mask is what the middle date actually was, and the blue line is where the map put it. Right: held-out overlap for eight triples against three baselines. The conformal map clears a static leaf by a wide margin and does not separate from the arc-length correspondence it was meant to improve on; that difference is smaller than its own scatter, and is reported rather than rounded into a result.',
    metadata: [
      { label: 'Specimen', value: 'PhenoLeaf-TS, Col-0 / rep_21, leaf 5' },
      { label: 'Test', value: 'build the map from t\u2080 to t\u2082, predict t\u2081, score IoU against t\u2081\u2019s real mask' },
      { label: 'Median IoU', value: 'conformal 0.758, arc-length null 0.757, uniform dilation 0.677, no growth 0.675' },
      { label: 'Conformal \u2212 arc-length', value: '+0.003 \u00b1 0.011 over 8 triples, ahead in 5' },
      { label: 'Conformal \u2212 no growth', value: '+0.108, ahead in 6 of 8' },
      {
        label: 'Not shown',
        value: 'the predicted-against-measured correlation Alim et al. report. It is not available at this resolution \u2014 see the plate above \u2014 and theirs is not ours to quote',
      },
    ],
    reference:
      'Test designed here; the map it scores is after Alim, Armon, Shraiman & Boudaoud, Phys. Biol. 13(5) 05LT01 (2016). Specimen: PhenoLeaf-TS, Col-0 rep_21 \u2014 Sari\u0107, Azam, Khan & \u010custovi\u0107, ECCV 2026',
    placeholder: '[REAL VALIDATION COMPARISON \u2014 TO BE INSERTED]',
  },
]

/**
 * `Time → Represent → Map → Track → Growth → Quantify`, read off the plates
 * rather than typed alongside them.
 *
 * This chain is also the section's whole navigation. It is printed once at the
 * offering's head as an arc, and each step in the prose column then names its
 * own position in it — which means the reader can place any plate from the plate
 * alone, with no rail and no stepper. Six words at the top and one word per step
 * is the entire wayfinding mechanism, and it is the version that still works in
 * a printed page.
 *
 * The arc at the head now also marks which term is current, which an earlier
 * revision of this note explicitly ruled out on the grounds that it would have
 * to track scroll position. It does track scroll position. That objection was
 * about not paying for a scroll listener to decorate static text; the section
 * now has one anyway, because the figures are a single transforming sequence and
 * something has to say which representation is on the stage. Marking the term is
 * the cheapest possible consumer of a value that already exists, and the chain
 * still reads correctly with the marking removed.
 *
 * Same reasoning as `STAGE_CHAIN` one level up: the chain at the head of a
 * sequence and the labels on the sequence itself are the same information, and
 * the only way they cannot disagree is if there is one of them.
 */
const DYNAMICS_CHAIN = DYNAMICS_EVIDENCE.map((s) => s.phase).join(' → ')

export const OFFERINGS: readonly Offering[] = [
  {
    id: 'reconstruction',
    index: '01',
    title: '3D Reconstruction',
    lede: 'A plant recovered from photographs as measurable geometry.',
    spec: STAGE_CHAIN,
    /**
     * The hand-off. Names what the reader just watched and what changes now —
     * the stages are the same, the material is real. No new claim is made and
     * the reader is not addressed.
     */
    bridge: ['The same three stages, shown with the underlying data.'],
    /**
     * Three plates, one per beat, and it has to stay three. This run used to be
     * five, mirroring the five stages the scroll then had: a separate SURFACE
     * TOPOLOGY wireframe plate and a separate RECONSTRUCTED SURFACE MODEL plate
     * sat between the point cloud and the traits. Both are gone with the beats
     * they illustrated. What they asserted has not been dropped — the closed,
     * organ-separated surface is now the end of the reconstruction plate's
     * summary, where it belongs, because it is the *output* of reconstructing
     * rather than a third thing that happens afterwards.
     *
     * `aspect: 'wide'` throughout, so the empty run reads as one sequence rather
     * than a set of differently shaped objects. That is the shape of the HOLE and
     * not a claim about the figure: the real asset states its own ratio in
     * `registry.ts` and that one wins. See `aspectOf`.
     */
    evidence: [
      {
        id: 'source-data',
        index: '01',
        label: 'Multi-view image acquisition',
        stage: 'capture',
        summary:
          'Images are captured from multiple viewpoints to reconstruct the plant in 3D. The plant is photographed in its original position.',
        category: 'photograph',
        aspect: 'wide',
        placeholder: '[REAL SOURCE IMAGE — TO BE INSERTED]',
      },
      {
        id: 'reconstruction-output',
        index: '02',
        label: 'Structure-from-motion reconstruction',
        stage: 'reconstruct',
        summary:
          // Was "...into a closed surface with plant organs separated". Neither
          // half held: screened Poisson leaves 1,646 boundary edges across 35
          // components, so the surface is not closed, and nothing in this
          // pipeline segments organs — no leaf, stem or head is ever labelled.
          'Camera poses and a dense point cloud are estimated from image correspondences. The images are aligned in a common coordinate frame, and the point cloud is converted into a continuous surface.',
        category: 'point-cloud',
        // No `expandable`, and it USED to be set, back when this slot held a
        // still. The enlarge control exists so a reader can get closer to dense
        // material they cannot otherwise inspect; the filled slot is now a view
        // they can already turn and zoom in place, so the control would open a
        // modal containing a second copy of a thing that was already answering
        // the question — at the cost of a third WebGL context on the page.
        aspect: 'wide',
        placeholder: '[REAL POINT CLOUD RESULT — TO BE INSERTED]',
      },
      {
        id: 'phenotyping-output',
        index: '03',
        label: 'Trait extraction',
        stage: 'phenotype',
        summary:
          'The 3D model is used to measure plant height, leaf area, leaf length, and leaf orientation. These measurements are derived directly from the reconstructed plant geometry.',
        category: 'diagram',
        aspect: 'wide',
        placeholder: '[REAL RESEARCH FIGURE — TO BE INSERTED]',
      },
    ],
  },
  {
    id: 'leaf-dynamics',
    index: '02',
    /**
     * `Leaf Dynamics`, and the conformal work named in the chain underneath
     * rather than in the title. A two-part title joined by a `+` reads as a
     * bundle of two things offered together; this is one study, and the
     * conformal map is a step inside it, not a second product.
     */
    title: 'Leaf Dynamics',
    lede: 'The same leaf across time, and the deformation between observations.',
    spec: DYNAMICS_CHAIN,
    /**
     * The turn in the argument, and the only place on the page where three
     * sentences sit together.
     *
     * It is short because it is doing something the rest of the section cannot:
     * conceding the limit of what came before. Offering 01 ends with a plant
     * measured at one instant, which is a complete result and also a still
     * photograph of something that does not hold still. Saying so plainly — and
     * only then saying what follows from it — is what makes the second sequence
     * the next chapter rather than a second list.
     *
     * No claim is made about the tracking being accurate, novel or better than
     * anything. The third sentence says it is possible; the six plates are where
     * the evidence for that would go.
     */
    bridge: [
      'A reconstructed plant gives us geometry.',
      'But plants change over time.',
      'We can track that change.',
    ],
    evidence: DYNAMICS_EVIDENCE,
  },
]

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ABOUT — THE TWO FOUNDERS
 * ════════════════════════════════════════════════════════════════════════════
 * A trailing sibling like `OFFERINGS_COPY` and `CONTACT_COPY` above and below
 * it — not a `BLOCKS` entry, so it costs page height and nothing else. See the
 * two-slot note in `ProgressProvider`.
 *
 * `FOUNDERS` is the one centralised place this information lives. Editing a
 * bio, swapping in a photo, or adding a LinkedIn link later is a change to this
 * array and nothing else — no component, no stylesheet, no layout edit.
 *
 * Every field below is a placeholder, deliberately. This file does not invent
 * a name, a title or a credential — the brackets stay until the real copy
 * arrives, the same discipline `evidence/registry.ts` applies to a figure that
 * has no asset yet.
 */
export interface Founder {
  readonly id: string
  /** `01` | `02` — the founder's position in the pair, not a headcount. */
  readonly index: string
  readonly name: string
  readonly role: string
  /** Two to three sentences. Background, contribution, nothing invented. */
  readonly bio: string
  /** Path under `public/`, e.g. `/team/jane.jpg`. `null` renders the placeholder frame. */
  readonly image: string | null
  /** Full profile URL. `null` omits the link rather than showing a dead one. */
  readonly linkedin: string | null
}

export const ABOUT_COPY = {
  eyebrow: 'About',
  title: 'About Shape Growth',
} as const

export const FOUNDERS: readonly Founder[] = [
  {
    id: 'founder-01',
    index: '01',
    name: '[NAME]',
    role: '[ROLE]',
    bio: '[SHORT BIO]',
    image: null,
    linkedin: null,
  },
  {
    id: 'founder-02',
    index: '02',
    name: '[NAME]',
    role: '[ROLE]',
    bio: '[SHORT BIO]',
    image: null,
    linkedin: null,
  },
]

/**
 * The invitation, and the last thing on the page.
 *
 * `OUTRO_COPY` above says the ending of the *demonstration* is deliberately not
 * a call to action, and that still holds — this is a separate document that
 * follows the evidence, the same way `OFFERINGS_COPY` does. The distinction the
 * two comments are drawing together: the specimen's closing frame stays a
 * colophon, and the asking happens afterwards, once the argument is finished.
 *
 * No form. The site is a static build on GitHub Pages with no server to post to,
 * so a form here could only be a third-party endpoint or a lie; a `mailto:`
 * hands the reader the address in the tool they already use to write to people.
 * `bodyHint` is therefore a prompt in a draft, not a set of required fields —
 * the reader can delete it.
 */
export const CONTACT_COPY = {
  eyebrow: 'Contact',
  title: "Let's talk.",
  standfirst: 'Have a plant dataset, research question, or collaboration in mind?',
  address: 'admin@shape-growth.com',
  subject: 'Shape Growth — Inquiry',
  /**
   * Trailing newline on each line so the reader's cursor lands under the label
   * rather than beside it. Joined with `\n` and encoded by the caller.
   */
  bodyHint: ['Name:', 'Organization:', 'Message:'],
  action: 'Contact us',
  /**
   * Stated rather than implied. A button that silently launches a different
   * application is the one interaction on this page that can surprise someone,
   * and the cost of saying so is six words.
   */
  hint: 'Opens your email application',
} as const
