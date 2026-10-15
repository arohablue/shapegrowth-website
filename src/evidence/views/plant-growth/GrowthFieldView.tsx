import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { BufferAttribute, BufferGeometry, Color, NormalBlending, Vector3 } from 'three'
import { useProgressContext } from '@/progress/ProgressContext'
import { useTheme } from '@/theme/ThemeContext'
import type { Theme } from '@/theme/palette'
import { DEFAULT_SPECIMEN, loadManifest, loadSpecimen, specimenById } from './manifest'
import type { PlantGrowthManifest, SpecimenArrays, SpecimenBounds, SpecimenRecord } from './manifest'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * TWO SCANS AND THE FIELDS BETWEEN THEM, TURNED BY HAND
 * ────────────────────────────────────────────────────────────────────────────
 * The whole of offering 02. Five representations of one registration — the two
 * scans, the warped source over the target, the displacement field, and the
 * Jacobian determinant — drawn from the arrays `loadSpecimen` reads out of
 * `M05.bin`. Nothing here is generated, interpolated for effect, or stood in
 * for. If an array is not in the file it is not on screen.
 *
 *
 * ONE INSTANCE, SIX SLOTS, A `beat` EACH
 * ──────────────────────────────────────
 * All six plates of the offering are filled by this component — see the note
 * over `GROWTH_FIELD_VIEW` in `registry.ts` and `isContinuous` in
 * `Offerings.tsx`. The stage mounts it once and changes its `beat` as the reader
 * scrolls, so the sequence is one view being asked five questions in turn and
 * then handed over:
 *
 *   source → target → registered → displacement → deformation → explore
 *
 * The first five are narrated. The beat names the representation, the rail is
 * not drawn, and the camera is the narration's. `explore` is the plate as it was
 * before the sequence existed: the rail appears, and the reader chooses.
 *
 * Nothing is unmounted between those steps and nothing is reloaded. The GL
 * context, the specimen's arrays and the camera's orbit are the same objects at
 * beat six that they were at beat one, which is what makes the hand-off at the
 * end a hand-off rather than a cut.
 *
 * Four specimens are reachable, and they are the four the exporter wrote point
 * arrays for. The manifest studied fourteen plants; the other ten exist only as
 * summary statistics and are not listed, because a selector entry that cannot
 * be opened is a promise the page cannot keep. Nothing here filters that list —
 * `manifest.specimens` IS the list, and the decision about what is usable was
 * made by the thing that produced the files.
 *
 *
 * THE LABEL AND THE ARRAYS CANNOT DISAGREE
 * ────────────────────────────────────────
 * The one invariant the selector has to hold. `shown` is a single object
 * carrying a record and the arrays fetched for that record together, so every
 * number, name, date and caveat on screen is read from one load. The reader's
 * pick lives separately in `selected`, and until its bytes arrive it changes
 * nothing but the `<select>` and a pending line that names both specimens.
 *
 * The consequence is deliberate: choosing T02 leaves M05 on screen for as long
 * as T02 takes to read, rather than blanking the frame. A plate that empties
 * itself on every click is worse at comparison than one that holds the last
 * good figure, and comparison is what four specimens are for. The same holds
 * for a failed read — the previous specimen stays, and the failure is reported
 * beside it rather than in place of it.
 *
 * The camera deliberately does NOT reset on a change. Every specimen is
 * normalised into the same frame, so the orbit stays valid across a switch, and
 * holding it is what lets a reader put two registrations at the same angle.
 *
 *
 * THE CAMERA IS THE DENSE CLOUD'S, AND SO ARE ITS RULES
 * ────────────────────────────────────────────────────
 * `views/DenseCloud.tsx` is the precedent and this follows it deliberately
 * rather than inventing a second interaction model for the same page. A
 * separate `<Canvas>` root with its own camera, so there is nothing to compete
 * with the scroll scene's `CameraRig` over; an orbit held in a ref and written
 * by `useFrame`, so turning the model costs zero React renders; plain wheel
 * never listened for, so the page scroll always belongs to the reader. Read
 * that file's header for the full argument — it is not restated here.
 *
 * What the beats add is a second writer of that orbit, and the rule that keeps
 * the two from fighting is that there is only ever one of them at a time:
 *
 *   NARRATED, UNTOUCHED — the beat's framing owns the camera. It is eased
 *   toward, never jumped to, and the five framings are one continuous turn
 *   around the plant, so scrolling the column walks around it and scrolling
 *   back walks back. Pointer input is ignored; a drag on a phone is the page
 *   scroll the reader meant it to be.
 *
 *   EXPLORE, UNTOUCHED — nothing is eased toward. The camera is left exactly
 *   where the narration put it and the slow idle turn takes over, which is the
 *   plate saying it can be turned without moving it anywhere the reader did not
 *   expect.
 *
 *   TOUCHED — the reader's, permanently and everywhere. `orbit.idle` is cleared
 *   on the first pointer down and never set again, so scrolling back up to a
 *   narrated beat does not reclaim the camera. A view that snatched the angle
 *   back from someone who had just set it would be the two controllers
 *   fighting, which is the one outcome this arrangement exists to rule out.
 *
 * `active` is the other addition and predates the beats: the plate draws only
 * while it is the one on the stage.
 *
 *
 * WHAT THE SCANNER'S FRAME IS, AND WHY EVERY ARRAY IS ROTATED
 * ──────────────────────────────────────────────────────────
 * Pheno4D's coordinates are **z up**, with the ground near z = 0 and a large
 * fixed offset on x and y — M05's y sits around −800. Three's world is y up and
 * its camera orbits the origin. So every position is centred on the bounding
 * box, scaled by its diagonal and rotated a quarter turn about x; every vector
 * gets the rotation and the scale but not the translation, because a difference
 * between two points has no origin to move.
 *
 * The check that the rotation is the right way round is in the data rather than
 * in the look of it: between M05's two scans the cloud's top rises 23.15 scan
 * units on axis 2 and goes nowhere on axis 1. A plant grows up.
 *
 *
 * WHAT A READER CAN AND CANNOT TAKE FROM THIS PLATE
 * ────────────────────────────────────────────────
 * The displacement field is the estimated motion between two scans. It is not
 * growth — it carries bending, drooping, rotation and registration error in the
 * same vectors — and the legend says so in the exporter's own words whenever
 * that field is on screen. det J is a cautious proxy for local volumetric
 * deformation of an estimated map, read qualitatively, and the three bands it
 * is drawn in are kept apart on purpose: a determinant at or below zero means
 * the map folds there and carries no readable expansion at all, so it is given
 * a colour that is not on the scale rather than being clipped onto the end of
 * it. M05 has none and T02 has eighty, and the selector reaches both — which is
 * the point of shipping the study's worst registration alongside its best.
 *
 * Every length on this plate is in `scan units`. The dataset states no unit and
 * the manifest declines to infer one; see its `unit_evidence`.
 */

/* ── the model in the frame ──────────────────────────────────────────────── */

/**
 * The normalised length of the specimen's bounding diagonal.
 *
 * Normalising by the diagonal rather than by height frames every specimen at a
 * comparable size whatever its proportions, which is what makes one camera
 * serve all four — M06's cloud is a different shape from M05's and T02 is a
 * tomato, and an orbit tuned to one must not lose the others off the top of the
 * frame. It is also why the camera survives a specimen change untouched.
 *
 * It costs the relative-size signal between specimens: two plants rendered at
 * the same apparent size are not the same size. Nothing on this plate claims
 * they are, and the alternative — a shared absolute scale — would frame the
 * smallest specimen as a speck to keep the largest in shot.
 *
 * 4 rather than 1 only so the camera distances below read as distances rather
 * than as fractions.
 */
const SCENE_DIAGONAL = 4

/**
 * The orbit's limits.
 *
 * M05's bounding box normalises to 2.83 tall, and at `FOV` 34° a radius of r
 * shows 2·r·tan(17°) of height — so the whole plant fits from about r = 4.7 and
 * `HOME` at 5.8 puts it at ~80% of the frame. Vertical is the binding axis at
 * 16:9, as it is for the dense cloud: the widest the box gets under yaw is 2.47,
 * which needs only r = 2.3.
 *
 * `RADIUS_MIN` is well inside the fit distance on purpose and is the one number
 * here that is not about framing. A displacement field is read by following
 * individual vectors, and at 3,000 points over a maize plant the reader has to
 * be able to get in among them; 2.6 is about as close as the orbit can come
 * before the near clip starts eating the canopy.
 */
const RADIUS_MIN = 2.6
const RADIUS_MAX = 14
const PITCH_MIN = -0.45
const PITCH_MAX = 1.2
const FOV = 34
const HOME = { yaw: 0.35, pitch: 0.18, radius: 5.8 }

/**
 * One arrow press, in the units the pointer path already uses.
 *
 * A drag turns 0.008 rad per pixel and pitches at 0.004, so these are a 12px
 * and an 18px nudge — small enough to aim with and large enough that getting
 * round the far side does not take a hundred presses. `KEY_ZOOM` is a ratio
 * because `radius` is scaled rather than offset everywhere else; 1.12 walks the
 * full 2.6–14 range in about fifteen presses.
 */
const KEY_YAW = 0.1
const KEY_PITCH = 0.07
const KEY_ZOOM = 1.12

/** Preallocated. The frame loop does not allocate. */
const ORIGIN = new Vector3(0, 0, 0)

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

interface Orbit {
  yaw: number
  pitch: number
  radius: number
  /** Residual angular velocity after a drag, in radians per second. */
  spin: number
  /** Cleared the first time the reader touches it. */
  idle: boolean
}

interface SceneFrame {
  readonly cx: number
  readonly cy: number
  readonly cz: number
  readonly scale: number
}

function frameOf(b: SpecimenBounds): SceneFrame {
  return { cx: b.centre[0], cy: b.centre[1], cz: b.centre[2], scale: SCENE_DIAGONAL / b.diagonal }
}

/** Scanner frame (z up, offset, scan units) → three's world (y up, centred). */
function positionsToScene(data: Float32Array, f: SceneFrame): Float32Array {
  const n = data.length / 3
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    out[i * 3] = (data[i * 3]! - f.cx) * f.scale
    out[i * 3 + 1] = (data[i * 3 + 2]! - f.cz) * f.scale
    out[i * 3 + 2] = -(data[i * 3 + 1]! - f.cy) * f.scale
  }
  return out
}

/**
 * The same rotation and scale, without the translation.
 *
 * A displacement is a difference between two positions, so centring it would
 * add the box centre to every vector and turn a 9-unit median motion into an
 * 800-unit one pointing at the scanner's origin.
 */
function vectorsToScene(data: Float32Array, f: SceneFrame): Float32Array {
  const n = data.length / 3
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    out[i * 3] = data[i * 3]! * f.scale
    out[i * 3 + 1] = data[i * 3 + 2]! * f.scale
    out[i * 3 + 2] = -data[i * 3 + 1]! * f.scale
  }
  return out
}

/* ── the five representations ────────────────────────────────────────────── */

type Mode = 'source' | 'target' | 'registered' | 'displacement' | 'deformation'

/**
 * The control labels, and the one place the plate's vocabulary is written.
 *
 * `DAY t` and `DAY t+1` keep their lowercase t — it is a variable, and the rail
 * is uppercased by default, which would set it as a second constant beside DAY.
 * `.plate__control--literal` is what exempts them.
 */
const MODES: readonly { readonly id: Mode; readonly label: string }[] = [
  { id: 'source', label: 'Day t' },
  { id: 'target', label: 'Day t+1' },
  { id: 'registered', label: 'Registered' },
  { id: 'displacement', label: 'Displacement' },
  { id: 'deformation', label: 'Deformation' },
]

/**
 * What a slot can ask this view for: one of the five representations, or the
 * whole plate with its controls.
 *
 * The strings are the registry's `beat` values and this is the vocabulary's one
 * definition — `Mode` is reused rather than paralleled, so a representation
 * cannot exist on the rail and be unreachable from the sequence, or the reverse.
 */
type Beat = Mode | 'explore'

/**
 * The beat a slot asked for, or `explore` for anything else.
 *
 * `undefined` reaches here from every other `component` slot on the page, and an
 * unrecognised string from a registry that has been edited past this file. Both
 * land on the full plate, which is this view's own default and what it was
 * before the sequence existed: the reader gets every representation through the
 * rail. The alternative — rendering nothing for a beat nobody here knows — would
 * turn a typo into an empty frame on a page that otherwise still works.
 */
function beatOf(beat: string | undefined): Beat {
  return MODES.some((m) => m.id === beat) ? (beat as Mode) : 'explore'
}

/**
 * Where the camera stands for each narrated beat.
 *
 * One continuous turn, left to right, from `HOME` to a little past a quarter of
 * the way round — so the five steps are the reader walking around one plant
 * rather than five cuts to five viewpoints. Scrolling back walks back.
 *
 * DAY t and DAY t+1 share a framing exactly, and that is the one entry here that
 * is a claim rather than a staging decision. The two clouds are a day apart and
 * the whole question is what moved between them; turning the camera at the same
 * moment would put the reader's own parallax into the comparison and make a
 * change of viewpoint look like a change in the plant.
 *
 * DISPLACEMENT comes in to 5.0 — a field is read by following individual
 * vectors — and DEFORMATION lifts the pitch to look down into the canopy, which
 * is where the determinant's two bands separate most visibly. Both stay well
 * inside the orbit's own limits, so nothing the narration does puts the camera
 * somewhere the reader could not have put it themselves.
 */
const BEAT_FRAMING: Record<Mode, { yaw: number; pitch: number; radius: number }> = {
  source: { yaw: HOME.yaw, pitch: HOME.pitch, radius: HOME.radius },
  target: { yaw: HOME.yaw, pitch: HOME.pitch, radius: HOME.radius },
  registered: { yaw: 0.95, pitch: 0.16, radius: 5.5 },
  displacement: { yaw: 1.55, pitch: 0.2, radius: 5.0 },
  deformation: { yaw: 2.15, pitch: 0.34, radius: 5.4 },
}

/**
 * Display density for the vector field, as a stride over the source index.
 *
 * Deterministic and not sampled: every n-th point of the array in its stored
 * order, so the same reader sees the same field twice and two readers at
 * different densities are looking at nested subsets rather than at two
 * different fields. The full 3,000 vectors stay in `arrays.displacement`
 * whatever this is set to — nothing here discards computed data.
 *
 * At 3,000 points none of these is a performance decision. A third of a maize
 * plant's worth of arrows is simply more legible than all of it.
 */
const DENSITIES: readonly { readonly label: string; readonly stride: number }[] = [
  { label: '1/4', stride: 4 },
  { label: '1/2', stride: 2 },
  { label: 'All', stride: 1 },
]

/**
 * Multipliers for the drawn length of a displacement vector.
 *
 * ×1 is true length in the normalised frame — a vector drawn exactly as long as
 * the motion it represents. The others are legibility aids and the rail labels
 * them as such, because a field drawn at ×4 looks like a plant moving four
 * times as far and there is nothing in the picture to say otherwise.
 */
const VECTOR_SCALES: readonly number[] = [1, 2, 4]

/* ── colour ──────────────────────────────────────────────────────────────── */

/**
 * The two scans never swap colours between modes.
 *
 * `day t` material is the deep leaf green the page already uses for a point
 * cloud and `day t+1` is the brighter chartreuse it uses for measurement, in
 * both themes. That holds across all five modes — the warped cloud in
 * REGISTERED is drawn in the day-t colour because it *is* the day-t cloud,
 * carried forward — so the reader learns the pair once rather than per mode.
 */
const SCAN_COLOURS: Record<Theme, { src: string; tgt: string; vectorBase: string; vectorTip: string }> = {
  light: { src: '#2f6b41', tgt: '#6f9b22', vectorBase: '#9bb08c', vectorTip: '#2f6b41' },
  dark: { src: '#96a79b', tgt: '#9bd07f', vectorBase: '#3f5a46', vectorTip: '#9bd07f' },
}

/**
 * The determinant scale: amber below one, green above it, and a colour that is
 * not on the scale at all below zero.
 *
 * Divergent about 1 — no volume change — rather than a single ramp, because the
 * question det J answers is directional and a one-ended ramp makes compression
 * read as "less expansion" rather than as its opposite. Amber for compression
 * is the botanical reading and, more usefully, it is the one hue that stays
 * separable from the page's greens at every weight in both themes.
 *
 * `invalid` is deliberately outside the family. Non-positive det J is not a
 * small number on this scale, it is the absence of a reading — the estimated
 * map folds there — and a dark green or a deep amber would place it at one end
 * of a scale it does not belong to. The crimson says "not a value".
 */
const DETJ_RAMP: Record<Theme, { compress: string; neutral: string; expand: string; invalid: string }> = {
  light: { compress: '#9a6410', neutral: '#8e8c7a', expand: '#2f6b41', invalid: '#a01f3c' },
  dark: { compress: '#d9922e', neutral: '#7c7f72', expand: '#9bd07f', invalid: '#ff5d7a' },
}

/**
 * One RGB triple per point, from its determinant.
 *
 * The valid ramp saturates at the specimen's own p95 so that a handful of
 * extreme points cannot flatten the rest of the field into one tone — and the
 * legend prints that endpoint, because a saturating ramp that does not say
 * where it saturates is a ramp that invents a ceiling.
 *
 * Saturating the COLOUR of a valid reading is not the same act as clipping an
 * invalid one, which is what the manifest forbids: every point above p95 is
 * still drawn, still in the expanding band, and still counted there. Points at
 * or below zero never enter the ramp.
 *
 * `Color` stores linear-light after parsing an sRGB hex, so these components go
 * straight into a vertex-colour attribute without a second conversion, and the
 * interpolation between stops happens in linear space where it belongs.
 */
function deformationColours(detJ: Float32Array, p95: number, theme: Theme): Float32Array {
  const ramp = DETJ_RAMP[theme]
  const compress = new Color(ramp.compress)
  const neutral = new Color(ramp.neutral)
  const expand = new Color(ramp.expand)
  const invalid = new Color(ramp.invalid)
  const c = new Color()

  const top = Math.max(p95, 1 + 1e-6)
  const out = new Float32Array(detJ.length * 3)
  for (let i = 0; i < detJ.length; i++) {
    const d = detJ[i]!
    if (d <= 0) c.copy(invalid)
    else if (d <= 1) c.copy(compress).lerp(neutral, d)
    else c.copy(neutral).lerp(expand, Math.min((d - 1) / (top - 1), 1))
    out[i * 3] = c.r
    out[i * 3 + 1] = c.g
    out[i * 3 + 2] = c.b
  }
  return out
}

/* ── geometry ────────────────────────────────────────────────────────────── */

/**
 * A `BufferGeometry` that disposes itself.
 *
 * The cleanup runs when `build` changes as well as on unmount, so switching
 * theme or vector scale releases the buffer it replaced instead of leaking one
 * per interaction. That matters more than it looks: the determinant colours and
 * the whole vector field are rebuilt on every one of those changes.
 */
function useDisposableGeometry(build: () => BufferGeometry | null, deps: unknown[]): BufferGeometry | null {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(build, deps)
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry
}

function pointsGeometry(positions: Float32Array, colours?: Float32Array): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  if (colours) g.setAttribute('color', new BufferAttribute(colours, 3))
  return g
}

/**
 * The displacement field as ONE `LineSegments` — two vertices per vector, one
 * draw call, no object per arrow.
 *
 * Each segment runs from a source point to that point plus its own displacement
 * times the display scale. The pairing is the file's: vector i belongs to point
 * i, because the exporter wrote them that way. No correspondence is computed
 * here and none is implied beyond the one the registration estimated.
 *
 * Colour carries direction, which is the job an arrowhead would otherwise do.
 * Each segment fades from a near-background tone at its base to the measurement
 * green at its tip, so the field reads as flowing away from the day-t surface
 * without 3,000 cones in the scene.
 */
function vectorGeometry(
  src: Float32Array,
  displacement: Float32Array,
  stride: number,
  scale: number,
  theme: Theme,
): BufferGeometry {
  const n = src.length / 3
  const count = Math.ceil(n / stride)
  const positions = new Float32Array(count * 6)
  const colours = new Float32Array(count * 6)

  const base = new Color(SCAN_COLOURS[theme].vectorBase)
  const tip = new Color(SCAN_COLOURS[theme].vectorTip)

  let w = 0
  for (let i = 0; i < n; i += stride) {
    const x = src[i * 3]!
    const y = src[i * 3 + 1]!
    const z = src[i * 3 + 2]!
    const o = w * 6
    positions[o] = x
    positions[o + 1] = y
    positions[o + 2] = z
    positions[o + 3] = x + displacement[i * 3]! * scale
    positions[o + 4] = y + displacement[i * 3 + 1]! * scale
    positions[o + 5] = z + displacement[i * 3 + 2]! * scale
    colours[o] = base.r
    colours[o + 1] = base.g
    colours[o + 2] = base.b
    colours[o + 3] = tip.r
    colours[o + 4] = tip.g
    colours[o + 5] = tip.b
    w++
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(positions, 3))
  g.setAttribute('color', new BufferAttribute(colours, 3))
  return g
}

/* ── the scene ───────────────────────────────────────────────────────────── */

interface SceneArrays {
  readonly src: Float32Array
  readonly tgt: Float32Array
  readonly warped: Float32Array
  readonly displacement: Float32Array
  readonly detJ: Float32Array
}

/**
 * Point sizes, in world units of the normalised frame.
 *
 * Larger than the dense cloud's 0.022 because this is a thirtieth of its
 * sample count: 3,000 points spread over a plant 2.8 tall are about five and a
 * half times further apart, and at the cloud's size they read as scattered dust
 * rather than as leaves.
 *
 * `registered` draws the warped cloud smaller than the target it is being
 * compared against, so the two are legible where they coincide — which, after a
 * registration that cut the surface distance by 81%, is nearly everywhere. Two
 * clouds at one size in the same place is a single speckled cloud.
 */
const POINT_SIZE = 0.045
const POINT_SIZE_WARPED = 0.032
const POINT_SIZE_TARGET = 0.052

function Field({ mode, scene, record, theme, stride, vectorScale }: {
  mode: Mode
  scene: SceneArrays
  record: SpecimenRecord
  theme: Theme
  stride: number
  vectorScale: number
}) {
  const colours = SCAN_COLOURS[theme]

  const srcGeometry = useDisposableGeometry(() => pointsGeometry(scene.src), [scene.src])
  const tgtGeometry = useDisposableGeometry(() => pointsGeometry(scene.tgt), [scene.tgt])
  const warpedGeometry = useDisposableGeometry(() => pointsGeometry(scene.warped), [scene.warped])

  const detJGeometry = useDisposableGeometry(
    () =>
      mode === 'deformation'
        ? pointsGeometry(scene.src, deformationColours(scene.detJ, record.diagnostics.detJ.p95, theme))
        : null,
    [mode, scene.src, scene.detJ, record.diagnostics.detJ.p95, theme],
  )

  const vectors = useDisposableGeometry(
    () =>
      mode === 'displacement'
        ? vectorGeometry(scene.src, scene.displacement, stride, vectorScale, theme)
        : null,
    [mode, scene.src, scene.displacement, stride, vectorScale, theme],
  )

  return (
    <>
      {/* DAY t, alone. */}
      {mode === 'source' && srcGeometry ? (
        <points geometry={srcGeometry} frustumCulled={false}>
          <pointsMaterial size={POINT_SIZE} sizeAttenuation color={colours.src} depthWrite depthTest blending={NormalBlending} />
        </points>
      ) : null}

      {/* DAY t+1, alone. */}
      {mode === 'target' && tgtGeometry ? (
        <points geometry={tgtGeometry} frustumCulled={false}>
          <pointsMaterial size={POINT_SIZE} sizeAttenuation color={colours.tgt} depthWrite depthTest blending={NormalBlending} />
        </points>
      ) : null}

      {/* REGISTERED: the warped source laid over the target it was fitted to. */}
      {mode === 'registered' && tgtGeometry && warpedGeometry ? (
        <>
          <points geometry={tgtGeometry} frustumCulled={false}>
            <pointsMaterial size={POINT_SIZE_TARGET} sizeAttenuation color={colours.tgt} depthWrite depthTest blending={NormalBlending} />
          </points>
          <points geometry={warpedGeometry} frustumCulled={false}>
            <pointsMaterial size={POINT_SIZE_WARPED} sizeAttenuation color={colours.src} depthWrite depthTest blending={NormalBlending} />
          </points>
        </>
      ) : null}

      {/* DISPLACEMENT: the day-t surface, dimmed, with its own vectors on it.
          The cloud stays so the field has a plant to be read against — the
          vectors alone are a shape in space with no surface to attach to. */}
      {mode === 'displacement' && srcGeometry && vectors ? (
        <>
          <points geometry={srcGeometry} frustumCulled={false}>
            <pointsMaterial
              size={POINT_SIZE * 0.72}
              sizeAttenuation
              color={colours.src}
              opacity={0.55}
              transparent
              depthWrite={false}
              depthTest
              blending={NormalBlending}
            />
          </points>
          <lineSegments geometry={vectors} frustumCulled={false}>
            <lineBasicMaterial vertexColors depthTest depthWrite={false} transparent opacity={0.92} blending={NormalBlending} />
          </lineSegments>
        </>
      ) : null}

      {/* DEFORMATION: the day-t positions, each carrying its own determinant. */}
      {mode === 'deformation' && detJGeometry ? (
        <points geometry={detJGeometry} frustumCulled={false}>
          <pointsMaterial size={POINT_SIZE} sizeAttenuation vertexColors depthWrite depthTest blending={NormalBlending} />
        </points>
      ) : null}
    </>
  )
}

/**
 * Drives the camera from the orbit ref. Never calls `setState`.
 *
 * Three writers and exactly one of them per frame; the header argues the rule,
 * this is where it is enforced. `framing` is non-null only on a narrated beat,
 * and every branch is also gated on `o.idle` — the moment the reader touches the
 * model, the first two stop existing for the rest of the page's life.
 *
 * The ease is frame-rate independent (`1 - e^(-k·dt)` rather than a fixed
 * fraction), so a 120Hz display does not arrive twice as fast as a 60Hz one, and
 * it is asymptotic — there is no arrival, no snap at the end and nothing to
 * interrupt if the beat changes mid-way. Scrolling back up simply changes which
 * point it is heading toward.
 *
 * Under reduced motion the easing is skipped and the framing is taken whole. The
 * stage is unstacked in that mode anyway and shows the last step, so this only
 * matters if a narrated beat is somehow reached: the reader gets the right
 * viewpoint without anything moving to get there.
 */
function Rig({ orbit, framing, reducedMotion }: {
  orbit: React.RefObject<Orbit>
  framing: { yaw: number; pitch: number; radius: number } | null
  reducedMotion: boolean
}) {
  const camera = useThree((s) => s.camera)

  useFrame((_, delta) => {
    const o = orbit.current
    const dt = Math.min(delta, 0.05)

    if (o.idle && framing) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-2.4 * dt)
      o.yaw += (framing.yaw - o.yaw) * k
      o.pitch += (framing.pitch - o.pitch) * k
      o.radius += (framing.radius - o.radius) * k
      o.spin = 0
    } else if (o.idle && !reducedMotion) {
      o.yaw += 0.12 * dt
    } else if (o.spin !== 0) {
      o.yaw += o.spin * dt
      o.spin *= Math.exp(-6 * dt)
      if (Math.abs(o.spin) < 0.002) o.spin = 0
    }

    camera.position.set(
      Math.sin(o.yaw) * Math.cos(o.pitch) * o.radius,
      Math.sin(o.pitch) * o.radius,
      Math.cos(o.yaw) * Math.cos(o.pitch) * o.radius,
    )
    camera.lookAt(ORIGIN)
  })

  return null
}

/* ── data ────────────────────────────────────────────────────────────────── */

/**
 * One specimen's record and its arrays, from one fetch.
 *
 * They travel together and are replaced together. This is the whole mechanism
 * behind the rule that the label can never describe someone else's data: there
 * is no moment at which `record` has been updated and `arrays` has not, because
 * there is no assignment that could create one.
 */
interface Shown {
  readonly manifest: PlantGrowthManifest
  readonly record: SpecimenRecord
  readonly arrays: SpecimenArrays
}

interface SpecimenState {
  /** What is on screen, or `null` before the first specimen has ever arrived. */
  readonly shown: Shown | null
  /** A specimen being read that is not on screen yet. */
  readonly reading: string | null
  /** The last read that failed, and which specimen it was for. */
  readonly failure: { readonly id: string; readonly message: string } | null
}

/**
 * Fetches the manifest and the selected specimen's arrays, once the plate is
 * near the viewport.
 *
 * Gated on proximity and not on `active`: the manifest is shared across the
 * offering and each binary is 120 kB, so pre-warming costs a rounding error and
 * spares the reader a visible gap at the moment the plate takes the stage.
 *
 * `loadedRef` is what stops a scroll past the plate from refetching: `near`
 * flips on the way out and back in, and without the guard each pass would
 * rebuild every geometry in the scene for bytes it already had. It holds the id
 * actually on screen, so it is cleared on failure — leaving a retry available
 * by picking another specimen and coming back.
 */
function useSpecimen(near: boolean, selected: string): SpecimenState {
  const [state, setState] = useState<SpecimenState>({ shown: null, reading: null, failure: null })
  const loadedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!near || loadedRef.current === selected) return
    let cancelled = false

    setState((s) => ({ ...s, reading: selected, failure: null }))

    void (async () => {
      try {
        const manifest = await loadManifest()
        const record = specimenById(manifest, selected)
        const arrays = await loadSpecimen(record)
        if (cancelled) return
        loadedRef.current = selected
        setState({ shown: { manifest, record, arrays }, reading: null, failure: null })
      } catch (err) {
        if (cancelled) return
        loadedRef.current = null
        // `shown` is carried, not cleared. A failed switch should cost the
        // reader the specimen they asked for, not the one they were looking at.
        setState((s) => ({
          shown: s.shown,
          reading: null,
          failure: { id: selected, message: err instanceof Error ? err.message : String(err) },
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [near, selected])

  return state
}

/* ── the legend ──────────────────────────────────────────────────────────── */

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

/**
 * The exporter's own caveat for the mode on screen, or nothing.
 *
 * Found by its opening words rather than by index, so reordering `caveats` in
 * the manifest cannot silently put the determinant's warning under the
 * displacement field. A rewrite that changes the opening returns `null`, which
 * drops the line rather than printing the wrong one.
 *
 * This is the obligation the manifest's own header states — that a view built
 * on it puts the caveats on screen rather than beside the code — honoured one
 * mode at a time. All four are in `manifest.caveats` whatever is showing.
 */
function caveatFor(mode: Mode, caveats: readonly string[]): string | null {
  const find = (prefix: string) => caveats.find((c) => c.startsWith(prefix)) ?? null
  if (mode === 'displacement') return find('Displacement is the estimated motion')
  if (mode === 'deformation') return find('det J describes')
  if (mode === 'registered') return find('Point correspondence')
  return null
}

function Legend({ hostRef, mode, record, manifest, theme, vectorScale, drawn, reading, failure }: {
  /** Measured by the view, which gives the scene the band below it on mobile. */
  hostRef: RefObject<HTMLDivElement | null>
  mode: Mode
  record: SpecimenRecord
  manifest: PlantGrowthManifest
  theme: Theme
  vectorScale: number
  drawn: number
  /** A specimen being read that is not this one, named rather than spun. */
  reading: string | null
  failure: { readonly id: string; readonly message: string } | null
}) {
  const d = record.diagnostics
  const units = manifest.units
  const caveat = caveatFor(mode, manifest.caveats)
  // Straight off the ramp the points are drawn from, rather than transcribed
  // into the stylesheet. A swatch that can disagree with the scale it is
  // labelling is worse than no swatch.
  const ramp = DETJ_RAMP[theme]

  // Both of these name a specimen that is NOT the one being drawn, so they are
  // resolved against the manifest rather than against `record`. `nameOf` falls
  // back to the bare id, which is the only sane answer for an id the manifest
  // does not have — and the only way to reach one is a stale `selected`.
  const nameOf = (id: string) => manifest.specimens.find((s) => s.id === id)?.label ?? id

  return (
    <div ref={hostRef} className="growth-legend">
      {/* The specimen on screen, named from the same object the points came
          from. Always present and never mode-dependent: it is the answer to
          "what am I looking at", and the selector above cannot be that answer
          because the selector shows what was asked for.

          One line, and it has to stay one line. At 375px this block is capped
          at 174px and every wrapped line is 19px of plant. `one day apart` and
          `per scan` were both restating what the two dates and the word
          `points` already say, and they cost a second line to do it. Nothing
          measured left this line — the specimen, the interval and the point
          count are all still here. */}
      <p className="growth-legend__line">
        {record.label} · {record.interval.from} → {record.interval.to} · {d.n_points} points
      </p>

      {reading ? (
        <p className="growth-legend__pending">Reading {nameOf(reading)}…</p>
      ) : null}

      {failure ? (
        <p className="growth-legend__pending growth-legend__pending--error">
          {nameOf(failure.id)} could not be read, so {record.label} is still showing.{' '}
          {failure.message}
        </p>
      ) : null}

      <p className="growth-legend__line">
        {mode === 'source' ? `Day t — ${record.interval.from}` : null}
        {mode === 'target' ? `Day t+1 — ${record.interval.to}` : null}
        {mode === 'registered' ? 'Warped day t drawn over day t+1' : null}
        {mode === 'displacement'
          ? `Estimated motion · median ${d.displacement.median.toFixed(1)}, p95 ${d.displacement.p95.toFixed(1)}, max ${d.displacement.max.toFixed(1)} ${units}`
          : null}
        {mode === 'deformation'
          ? `det J · ramp saturates at p95 ${d.detJ.p95.toFixed(2)}`
          : null}
        {/* The folded count rides whichever line is already on screen rather
            than holding one of its own. It must appear in every mode — a count
            that shows up only when it is non-zero cannot tell the reader the
            check was made and passed — but DEFORMATION already states it in the
            `≤ 0 invalid` swatch and REGISTERED states it on the fit line below,
            and printing it three times in one block is how the block got to be
            the largest object on the figure. */}
        {mode !== 'deformation' && mode !== 'registered'
          ? ` · ${d.detJ.count_non_positive}/${d.n_points} folded`
          : null}
      </p>

      {mode === 'displacement' ? (
        <p className="growth-legend__line">
          {drawn} of {d.n_points} vectors drawn at ×{vectorScale}
          {vectorScale === 1 ? ' (true length)' : ' (visual scale — not measured length)'}
        </p>
      ) : null}

      {mode === 'deformation' ? (
        <ul className="growth-swatches">
          <li className="growth-swatch">
            <span className="growth-swatch__chip" style={{ backgroundColor: ramp.expand }} />
            {'>'} 1 expanding · {pct(d.detJ.frac_expanding)}
          </li>
          <li className="growth-swatch">
            <span className="growth-swatch__chip" style={{ backgroundColor: ramp.compress }} />0 to 1
            compressing · {pct(d.detJ.frac_compressing)}
          </li>
          {/* Always drawn, including M05's zero. A band that disappears when it
              is empty cannot tell the reader the check was made and passed —
              it just looks like a two-band scale. */}
          <li className="growth-swatch">
            <span className="growth-swatch__chip" style={{ backgroundColor: ramp.invalid }} />≤ 0
            invalid, map folds · {d.detJ.count_non_positive} points
          </li>
        </ul>
      ) : null}

      {/* How far this registration is to be trusted. REGISTERED only now, and
          the cut is worth recording because this line used to carry four
          numbers in all five modes.

          It carried the displacement mean and the det J median as well, and
          both were already on screen wherever they meant anything: the mode
          line reports displacement median, p95 and max in DISPLACEMENT, and det
          J p95 with three swatches of distribution in DEFORMATION. In the other
          three modes they described a field that was not being drawn. So they
          were a second, blunter copy of the statistic beside them, costing two
          wrapped lines of a block that at 375px is capped at 174px — the single
          largest text object on a figure whose brief is that the plant is the
          primary thing. Removing a duplicate is not the same as removing a
          caveat, and nothing here is now stated in only one place.

          The surface distance before and after is the whole claim the
          registration makes, so it belongs to the mode that draws that claim.
          In the other four it was describing something not on screen, at the
          cost of two wrapped lines — and two wrapped lines here is the
          difference between a legend that fits its cap and one that has to be
          scrolled.

          The folded count is NOT mode-dependent and has not become so. It is
          the one number that decides whether any of the rest can be read, so it
          appears in all five modes including the zero: here in REGISTERED, in
          the `≤ 0 invalid` swatch in DEFORMATION, and appended to the mode line
          in the other three. A count that appears only when it is non-zero
          cannot tell the reader the check was made and passed.

          BELOW the mode block rather than above it, which it used to be. The
          order here decides what a reader sees without scrolling, and on T02 in
          DEFORMATION the old order pushed the `≤ 0 invalid` swatch 24px under
          the fold. That is the one row that must not need a gesture to reach:
          it is the key to the crimson already on screen.

          The reading order is better for it independently of the arithmetic:
          what am I looking at, what do the colours mean, how far to trust it. */}
      {mode === 'registered' ? (
        <p className="growth-legend__line">
          Surface distance {record.fit.chamfer_before.toFixed(2)} →{' '}
          {record.fit.chamfer_after.toFixed(2)} {units} · {d.detJ.count_non_positive}/{d.n_points}{' '}
          folded
        </p>
      ) : null}

      {/* The exporter's own sentence about THIS specimen, in the exporter's own
          words, in every mode. Three of the four carry one and M05 does not,
          which is the shape of the thing: a note exists where the registration
          needs qualifying, so its absence is a statement too.

          Flagged, not hidden, when the quality is `problematic` — T02 is in the
          selector precisely so a reader can meet a failed registration, and a
          failure case that arrives unannounced is a trap rather than a lesson.
          The quality comes off the record, so nothing here decides which
          specimens are sound; the exporter already did, from the fit. */}
      {record.note ? (
        <p
          className={
            record.quality === 'problematic'
              ? 'growth-legend__caveat growth-legend__caveat--flag'
              : 'growth-legend__caveat'
          }
        >
          {record.quality === 'problematic' ? <strong>Problematic registration. </strong> : null}
          {record.note}
        </p>
      ) : null}

      {caveat ? <p className="growth-legend__caveat">{caveat}</p> : null}
    </div>
  )
}

/* ── the plate ───────────────────────────────────────────────────────────── */

export default function GrowthFieldView({
  active = false,
  beat,
}: {
  active?: boolean
  beat?: string
}) {
  const { reducedMotion } = useProgressContext()
  const { theme } = useTheme()
  const hostRef = useRef<HTMLDivElement>(null)
  const orbit = useRef<Orbit>({ ...HOME, spin: 0, idle: true })

  const step = beatOf(beat)
  /** Whether the plate is the reader's: the rail, the pointer and the wheel. */
  const interactive = step === 'explore'

  /** What the reader has asked for. What is on screen is `shown.record`. */
  const [selected, setSelected] = useState(DEFAULT_SPECIMEN)
  const [mode, setMode] = useState<Mode>('source')
  const [strideIndex, setStrideIndex] = useState(1)
  const [scaleIndex, setScaleIndex] = useState(0)

  // A narrated beat writes its representation into the same state the rail
  // drives, rather than being carried beside it. Two reasons, and the second is
  // the one that matters: the rail would otherwise need a second source of
  // truth, and the reader arriving at EXPLORE would find the plate snapped back
  // to DAY t rather than holding the determinant map the step before it left
  // them on. Arriving at a plate already showing what you were just reading is
  // what makes the rail read as a continuation rather than a reset.
  //
  // The cost is that a choice made on EXPLORE does not survive scrolling up into
  // the narration and back down — the beats overwrite it on the way through,
  // which is correct, because each of those steps has a paragraph beside it
  // naming what is on screen. The camera is the opposite case and is handled the
  // opposite way: see `idle` in the header.
  //
  // Set during render, which is React's documented way to derive state from a
  // prop that changed: it re-renders immediately with the new value, before the
  // browser paints, so no frame is ever drawn in the previous beat's mode.
  if (step !== 'explore' && mode !== step) setMode(step)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef(0)

  const [near, setNear] = useState(false)
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof IntersectionObserver !== 'function') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setNear(e?.isIntersecting ?? false), {
      rootMargin: '200px',
    })
    io.observe(host)
    return () => io.disconnect()
  }, [])

  const { shown, reading, failure } = useSpecimen(near, selected)

  const chromeRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const [inset, setInset] = useState<readonly [top: number, bottom: number]>([0, 0])

  /**
   * Gives the scene the band the chrome is not using, when there is no gutter.
   *
   * On a wide frame this does nothing and returns `[0, 0]`: the rail sits in a
   * 26% side gutter the specimen never reaches into, and the legend is in a
   * corner, so a full-bleed canvas is correct and cheaper. Below the
   * stylesheet's breakpoint the rail wraps to the bottom edge and the legend to
   * the top, and at 375px those two together are most of the frame — in
   * DISPLACEMENT mode they leave about 13px of it, which is to say the figure
   * is entirely behind its own apparatus. Shrinking the drawing surface is the
   * only answer that does not involve moving the plant somewhere it would be
   * cropped instead.
   *
   * The rail is classified by its own measured width rather than by a media
   * query repeated here — wider than half the frame means the stylesheet has
   * wrapped it — which is the test `measurePlate` already uses for the leaf
   * plates, and for the same reason: it stays correct if the breakpoint moves.
   *
   * A narrated beat has no rail, so this returns `[0, 0]` at every width and the
   * canvas is full-bleed. That is the right answer rather than a gap in the
   * mechanism: the only thing over the figure there is the legend, which is
   * capped at a third of the frame and sits over the clear band above the
   * canopy. The band this reserves is for the apparatus the reader is given, and
   * on those five steps they are given none.
   *
   * Both elements are observed, not just the host. The rail grows by a row when
   * DISPLACEMENT adds its two pickers and the legend grows by a paragraph with
   * every mode, so a resize of the frame is not the only way this band moves.
   */
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver !== 'function') return

    const measure = () => {
      const box = host.getBoundingClientRect()
      const rail = chromeRef.current?.getBoundingClientRect()
      const next: readonly [number, number] =
        !rail || rail.width <= box.width * 0.5
          ? [0, 0]
          : [
              Math.max(0, Math.round((legendRef.current?.getBoundingClientRect().bottom ?? box.top) - box.top)),
              Math.max(0, Math.round(box.bottom - rail.top)),
            ]
      setInset((prev) => (prev[0] === next[0] && prev[1] === next[1] ? prev : next))
    }

    const ro = new ResizeObserver(measure)
    ro.observe(host)
    if (chromeRef.current) ro.observe(chromeRef.current)
    if (legendRef.current) ro.observe(legendRef.current)
    measure()
    return () => ro.disconnect()
  }, [active, shown, interactive])

  /**
   * `position` and `width` as well as the two insets, because all four are
   * fighting an inline style. R3F writes `position: relative; width: 100%;
   * height: 100%` onto its own container element, and a stylesheet cannot reach
   * past that without `!important` on each — so the override is passed as a
   * style, which R3F merges after its defaults. The canvas inside keeps filling
   * that container, which is what `.growth-view canvas` already says.
   */
  const canvasStyle = useMemo(
    () =>
      inset[0] === 0 && inset[1] === 0
        ? undefined
        : { position: 'absolute' as const, top: inset[0], bottom: inset[1], left: 0, right: 0, width: 'auto', height: 'auto' },
    [inset],
  )

  // `ctrlKey` and nothing else; a plain wheel scrolls the page. See DenseCloud.
  // Not listened for at all on a narrated beat, where the camera is the
  // narration's — see the header.
  useEffect(() => {
    const host = hostRef.current
    if (!host || !interactive) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const o = orbit.current
      o.idle = false
      o.radius = clamp(o.radius * Math.exp(e.deltaY * 0.01), RADIUS_MIN, RADIUS_MAX)
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [interactive])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return

    // A press on the rail is not a camera gesture, and letting it reach the
    // capture below does not merely add a stray drag — it eats the click.
    //
    // This handler is on the host and the rail is inside the host, so a press
    // on a mode label bubbles here. `setPointerCapture` then retargets every
    // later event for that pointer to the host, which means `pointerup` fires
    // on the host rather than on the label. `click` is dispatched at the
    // nearest common ancestor of the down and up targets, so it fires on the
    // host too, and the label never sees one. The radio never flips. The same
    // went for the specimen select, both pickers and Reset: nine controls that
    // looked and hovered like controls, and did nothing to a mouse or a finger.
    //
    // Only `.growth-chrome` is excluded, not the legend. The legend holds no
    // controls, so no click there has anywhere to go, and a horizontal drag
    // across it is documented to keep turning the model — see the stylesheet.
    if ((e.target as Element).closest('.growth-chrome')) return

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    orbit.current.idle = false
    orbit.current.spin = 0
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const o = orbit.current

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      if (pinch.current > 0 && d > 0) {
        o.radius = clamp(o.radius * (pinch.current / d), RADIUS_MIN, RADIUS_MAX)
      }
      pinch.current = d
      return
    }

    o.yaw -= dx * 0.008
    o.pitch = clamp(o.pitch + dy * 0.004, PITCH_MIN, PITCH_MAX)
    o.spin = -dx * 0.008 * 60
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = 0
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  /**
   * Back to the opening shot, and then it holds there.
   *
   * `idle` stays false, so the slow drift does not resume. The reader pressed
   * Reset to get a known view, and a view that starts turning again on its own
   * is not one.
   */
  const reset = () => {
    const o = orbit.current
    o.yaw = HOME.yaw
    o.pitch = HOME.pitch
    o.radius = HOME.radius
    o.spin = 0
    o.idle = false
  }

  /**
   * The same model, from a keyboard.
   *
   * Until this existed the nine controls around the plate were all reachable by
   * tab and the thing they were controlling was not: the model could only be
   * turned by dragging it. A reader who cannot use a pointer could choose a
   * specimen and a mode and then only ever see the one viewpoint the narration
   * left behind — which, in DISPLACEMENT and DEFORMATION, is a field seen from
   * a single angle, and the occlusion in a 3000-point cloud is most of the
   * reason to turn it at all.
   *
   * It writes to the same `orbit` ref the pointer path writes to, so it is the
   * same single camera owner rather than a second one, and it clears `idle` for
   * the same reason a drag does: the reader has taken the camera, and the
   * narration's framing and the slow drift both stop competing for it. Pressing
   * an arrow is a deliberate act, exactly like putting a finger down.
   *
   * `spin` is set to zero rather than given momentum. The pointer path flings
   * because a drag has a velocity to carry over; a keypress has none, and
   * inventing one would make each press overshoot the step it asked for.
   *
   * The steps are the pointer's own numbers: a drag turns 0.008 rad/px, so 0.1
   * is about a 12px nudge, and twelve presses take the model right around. The
   * page must not scroll underneath while that happens, hence `preventDefault`
   * — but only on the keys actually handled, so Tab still leaves.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    // A keystroke meant for the selector or one of the buttons is theirs.
    if (e.target !== e.currentTarget) return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const o = orbit.current
    let handled = true

    switch (e.key) {
      case 'ArrowLeft':
        o.yaw -= KEY_YAW
        break
      case 'ArrowRight':
        o.yaw += KEY_YAW
        break
      case 'ArrowUp':
        o.pitch = clamp(o.pitch + KEY_PITCH, PITCH_MIN, PITCH_MAX)
        break
      case 'ArrowDown':
        o.pitch = clamp(o.pitch - KEY_PITCH, PITCH_MIN, PITCH_MAX)
        break
      case '+':
      case '=':
        o.radius = clamp(o.radius / KEY_ZOOM, RADIUS_MIN, RADIUS_MAX)
        break
      case '-':
      case '_':
        o.radius = clamp(o.radius * KEY_ZOOM, RADIUS_MIN, RADIUS_MAX)
        break
      case 'Home':
      case '0':
        reset()
        break
      default:
        handled = false
    }

    if (!handled) return
    e.preventDefault()
    o.spin = 0
    o.idle = false
  }

  /**
   * The scene arrays, rebuilt per specimen.
   *
   * Keyed on `shown`, which changes only when a whole load lands, so the five
   * arrays here are always one specimen's. Each one is normalised by that
   * specimen's OWN bounds — carrying M05's centre and scale onto T02 would put
   * a tomato off-frame and shrink it by the ratio of their diagonals.
   *
   * The arrays this replaces are released by the garbage collector; the GPU
   * buffers built from them are released by `useDisposableGeometry`, whose
   * cleanup runs when the geometry changes and not only on unmount. That is the
   * whole of the disposal story for a specimen change — there is no cache
   * holding the previous specimen alive, by design.
   */
  const scene = useMemo<SceneArrays | null>(() => {
    if (!shown) return null
    const f = frameOf(shown.record.diagnostics.bounds)
    return {
      src: positionsToScene(shown.arrays.src, f),
      tgt: positionsToScene(shown.arrays.tgt, f),
      warped: positionsToScene(shown.arrays.warped, f),
      displacement: vectorsToScene(shown.arrays.displacement, f),
      detJ: shown.arrays.detJ,
    }
  }, [shown])

  const camera = useMemo(
    () => ({
      fov: FOV,
      near: 0.1,
      far: 60,
      position: [0, HOME.pitch * HOME.radius, HOME.radius] as [number, number, number],
    }),
    [],
  )

  const stride = DENSITIES[strideIndex]!.stride
  const vectorScale = VECTOR_SCALES[scaleIndex]!
  const drawn = shown ? Math.ceil(shown.record.diagnostics.n_points / stride) : 0

  return (
    <div
      ref={hostRef}
      className="plate__view growth-view"
      // The grab cursor is a promise, and on a narrated beat it is one this
      // plate does not keep. The stylesheet reads this rather than the beat
      // itself, which is none of its business.
      data-interactive={interactive}
      // In the tab order only where there is something to drive. On a narrated
      // beat the camera belongs to the narration and every key below is a
      // no-op, so a stop here would be a focus step that does nothing.
      tabIndex={interactive ? 0 : -1}
      // No `role`. `application` would pass the arrows through on a screen
      // reader, which is what the handler wants, but it also takes the legend
      // inside this element out of browse mode — and the legend is where the
      // caveats are. The keys are advertised instead, and the figure stays
      // readable.
      aria-label={
        interactive
          ? 'Plant growth field, 3D. Arrow keys turn the model, plus and minus zoom, 0 returns to the opening view.'
          : undefined
      }
      aria-keyshortcuts={interactive ? 'ArrowLeft ArrowRight ArrowUp ArrowDown Plus Minus 0' : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        // Drawn only while this is the plate on the stage AND the stage is
        // somewhere near the window. `active` alone used to be enough, when
        // this was one of five plates and four of them sat at `opacity: 0`; it
        // is not any more, because the offering now mounts one instance that is
        // active at every beat, and a render loop two sections above the reader
        // is work nobody can see either. `near` is the same 200px observer that
        // decides when to read the bytes.
        frameloop={active && near && shown ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        dpr={[1, 2]}
        camera={camera}
        style={canvasStyle}
      >
        <Rig
          orbit={orbit}
          framing={step === 'explore' ? null : BEAT_FRAMING[step]}
          reducedMotion={reducedMotion}
        />
        {shown && scene ? (
          <Field
            mode={mode}
            scene={scene}
            record={shown.record}
            theme={theme}
            stride={stride}
            vectorScale={vectorScale}
          />
        ) : null}
      </Canvas>

      {/* Both of these cover the whole frame, so they are strictly for the case
          where there is nothing to cover — before the first specimen lands.
          Once one has, a later failure is reported in the legend beside the
          figure that is still standing, not over it. */}
      {!shown && !failure ? <p className="growth-status">Reading the scans…</p> : null}
      {!shown && failure ? (
        <p className="growth-status growth-status--error">
          The growth fields could not be read. {failure.message}
        </p>
      ) : null}

      {/* The rail belongs to the last beat alone. On the five before it the
          representation is the step's and the specimen is the study's default,
          so a rail there would offer the reader a way to contradict the
          paragraph they are reading — and nine controls would be in the tab
          order six times over, on what is one figure.

          The legend is not part of that bargain and renders on every beat. It
          carries the specimen's identity, the fit, and the exporter's own caveat
          for whatever is on screen, and those are least optional exactly where
          the reader has no controls to interrogate the figure with. */}
      {active && shown ? (
        <>
          {interactive ? (
            <div ref={chromeRef} className="plate__chrome growth-chrome">
              {/* The specimen, first, because it governs everything below it.
                  A `<select>` and not a row of buttons, which is what the rest of
                  this rail is made of: four ids across a 216px column would have
                  to be bare `M05 M04 M06 T02`, and the species would be left to
                  a letter. An option can say `Maize M05` and `Tomato T02 —
                  problematic`, which is the whole of what a reader needs before
                  clicking. It is also the one control here whose list is not
                  fixed by this file, and a select grows without a layout.

                  `manifest.specimens` is used unfiltered and on purpose. The
                  exporter already decided which plants have usable arrays — ten
                  of the fourteen are simply not in it — so a filter here would
                  be a second, quieter opinion about the same question. */}
              <label className="plate__control plate__control--select growth-chrome__specimen">
                <span className="plate__vh">Specimen</span>
                <select
                  value={selected}
                  onChange={(event) => setSelected(event.currentTarget.value)}
                >
                  {shown.manifest.specimens.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                      {s.quality === 'problematic' ? ' — problematic' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="plate__stages">
                <legend className="plate__vh">Representation</legend>
                {MODES.map((m) => (
                  <label
                    key={m.id}
                    className="plate__control plate__control--literal"
                    aria-pressed={mode === m.id}
                  >
                    <input
                      className="plate__vh"
                      type="radio"
                      name="growth-mode"
                      value={m.id}
                      checked={mode === m.id}
                      onChange={() => setMode(m.id)}
                    />
                    {m.label}
                  </label>
                ))}
              </fieldset>

              {mode === 'displacement' ? (
                <>
                  <fieldset className="plate__stages growth-chrome__row">
                    <legend className="plate__vh">Vector density</legend>
                    {DENSITIES.map((d, i) => (
                      <label key={d.label} className="plate__control" aria-pressed={strideIndex === i}>
                        <input
                          className="plate__vh"
                          type="radio"
                          name="growth-density"
                          checked={strideIndex === i}
                          onChange={() => setStrideIndex(i)}
                        />
                        {d.label}
                      </label>
                    ))}
                  </fieldset>

                  <fieldset className="plate__stages growth-chrome__row">
                    {/* Named as display scaling in the control's own accessible
                        name, not only in the legend under it. */}
                    <legend className="plate__vh">Vector display scale, visual only</legend>
                    {VECTOR_SCALES.map((s, i) => (
                      <label key={s} className="plate__control" aria-pressed={scaleIndex === i}>
                        <input
                          className="plate__vh"
                          type="radio"
                          name="growth-scale"
                          checked={scaleIndex === i}
                          onChange={() => setScaleIndex(i)}
                        />
                        ×{s}
                      </label>
                    ))}
                  </fieldset>
                </>
              ) : null}

              <button type="button" className="plate__control" onClick={reset}>
                Reset view
              </button>
            </div>
          ) : null}

          <Legend
            hostRef={legendRef}
            mode={mode}
            record={shown.record}
            manifest={shown.manifest}
            theme={theme}
            vectorScale={vectorScale}
            drawn={drawn}
            // Named only while they are about a specimen other than the one on
            // screen. The first read of all has nothing to sit beside, and is
            // reported by the full-frame status above instead.
            reading={reading && reading !== shown.record.id ? reading : null}
            failure={failure && failure.id !== shown.record.id ? failure : null}
          />
        </>
      ) : null}
    </div>
  )
}
