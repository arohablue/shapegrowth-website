/**
 * Single source of colour truth, shared by CSS and WebGL.
 *
 * three's Color parses these as sRGB and converts to the linear working space
 * automatically (ColorManagement is on by default), and the fragment shader
 * converts back on output via `#include <colorspace_fragment>`. Skipping either
 * half of that round-trip is the usual reason WebGL colour fails to match CSS.
 *
 * The four roles are semantic, not literal, which is what makes a second theme
 * cheap: `void` is always "the page", `ink` is always "type on the page". Every
 * consumer — 64 sites in the stylesheet, nine in the scene — is written against
 * the role, so a theme is a set of four values rather than a set of overrides.
 * The light values mirror the dark ones across that role, they are not inverted
 * channel-wise: `void` light stays warm off-white rather than becoming pure
 * white, and `accent` darkens to hold contrast on it instead of keeping a
 * luminance tuned for near-black.
 */
export type Theme = 'light' | 'dark'

export interface Palette {
  /** Page background. */
  void: string
  /** Primary type. */
  ink: string
  /** Resting colour of the point cloud. */
  cloud: string
  /** Botanical sage-chartreuse. Used sparingly: measurement, emphasis, sweep. */
  accent: string
}

export const PALETTES: Record<Theme, Palette> = {
  /**
   * Warm off-white rather than #fff. Pure white next to the bone-coloured dark
   * theme would read as a different product, and it makes the accent's job
   * harder: the whiter the field, the darker a green has to go before it holds.
   */
  light: {
    void: '#f2f0e8',
    ink: '#101410',
    // Both of these are darkened well past a naive inversion. #96a79b and
    // #9bd07f are calibrated to glow against near-black; on an off-white field
    // they land around 1.6:1 and vanish.
    //
    // The first pass at that darkening only solved contrast, and contrast is
    // not the same fact as chroma. It carried the dark theme's *saturation*
    // down with the luminance — `cloud` came out at 9% HSL saturation, which is
    // a sage grey. On near-black a 9%-saturated green still reads as green,
    // because the eye has nothing brighter to compare it against and the hue
    // is the only signal in the frame. Put the same swatch on warm off-white,
    // where the background itself is a low-chroma warm colour, and the two
    // become neighbours: the plant turns grey and the page keeps the only
    // colour. Dropping luminance on a light field is what *makes room* for
    // chroma, so the saturation has to be spent, not inherited.
    //
    // Hues are held exactly — `cloud` at 138°, `accent` at 98°, matching the
    // dark theme to the degree — so this is the same two colours seen under a
    // different light, not a second palette. What moved is saturation and
    // depth: cloud 9%→39%, accent 42%→60%, and both gain contrast against
    // `void` (4.97:1→5.58:1 and 4.95:1→5.30:1). The ceiling on both is the
    // point where a deep leaf green becomes a signal green; 60% at 27%
    // lightness is a shaded canopy, 60% at 50% would be a highlighter.
    cloud: '#2f6b41',
    accent: '#3a6f1c',
  },
  dark: {
    void: '#070908',
    ink: '#eae8e1',
    cloud: '#96a79b',
    accent: '#9bd07f',
  },
}

/**
 * The part of the scene that is not a colour.
 *
 * Re-tinting the point cloud is not enough to move it to a light field, because
 * the cloud's legibility in dark mode comes from *additive* blending: hundreds
 * of dim overlapping quads summing into a luminous body. Additive blending
 * against a near-white background is a no-op — every fragment saturates the
 * already-bright framebuffer and the specimen disappears completely. So light
 * mode switches the cloud to the `sorted` path, which is alpha blending with
 * depth writes and was already a first-class mode in `PointCloudConfig`.
 *
 * That swap is the substantive adaptation; the mesh light intensities below are
 * a consequence of it. `ambientLight` is tinted with `cloud`, which is much
 * darker in light mode, so the same intensity would leave the surface almost
 * black against its background.
 */
/**
 * Illuminant colours for the mesh's three lights.
 *
 * NOT theme values, which is the correction they represent. These were
 * previously `PALETTE.ink` (key) and `PALETTE.cloud` (ambient and rim), and
 * that only ever worked by coincidence: in the dark theme `ink` happens to be
 * a warm bone white, which is a plausible key light. Resolve the same token in
 * the light theme and the key light becomes #101410 — a black lamp, which
 * emits nothing and would have left the finished plant lit by ambient alone.
 *
 * A key light is warm white because it is a lamp, not because the type is
 * bone-coloured. The two were never the same fact. Theme adapts the
 * *intensities* below, where the real difference lives.
 */
export const ILLUMINANTS = {
  /** Warm white key. */
  key: '#eae8e1',
  /** Sage ambient and rim — the palette's cool neutral, read as bounce. */
  fill: '#96a79b',
} as const

/** Resting value, and the value at full `finalPlant` weight. */
export type IntensityRamp = readonly [rest: number, final: number]

export interface SceneTuning {
  /** `additive` sums into the frame; `sorted` alpha-blends and writes depth. */
  depthMode: 'additive' | 'sorted'
  /** Linear gain on the cloud's emitted colour. */
  brightness: number
  /**
   * Base colour for the reconstructed surface, or `null` to use the GLB's own.
   *
   * The supplied mesh is authored at `#adc89e` — 21% saturation, 70% lightness.
   * That is a deliberate choice for a near-black frame, where a pale material is
   * the only lit thing in view and reads as a plant catching light. On warm
   * off-white it is the failure the whole light theme has to answer for: the
   * surface is the largest green object on the page and it sits four percent
   * of a saturation step away from the background it is drawn on.
   *
   * No lighting change fixes this. Scaling irradiance scales luminance and
   * leaves the ratio between the channels alone, so a dim #adc89e is a grey-
   * green rather than a deep one — chroma this low has to be authored, not lit.
   *
   * Dark is `null` rather than a copy of `#adc89e`, so it keeps whatever the
   * asset ships and stays correct if the specimen is ever swapped.
   */
  foliage: string | null
  ambientIntensity: number
  keyIntensity: IntensityRamp
  rimIntensity: IntensityRamp
}

export const SCENE_TUNING: Record<Theme, SceneTuning> = {
  light: {
    depthMode: 'sorted',
    // Below 1, and this is the only lever that reaches the specimen itself.
    //
    // The 240k-point cloud is vertex-coloured — the shader takes the `USE_COLOR`
    // branch and `uTint` is never read — so `palette.cloud` does not tint the
    // plant. Retuning the palette makes the wireframe, the tie points, the rig
    // and the annotations richer and leaves the largest green object on the page
    // exactly as washed out as it was. This is what fixes that one.
    //
    // A gain, not a colour: it scales the scan's own linear RGB, so hue and
    // relative chroma survive untouched and nothing is being recoloured. What
    // changes is where the alpha-blended composite lands. On `sorted` every
    // point arrives at partial alpha, so what the reader sees is the sample
    // colour mixed toward the background — and here the background is near
    // white, so that mix is a bleach. Darkening the source before the blend
    // widens the gap the blend then closes. Above 1 it would do the opposite,
    // which is why the dark theme's 1 is not transferable.
    //
    // 0.85 is bounded by the mid-canopy: much below it the interior samples,
    // already dimmed by the depth fade, go to near-black and the cloud reads as
    // a silhouette rather than as volume.
    brightness: 0.85,
    // Same move as the tokens, applied to the asset: hold the hue, spend the
    // lightness on chroma. The GLB's #adc89e sits at hue 99°, which is also
    // where `accent` sits — the specimen and the measurement colour were
    // authored from one family and that relationship is worth keeping, so only
    // saturation (21%→51%) and lightness (70%→40%) move.
    //
    // Deeper than it should look, on purpose. The key reaches 1.25 by the final
    // stage, so a lit face renders around #81c15e while faces carrying only the
    // 0.34 ambient stay in the shadow this base describes. Authoring the base at
    // the colour the plant should *appear* would blow the lit side out to a
    // pastel and flatten the form — the light has to have somewhere to go.
    foliage: '#5c8a43',
    ambientIntensity: 0.34,
    // Lower at both ends than dark, which is the opposite of the intuition.
    // The dark theme ramps the key to 2.1 to make the finished plant glow out
    // of a near-black frame; run that same ramp against an off-white frame and
    // the foliage clips to white, so the specimen dissolves into the page at
    // exactly the moment it is supposed to be most resolved. On light the plant
    // reads by being *darker* than its background, so the key only has to model
    // the form.
    keyIntensity: [0.45, 1.25],
    // The dark theme's rim separates the surface from the void. On a light
    // field the background does that unaided and a bright rim reads as a halo.
    rimIntensity: [0.12, 0.35],
  },
  dark: {
    depthMode: 'additive',
    brightness: 1,
    foliage: null,
    ambientIntensity: 0.32,
    keyIntensity: [0.55, 2.1],
    rimIntensity: [0.25, 0.85],
  },
}
