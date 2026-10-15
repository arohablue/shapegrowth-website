import type { Offering } from './content'
import type { ScientificFigure } from './evidence/figure'

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ARCHIVE — THE LEAF DYNAMICS OFFERING
 * ════════════════════════════════════════════════════════════════════════════
 * Nothing imports this file. It is the Leaf Dynamics study — six plates, the
 * chain derived from them, and the offering that held them — lifted out of
 * `content.ts` whole when PLANT GROWTH FIELDS took position 02, and kept rather
 * than deleted because the work behind it is real and the page may want it back.
 *
 * It is a file and not a comment block, and not a `git log` entry, for one
 * reason: it still type-checks. `tsc --noEmit` reads it on every build, so a
 * rename in `ScientificFigure` or `Offering` breaks here loudly instead of
 * silently rotting until somebody tries to restore it.
 *
 *
 * TO RESTORE
 * ──────────
 *   1. `import { ARCHIVED_LEAF_DYNAMICS } from './content.archive'` in
 *      `content.ts` and put it back in the `OFFERINGS` array.
 *   2. Renumber: `index` must equal the offering's position, `'01'`-padded —
 *      `verify-narrative.mjs` asserts it, and so must the plate indices if the
 *      sequence is reordered.
 *
 * Nothing else moved. The six figures are still registered under their own ids
 * in `evidence/registry.ts` and their assets are still in
 * `public/evidence/leaf-dynamics/`, so a restored offering renders complete. An
 * entry in `EVIDENCE_SOURCES` that no figure claims is inert — the lookup is by
 * figure id and the lazy chunks are never requested — and emptying the registry
 * as well would have made restoring this a two-file reconstruction instead of
 * one import.
 */

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

export const ARCHIVED_LEAF_DYNAMICS: Offering = {
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
}
