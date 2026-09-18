/**
 * Placeholder specimen shader.
 *
 * Every visual property here is driven by a uniform that came from
 * `deriveSceneState`. Nothing animates on its own except the ambient drift,
 * which is additive, sub-centimetre, and disabled under reduced motion.
 *
 * The `aRevealOrder` attribute is deliberate groundwork: the real point cloud
 * will gate visibility per-point off exactly this attribute, so reveal costs
 * one comparison in the vertex shader and zero buffer re-uploads.
 */

export const specimenVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScan;
  uniform float uPointCloud;
  uniform float uMesh;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uDrift;

  attribute vec3 aScatter;
  attribute float aRevealOrder;
  attribute float aSeed;

  varying float vScan;
  varying float vSeed;
  varying float vDepth;

  void main() {
    // Staggered cohesion: lower samples settle first, so the cloud gathers
    // from the base upward rather than snapping together uniformly.
    float stagger = clamp((uPointCloud * 1.35) - aRevealOrder * 0.35, 0.0, 1.0);
    float cohere = stagger * stagger * (3.0 - 2.0 * stagger);

    vec3 pos = mix(aScatter, position, cohere);

    float driftAmount = (1.0 - cohere * 0.75) * uDrift;
    pos.x += sin(uTime * 0.35 + aSeed * 12.566) * 0.045 * driftAmount;
    pos.y += cos(uTime * 0.29 + aSeed * 9.424) * 0.045 * driftAmount;
    pos.z += sin(uTime * 0.31 + aSeed * 7.853) * 0.045 * driftAmount;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Sensor sweep: a plane travelling base → apex across the specimen.
    float sweepY = mix(-2.0, 2.0, uScan);
    float band = 1.0 - smoothstep(0.0, 0.30, abs(pos.y - sweepY));
    // NB: 'active' is a reserved word in GLSL ES — do not rename this back.
    float sweepActive = step(0.001, uScan) * (1.0 - step(0.999, uScan));
    vScan = band * sweepActive * (1.0 - uMesh);

    vSeed = aSeed;
    vDepth = -mv.z;

    // Only a mild shrink as the surface closes — at 0.55 the specimen faded to
    // nothing by the end of the page.
    float shrink = mix(1.0, 0.82, uMesh);
    gl_PointSize = uSize * uPixelRatio * shrink * (0.55 + 0.45 * aSeed) / max(vDepth, 0.001);
  }
`

export const specimenFragmentShader = /* glsl */ `
  uniform vec3 uColorBase;
  uniform vec3 uColorAccent;
  uniform float uPhenotype;
  uniform float uOpacity;

  varying float vScan;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    if (d > 0.25) discard;

    float alpha = 1.0 - smoothstep(0.03, 0.25, d);

    vec3 color = mix(uColorBase, uColorAccent, uPhenotype * 0.85);
    color = mix(color, vec3(1.0), vScan * 0.9);

    float depthFade = 1.0 - smoothstep(3.5, 12.0, vDepth);
    alpha *= (0.38 + 0.62 * vSeed) * (0.42 + 0.58 * depthFade) * uOpacity;
    alpha += vScan * 0.35;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`
