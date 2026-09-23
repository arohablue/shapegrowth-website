/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE CAPTURE RIG
 * ────────────────────────────────────────────────────────────────────────────
 * Two shader pairs cover the whole instrument:
 *
 *   captureLine*  — the orbit path and the viewpoint frustum
 *   capturePoint* — the marked viewpoints and the sparse tie points
 *
 * They are shared rather than written per-object because the four elements are
 * genuinely the same two ideas: a faint line with a gradient along it, and a
 * small crisp mark that appears the moment the rig reaches it.
 *
 * ── The one mechanism worth understanding ────────────────────────────────────
 * Every element carries a single float attribute, `aAt`, holding the rig
 * traverse value (0 → 1) at which that element is reached. `uHead` is where the
 * rig is now. So `since = uHead - aAt` is the entire animation system:
 *
 *   since < 0   not yet measured        → invisible / unlit
 *   since ≈ 0   being measured now      → the flash
 *   since > 0   measured, on record     → steady, dim, permanent
 *
 * That is why nothing here needs a clock, a wrap-around, or an angle in
 * radians, and why scrubbing backwards is exact rather than approximately
 * reversed. It is also why the beat reads as *accumulation*: `since > 0` is
 * monotone in progress, so a measurement once taken is never un-taken.
 *
 * ── What is deliberately absent ──────────────────────────────────────────────
 * No bloom, no additive glow on the lines, no travelling dashes, no expanding
 * rings, no reticles, no hexagons, and no scanline texture. Every one of those
 * is the vocabulary of a game HUD. What is left is the vocabulary of an
 * instrument: thin constant-width lines, low alpha, crisp square marks, and one
 * brief brightening at the exact moment a reading is taken. The flash is the
 * only permitted flourish in the whole rig, and it is short (an exponential over
 * ~4% of the traverse) because a real sensor registers a return and moves on.
 */

export const captureLineVertexShader = /* glsl */ `
  uniform float uHead;
  /** 1 → orbit path (trail behind the rig), 0 → frustum ray (fade along it). */
  uniform float uTrail;

  attribute float aAt;

  varying float vAlpha;
  varying float vHead;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    float since = uHead - aAt;

    // The orbit path states three things at once, which is the most a single
    // faint line can carry: where the rig will go (base), where it has been
    // (trail), and where it is (head).
    float travelled = smoothstep(0.0, 0.008, since);
    float head = exp(-max(since, 0.0) * 38.0) * travelled;
    float ring = 0.22 + 0.42 * travelled + 0.9 * head;

    // Frustum rays fade away from the sensor, so the lines are densest at the
    // apparatus and dissolve before they arrive at the specimen. A ray of even
    // brightness terminating in mid-air looks like an unfinished line; one that
    // fades looks like the edge of a field of view, which is what it is.
    float ray = 1.0 - 0.82 * aAt;

    vAlpha = mix(ray, ring, uTrail);
    vHead = head;
  }
`

export const captureLineFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHeadColor;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vHead;

  void main() {
    // Accent only at the head of the traverse, and only there. This palette has
    // exactly one saturated colour and spending it on the whole instrument would
    // make the instrument the subject.
    vec3 color = mix(uColor, uHeadColor, vHead * 0.85);
    float alpha = uOpacity * vAlpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`

export const capturePointVertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMaxPixelSize;
  uniform float uHead;
  /** Width of the capture flash, in traverse units. */
  uniform float uFlashWidth;

  attribute float aAt;

  varying float vLit;
  varying float vFlash;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    float since = uHead - aAt;

    // Soft over ~1% of the traverse rather than a hard step: at 720 tie points
    // a true step pops them in one at a time as a visible stutter, and the
    // sub-pixel aliasing on a 3 px mark appearing instantly is worse than the
    // pop itself.
    vLit = smoothstep(0.0, 0.010, since);
    vFlash = exp(-max(since, 0.0) / max(uFlashWidth, 0.0001)) * vLit;

    // Attenuated like the point cloud, so the marks sit *in* the volume rather
    // than floating on the glass in front of it. Constant screen size was the
    // first thing I tried and it reads as an overlay drawn on the image, which
    // is exactly the game-HUD failure this is trying to avoid.
    float depth = max(-mv.z, 0.001);
    gl_PointSize = min(
      uSize * uPixelRatio * (1.0 + 0.85 * vFlash) / depth,
      uMaxPixelSize * uPixelRatio
    );
  }
`

export const capturePointFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uFlashColor;
  uniform float uOpacity;

  varying float vLit;
  varying float vFlash;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;

    // Square, and that is load-bearing. The point cloud's raw returns are soft
    // round blobs because that is what an unresolved sensor return looks like.
    // These are the opposite thing — discrete, located, recorded readings — and
    // a crisp square is how measurement reads. Using the same soft disc for
    // both would collapse the distinction the beat exists to draw.
    float r = max(abs(uv.x), abs(uv.y));
    float mask = 1.0 - smoothstep(0.32, 0.5, r);

    vec3 color = mix(uColor, uFlashColor, vFlash * 0.9);
    float alpha = uOpacity * mask * vLit * (1.0 + 2.4 * vFlash);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`
