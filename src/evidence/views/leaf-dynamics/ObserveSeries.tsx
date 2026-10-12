import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgressContext } from '@/progress/ProgressContext'
import { fitRect } from './geometry'
import type { Rect } from './geometry'
import { POSTER_URL, formatElapsed, formatStamp, formatStampShort, loadManifest } from './manifest'
import type { LeafDynamicsManifest, SheetTier } from './manifest'
import { PlateChrome, measurePlate, useNearViewport, useResizeRedraw } from './PlateChrome'
import type { PlateLayout } from './PlateChrome'
import { drawFrame, loadTier, pickTier } from './sheets'
import type { Decoded } from './sheets'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * PLATE 01 — OBSERVE
 * ────────────────────────────────────────────────────────────────────────────
 * 97 real frames of Col-0/rep_21, 2022-08-09 17:03 to 2022-09-02 17:05, with
 * their real timestamps. Play, scrub, or set the first frame beside the current
 * one.
 *
 * The timestamps are the reason this plate is interactive at all. The cadence
 * is nominally six-hourly and actually irregular — 17:03, 23:03, 06:03, 12:05 —
 * and that irregularity is a property of the experiment, not noise to be
 * smoothed. A strip of five stills cannot show it; a scrubber that prints the
 * stamp of the frame under it can.
 *
 * NO setState DURING PLAYBACK OR SCRUBBING
 * ────────────────────────────────────────
 * React state here is three values, each changed only by a click: `playing`,
 * `compare`, and the loaded data. The current frame is a ref. A playing plate
 * does three imperative writes per tick — one `drawImage`, one `textContent`,
 * one `input.value` — and renders zero times. Putting the frame index in state
 * would re-render six mounted plates at 6 fps for the entire time the reader is
 * looking at one of them.
 *
 * WHY COMPARE IS ONE BUTTON AND NOT THREE
 * ───────────────────────────────────────
 * The brief asks for an early-vs-late comparison. The designed version of that
 * was Set A / Set B / Compare — three controls to express a thing the reader
 * almost always wants one way round. This shows frame 0 against whatever the
 * scrubber is on, which is the same comparison with a third of the chrome, and
 * leaves the rail short enough to fit the side gutter without covering pixels.
 */

const FPS = 6

interface Loaded {
  readonly manifest: LeafDynamicsManifest
  readonly tier: SheetTier
  readonly sheets: readonly Decoded[]
}

/** One panel, or two side by side with a hairline of space between them. */
function panelRects(layout: PlateLayout, compare: boolean, srcW: number, srcH: number): Rect[] {
  if (!compare) return [layout.rect]
  const gap = Math.max(2, Math.round(layout.availW * 0.012))
  const half = (layout.availW - gap) / 2
  const a = fitRect(half, layout.availH, srcW, srcH)
  const b = fitRect(half, layout.availH, srcW, srcH)
  return [a, { ...b, x: b.x + half + gap }]
}

export default function ObserveSeries({ active = false }: { active?: boolean }) {
  const { reducedMotion } = useProgressContext()

  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<HTMLInputElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)

  const dataRef = useRef<Loaded | null>(null)
  const layoutRef = useRef<PlateLayout | null>(null)
  const frameRef = useRef(0)
  const compareRef = useRef(false)
  const playingRef = useRef(false)

  const live = useNearViewport(hostRef)
  const [data, setData] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  // Under reduced motion the plate's resting state is the comparison, because
  // it is the only one of the two that says something without moving.
  const [compare, setCompare] = useState(reducedMotion)

  const draw = useCallback(() => {
    const d = dataRef.current
    const layout = layoutRef.current
    const canvas = canvasRef.current
    if (!d || !layout || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [, , srcW, srcH] = d.manifest.crop
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const rects = panelRects(layout, compareRef.current, srcW, srcH)
    if (rects.length === 2) {
      drawFrame(ctx, d.sheets, d.tier, 0, rects[0]!)
      drawFrame(ctx, d.sheets, d.tier, frameRef.current, rects[1]!)
    } else {
      drawFrame(ctx, d.sheets, d.tier, frameRef.current, rects[0]!)
    }
  }, [])

  /** The two chrome writes that happen per frame. Both imperative, both cheap. */
  const syncChrome = useCallback(() => {
    const d = dataRef.current
    if (!d) return
    const frames = d.manifest.frames
    const now = frames[frameRef.current]
    const first = frames[0]
    if (!now || !first) return

    if (readoutRef.current) {
      readoutRef.current.textContent = compareRef.current
        ? `${formatStampShort(first.t)} \u2192 ${formatStampShort(now.t)}`
        : `${formatStampShort(now.t)} \u00b7 +${formatElapsed(now.hoursFromStart)}`
    }

    const range = rangeRef.current
    if (range) {
      range.value = String(frameRef.current)
      // The scrubber carries the stamp on `aria-valuetext` rather than in a
      // live region. A live region would announce all 97 of these on a held
      // arrow key; `aria-valuetext` is read on the value the reader stopped on.
      range.setAttribute(
        'aria-valuetext',
        `Frame ${now.i + 1} of ${frames.length}, ${formatStamp(now.t)}, ${formatElapsed(
          now.hoursFromStart,
        )} after the first observation`,
      )
    }
  }, [])

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
        // Reduced motion opens on first-against-last, so the resting frame is
        // the last one. Otherwise the plate opens where the series does.
        frameRef.current = reducedMotion ? manifest.frames.length - 1 : 0
        setData(loaded)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [live, reducedMotion])

  // One effect for every discrete change: new data, or a mode toggle. Both end
  // in the same two calls, and neither happens more than once per click.
  useEffect(() => {
    compareRef.current = compare
    relayout()
    syncChrome()
  }, [compare, data, active, relayout, syncChrome])

  const awake = live && active

  useEffect(() => {
    playingRef.current = playing
    if (!playing || !awake || !data || reducedMotion) return

    let raf = 0
    let last = performance.now()
    const total = data.manifest.frames.length
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      if (now - last < 1000 / FPS) return
      last = now
      frameRef.current = (frameRef.current + 1) % total
      syncChrome()
      draw()
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, awake, data, reducedMotion, draw, syncChrome])

  const onScrub = useCallback(
    (event: { currentTarget: HTMLInputElement }) => {
      frameRef.current = Number(event.currentTarget.value)
      // Guarded, because this fires on every pixel of a drag and an unguarded
      // setState here would re-render the plate dozens of times per gesture.
      if (playingRef.current) setPlaying(false)
      syncChrome()
      draw()
    },
    [draw, syncChrome],
  )

  // A failed chunk, a failed fetch or a browser with no canvas degrades to the
  // poster — a correct static photograph of the specimen, under the accessible
  // name the registry already gives the wrapper.
  if (failed) {
    return <img className="plate__poster" src={POSTER_URL} alt="" />
  }

  const frames = data?.manifest.frames

  return (
    <div className="plate__view" ref={hostRef}>
      <canvas ref={canvasRef} />
      {!data && <img className="plate__poster" src={POSTER_URL} alt="" />}
      {frames && active && (
        <PlateChrome chromeRef={chromeRef}>
          <span className="plate__readout" ref={readoutRef} />
          {!reducedMotion && (
            <button
              type="button"
              className="plate__control"
              aria-pressed={playing}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          )}
          <button
            type="button"
            className="plate__control"
            aria-pressed={compare}
            onClick={() => setCompare((c) => !c)}
          >
            Compare
          </button>
          <input
            ref={rangeRef}
            className="plate__scrub"
            type="range"
            min={0}
            max={frames.length - 1}
            step={1}
            defaultValue={frameRef.current}
            aria-label="Observation"
            onInput={onScrub}
          />
        </PlateChrome>
      )}
    </div>
  )
}
