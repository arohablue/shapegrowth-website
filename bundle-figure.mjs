// src/evidence/figure.ts
var CATEGORY_LABEL = {
  photograph: "Photograph",
  plot: "Plot",
  micrograph: "Micrograph",
  segmentation: "Segmentation",
  "point-cloud": "Point cloud",
  mesh: "Surface mesh",
  map: "Map",
  field: "Field",
  diagram: "Diagram"
};
var ASPECT_PRESET = {
  wide: "16 / 9",
  square: "1 / 1",
  tall: "3 / 4"
};
function resolveAspect(aspect) {
  return aspect in ASPECT_PRESET ? ASPECT_PRESET[aspect] : aspect.replace("/", " / ");
}
function aspectValue(aspect) {
  const [w, h] = resolveAspect(aspect).split("/").map((n) => Number(n.trim()));
  return w / h;
}
function aspectOf(figure, source) {
  return source?.aspect ?? figure.aspect;
}
export {
  ASPECT_PRESET,
  CATEGORY_LABEL,
  aspectOf,
  aspectValue,
  resolveAspect
};
