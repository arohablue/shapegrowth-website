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
var clamp = (v, min, max) => v < min ? min : v > max ? max : v;
var lerp = (a, b, t) => a + (b - a) * t;
var invLerp = (a, b, v) => {
  const span = b - a;
  return span === 0 ? 0 : (v - a) / span;
};
var smoothstep = (edge0, edge1, v) => {
  const t = clamp01(invLerp(edge0, edge1, v));
  return t * t * (3 - 2 * t);
};
var damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export {
  EASINGS,
  clamp,
  clamp01,
  damp,
  easeInOutCubic,
  easeInOutQuint,
  easeOutCubic,
  easeOutExpo,
  invLerp,
  lerp,
  linear,
  smoothstep
};
