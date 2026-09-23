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
 * Before this file, the copy was spread across six modules: the five beats in
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
 * trap the constraints are enforced by `scripts/verify-narrative.mjs` and
 * `scripts/verify-phenotype.mjs`. Run `npm run verify` after a copy edit.
 * It will tell you, by name, if:
 *
 *   • a lede runs past 60 characters or a spec past 34 (they are set in a fixed
 *     band and will wrap onto the specimen);
 *   • the five ledes together run past 40 words (currently 27);
 *   • a plate index stops matching its position;
 *   • marketing vocabulary appears — `discover`, `unlock`, `seamless`,
 *     `learn more`, `contact us` and a dozen others are rejected outright,
 *     because the page's whole register depends on not addressing the reader.
 *
 * `verify-phenotype.mjs` separately checks that all seven trait labels still fit
 * on a 375px viewport. `INTERNODE DIST.` is abbreviated for exactly that reason.
 *
 * Assertion 8 of the narrative harness pins the five ledes to the brief
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
 *   index + title  a plate number and a one-word beat, set as a label
 *   lede           the single sentence that names the transformation
 *   spec           a specification fragment, not a sentence
 *
 * `spec` is what keeps the register scientific without adding prose. It is set
 * in the same tracked mono as the measurement annotations on purpose — the
 * editorial layer and the measurement layer are then visibly the same document,
 * which is the cheapest way to make five sections read as one narrative.
 *
 * There is deliberately no call to action anywhere in this table.
 */
export interface SectionCopy {
  /** Plate number. Tabular, accent, always two digits, must match position. */
  readonly index: string
  /** One word, uppercased by CSS. Also what the progress rail lists. */
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
 */
export const SECTION_COPY: Record<StageId, SectionCopy> = {
  capture: {
    index: '01',
    title: 'Capture',
    lede: 'We observe the plant from multiple viewpoints.',
    spec: '24 viewpoints · structured light',
  },
  reconstruct: {
    index: '02',
    title: 'Reconstruct',
    lede: 'Image streams become spatial information.',
    spec: '2.4M samples · registered',
  },
  geometry: {
    index: '03',
    title: 'Geometry',
    lede: 'Points become structure.',
    spec: 'triangulated · watertight',
  },
  surface: {
    index: '04',
    title: 'Surface',
    lede: 'Structure becomes a measurable 3D representation.',
    spec: 'organs segmented · addressable',
  },
  phenotype: {
    index: '05',
    title: 'Phenotype',
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
 */
export const OUTRO_COPY = {
  /** Answers the hero and nothing else. ≤16ch measure. */
  closing: 'Nothing was cut.',
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
 * Above: one continuous scroll-driven transformation, five beats, one specimen.
 * Below: an index of two offerings, each a sequence of evidence steps. The
 * reconstruction is the *argument*; this is the *record*. They are different
 * kinds of reading and the code keeps them apart — nothing here reads
 * experienceProgress, subscribes to a frame, or appears in `BLOCKS`.
 *
 * That separation is the whole reason this could be added without retiming the
 * five beats. See the two-slot note in `progress/ProgressProvider.tsx`.
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
    'Above, one specimen carried through five stages. Below, two measurement programmes and the figures each of them produces.',
} as const

/**
 * `Capture → Reconstruct → Geometry → Surface → Phenotype`, built from the beat
 * titles rather than typed out.
 *
 * Offering 01's whole structure is a second pass over those five beats, so the
 * chain printed at its head has to be the same five words the progress rail
 * showed during the scroll. Deriving it means renaming a beat updates the rail,
 * the section heading and this chain together; a hand-typed string would make
 * that rename a silent inconsistency between the two halves of the page.
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
 * TIME → REPRESENT → MAP → TRACK → GROWTH → QUANTIFY.
 *
 * One leaf as recorded across observations; that leaf described as a boundary;
 * the boundary carried into a normalised frame; the same leaf matched to itself
 * across observations inside that frame; the difference between them resolved as
 * a field; the field checked against something measured independently.
 *
 * Three of these were renamed from verbs to the thing the step produces — TIME,
 * GROWTH and QUANTIFY were OBSERVE, MEASURE and VALIDATE. The sequence did not
 * change and the argument below is unaffected; the words are now what the stage
 * rubric shows in the sticky figure stage, where they are read as an arc rather
 * than one at a time, and an arc of six imperatives reads as instructions to the
 * reader rather than as the shape of a pipeline.
 *
 * WHY MAP COMES BEFORE TRACK
 * ──────────────────────────
 * It is the one ordering in the six that is not obvious, and getting it the
 * other way round is the default assumption — track the leaf first, then
 * analyse the shapes you tracked. The pipeline runs the other way, and the
 * reason is the whole argument of the section. Two observations of a leaf
 * differ in size, posture and camera angle all at once; correspondence between
 * them is only well posed once both have been carried into a frame where those
 * differences are already removed. The conformal map is what makes TRACK a
 * question with an answer, so it has to be read first.
 *
 * Each step is only legible as a consequence of the one above it, which is why
 * these are plates in a fixed order rather than six parallel capabilities. The
 * interpretation on every plate is written to name what the previous step made
 * possible — that is what carries the reader from TIME to QUANTIFY without the
 * page ever asserting a result.
 *
 * Nothing here is measured. No species, no interval, no count, no unit, no
 * equation, no correlation. Every sentence stays true of whatever figure
 * eventually lands in the frame above it; see the `summary` doc above for why
 * that constraint is the whole design. VALIDATE is the plate where this matters
 * most and is stated most carefully: it says what the comparison is *for*, and
 * says nothing whatever about how it came out.
 */
const DYNAMICS_EVIDENCE: readonly ScientificFigure[] = [
  {
    id: 'leaf-observation',
    index: '01',
    phase: 'Time',
    label: 'Original leaf observation',
    summary:
      'A single leaf as it was recorded, before anything has been fitted to it. Every later plate refers back to this frame, so it is shown first and unaltered.',
    category: 'photograph',
    aspect: 'wide',
    placeholder: '[REAL LEAF OBSERVATION — TO BE INSERTED]',
  },
  {
    id: 'leaf-boundary',
    index: '02',
    phase: 'Represent',
    label: 'Boundary and shape representation',
    summary:
      'The blade is separated from its surroundings and described as an outline and a surface. The leaf stops being an image and becomes an object with a geometry.',
    category: 'segmentation',
    aspect: 'wide',
    placeholder: '[REAL BOUNDARY EXTRACTION — TO BE INSERTED]',
  },
  {
    id: 'conformal-mapping',
    index: '03',
    phase: 'Map',
    label: 'Conformal parameterisation',
    summary:
      'The curved blade is carried onto a planar domain with angles preserved. Leaves that differ in size, posture and viewing angle are brought into one normalised frame.',
    category: 'map',
    expandable: true,
    aspect: 'wide',
    placeholder: '[REAL CONFORMAL MAP — TO BE INSERTED]',
  },
  {
    id: 'leaf-tracking',
    index: '04',
    phase: 'Track',
    label: 'Leaf correspondence across observations',
    summary:
      'The same leaf is matched to itself between observations, and its normalised frames are put into register. A point on the blade can then be followed rather than found again.',
    category: 'segmentation',
    aspect: 'wide',
    placeholder: '[REAL TRACKING RESULT — TO BE INSERTED]',
  },
  {
    id: 'growth-field',
    index: '05',
    phase: 'Growth',
    label: 'Growth and displacement field',
    summary:
      'The difference between registered observations is resolved across the blade. Change is described per region of the surface rather than as one number for the leaf.',
    category: 'field',
    expandable: true,
    aspect: 'wide',
    placeholder: '[REAL GROWTH FIELD — TO BE INSERTED]',
  },
  {
    id: 'quantitative-validation',
    index: '06',
    phase: 'Quantify',
    label: 'Quantitative comparison',
    summary:
      'The recovered field will be set against independent measurements of the same leaves. This is the plate that decides whether the five above it hold.',
    category: 'plot',
    aspect: 'wide',
    placeholder: '[REAL VALIDATION COMPARISON — TO BE INSERTED]',
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
    bridge: ['The same five stages, shown with the underlying data.'],
    evidence: [
      {
        id: 'source-data',
        index: '01',
        label: 'Multi-view image acquisition',
        stage: 'capture',
        summary:
          'Multiple viewpoints provide the visual observations used for 3D reconstruction. The specimen is photographed intact, without cutting or flattening.',
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
          'Camera positions and a dense point cloud are recovered from correspondences between the images. The views are resolved into a single coordinate frame.',
        category: 'point-cloud',
        expandable: true,
        aspect: 'wide',
        placeholder: '[REAL POINT CLOUD RESULT — TO BE INSERTED]',
      },
      {
        id: 'geometry-output',
        index: '03',
        label: 'Surface topology',
        stage: 'geometry',
        summary:
          'The points are connected into vertices, edges and faces. The reconstruction gains an explicit surface rather than a scatter of samples.',
        category: 'mesh',
        expandable: true,
        aspect: 'wide',
        placeholder: '[REAL GEOMETRY OUTPUT — TO BE INSERTED]',
      },
      {
        id: 'final-model',
        index: '04',
        label: 'Reconstructed surface model',
        stage: 'surface',
        summary:
          'The closed surface used for measurement, with plant organs separated. Each measurement can be addressed to a named part rather than to the model as a whole.',
        category: 'mesh',
        // `wide`, like the other four, so the empty run reads as one sequence
        // rather than a set of differently shaped objects. This is the shape of
        // the HOLE and not a claim about the figure: the real asset states its
        // own ratio in `registry.ts` and that one wins. See `aspectOf`.
        aspect: 'wide',
        placeholder: '[REAL RECONSTRUCTED MESH — TO BE INSERTED]',
      },
      {
        id: 'phenotyping-output',
        index: '05',
        label: 'Trait extraction',
        stage: 'phenotype',
        summary:
          'Traits are measured directly from the reconstructed surface. Each value keeps the span on the model it was derived from.',
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
