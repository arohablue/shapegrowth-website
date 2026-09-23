// src/experience/easing.ts
var linear = (t) => t;
var easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
var easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
var easeOutExpo = (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
var easeInOutQuint = (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
var EASINGS = {
  linear,
  easeOutCubic,
  easeInOutCubic,
  easeOutExpo,
  easeInOutQuint
};
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var invLerp = (a, b, v) => {
  const span = b - a;
  return span === 0 ? 0 : (v - a) / span;
};

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

// src/experience/cameraSpline.ts
var DESKTOP_KEYFRAMES = [
  // Hero. Furthest back: the display type is the subject here, the specimen is
  // a presence behind it.
  { at: 0, position: [0.55, 0.42, 8.55], target: [0, 0.05, 0] },
  { at: 0.25, position: [0.28, 0.22, 7.7], target: [0, 0.02, 0] },
  // Closest framing of the journey, and the lowest — level with the specimen
  // while individual samples are snapping onto vertices.
  { at: 0.5, position: [-0.02, -0.04, 7.3], target: [0, -0.02, 0] },
  { at: 0.75, position: [-0.34, 0.14, 7.85], target: [0, 0.01, 0] },
  // Widest. The plant is finished and about to be measured; the annotations
  // need room outside the silhouette.
  { at: 1, position: [-0.62, 0.34, 8.7], target: [0, 0.04, 0] }
];
var MOBILE_KEYFRAMES = [
  { at: 0, position: [0.22, 0.3, 10.05], target: [0, 0.06, 0] },
  { at: 0.25, position: [0.11, 0.16, 9.45], target: [0, 0.03, 0] },
  { at: 0.5, position: [-0.01, -0.02, 9.15], target: [0, 0, 0] },
  { at: 0.75, position: [-0.14, 0.1, 9.55], target: [0, 0.02, 0] },
  { at: 1, position: [-0.26, 0.24, 10.2], target: [0, 0.05, 0] }
];
var KEYFRAMES = {
  desktop: DESKTOP_KEYFRAMES,
  mobile: MOBILE_KEYFRAMES
};
var catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
var at = (keys, i) => keys[Math.max(0, Math.min(keys.length - 1, i))];
var sampleChannel = (keys, i, local, channel, axis) => {
  const c = (k) => k[channel][axis];
  return catmullRom(c(at(keys, i - 1)), c(at(keys, i)), c(at(keys, i + 1)), c(at(keys, i + 2)), local);
};
function sampleCameraSpline(p, breakpoint, out) {
  const keys = KEYFRAMES[breakpoint];
  const t = clamp01(p);
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].at) i++;
  const local = clamp01(invLerp(keys[i].at, keys[i + 1].at, t));
  out.position[0] = sampleChannel(keys, i, local, "position", 0);
  out.position[1] = sampleChannel(keys, i, local, "position", 1);
  out.position[2] = sampleChannel(keys, i, local, "position", 2);
  out.target[0] = sampleChannel(keys, i, local, "target", 0);
  out.target[1] = sampleChannel(keys, i, local, "target", 1);
  out.target[2] = sampleChannel(keys, i, local, "target", 2);
}
var clone = (v) => [v[0], v[1], v[2]];
var createCameraState = () => ({
  position: clone(DESKTOP_KEYFRAMES[0].position),
  target: clone(DESKTOP_KEYFRAMES[0].target)
});

// src/experience/deriveSceneState.ts
var track = (id, p) => {
  const w = TRACKS[id];
  return EASINGS[w.ease](clamp01(invLerp(w.in, w.out, p)));
};
var getPointCloudProgress = (p) => track("pointCloud", p);
var getVertexProgress = (p) => track("vertex", p);
var getGeometryProgress = (p) => track("geometry", p);
var getMeshProgress = (p) => track("mesh", p);
var getFinalPlantProgress = (p) => track("finalPlant", p);
var resolveActiveStage = (p) => {
  const centreVh = clamp01(p) * SCROLLABLE_VH + 50;
  for (const range of BLOCK_RANGES) {
    if (range.id === "hero" || range.id === "outro") continue;
    if (centreVh >= range.startVh && centreVh < range.endVh) return range.id;
  }
  return centreVh < BLOCK_RANGES[1].startVh ? "capture" : "phenotype";
};
var createSceneState = () => ({
  experienceProgress: 0,
  rawProgress: 0,
  velocity: 0,
  scanProgress: 0,
  pointCloudProgress: 0,
  vertexProgress: 0,
  geometryProgress: 0,
  meshProgress: 0,
  finalPlantProgress: 0,
  phenotypeProgress: 0,
  camera: createCameraState(),
  activeStage: "capture",
  activeStageIndex: 0
});
function deriveSceneState(p, raw, velocity, breakpoint, out) {
  const clamped = clamp01(p);
  out.experienceProgress = clamped;
  out.rawProgress = raw;
  out.velocity = velocity;
  out.scanProgress = track("scan", clamped);
  out.pointCloudProgress = getPointCloudProgress(clamped);
  out.vertexProgress = getVertexProgress(clamped);
  out.geometryProgress = getGeometryProgress(clamped);
  out.meshProgress = getMeshProgress(clamped);
  out.finalPlantProgress = getFinalPlantProgress(clamped);
  out.phenotypeProgress = track("phenotype", clamped);
  sampleCameraSpline(clamped, breakpoint, out.camera);
  out.activeStage = resolveActiveStage(clamped);
  out.activeStageIndex = STAGE_ORDER.indexOf(out.activeStage);
  return out;
}
export {
  createSceneState,
  deriveSceneState,
  getFinalPlantProgress,
  getGeometryProgress,
  getMeshProgress,
  getPointCloudProgress,
  getVertexProgress,
  resolveActiveStage,
  track
};
