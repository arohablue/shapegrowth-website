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
 * because its spine already exists elsewhere in the page. This one's does not
 * exist anywhere else, so it has to come from the plates themselves.
 *
 *
 * WHAT THE SEQUENCE HAS TO SAY, IN ORDER
 * ──────────────────────────────────────
 * DAY t → DAY t+1 → REGISTRATION → DISPLACEMENT → DEFORMATION → EXPLORATION.
 *
 * One plant recorded, then recorded again; the two recordings put into
 * correspondence by a deformation that is estimated rather than observed; the
 * motion that correspondence implies; what that motion does to the tissue
 * locally; and the whole of it handed to the reader to turn over.
 *
 * The two scans are two plates and not one, which is the change this sequence
 * made when the figures arrived. As a single plate called SCANS it had to show
 * both clouds at once, and two clouds shown together before anything has
 * aligned them is a picture of a mess that the reader is asked to take on trust.
 * Shown one after the other at a fixed camera they are a comparison: the same
 * plant, a day on, and no way to say which point went where. That absence is
 * the premise of every plate below, so it is worth a step of its own rather
 * than a subordinate clause.
 *
 * The last step is not a summary of the five above it. Steps one to five are
 * each a single claim with a single representation and no controls at all; the
 * sixth is where the rail appears, and it is the only place the reader can put a
 * specimen other than the default on screen — which is where a failure case
 * stops being a sentence in a caption and becomes something they found
 * themselves.
 *
 *
 * ALL SIX ARE ONE FIGURE
 * ──────────────────────
 * Every plate here is filled by `GrowthFieldView`, from six entries in
 * `registry.ts` that name the same component and differ only in which
 * representation they ask for. The stage mounts it once and the reader's
 * position in the column chooses the beat, so the plant on screen is one
 * continuous object from the first step to the last rather than six pictures of
 * one. See the note over those entries, and `Offerings.tsx` for the stage.
 *
 * What that costs this file is that a plate's `index` is now also its position
 * in a narrative the view knows the order of. Reordering these six without
 * reordering the `beat` strings beside them would caption each step with the
 * one before it, and nothing would throw.
 *
 *
 * WHAT THESE PLATES ARE NOT ALLOWED TO SAY
 * ────────────────────────────────────────
 * Every `summary` below is written to stay true of whatever figure lands in its
 * slot, which is the house rule for an unfilled plate. Three of them carry a
 * second constraint that does not expire when the figure arrives, because they
 * are the three places this study can most easily overclaim:
 *
 *   DISPLACEMENT is motion, not growth. A plant bends, droops and rotates
 *   overnight, and the registration has its own error; all of it lands in the
 *   same vector. Calling the field growth would be the single biggest lie this
 *   section could tell, and it would be an easy one.
 *
 *   DEFORMATION is a proxy, not a measurement. The Jacobian determinant of an
 *   estimated map describes volumetric change, and leaves are thin surfaces, so
 *   it answers *where* tissue expands and not *by how much*.
 *
 *   Correspondence is estimated. The two scans are independent samplings of the
 *   plant and share no ground-truth point identity, so nothing on these plates
 *   is a point that was tracked.
 *
 * None of that is hedging bolted on afterwards. It is the finding, and the
 * `caveats` array the exporter writes into `plant-growth/manifest.json` carries
 * the same four sentences in the same words, so the page and the data cannot
 * drift apart on what they refuse to claim.
 *
 * No quantity appears in any `summary`, and that is a rule rather than a state
 * of play: the interpretation line is the one piece of copy that is read as a
 * claim about the whole step, so the study's numbers — Chamfer distances,
 * median det J, the fraction of points where the map folds — go in `caption`
 * and `metadata`, which `verify-narrative.mjs` will not let a plate carry until
 * a real figure exists in `registry.ts` to be described.
 *
 * Only the last plate carries them, and that is now a choice rather than a
 * constraint — all six have real figures, so the harness would let any of them
 * have a key and a citation. Five do not, because the apparatus describes the
 * EXPLORER: the panel key enumerates representations the reader can choose
 * between, and the metadata reports the four specimens the picker offers. On a
 * narrated step there is no picker and one representation, so every line of it
 * would be describing controls that are not on screen. The figures those five
 * steps show are each covered by the legend inside the view, which reads the
 * same `plant-growth/manifest.json` the metadata quotes.
 */
const GROWTH_FIELDS_EVIDENCE: readonly ScientificFigure[] = [
  {
    id: 'scan-day-t',
    index: '01',
    phase: 'Day t',
    label: 'The earlier scan',
    summary:
      'One plant recorded as a cloud of points, with the soil label removed and the cloud brought to a common centre and scale. This is the whole of what the instrument gives: positions on a surface, with no identity attached to any of them.',
    category: 'point-cloud',
    aspect: 'wide',
    placeholder: '[REAL DAY-t SCAN — TO BE INSERTED]',
  },
  {
    id: 'scan-day-t1',
    index: '02',
    phase: 'Day t+1',
    label: 'The same plant one day later',
    summary:
      'The second recording, made a day after the first and sampled independently of it. Nothing marks which point here is which point there, and that absence is the problem the rest of the sequence exists to work around.',
    category: 'point-cloud',
    aspect: 'wide',
    placeholder: '[REAL DAY-t+1 SCAN — TO BE INSERTED]',
  },
  {
    id: 'non-rigid-registration',
    index: '03',
    phase: 'Registration',
    label: 'Non-rigid registration between two scans',
    summary:
      'A rigid alignment first, then a smooth non-rigid deformation that carries the earlier scan onto the later one. How well it arrived is reported as the distance between the two surfaces before and after, which is the only check available when there is no ground-truth correspondence.',
    category: 'point-cloud',
    aspect: 'wide',
    placeholder: '[REAL REGISTRATION RESULT — TO BE INSERTED]',
  },
  {
    id: 'displacement-field',
    index: '04',
    phase: 'Displacement',
    label: 'Estimated displacement between scans',
    summary:
      'The vector carrying each point of the earlier scan to where the registration places it in the later one. It contains bending, drooping, rotation and registration error alongside growth, so it is the plant\u2019s motion and not its growth.',
    category: 'field',
    aspect: 'wide',
    placeholder: '[REAL DISPLACEMENT FIELD — TO BE INSERTED]',
  },
  {
    id: 'local-deformation',
    index: '05',
    phase: 'Deformation',
    label: 'Local volumetric deformation of the estimated map',
    summary:
      'The determinant of the deformation\u2019s Jacobian, read as where tissue expands and where it compresses. A leaf is a thin surface, so this is a cautious proxy for a volume change and answers where rather than by how much.',
    category: 'field',
    aspect: 'wide',
    placeholder: '[REAL DEFORMATION MAP — TO BE INSERTED]',
  },
  {
    id: 'growth-field-explorer',
    index: '06',
    phase: 'Exploration',
    label: 'Both scans and the fields between them, in one view',
    summary:
      'The same plant and the same five representations, now under the reader\u2019s hand and in any order they like. The specimen is theirs to change — the study\u2019s weakest registration is among the choices rather than held back — as are vector density and vector length, which alter how the field is drawn rather than what was computed.',
    category: 'point-cloud',
    aspect: 'wide',
    placeholder: '[REAL INTERACTIVE EXPLORER — TO BE INSERTED]',
    /* The only plate of this offering that carries apparatus, which is a choice
     * and not a constraint — see the note above `GROWTH_FIELDS_EVIDENCE`, and
     * assertion 12 in `verify-narrative.mjs` for what has to be true before any
     * of them may. Every quantity below is read off
     * `public/evidence/plant-growth/manifest.json` and nothing is rounded past
     * the digit the legend shows.
     *
     * The key describes the rail and the metadata describes the picker, and
     * neither exists on a narrated step. The five before this one are covered by
     * the legend inside the view, which reads the same file. */
    caption:
      'Five representations of one pair of scans, chosen on the rail. DAY t and DAY t+1 are the two clouds on their own. REGISTERED overlays the warped earlier scan on the later one, so the residual is what remains visible between them. DISPLACEMENT draws each point\u2019s estimated motion as a line leaving the position it starts from. DEFORMATION colours every point by the determinant of the registration\u2019s Jacobian: green above one where the map expands tissue, amber between zero and one where it compresses, and an off-scale red at or below zero, where the map folds and the value is not a deformation at all. The picker above the rail changes the specimen, and the legend changes with it — every figure in it is read from the same file as the points beside it. Distances are in scan units. The vector display scale is a drawing choice and leaves the lengths the legend reports untouched.',
    metadata: [
      {
        label: 'Specimens',
        value:
          'Four of the fourteen plants studied — maize M05, M04 and M06 and tomato T02 — being the four with point-level arrays. The other ten exist only as summary statistics and are not offered. M05 opens the plate.',
      },
      { label: 'Interval', value: '03-24 to 03-25, one day apart, the only labelled consecutive-day pair in Pheno4D' },
      { label: 'Sampling', value: '3,000 points per scan, soil label removed, shared centre and scale' },
      { label: 'Registration', value: 'Non-rigid Coherent Point Drift with rigid pre-alignment (β 1.2, λ 30, w 0.2)' },
      {
        label: 'Fit',
        value:
          'Chamfer distance, the only check available without ground-truth correspondence. 7.30 to 1.37 scan units on M05, the tightest of the four; 16.59 to 6.49 on T02, which is the study\u2019s weakest and is labelled as such on the plate.',
      },
      {
        label: 'Displacement',
        value:
          'Median 9.4 scan units on M05, rising to 35.8 on T02. Much of the larger figures is leaf motion rather than tissue growth.',
      },
      {
        label: 'det J',
        value:
          'Median 1.31 on M05 with no non-positive values; 1.96 on T02, where 80 of 3,000 points fold and carry no readable deformation. Those are drawn off-scale rather than clipped.',
      },
      {
        label: 'Units',
        value:
          'Scan units. Pheno4D documents the files only as x, y, z and a label, so the millimetre reading the instrument implies is recorded as an inference and not applied.',
      },
    ],
    reference:
      'Pheno4D — Schunck, Magistri, Marcuzzi, Nardi, Nunes, Behley, Stachniss, PLoS ONE 16(8) e0256340 (2021)',
  },
]

/**
 * `Scans → Registration → Displacement → Deformation → Exploration`, read off
 * the plates rather than typed alongside them.
 *
 * NOTHING RENDERS THIS. `Offerings.tsx` does not read `Offering.spec` — the
 * wayfinding the reader actually gets is the one-word `phase` rubric on each
 * plate, which is the same information one step at a time. The note that stood
 * here described an arc printed at the offering's head; that arc is gone from
 * the component and the note had outlived it.
 *
 * It is still derived, and `verify-narrative.mjs` still asserts term-for-term
 * that it matches the plates, because the field is on the `Offering` type and
 * will be read again the moment a head arc or a stepper comes back. A chain
 * typed by hand would be a chain that disagreed with the plates by then, and
 * disagreed silently, since nothing on screen would show the contradiction.
 *
 * The terms are nouns here where offering 01's are verbs, and that is not an
 * oversight. Offering 01's chain names things *done to* the specimen by a
 * pipeline the reader watches run. Every term below except the last names an
 * object the study produces and then has to defend — a displacement field, a
 * deformation — and a verb would have quietly credited the pipeline with having
 * observed it. `Registration` is the hinge: it is the estimate everything after
 * it inherits, and naming it as a thing rather than an action is the first
 * reminder that what follows rests on it.
 *
 * Same reasoning as `STAGE_CHAIN` one level up: the chain and the labels on the
 * sequence itself are the same information, and the only way they cannot
 * disagree is if there is one of them.
 */
const GROWTH_FIELDS_CHAIN = GROWTH_FIELDS_EVIDENCE.map((s) => s.phase).join(' → ')

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
    id: 'plant-growth-fields',
    index: '02',
    /**
     * `Plant Growth Fields`, in sentence case — the stylesheet sets the caps, the
     * same way it does for every plate title.
     *
     * The word doing the work is `Fields`. What this study produces is not a
     * number per plant or a growth rate; it is a quantity defined at every point
     * of a surface, and naming it in the title is what stops the section being
     * read as a second trait table.
     */
    title: 'Plant Growth Fields',
    lede: 'Consecutive scans of one plant, registered to estimate how it moved and deformed between them.',
    spec: GROWTH_FIELDS_CHAIN,
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
     * The third line is the whole claim and it is deliberately the weaker of the
     * two available. `We can measure how it grew` was the sentence this section
     * wants to be able to write and cannot: what comes off the registration is
     * motion, and separating growth from bending is not something this work
     * does. `Estimate` carries the rest — the correspondence between two scans is
     * inferred, not observed, and everything on the six plates inherits that.
     */
    bridge: [
      'A reconstructed plant gives us geometry at one instant.',
      'But a plant does not hold still between scans.',
      'Registering two scans estimates what changed.',
    ],
    evidence: GROWTH_FIELDS_EVIDENCE,
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
