/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE PARTICLE STAGE OF THE TRANSFORMATION
 * ────────────────────────────────────────────────────────────────────────────
 * This shader carries three of the six beats: raw returns, resolved point cloud,
 * and vertices. It does so without ever swapping geometry — one buffer, one draw
 * call, and every beat is a uniform.
 *
 * The spatially continuous part is `aTarget`: each sample's nearest vertex on the
 * reconstruction, computed once at load (see `assets/topology.ts`). During the
 * vertex window each particle interpolates from where it was measured to where
 * the reconstruction says it is. That is the mechanism that makes the cloud
 * *become* the geometry rather than fade into it.
 *
 * Structural choices worth knowing:
 *
 * - Point *shape* and *size attenuation* are `#define`s, not uniforms. Both are
 *   configuration rather than animation, and a define costs nothing per
 *   fragment where a branch would cost something on every one. `MORPH` is a
 *   define for the same reason: whether targets exist is fixed at load.
 * - `USE_COLOR` is not ours — three injects it, together with
 *   `attribute vec3 color`, whenever `vertexColors: true` is set on the
 *   material. Declaring our own attribute would collide with it.
 * - PLY vertex colours are sRGB. three only auto-converts colour attributes for
 *   its built-in materials, so the conversion is explicit here; without it a
 *   scan renders visibly washed out through the midtones.
 * - `aSeed` is a stable per-point random driving brightness and size variation.
 *   It is what stops a uniformly-lit scan reading as flat sandpaper.
 * - `aRevealOrder` is base→apex height, 0→1. It orders the reveal and staggers
 *   the snap, keeping both sweeping upward like a surface being inferred.
 *   Note it does NOT order the capture: the capture beat is angular, because a
 *   rig goes *around* a plant. Two beats, two directions, one at a time — see
 *   the sensor-lobe block in `main`.
 *
 * Nothing integrates over time except `uTime`, which only feeds the drift field.
 * Every other input is a pure function of scroll progress, so scrubbing
 * backwards is exact rather than approximately reversed.
 */

export const pointCloudVertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMaxPixelSize;
  uniform float uSparkle;

  uniform float uTime;
  uniform float uReveal;
  /** Strength of the sensor's illuminated lobe. */
  uniform float uScan;
  /**
   * Where the sensor is, as a unit direction in plan view — NOT an angle.
   * Supplied by experience/captureRig.ts so the convention is never re-derived
   * here. See the sensor-lobe block in main().
   */
  uniform vec2 uSensorDir;
  uniform float uSnap;
  uniform float uDrift;
  uniform float uDriftAmount;
  uniform float uVertexEmphasis;
  uniform float uVertexSize;
  uniform float uDispersion;

  attribute float aSeed;
  attribute float aRevealOrder;

  #ifdef MORPH
    attribute vec3 aTarget;
  #endif

  varying float vSeed;
  varying float vDepth;
  varying float vAppear;
  varying float vScanBand;
  varying float vEmphasis;

  #ifdef USE_COLOR
    varying vec3 vLinearColor;

    // sRGB → linear. The renderer works in linear space and converts back on
    // output; feeding it sRGB directly double-brightens the midtones.
    vec3 srgbToLinear(vec3 c) {
      return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
    }
  #endif

  /**
   * Coherent drift.
   *
   * A smooth function of *position*, so neighbouring samples move together and
   * the cloud breathes as a body. Per-point random velocity — the obvious
   * implementation — reads as television static and destroys any sense that the
   * particles describe a real object. The per-point phase term is deliberately
   * small (< 1 radian) so it adds measurement jitter without breaking that
   * local coherence.
   */
  vec3 driftField(vec3 p, float t, float seed) {
    float ph = seed * 0.9;
    return vec3(
      sin(p.y * 1.9 + t * 0.43 + ph) + 0.6 * sin(p.z * 1.3 - t * 0.29),
      0.55 * sin(p.x * 1.6 + t * 0.37 + ph),
      cos(p.y * 1.7 + t * 0.31 + ph) + 0.6 * cos(p.x * 1.4 + t * 0.33)
    );
  }

  void main() {
    // ── Progressive reveal, base → apex ──────────────────────────────────
    // At uReveal = 1 the expression is >= 1.0 for every point, so the whole
    // cloud is guaranteed present; at 0 it is <= 0 for every point.
    float appear = smoothstep(0.0, 0.35, uReveal * 1.35 - aRevealOrder * 0.35);

    // Floored, not gated. A hard gate leaves the hero — 15% of the page before
    // the reveal window opens — as an empty frame. A floor renders it as a faint
    // unresolved haze instead, which is what a raw capture actually looks like.
    //
    // 0.58, not 0.30. This floor is multiplied by cloudOpacity, which carries a
    // floor of its own (see the presence block in experience/representation.ts),
    // and the product is what the opening frame is actually drawn at — 0.072
    // under the old pair, measured at 0.19% bright pixels against a 2.83% peak.
    // Two independently-authored "faint floors" are not a faint floor; they are a
    // dark one. Raising this one compresses the reveal's alpha range, which is
    // fine here because the reveal is not carried by alpha alone: uDispersion
    // contracts the cloud onto itself and uDrift stills it, and those two are
    // what make the sweep read as resolution rather than as a fade-in.
    vAppear = mix(0.58, 1.0, appear);

    // Unresolved samples sit slightly outside their true position, radially.
    // Scaling about the model origin keeps this coherent — the cloud contracts
    // onto itself as it resolves, rather than individual points twitching home.
    vec3 scanned = position * (1.0 + (1.0 - appear) * uDispersion);

    // ── Migration onto the reconstruction's vertices ─────────────────────
    // Staggered by height so the snap sweeps upward instead of the whole cloud
    // teleporting on one frame. Bounds are chosen so every point completes:
    // max start 0.53, max end 0.95.
    float stagger = aRevealOrder * 0.55 + aSeed * 0.18;
    float snapT = smoothstep(stagger * 0.72, stagger * 0.72 + 0.42, uSnap);

    vec3 base = scanned;
    #ifdef MORPH
      base = mix(scanned, aTarget, snapT);
    #endif

    // ── The side facing the sensor ──────────────────────────────────────
    // This used to be a band travelling vertically up the specimen, driven by
    // its own progress value. It was replaced because it had no visible cause:
    // once the capture rig exists and is orbiting, a *second* unexplained
    // motion sweeping the other way is two effects at once, and the eye reads
    // the pair as decoration rather than as an instrument taking a reading.
    //
    // What a multi-view or structured-light rig actually produces is a lit
    // side — the half of the canopy the sensor can currently see. So the band
    // is now angular and centred on the rig's own azimuth, which means it is
    // not an animation at all: it is the consequence of where the sensor is.
    //
    // No attribute is needed, and deliberately no angle either. An earlier
    // version recomputed the azimuth here with atan and differenced it against
    // the rig's traverse. That worked, but it meant the convention was written
    // out twice — once in TS, once inverted in GLSL — which is exactly the
    // mistake that produced a lit patch trailing the sensor by 90°.
    //
    // Comparing directions instead makes the error unrepresentable: the lobe is
    // just "how closely does this sample's bearing align with the sensor's",
    // one dot product, no seam to wrap and no branch. The cosine threshold is
    // ~±50° of arc — wider and the whole plant is lit at once so there is no
    // readable direction; much narrower and it becomes a rotating blade.
    vec2 bearing = normalize(vec2(base.x, base.z) + vec2(1e-5));
    float band = smoothstep(0.64, 1.0, dot(bearing, uSensorDir));

    // Facing the sensor is only meaningful while there IS a sensor. uScan is
    // the envelope; (1 - uReveal) retires it as the data becomes legible in
    // its own right.
    vScanBand = band * uScan * (1.0 - uReveal);

    // Drift stops as samples lock onto vertices — a cloud still breathing after
    // it has become geometry reads as noise rather than as measurement.
    vec3 drifted = base + driftField(base, uTime, aSeed) * uDriftAmount * uDrift * (1.0 - snapT);

    vec4 mv = modelViewMatrix * vec4(drifted, 1.0);
    gl_Position = projectionMatrix * mv;

    vSeed = aSeed;
    vDepth = -mv.z;
    vEmphasis = uVertexEmphasis;

    #ifdef USE_COLOR
      vLinearColor = srgbToLinear(color);
    #endif

    // Sparkle drives size as well as alpha. Varying only alpha reads as noisy
    // flicker; varying both reads as depth.
    float variation = mix(1.0, 0.55 + 0.45 * aSeed, uSparkle);

    // Vertices are smaller and more uniform than scan returns — that size change
    // is most of what sells "this is now a vertex, not a sample".
    //
    // The scan band deliberately does NOT inflate point size any more. It was
    // boosting size, colour, brightness and alpha at once, and four boosts on
    // one moving band is a laser sweep out of a title sequence, not a structured
    // light pass. Brightness alone is what a real illuminated band does; the
    // size term was the part that bloomed.
    float sizeBase = mix(uSize, uVertexSize, uVertexEmphasis);

    #ifdef ATTENUATE
      gl_PointSize = sizeBase * uPixelRatio * variation / max(vDepth, 0.001);
    #else
      gl_PointSize = sizeBase * uPixelRatio * variation;
    #endif

    gl_PointSize = min(gl_PointSize, uMaxPixelSize * uPixelRatio);
  }
`

export const pointCloudFragmentShader = /* glsl */ `
  uniform vec3 uTint;
  uniform vec3 uVertexTint;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uDepthFadeNear;
  uniform float uDepthFadeFar;
  uniform float uSparkle;

  varying float vSeed;
  varying float vDepth;
  varying float vAppear;
  varying float vScanBand;
  varying float vEmphasis;

  #ifdef USE_COLOR
    varying vec3 vLinearColor;
  #endif

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d2 = dot(uv, uv);

    #if defined(SHAPE_SQUARE)
      float mask = 1.0;
    #elif defined(SHAPE_RING)
      if (d2 > 0.25) discard;
      float r = sqrt(d2);
      float mask = smoothstep(0.16, 0.30, r) * (1.0 - smoothstep(0.42, 0.50, r));
    #elif defined(SHAPE_DISC)
      if (d2 > 0.25) discard;
      float mask = 1.0;
    #else
      // SHAPE_SOFT. Hardens with vertex emphasis: a soft gaussian blob reads as
      // a sensor return, a crisp dot reads as a vertex. Interpolating the falloff
      // is how one buffer covers both without a shader swap.
      if (d2 > 0.25) discard;
      float soft = 1.0 - smoothstep(0.03, 0.25, d2);
      float crisp = 1.0 - smoothstep(0.17, 0.25, d2);
      float mask = mix(soft, crisp, vEmphasis);
    #endif

    #ifdef USE_COLOR
      vec3 color = vLinearColor;
    #else
      vec3 color = uTint;
    #endif

    // Foliage colour → measurement colour. Vertices are data about the plant,
    // not the plant, and reading as such is the point of the stage.
    color = mix(color, uVertexTint, vEmphasis * 0.72);
    // Restrained on purpose: the sweep should read as light falling across the
    // canopy for a moment, not as a highlighter drawn over it.
    color = mix(color, uVertexTint, vScanBand * 0.32);
    color *= uBrightness * (1.0 + 0.42 * vScanBand);

    // Distance attenuation. Without it every point is equally bright and the
    // cloud collapses into a flat sheet with no readable depth.
    float depthFade = 1.0 - smoothstep(uDepthFadeNear, uDepthFadeFar, vDepth);
    float sparkle = mix(1.0, 0.38 + 0.62 * vSeed, uSparkle);

    float alpha = mask * sparkle * (0.42 + 0.58 * depthFade) * uOpacity * vAppear;

    // Vertex-emphasis light compensation.
    //
    // Becoming a vertex costs a point most of its light twice over: the quad
    // shrinks (18 → 11 px, ~2.7x less area) and the mask hardens from a gaussian
    // to a crisp disc, which cuts integrated alpha again. Measured, the vertex
    // stage came out at less than half the mean luminance of the point-cloud
    // stage — the conceptual centre of the whole transformation was also its
    // dimmest, faintest frame.
    //
    // This restores the luminance the geometry change took away, without
    // touching the size or the hardness that are doing the actual storytelling.
    // A vertex should read as small, precise and *bright* — the way a measured
    // point reads on an instrument — not as a faint speck.
    alpha *= mix(1.0, 2.1, vEmphasis);

    alpha *= 1.0 + 0.55 * vScanBand;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`
