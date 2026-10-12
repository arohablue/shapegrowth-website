import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useProgressContext } from '@/progress/ProgressContext'
import { inBbox, pointInPolygon, project, rgba, tracePath, unproject } from './geometry'
import { POSTER_URL, loadManifest } from './manifest'
import type { LeafContour, LeafDynamicsManifest, LeafRecord, SheetTier } from './manifest'
import { PlateChrome, measurePlate, useNearViewport, useResizeRedraw } from './PlateChrome'
import type { PlateLayout } from './PlateChrome'
import { drawFrame, loadTier, pickTier } from './sheets'
import type { Decoded } from './sheets'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * PLATE 02 — SEGMENT
 * ────────────────────────────────────────────────────────────────────────────
 * One real frame, in three states: the photograph, the dataset's instance
 * labels over it, and one leaf isolated from the rest.
 *
 * WHAT THE COLOURS ARE
 * ────────────────────
 * They are not a palette chosen here. Every outline is filled with the exact
 * RGB that PhenoLeaf-TS assigns that instance in its label PNG — the same table
 * `leaves_unique_colours.xlsx` holds and the same one the Python plates read.
 * There is one source of identity colour on this page and it is the dataset's.
 *
 * The contours themselves are traced from those label masks and simplified; no
 * segmentation model ran here, and the plate must never imply one did.
 *
 * WHICH INSTANCES ARE SHOWN, AND WHICH ARE NOT
 * ────────────────────────────────────────────
 * Only instances that persist for at least three frames. The dataset contains
 * at least one that does not — leaf 10, a 22 px² blip present in exactly one
 * frame of 97 — and drawing it would put an organ on the plate that the plant
 * never had. That filter is stated in the plate's caption rather than applied
 * quietly, because a rule that removes data belongs in the figure's key.
 */

type Stage = 0 | 1 | 2

const STAGES: readonly { readonly value: Stage; readonly label: string }[] = [
  { value: 0, label: 'Image' },
  { value: 1, label: 'Instances' },
  { value: 2, label: 'One leaf' },
]

interface Loaded {
  readonly manifest: LeafDynamicsManifest
  readonly tier: SheetTier
  readonly sheets: readonly Decoded[]
}

export default function SegmentReveal({ active = false }: { active?: boolean }) {
  const { reducedMotion } = useProgressContext()
  // Per-instance, because two copies of this plate are mounted at once while the
  // enlarged view is open. A literal `name` would put both sets of radios in one
  // DOM group, where checking one silently unchecks the other — the controlled
  // `checked` would not correct it, since the other instance's state never
  // changed and so it never re-renders.
  const stageGroup = useId()

  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)

  const dataRef = useRef<Loaded | null>(null)
  const layoutRef = useRef<PlateLayout | null>(null)
  const stageRef = useRef<Stage>(0)
  const focusRef = useRef<number | null>(null)
  const hoverRef = useRef<number | null>(null)

  const live = useNearViewport(hostRef)
  const [data, setData] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  // Reduced motion opens on the overlay rather than the bare photograph: with
  // no transition to watch, state 0 is a plate that looks like it has not
  // loaded yet. Reduced motion means no autonomous movement, not less content.
  const [stage, setStage] = useState<Stage>(reducedMotion ? 1 : 0)
  const [focus, setFocus] = useState<number | null>(null)

  const leafById = useMemo(() => {
    const map = new Map<number, LeafRecord>()
    for (const leaf of data?.manifest.leaves ?? []) map.set(leaf.id, leaf)
    return map
  }, [data])

  const draw = useCallback(() => {
    const d = dataRef.current
    const layout = layoutRef.current
    const canvas = canvasRef.current
    if (!d || !layout || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { crop, segment } = d.manifest
    const rect = layout.rect
    const dpr = layout.pw / Math.max(1, layout.cssW)

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawFrame(ctx, d.sheets, d.tier, segment.frame, rect)

    const current = stageRef.current
    if (current === 0) return

    const focused = focusRef.current
    const hovered = hoverRef.current
    const shown: readonly LeafContour[] =
      current === 2 && focused !== null
        ? segment.contours.filter((c) => c.leaf === focused)
        : segment.contours

    // State 2 is "this one, out of all of them" — so the rest of the rosette
    // stays visible underneath a scrim rather than being erased. A leaf cut out
    // onto a blank field is a different and much weaker claim: it no longer
    // shows that the instance was separated from anything.
    if (current === 2 && focused !== null) {
      ctx.save()
      ctx.fillStyle = 'rgba(250, 250, 249, 0.82)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
      for (const contour of shown) {
        ctx.save()
        tracePath(ctx, contour.points, rect, crop)
        ctx.clip()
        drawFrame(ctx, d.sheets, d.tier, segment.frame, rect)
        ctx.restore()
      }
      ctx.restore()
    }

    ctx.lineJoin = 'round'
    for (const contour of shown) {
      const colour = leafById.get(contour.leaf)?.color ?? ([120, 120, 120] as const)
      const lit = contour.leaf === hovered || contour.leaf === focused
      tracePath(ctx, contour.points, rect, crop)
      ctx.fillStyle = rgba(colour, lit ? 0.42 : 0.2)
      ctx.fill()
      ctx.strokeStyle = rgba(colour, lit ? 1 : 0.78)
      ctx.lineWidth = (lit ? 2.2 : 1.3) * dpr
      ctx.stroke()
    }

    // Tags are drawn only where they fit. At 375px the frame is ~190px tall and
    // fifteen three-character labels over a 190px rosette is not a key, it is a
    // texture.
    if (rect.w > 420 * (dpr / 2)) {
      ctx.font = `${Math.round(10 * dpr)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const contour of shown) {
        const leaf = leafById.get(contour.leaf)
        if (!leaf) continue
        // `project`, not the arithmetic spelled out again. It was spelled out
        // here once, and when the transform was corrected the outlines moved
        // onto their leaves while the tags stayed where they were — a plate
        // labelling the right plant with the wrong names.
        const [tx, ty] = project(rect, crop, contour.centroid[0], contour.centroid[1])
        ctx.lineWidth = 3 * dpr
        ctx.strokeStyle = 'rgba(250, 250, 249, 0.9)'
        ctx.strokeText(leaf.tag, tx, ty)
        ctx.fillStyle = '#15161a'
        ctx.fillText(leaf.tag, tx, ty)
      }
    }
  }, [leafById])

  const relayout = useCallback(() => {
    const d = dataRef.current
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!d || !host || !canvas) return
    const [, , srcW, srcH] = d.manifest.crop
    const layout = measurePlate(host, chromeRef.current, srcW, srcH)
    canvas.width = layout.pw
    canvas.height = layout.ph
    canvas.style.width = `${layout.cssW}px`
    canvas.style.height = `${layout.cssH}px`
    layoutRef.current = layout
    draw()
  }, [draw])

  useResizeRedraw(hostRef, chromeRef, relayout)

  useEffect(() => {
    if (!live || dataRef.current) return
    let cancelled = false
    loadManifest()
      .then(async (manifest) => {
        const tier = pickTier(manifest.tiers)
        const sheets = await loadTier(tier)
        if (cancelled) return
        const loaded: Loaded = { manifest, tier, sheets }
        dataRef.current = loaded
        focusRef.current = manifest.segment.focus
        setFocus(manifest.segment.focus)
        setData(loaded)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [live])

  useEffect(() => {
    stageRef.current = stage
    focusRef.current = focus
    relayout()
  }, [stage, focus, data, active, relayout])

  /** Source-pixel coordinates of a pointer event, or null if it is off-image. */
  const hit = useCallback((event: { clientX: number; clientY: number }): number | null => {
    const d = dataRef.current
    const layout = layoutRef.current
    const canvas = canvasRef.current
    if (!d || !layout || !canvas) return null
    const box = canvas.getBoundingClientRect()
    const dpr = layout.pw / Math.max(1, layout.cssW)
    const [x, y] = unproject(
      layout.rect,
      d.manifest.crop,
      (event.clientX - box.left) * dpr,
      (event.clientY - box.top) * dpr,
    )
    // Last first: the exporter writes contours in leaf order, and a younger
    // leaf drawn on top of an older one should also be the one picked.
    const contours = d.manifest.segment.contours
    for (let i = contours.length - 1; i >= 0; i -= 1) {
      const contour = contours[i]!
      if (inBbox(contour.bbox, x, y) && pointInPolygon(contour.points, x, y)) return contour.leaf
    }
    return null
  }, [])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (stageRef.current === 0) return
      const found = hit(event)
      if (found === hoverRef.current) return
      hoverRef.current = found
      // Both writes are imperative. Hover is not application state — it changes
      // on every pixel of a mouse path and must never reach React.
      event.currentTarget.style.cursor = found === null ? '' : 'pointer'
      draw()
    },
    [draw, hit],
  )

  const onPointerLeave = useCallback(() => {
    if (hoverRef.current === null) return
    hoverRef.current = null
    draw()
  }, [draw])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (stageRef.current === 0) return
      const found = hit(event)
      if (found === null) return
      event.currentTarget.setPointerCapture(event.pointerId)
      setFocus(found)
      setStage(2)
    },
    [hit],
  )

  if (failed) {
    return <img className="plate__poster" src={POSTER_URL} alt="" />
  }

  const contours = data?.manifest.segment.contours
  const focusContour = contours?.find((c) => c.leaf === focus)
  const focusLeaf = focus === null ? undefined : leafById.get(focus)

  return (
    <div
      className="plate__view plate__view--pickable"
      ref={hostRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerCancel={onPointerLeave}
    >
      <canvas ref={canvasRef} />
      {!data && <img className="plate__poster" src={POSTER_URL} alt="" />}
      {contours && active && (
        <PlateChrome chromeRef={chromeRef}>
          <span className="plate__readout">
            {stage === 0
              ? `${contours.length} instances labelled`
              : stage === 1
                ? `${contours.length} instances \u00b7 click one`
                : focusContour && focusLeaf
                  ? `${focusLeaf.tag} \u00b7 ${focusContour.areaPx2} px\u00b2 \u00b7 ${focusContour.perimeterPx.toFixed(0)} px`
                  : ''}
          </span>
          <fieldset className="plate__stages">
            <legend className="plate__vh">Segmentation state</legend>
            {STAGES.map((option) => (
              <label key={option.value} className="plate__control">
                <input
                  className="plate__vh"
                  type="radio"
                  name={stageGroup}
                  checked={stage === option.value}
                  onChange={() => setStage(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label className="plate__control plate__control--select">
            <span className="plate__vh">Leaf</span>
            <select
              value={focus ?? ''}
              onChange={(event) => {
                setFocus(Number(event.currentTarget.value))
                setStage(2)
              }}
            >
              {contours.map((contour) => (
                <option key={contour.leaf} value={contour.leaf}>
                  {leafById.get(contour.leaf)?.tag ?? `L${contour.leaf}`}
                </option>
              ))}
            </select>
          </label>
        </PlateChrome>
      )}
    </div>
  )
}
