// src/experience/timeline.ts
var BLOCKS = [
  { id: "hero", vh: 100 },
  { id: "capture", vh: 185 },
  { id: "reconstruct", vh: 405 },
  { id: "phenotype", vh: 120 },
  { id: "outro", vh: 100 }
];
var STAGE_ORDER = ["capture", "reconstruct", "phenotype"];
var TOTAL_VH = BLOCKS.reduce((sum, b) => sum + b.vh, 0);
var SCROLLABLE_VH = TOTAL_VH - 100;
var BLOCK_RANGES = (() => {
  let cursor = 0;
  return BLOCKS.map((b) => {
    const startVh = cursor;
    const endVh = cursor + b.vh;
    cursor = endVh;
    return {
      id: b.id,
      vh: b.vh,
      startVh,
      endVh,
      startP: startVh / SCROLLABLE_VH,
      endP: endVh / SCROLLABLE_VH
    };
  });
})();
var progressToVh = (p) => p * SCROLLABLE_VH;
var TRACKS = {
  /**
   * The capture rig's traverse around the specimen — one full orbit, 0 → 1.
   *
   * `linear`, and that is the whole point. Every other track here is eased,
   * because every other track is a *transformation* with a beginning and an end.
   * This one is a machine on a track. A gantry that accelerates into its first
   * viewpoint and coasts out of its last is a hand-animated flourish, and it
   * reads instantly as one — the eye is very good at spotting a camera move that
   * was authored rather than driven. Constant angular rate is what a rig does.
   *
   * Runs 0 → 0.30, which is wider than `scan` on both ends by design:
   *   • it starts at 0 so the instrument is already present and already moving
   *     in the hero, establishing that something is *being measured* before the
   *     first heading arrives;
   *   • it ends at 0.30, inside the `pointCloud` window, so the rig is still
   *     travelling as the dense cloud resolves and then leaves. Ending it at
   *     0.18 with `scan` froze the rig on-screen for the whole handoff, which
   *     looks like a stalled machine rather than a completed pass.
   */
  rig: { in: 0, out: 0.3, ease: "linear" },
  /**
   * Sensor sweep. Leads everything: by the time the reader has left the hero the
   * rig has already passed over the specimen, so the point cloud has something
   * to resolve *from* rather than appearing out of nothing.
   *
   * This is now the *envelope* of the sweep, not its position — where the lit
   * band actually falls is a function of `rig`, because the band is the side of
   * the plant facing the sensor. See `representation.ts`.
   */
  scan: { in: 0.03, out: 0.18, ease: "easeInOutCubic" },
  /** Raw returns resolve into discrete, legible samples. Overlaps scan 0.15–0.18. */
  pointCloud: { in: 0.15, out: 0.35, ease: "easeInOutCubic" },
  /**
   * Samples migrate onto the reconstruction's actual vertices. This is the one
   * window where particle *positions* change; everything before and after moves
   * only opacity, size and colour.
   *
   * Opens at 0.33 rather than 0.35 so it is already moving while `pointCloud`
   * eases out. Abutting the two exactly leaves a measurable dead spot at 0.349
   * where both slopes are ~0 and the scene freezes.
   */
  vertex: { in: 0.33, out: 0.5, ease: "easeOutCubic" },
  /**
   * Edges grow between the settled vertices. Overlaps vertex 0.40–0.50.
   *
   * Opens at 0.40, not 0.45. Abutting the end of `vertex` was defensible on the
   * weights — the harness showed no stall and no solo frame, because `snap`
   * stays pinned at 1 while the cloud is still fully visible — but it was wrong
   * on the pixels. Measured in the browser at p=0.45: 0.14% frame coverage,
   * effectively a blank page, because the samples had finished collapsing onto
   * a much smaller set of vertex positions and nothing else had started.
   *
   * That gap is structural, not a fixture accident. A reconstruction always has
   * far fewer vertices than the scan has samples — that is what reconstruction
   * *is* — so the vertex stage is always the sparsest moment in the sequence and
   * must never be left holding the frame alone. Starting the edges while the
   * last samples are still migrating also happens to be the truer story: the
   * structure is inferred *from* the samples, not after them.
   */
  geometry: { in: 0.4, out: 0.65, ease: "easeOutCubic" },
  /** Surface closes over the wireframe, sweeping upward. Overlaps geometry 0.55–0.65. */
  mesh: { in: 0.55, out: 0.75, ease: "easeOutCubic" },
  /**
   * Material, lighting and atmosphere resolve to the finished plant. Overlaps
   * mesh 0.70–0.75. Keeps the symmetric ease: this drives light intensity and
   * roughness directly, with no per-element smoothing underneath to absorb a
   * sudden onset.
   */
  finalPlant: { in: 0.7, out: 0.85, ease: "easeInOutCubic" },
  /**
   * Measurement pass over the finished model. Overlaps finalPlant 0.85.
   *
   * `easeOutCubic`, not `easeOutExpo`, and the difference is measurable rather
   * than aesthetic. easeOutExpo's derivative at t=0 is 10·ln2 ≈ 6.93; over a
   * 0.15-wide window that is 46 per unit of page progress, or 0.046 per 0.001 —
   * past the 0.03 continuity budget, so the first scroll tick into the stage
   * pops. easeOutCubic's is 3, giving 0.02 per 0.001.
   *
   * It is also the right *shape*. This drives an accumulation — seven lines
   * being drawn one after another — and an exponential out spends most of its
   * range in the first sliver of the window, finishing the whole pass by p0.894
   * and leaving the last 10% of the page holding a static frame. Cubic spreads
   * it to ~p0.924. Same reasoning as the ease choice on every other
   * accumulating track here; expo belongs on things that illuminate, not on
   * things that fill.
   */
  phenotype: { in: 0.85, out: 1, ease: "easeOutCubic" }
};
export {
  BLOCKS,
  BLOCK_RANGES,
  SCROLLABLE_VH,
  STAGE_ORDER,
  TOTAL_VH,
  TRACKS,
  progressToVh
};
