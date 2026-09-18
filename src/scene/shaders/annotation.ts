/**
 * ────────────────────────────────────────────────────────────────────────────
 * DIMENSION LINES AND MEASUREMENT MARKERS
 * ────────────────────────────────────────────────────────────────────────────
 * The drawn half of the phenotyping pass. The typography is DOM (see
 * `AnnotationLabels.tsx`); everything anchored in the scene is here.
 *
 * Two programs, both driven by one uniform:
 *
 *   uStage    the phenotype track, 0 → 1
 *
 * Per-vertex `aAt` carries the annotation's place in the stagger and `aSpan`
 * carries position along its own line, 0 → 1. Between them a line can draw
 * itself progressively from its start toward its end — which is what makes it
 * read as a measurement being taken rather than a graphic being faded in.
 *
 * `aReveal` is precomputed per-vertex on the CPU rather than derived from
 * `aAt` in the shader. That looks redundant and is not: the stagger curve lives
 * in `experience/phenotype.ts` as a pure function so it can be asserted in
 * Node, and duplicating it in GLSL is exactly the two-implementations-of-one-
 * convention mistake that already cost a quarter-turn error in the capture rig.
 * One buffer write per frame per annotation is cheaper than the risk.
 *
 *
 * WHAT IS DELIBERATELY ABSENT
 * ───────────────────────────
 * No additive blending, no glow, no bloom, no pulsing, no travelling dashes,
 * no rounded end caps, no drop shadows. A dimension line on a technical
 * drawing is one weight of one colour and it does not move once drawn. Every
 * effect in that list would read as a game HUD, and the brief's "avoid bright
 * neon UI" is really a request for restraint about exactly these.
 *
 * The one concession to motion is `head`: a short brightening at the drawing
 * tip while a line extends, which decays to nothing the moment it arrives. It
 * earns its place because without it a line growing at scroll speed has no
 * visible direction, and direction is the difference between "measuring" and
 * "appearing".
 */

export const annotationLineVertexShader = /* glsl */ `
  uniform float uOpacity;

  /** This vertex's annotation reveal, 0 → 1. Written per frame from the CPU. */
  attribute float aReveal;
  /** Position along this annotation's own line, 0 → 1. */
  attribute float aSpan;

  varying float vAlpha;
  varying float vHead;

  void main() {
    // The drawing front, offset so that reveal 0 is genuinely *nothing*.
    //
    // Using aReveal directly is the obvious version and it leaks: the softness
    // below is two-sided, so at aReveal = 0 the vertex at aSpan = 0 still
    // resolves to half alpha. Six of the seven annotations sit at reveal 0 for
    // the first part of the stage, and any over the breakpoint's capacity sit
    // there for all of it — so the leak is six stray dots on the specimen at
    // the moment the pass opens, which reads as dirt on the lens. Starting the
    // front behind zero costs one multiply and makes the off state exact.
    float front = aReveal * 1.04 - 0.04;

    // The line exists up to the front and not beyond it. Without the 0.02 of
    // softness the leading vertex pops on, which at these segment counts is a
    // visible stipple crawling along the line.
    float drawn = smoothstep(front + 0.02, front - 0.02, aSpan);

    // Brightening at the drawing tip, decaying fast behind it. Not a comet
    // trail — the exponent is steep enough that a settled line carries none of
    // it, so the effect is invisible once the stage is complete.
    vHead = exp(-max(front - aSpan, 0.0) * 26.0) * step(0.001, aReveal) * (1.0 - step(0.999, aReveal));

    vAlpha = drawn * uOpacity;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const annotationLineFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHeadColor;

  varying float vAlpha;
  varying float vHead;

  void main() {
    if (vAlpha < 0.004) discard;
    // Colour shifts toward the accent only at the tip. A whole line in the
    // accent green reads as a highlight; a line in the resting cloud colour
    // with a bright tip reads as an instrument drawing it.
    vec3 c = mix(uColor, uHeadColor, vHead * 0.8);
    gl_FragColor = vec4(c * (1.0 + 0.5 * vHead), vAlpha);
    #include <colorspace_fragment>
  }
`

export const annotationMarkerVertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;

  attribute float aReveal;
  /** 0 for the span's endpoints, 1 for the label anchor. */
  attribute float aKind;

  varying float vAlpha;
  varying float vKind;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Endpoint markers land as their line arrives; the anchor marker waits
    // until the line has actually reached it. A marker that appears before the
    // line connects to it reads as an unrelated dot.
    float gate = mix(smoothstep(0.0, 0.12, aReveal), smoothstep(0.86, 1.0, aReveal), aKind);
    vAlpha = gate * uOpacity;
    vKind = aKind;

    // Constant screen size, not attenuated. These are annotation, not part of
    // the specimen — a tick that shrinks with distance reads as an object in
    // the scene rather than a mark on the drawing.
    gl_PointSize = uSize * uPixelRatio;
  }
`

export const annotationMarkerFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAnchorColor;

  varying float vAlpha;
  varying float vKind;

  void main() {
    if (vAlpha < 0.004) discard;

    vec2 uv = gl_PointCoord - 0.5;

    // Square, matching the capture rig's tie points. That vocabulary was
    // established earlier in the sequence — square means "a discrete recorded
    // reading" as against the point cloud's soft round sensor returns — and a
    // measurement endpoint is exactly that, so it reuses the shape rather than
    // introducing a third one.
    float r = max(abs(uv.x), abs(uv.y));

    // Endpoints are hollow, the label anchor is solid. One bit of information,
    // no extra geometry: a caliper's jaws are not the same mark as the point
    // the reading is written at.
    float mask = 1.0 - smoothstep(0.30, 0.46, r);
    float hollow = smoothstep(0.14, 0.24, r);
    mask *= mix(hollow, 1.0, vKind);

    if (mask < 0.01) discard;

    vec3 c = mix(uColor, uAnchorColor, vKind);
    gl_FragColor = vec4(c, mask * vAlpha);
    #include <colorspace_fragment>
  }
`
