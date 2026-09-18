/**
 * Single source of colour truth, shared by CSS and WebGL.
 *
 * three's Color parses these as sRGB and converts to the linear working space
 * automatically (ColorManagement is on by default), and the fragment shader
 * converts back on output via `#include <colorspace_fragment>`. Skipping either
 * half of that round-trip is the usual reason WebGL colour fails to match CSS.
 */
export const PALETTE = {
  /** Page background. Near-black with a trace of green. */
  void: '#070908',
  /** Primary type. Warm bone, never pure white — pure white on near-black glares. */
  ink: '#EAE8E1',
  /** Resting colour of the point cloud. */
  cloud: '#96A79B',
  /** Botanical sage-chartreuse. Used sparingly: measurement, emphasis, sweep. */
  accent: '#9BD07F',
} as const
