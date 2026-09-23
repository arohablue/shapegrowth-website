// src/content.ts
var SPECIMEN = "Specimen 04";
var HERO_COPY = {
  /**
   * Uppercased and tracked out by CSS. The non-breaking spaces around the slash
   * keep it from ever wrapping mid-rule; write them as `\u00a0`.
   */
  eyebrow: "Phenotyping\xA0/\xA0Reconstruction Lab",
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
    lead: "From",
    middle: "Images to",
    editorial: "growth",
    stop: "."
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
  standfirst: "From images to growth.",
  /** The scroll affordance. One word beside a hairline. */
  scrollCue: "Scroll"
};
var HERO_ARIA = `${HERO_COPY.headline.lead} ${HERO_COPY.headline.middle.toLowerCase()} ${HERO_COPY.headline.editorial}`;
var SECTION_COPY = {
  capture: {
    index: "01",
    title: "Capture",
    lede: "We observe the plant from multiple viewpoints.",
    spec: "66 of 102 views registered \xB7 RGB"
  },
  // The middle beat absorbed two that used to stand alone — GEOMETRY ("Points
  // become structure") and SURFACE ("Structure becomes a measurable 3D
  // representation"). Both were true and both were mechanism. A reader does not
  // need to be told that a reconstruction triangulates before it closes; they
  // need to be told that photographs come in and a measurable plant comes out,
  // which is what this one line now says. The triangulation and the closing are
  // still on screen underneath it, which is the right place for a mechanism.
  reconstruct: {
    index: "02",
    title: "3D Reconstruction",
    lede: "Image streams become one measurable 3D plant.",
    spec: "560k dense points \xB7 36k triangles"
  },
  phenotype: {
    index: "03",
    title: "Phenotyping",
    lede: "The reconstructed plant becomes quantitative data.",
    spec: "7 traits \xB7 non-destructive"
  }
};
var PHENOTYPE_DISCLAIMER = "Schematic \u2014 not measured";
var TRAIT_READOUT = {
  "plant-height": { label: "PLANT HEIGHT", value: 82.4, unit: "cm", precision: 1 },
  "leaf-length": { label: "LEAF LENGTH", value: 8.31, unit: "cm", precision: 2 },
  "leaf-width": { label: "LEAF WIDTH", value: 2.94, unit: "cm", precision: 2 },
  "leaf-area": { label: "LEAF AREA", value: 12.4, unit: "cm\xB2", precision: 1 },
  "leaf-angle": { label: "LEAF ANGLE", value: 37.2, unit: "\xB0", precision: 1 },
  "internode-distance": { label: "INTERNODE DIST.", value: 4.75, unit: "cm", precision: 2 },
  "stem-diameter": { label: "STEM DIAMETER", value: 6.2, unit: "mm", precision: 1 }
};
var OUTRO_COPY = {
  colophonLeft: `${SPECIMEN} \u2014 reconstruction complete`,
  /**
   * Counted from `TRAIT_READOUT` rather than written as "7", so adding or
   * removing a trait cannot leave the closing line contradicting the
   * annotations the reader just scrolled past.
   */
  colophonRight: `${Object.keys(TRAIT_READOUT).length} traits extracted`
};
var LOADING_COPY = {
  failed: "Reconstruction unavailable",
  /** `progress` is already rounded by the caller. */
  active: (progress) => `Loading reconstruction ${progress}%`
};
var OFFERINGS_COPY = {
  /** Scientific, not commercial. Names the genre of what follows. */
  eyebrow: "Evidence",
  title: "What the method produces",
  /**
   * Two clauses in deliberate parallel, because the parallel IS the transition.
   * The count stays here rather than in the title: how many programmes there are
   * is orientation, not the point, and putting it in the heading made the
   * section an index of two things instead of the second half of an argument.
   */
  standfirst: "Above, one specimen carried through three stages. Below, two measurement programmes and the figures each of them produces."
};
var STAGE_CHAIN = Object.values(SECTION_COPY).map((s) => s.title).join(" \u2192 ");
var DYNAMICS_EVIDENCE = [
  {
    id: "leaf-observation",
    index: "01",
    phase: "Time",
    label: "Original leaf observation",
    summary: "A single leaf as it was recorded, before anything has been fitted to it. Every later plate refers back to this frame, so it is shown first and unaltered.",
    category: "photograph",
    aspect: "wide",
    placeholder: "[REAL LEAF OBSERVATION \u2014 TO BE INSERTED]"
  },
  {
    id: "leaf-boundary",
    index: "02",
    phase: "Represent",
    label: "Boundary and shape representation",
    summary: "The blade is separated from its surroundings and described as an outline and a surface. The leaf stops being an image and becomes an object with a geometry.",
    category: "segmentation",
    aspect: "wide",
    placeholder: "[REAL BOUNDARY EXTRACTION \u2014 TO BE INSERTED]"
  },
  {
    id: "conformal-mapping",
    index: "03",
    phase: "Map",
    label: "Conformal parameterisation",
    summary: "The curved blade is carried onto a planar domain with angles preserved. Leaves that differ in size, posture and viewing angle are brought into one normalised frame.",
    category: "map",
    expandable: true,
    aspect: "wide",
    placeholder: "[REAL CONFORMAL MAP \u2014 TO BE INSERTED]"
  },
  {
    id: "leaf-tracking",
    index: "04",
    phase: "Track",
    label: "Leaf correspondence across observations",
    summary: "The same leaf is matched to itself between observations, and its normalised frames are put into register. A point on the blade can then be followed rather than found again.",
    category: "segmentation",
    aspect: "wide",
    placeholder: "[REAL TRACKING RESULT \u2014 TO BE INSERTED]"
  },
  {
    id: "growth-field",
    index: "05",
    phase: "Growth",
    label: "Growth and displacement field",
    summary: "The difference between registered observations is resolved across the blade. Change is described per region of the surface rather than as one number for the leaf.",
    category: "field",
    expandable: true,
    aspect: "wide",
    placeholder: "[REAL GROWTH FIELD \u2014 TO BE INSERTED]"
  },
  {
    id: "quantitative-validation",
    index: "06",
    phase: "Quantify",
    label: "Quantitative comparison",
    summary: "The recovered field will be set against independent measurements of the same leaves. This is the plate that decides whether the five above it hold.",
    category: "plot",
    aspect: "wide",
    placeholder: "[REAL VALIDATION COMPARISON \u2014 TO BE INSERTED]"
  }
];
var DYNAMICS_CHAIN = DYNAMICS_EVIDENCE.map((s) => s.phase).join(" \u2192 ");
var OFFERINGS = [
  {
    id: "reconstruction",
    index: "01",
    title: "3D Reconstruction",
    lede: "A plant recovered from photographs as measurable geometry.",
    spec: STAGE_CHAIN,
    /**
     * The hand-off. Names what the reader just watched and what changes now —
     * the stages are the same, the material is real. No new claim is made and
     * the reader is not addressed.
     */
    bridge: ["The same three stages, shown with the underlying data."],
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
        id: "source-data",
        index: "01",
        label: "Multi-view image acquisition",
        stage: "capture",
        summary: "Multiple viewpoints provide the visual observations used for 3D reconstruction. The specimen is photographed where it stands.",
        category: "photograph",
        aspect: "wide",
        placeholder: "[REAL SOURCE IMAGE \u2014 TO BE INSERTED]"
      },
      {
        id: "reconstruction-output",
        index: "02",
        label: "Structure-from-motion reconstruction",
        stage: "reconstruct",
        summary: (
          // Was "...into a closed surface with plant organs separated". Neither
          // half held: screened Poisson leaves 1,646 boundary edges across 35
          // components, so the surface is not closed, and nothing in this
          // pipeline segments organs — no leaf, stem or head is ever labelled.
          "Camera positions and a dense point cloud are recovered from correspondences between the images. The views resolve into a single coordinate frame, and the samples into a continuous surface."
        ),
        category: "point-cloud",
        // No `expandable`, and it USED to be set, back when this slot held a
        // still. The enlarge control exists so a reader can get closer to dense
        // material they cannot otherwise inspect; the filled slot is now a view
        // they can already turn and zoom in place, so the control would open a
        // modal containing a second copy of a thing that was already answering
        // the question — at the cost of a third WebGL context on the page.
        aspect: "wide",
        placeholder: "[REAL POINT CLOUD RESULT \u2014 TO BE INSERTED]"
      },
      {
        id: "phenotyping-output",
        index: "03",
        label: "Trait extraction",
        stage: "phenotype",
        summary: "Traits are measured directly from the reconstructed surface. Each value keeps the span on the model it was derived from.",
        category: "diagram",
        aspect: "wide",
        placeholder: "[REAL RESEARCH FIGURE \u2014 TO BE INSERTED]"
      }
    ]
  },
  {
    id: "leaf-dynamics",
    index: "02",
    /**
     * `Leaf Dynamics`, and the conformal work named in the chain underneath
     * rather than in the title. A two-part title joined by a `+` reads as a
     * bundle of two things offered together; this is one study, and the
     * conformal map is a step inside it, not a second product.
     */
    title: "Leaf Dynamics",
    lede: "The same leaf across time, and the deformation between observations.",
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
      "A reconstructed plant gives us geometry.",
      "But plants change over time.",
      "We can track that change."
    ],
    evidence: DYNAMICS_EVIDENCE
  }
];
var CONTACT_COPY = {
  eyebrow: "Contact",
  title: "Let's talk.",
  standfirst: "Have a plant dataset, research question, or collaboration in mind?",
  address: "admin@shape-growth.com",
  subject: "Shape Growth \u2014 Inquiry",
  /**
   * Trailing newline on each line so the reader's cursor lands under the label
   * rather than beside it. Joined with `\n` and encoded by the caller.
   */
  bodyHint: ["Name:", "Organization:", "Message:"],
  action: "Contact us",
  /**
   * Stated rather than implied. A button that silently launches a different
   * application is the one interaction on this page that can surprise someone,
   * and the cost of saying so is six words.
   */
  hint: "Opens your email application"
};
export {
  CONTACT_COPY,
  HERO_ARIA,
  HERO_COPY,
  LOADING_COPY,
  OFFERINGS,
  OFFERINGS_COPY,
  OUTRO_COPY,
  PHENOTYPE_DISCLAIMER,
  SECTION_COPY,
  TRAIT_READOUT
};
