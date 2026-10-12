import type { EvidenceSource } from '@/evidence/registry'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DEMO ONLY — TEMPORARY DEVELOPMENT VISUALS, NOT RESEARCH OUTPUT
 * ────────────────────────────────────────────────────────────────────────────
 * Every asset referenced from this file is a schematic drawn to show what KIND
 * of evidence each slot is waiting for. None of it is measured, computed or
 * observed. Nothing here came out of an experiment.
 *
 * This file exists so that the demo material is removable in one action. It is
 * spread into `EVIDENCE_SOURCES` in `registry.ts` on a single marked line:
 * delete the import and that line and every slot this file still holds returns
 * to a labelled hole, with no other edit anywhere. That is the whole reason for a second module
 * rather than eleven entries typed into the registry directly — mixed in, the
 * demo entries would be indistinguishable from real ones within a week, and
 * removing them would be an archaeology exercise against `git log`.
 *
 *
 * HOW A REAL FIGURE REPLACES A DEMO
 * ─────────────────────────────────
 * Two ways, and the second is the one to use.
 *
 *   1. Overwrite the file at the same path. Fastest, and wrong: the entry still
 *      lives in a file that says DEMO at the top, so the next person deletes it.
 *
 *   2. Add the real entry to `EVIDENCE_SOURCES` in `registry.ts`, under the same
 *      step id. The registry spreads this map FIRST, so a real entry silently
 *      supersedes the demo for that slot, and the demo file can then be deleted
 *      on its own. Slots convert one at a time and the file empties as the study
 *      fills in.
 *
 * The `alt` text is written to describe the schematic that is actually on
 * screen, and says so. A screen reader user is told this is a placeholder for
 * the same reason a sighted user can see a faint DEMO mark in the corner of the
 * drawing — the two audiences get the same information, which is the only
 * defensible reading of "do not present these as real results".
 *
 *
 * WHAT IS NOT HERE, AND MUST NOT BE
 * ─────────────────────────────────
 * No `caption`, `metadata` or `reference` has been added to any figure in
 * `content.ts` alongside these. The apparatus describes a specific figure, and
 * these are not figures — a scale bar or an instrument line under a drawing of a
 * leaf is a fabricated detail whether or not the drawing is labelled a demo.
 * `verify-narrative.mjs` treats a demo-filled slot exactly as it treats an empty
 * one and fails the run if any of the three appears on it.
 *
 * No entry here sets `aspect` either, and that one is a statement rather than an
 * omission. Every schematic was drawn at 1600x900 to fit the reserved box, so
 * declaring `wide` would be the demo asserting the shape it was handed — and it
 * would read, to whoever replaces it, as a property of the slot that has to be
 * preserved. The demos take whatever hole they are given. Real assets state
 * their own ratio and the page reshapes to it. `verify-narrative.mjs` fails the
 * run if a demo entry ever grows one.
 */
export const DEMO_SOURCES: Partial<Record<string, EvidenceSource>> = {
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
  'phenotyping-output': {
    type: 'image',
    src: '/demo/reconstruction/phenotyping-output.svg',
    alt: 'Placeholder schematic: the same drawn plant in outline with four measurement annotations — a dimension line for plant height, a hatched blade for leaf area, an arc between two arms for leaf angle, and a caliper across the stem base for stem thickness. Each carries only its trait name; no values are shown.',
  },

  /* ── 02 / LEAF DYNAMICS / CONFORMAL GROWTH ──────────────────────────────── */

  // Nothing. All six leaf-dynamics plates are filled for real from the
  // PhenoLeaf-TS dataset, specimen Col-0 / rep_21 — see the REAL block in
  // `registry.ts`. Deleted rather than left underneath, same reasoning as
  // offering 01's two deletions above: a superseded demo never renders once the
  // registry has a real entry at that key, so keeping it here would just be dead
  // code that still reads as an open placeholder to anyone auditing the page.
  //
  // `quantitative-validation` was the last one standing, and the note in this
  // place argued it had to stay: there is no independent instrument measurement
  // in this dataset to validate a recovered displacement field against, and
  // inventing one was out of the question. That was true and is still true. What
  // changed is that it turned out not to be the only available test — a map
  // built from two frames can be made to predict a third it never saw, and
  // scored against that frame's own mask. The plate now reports how that went,
  // which includes the part where the conformal map does not clearly beat a
  // much simpler correspondence.
  //
  // The SVGs for all six are still in `public/demo/conformal/` and are now
  // unreferenced.
}
