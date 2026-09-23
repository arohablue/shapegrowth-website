// src/evidence/demo.ts
var DEMO_SOURCES = {
  /* ── 01 / 3D RECONSTRUCTION ─────────────────────────────────────────────── */
  // `source-data` and `reconstruction-output` stood here. Both are now filled
  // for real, from the COLMAP sunflower scan — see the REAL block in
  // `registry.ts`. They are deleted rather than left underneath the real
  // entries: the registry spread means a superseded demo never renders, so
  // keeping it would be dead code that still reads as a live placeholder to
  // anyone auditing what is and is not yet evidenced.
  //
  // `geometry-output` and `final-model` also stood here, for the SURFACE
  // TOPOLOGY and RECONSTRUCTED SURFACE MODEL plates. Those plates were removed
  // when the page went from five beats to three; a demo with no slot to fill is
  // dead weight in a file whose whole purpose is to empty out.
  //
  // The SVGs for all four are still in `public/demo/reconstruction/` and are
  // now unreferenced.
  /** DEMO ONLY — stands in for the real trait extraction figure. */
  "phenotyping-output": {
    type: "image",
    src: "/demo/reconstruction/phenotyping-output.svg",
    alt: "Placeholder schematic: the same drawn plant in outline with four measurement annotations \u2014 a dimension line for plant height, a hatched blade for leaf area, an arc between two arms for leaf angle, and a caliper across the stem base for stem thickness. Each carries only its trait name; no values are shown."
  },
  /* ── 02 / LEAF DYNAMICS / CONFORMAL GROWTH ──────────────────────────────── */
  /** DEMO ONLY — stands in for the real recorded time series of one leaf. */
  "leaf-observation": {
    type: "image",
    src: "/demo/conformal/leaf-observation.svg",
    alt: "Placeholder schematic: five framed panels in a row, each showing the same drawn leaf a little larger and flatter than the last, labelled T 01 to T 05, above an arrow marked OBSERVATION INDEX. The panels carry indices only \u2014 no interval and no date."
  },
  /** DEMO ONLY — stands in for the real segmentation and shape representation. */
  "leaf-boundary": {
    type: "image",
    src: "/demo/conformal/leaf-boundary.svg",
    alt: "Placeholder schematic: the same drawn leaf twice \u2014 on the left a soft veined blade labelled IMAGE, on the right the same blade reduced to a heavy traced outline with vertices marked along it and chords across the interior, labelled CONTOUR AND SURFACE. An inset magnifies one stretch of the boundary with its vertices and outward normals."
  },
  /**
   * DEMO ONLY — stands in for the real conformal parameterisation figure.
   * Conceptual illustration of what normalisation does. The right-hand grid is
   * regular because it was drawn regular; nothing was computed or solved.
   */
  "conformal-mapping": {
    type: "image",
    src: "/demo/conformal/conformal-mapping.svg",
    alt: "Placeholder schematic: on the left a curved leaf carrying a grid that follows its surface, on the right a plain rectangle carrying a regular grid, joined by an arrow marked NORMALISE. One cell is highlighted on each side and a right-angle marker sits on each. A conceptual drawing of the idea, not the output of a mapping."
  },
  /** DEMO ONLY — stands in for the real correspondence/tracking result. */
  "leaf-tracking": {
    type: "image",
    src: "/demo/conformal/leaf-tracking.svg",
    alt: "Placeholder schematic: three framed panels labelled T 01 to T 03, each showing the same three leaves on a stem, larger in each successive panel. Every leaf carries a tag reading L1, L2 or L3, and dashed links between the panels carry each tag forward to the next frame."
  },
  /**
   * DEMO ONLY — stands in for the real growth or displacement field. Every arrow
   * is the same length and points away from the stalk: a geometric construction,
   * not a measured field. A field with varying magnitude would be
   * indistinguishable from a result.
   */
  "growth-field": {
    type: "image",
    src: "/demo/conformal/growth-field.svg",
    alt: "Placeholder schematic: a leaf outline filled with a lattice of arrows, all of identical length, each pointing away from the stalk. A key beside it reads DIRECTION, UNIFORM MAGNITUDE and SCHEMATIC FIELD. The directions are constructed, not measured."
  },
  /**
   * DEMO ONLY — stands in for the real quantitative comparison plot. Chart
   * furniture with nothing measured inside it: the markers sit on a perfectly
   * regular lattice and the bars are all one height, neither of which is a shape
   * data can take.
   */
  "quantitative-validation": {
    type: "image",
    src: "/demo/conformal/quantitative-validation.svg",
    alt: "Placeholder schematic: a two-panel chart template with no data. The left panel is a scatter frame whose markers sit on a perfectly regular lattice; the right panel is a bar frame whose bars are all the same height. Axes are named but carry no values, and a note beneath reads that axes, series and scale are placeholders."
  }
};
export {
  DEMO_SOURCES
};
