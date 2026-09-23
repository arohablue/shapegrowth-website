// src/experience/easing.ts
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var invLerp = (a, b, v) => {
  const span = b - a;
  return span === 0 ? 0 : (v - a) / span;
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
var CAMERA_FOV = {
  desktop: 38,
  mobile: 52
};
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
export {
  CAMERA_FOV,
  createCameraState,
  sampleCameraSpline
};
