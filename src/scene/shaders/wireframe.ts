/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE WIREFRAME STAGE
 * ────────────────────────────────────────────────────────────────────────────
 * Edges grow from one endpoint to the other rather than fading in. `aOther`
 * holds the segment's origin for both of its vertices, so interpolating
 * `position` from `aOther` leaves vertex 0 anchored and sweeps vertex 1 along the
 * edge (see `assets/topology.ts` for how the buffer is laid out).
 *
 * Growth order comes from `aReveal` — the edge midpoint's normalised height — so
 * structure is inferred upward from the base, matching the direction the samples
 * snapped in. The two stages overlap for 0.05 of progress and the shared
 * direction is what makes the overlap read as one continuous process.
 *
 * On line weight: WebGL ignores `linewidth` on almost every platform (ANGLE
 * clamps it to 1), so the requested "line-weight change" is done with brightness
 * and alpha instead. A genuine variable-width line needs instanced quads —
 * drei's `<Line>` / three's `Line2` — which is a real option later but costs a
 * per-edge quad and a lot more geometry than this stage justifies.
 */

export const wireframeVertexShader = /* glsl */ `
  uniform float uBuild;

  attribute vec3 aOther;
  attribute float aReveal;

  varying float vGrown;
  varying float vFront;

  void main() {
    // Bounds chosen so every edge completes exactly at uBuild = 1:
    // max start 0.42, max end 1.0.
    float start = aReveal * 0.42;
    float grown = smoothstep(start, start + 0.58, uBuild);

    vec3 pos = mix(aOther, position, grown);

    // There was a travelling sine shimmer on the growth front here. It is gone.
    // An inferred edge is an assertion about where the surface is — making it
    // wobble says the opposite of what the stage means. It also measured out at
    // 0.004 world units, which at the working distance of ~7.5 is under a pixel,
    // so it cost a per-vertex trig call across 60k edges to say nothing.

    // 1 where this edge is actively being drawn, 0 once settled. Drives the
    // bright tip so the eye follows the construction.
    vFront = grown * (1.0 - grown) * 4.0;
    vGrown = grown;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

export const wireframeFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uFrontColor;
  uniform float uOpacity;

  varying float vGrown;
  varying float vFront;

  void main() {
    // An edge that has not started growing must not paint its origin vertex.
    if (vGrown < 0.001) discard;

    // Stand-in for line weight: the growth front burns brighter, settled edges
    // sit back. Reads as weight without needing instanced quads.
    vec3 color = mix(uColor, uFrontColor, clamp(vFront, 0.0, 1.0) * 0.85);

    float alpha = uOpacity * vGrown * (0.55 + 0.45 * vFront);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`
