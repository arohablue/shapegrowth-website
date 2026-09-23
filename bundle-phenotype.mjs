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

// src/experience/phenotype.ts
var TRAIT_GEOMETRY = [
  {
    id: "plant-height",
    // The one clearance span: a datum line beside the plant, base to apex, the
    // way total height is dimensioned on a drawing.
    //
    // This is the trait the yaw hurt most, and the only one that could not be
    // fixed by moving its anchor. Rotating the old datum took it to z = +1.11,
    // which is not beside the plant at all — it is a full plan extent in FRONT
    // of it, so it projects as a vertical line drawn straight down the middle
    // of the specimen. A height datum crossing the thing it measures is not a
    // datum, so the line was re-placed rather than rotated: swept inboard from
    // x = -1.60 until the first x whose whole length clears the silhouette by
    // 6px in all six frames, sampled at 41 stations up the line and not just at
    // the two ends, because a datum that grazes the canopy in the middle reads
    // as touching it even though both endpoints are clear. That is x = -1.00,
    // and it holds 0.275 of real 3D clearance at its tightest point.
    //
    // z = 0 rather than the old 0.1: the offset existed to dodge a leaf that
    // the rotation has moved, and the plane of the page is where a drawing
    // would put it.
    startPoint: { x: -1, y: 0, z: 0 },
    endPoint: { x: -1, y: 1, z: 0 },
    // At the FOOT of the datum, not the apex, and opening OUTWARD across it.
    //
    // This is the one label in the set that sits on a line rather than beside
    // everything. It is not a compromise made to dodge a collision — the sweep
    // was run for both sides at every 0.02 of x and 0.01 of y against all five
    // viewports the harness checks, and `side: 'right'` has NO solution at all:
    // the pocket beside the pot is wide enough at 1440 and is not at 375, where
    // the label is the same 89px but the plant is not the same size. Opening
    // left has 602, and every one of them crosses the datum, necessarily —
    // anything inboard of the line with its label to the left must pass over
    // it. So the choice is between crossing a hairline and crossing a leaf.
    //
    // A drawing crosses the hairline. Dimension text sits ON the dimension line
    // by convention, and here that convention happens to also be the only thing
    // that fits. x = -0.68 is the innermost of the 602 — further out and the
    // label runs off the left edge at 375.
    anchor: { x: -0.68, y: 0.02, z: 0 },
    attachment: "clearance",
    side: "left",
    at: 0,
    priority: 0
  },
  {
    id: "leaf-length",
    // The upper blade that the yaw has swung toward the viewer: from just off
    // its node on the stem out to the tip, 0.85 of a world unit. Chosen over
    // the longer lower leaves because it is the straightest — the endpoints
    // here sit 0.027 and 0.010 from real samples, where a node-to-tip line on
    // the drooping lower blades departs by 0.16. A "length" that visibly floats
    // off the organ is worse than a shorter one.
    //
    // Same two samples as before the yaw, carried through Ry(1.5010) and
    // rescaled by 0.96308 — the plan half-extent grows from 1.25406 to 1.30214
    // when the plant turns, and these are FRACTIONS of it, so rotating them
    // without the rescale would have walked every endpoint 3.7% outboard.
    startPoint: { x: 0.078, y: 0.869, z: 0.224 },
    endPoint: { x: -0.249, y: 0.868, z: 0.78 },
    // Straight on past the tip, the minimum 0.22 march. The canopy has already
    // ended here so there is nothing to clear — 0.00% ink at all six frames —
    // and this is the outermost label on the set, so at 375px the frame margin
    // and not the leaf is what stops it going further.
    anchor: { x: -0.469, y: 0.868, z: 0.78 },
    attachment: "surface",
    side: "left",
    at: 0.16,
    priority: 1
  },
  {
    id: "leaf-width",
    // A chord across the mid-canopy blade, perpendicular in plan to its midrib
    // — the widest of four stations sampled along it. The two y values differ
    // by 0.02 because the blade droops: a level chord would be the authored
    // idea of a leaf rather than this leaf. Endpoints land 0.020 and 0.013 from
    // real samples after the rotation.
    startPoint: { x: 0.68, y: 0.342, z: 0.228 },
    endPoint: { x: 0.412, y: 0.324, z: 0.528 },
    // Outboard of the blade along the chord's own direction rather than below
    // it — this specimen has more canopy underneath than beside.
    anchor: { x: 0.9, y: 0.342, z: 0.228 },
    attachment: "surface",
    // LEFT before the yaw, right after it. This blade used to sit on -x and the
    // rotation carried it across to +x; the side has to follow the organ or the
    // leader line reaches back across the whole plant to find its own anchor.
    // It is the only one of the seven whose side changed.
    side: "right",
    at: 0.28,
    priority: 2
  },
  {
    id: "leaf-area",
    // A trait of a surface, not of a span. Two stations partway along the long
    // +x blade, so the marker pair reads as sampling a region rather than
    // measuring a length — which is why it stops partway along a blade rather
    // than reaching the tip.
    //
    // The start is the loosest endpoint in the set at 0.113 from the nearest
    // sample, well inside the 0.22 tolerance but the one to watch: this blade
    // is thin where the upper station falls, so the rotated point passes
    // through a gap between samples rather than onto one.
    startPoint: { x: 0.151, y: 0.716, z: -0.29 },
    endPoint: { x: 0.216, y: 0.714, z: -0.616 },
    // The trait whose old anchor the yaw broke outright — rotated, it landed
    // at z = -1.05, behind the plant and projecting onto the middle of the
    // canopy. Re-marched outboard 0.51 to the first position clear in all six
    // frames, which still leaves 0.47% ink: the highest of the seven, and the
    // reason the ceiling is 0.5% rather than zero. There is no fully empty
    // pocket at this height on a plant this bushy.
    anchor: { x: 0.726, y: 0.714, z: -0.616 },
    attachment: "surface",
    side: "right",
    at: 0.42,
    priority: 4
  },
  {
    id: "leaf-angle",
    // From a node low on the stem outward along the first stretch of a midrib:
    // the angle the blade leaves the stem at. Reads as an angle because it
    // starts on the axis and departs from it, so it is kept short — 0.33 — and
    // stops before the blade droops away from the straight line. This is the
    // lower leaf rather than one of the mid-canopy ones: its first third is
    // the straightest stretch on the plant, never more than 0.096 off material,
    // where the mid-canopy blades bend away by 0.24 within the same distance.
    startPoint: { x: 0.045, y: 0.202, z: -0.058 },
    endPoint: { x: 0.011, y: 0.198, z: -0.305 },
    // The longest march in the set, 0.70, and it has to be: the span sits in
    // the middle of the canopy and the first clear position is past the
    // blade's own tip. Held at the start point's height and depth rather than
    // continuing along the span, because extending the span's own direction
    // drives it further behind the plant, not out of it.
    anchor: { x: 0.745, y: 0.202, z: -0.058 },
    attachment: "surface",
    side: "right",
    at: 0.55,
    priority: 5
  },
  {
    id: "internode-distance",
    // Two nodes apart on the stem surface, so it runs vertically along the axis
    // rather than out into the canopy. The axis drifts slightly over this
    // stretch, which is why x and z are not equal at the two ends.
    startPoint: { x: 0.036, y: 0.506, z: 0.024 },
    endPoint: { x: 0.059, y: 0.594, z: 0.039 },
    // Straight out to -x at the foot of the span, 0.52. This one crosses the
    // canopy to reach clear air, so it is the second-highest ink at 0.21%; the
    // alternative was pushing it past the frame edge at 375px.
    anchor: { x: -0.484, y: 0.506, z: 0.024 },
    attachment: "surface",
    side: "left",
    at: 0.68,
    // Third rather than sixth: mobile keeps four, and the other three are all
    // in the upper canopy. `priority` orders by *spatial separation* under a
    // reduced set, `at` by protocol order — conflating them is what put four
    // mobile labels in the same corner.
    priority: 3
  },
  {
    id: "stem-diameter",
    // Across the trunk just above the pot, below everything, where a caliper
    // would actually reach. The half-width is the 75th percentile of the radial
    // distance of every sample within 0.20 of the axis — the stem's own surface
    // rather than a guess. This is the shortest span in the set by a wide
    // margin, 0.14 of the plan extent, which is why the leader line and not the
    // span carries the label.
    startPoint: { x: -4e-3, y: 0.125, z: 0.102 },
    endPoint: { x: 5e-3, y: 0.125, z: -0.032 },
    // Left, and a long way out — 0.74, the second-longest march. Right is
    // taken by leaf-angle at a similar height, and the extra distance is what
    // keeps the label off the POT rather than merely off the plant; the pot is
    // in the coverage mask too, which is why this one had to travel so far.
    anchor: { x: -0.744, y: 0.125, z: 0.102 },
    attachment: "surface",
    side: "left",
    at: 0.8,
    priority: 6
  }
];
var BREAKPOINT_CAPACITY = { desktop: 7, mobile: 4 };
var ORDERED_MEASUREMENTS = TRAIT_GEOMETRY.map((g) => ({
  ...g,
  ...TRAIT_READOUT[g.id]
})).sort((a, b) => a.at - b.at);
function annotationCapacity(breakpoint) {
  return BREAKPOINT_CAPACITY[breakpoint];
}
function annotationVisible(m, breakpoint) {
  return m.priority < BREAKPOINT_CAPACITY[breakpoint];
}
var FALLBACK_BOUNDS = {
  minY: -1.92,
  maxY: 1.92,
  planHalfExtent: 1.55
};
function measureSpecimenBounds(positions) {
  let minY = Infinity;
  let maxY = -Infinity;
  let plan = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const ax = x < 0 ? -x : x;
    const az = z < 0 ? -z : z;
    if (ax > plan) plan = ax;
    if (az > plan) plan = az;
  }
  if (!(maxY > minY)) return FALLBACK_BOUNDS;
  return { minY, maxY, planHalfExtent: plan > 1e-4 ? plan : FALLBACK_BOUNDS.planHalfExtent };
}
function resolveAnnotationPoint(p, bounds, out) {
  out.x = p.x * bounds.planHalfExtent;
  out.y = bounds.minY + p.y * (bounds.maxY - bounds.minY);
  out.z = p.z * bounds.planHalfExtent;
}
function annotationReveal(stage, at) {
  const start = at * 0.64;
  const t = (stage - start) / 0.24;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function formatValue(m) {
  return m.value.toFixed(m.precision);
}
export {
  FALLBACK_BOUNDS,
  ORDERED_MEASUREMENTS,
  annotationCapacity,
  annotationReveal,
  annotationVisible,
  formatValue,
  measureSpecimenBounds,
  resolveAnnotationPoint
};
