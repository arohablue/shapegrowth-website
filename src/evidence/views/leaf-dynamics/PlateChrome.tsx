import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { fitRect } from './geometry'
import type { Rect } from './geometry'

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE PLATE SHELL
 * ────────────────────────────────────────────────────────────────────────────
 * The control rail both interactive plates wear, plus the two measurements and
 * the one observer they both need. It is one file rather than four because all
 * of it answers the same question — *where does the chrome go, and what room is
 * left for the specimen* — and splitting that answer across files is how the
 * canvas and the stylesheet end up disagreeing about it.
 *
 * WHY THE CONTROLS ARE INSIDE THE FRAME
 * ─────────────────────────────────────
 * The plate renders nothing above it and nothing below it; that rule is the
 * whole visual argument of this page and it does not get an exception for a
 * play button. So the chrome is absolutely positioned inside
 * `.evidence__frame`, at exactly the weight `.plate__expand` already set for
 * the one other control on a plate.
 *
 * AND WHY IT NEVER COVERS THE SPECIMEN
 * ────────────────────────────────────
 * The crop is 292×287 — near square — inside an authored 16:9 frame, so the
 * image pillarboxes and ~21% of the frame's width is empty on each side. That
 * gutter is where the rail goes on a wide viewport. Below 900px the gutter is
 * too narrow for a 44px tap target, so the rail wraps to the bottom instead —
 * and `measurePlate` then hands the canvas a *shorter* box, which moves the
 * image up rather than letting the rail sit on top of it.
 *
 * That is the point of measuring the rail from the DOM rather than hard-coding
 * its size: the stylesheet decides how big the chrome is, and the canvas reads
 * the decision. A number duplicated in both places is a number that drifts.
 */

export function PlateChrome({
  chromeRef,
  children,
}: {
  chromeRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <div className="plate__chrome" ref={chromeRef}>
      {children}
    </div>
  )
}

export interface PlateLayout {
  /** CSS pixels — what the canvas element is sized to. */
  readonly cssW: number
  readonly cssH: number
  /** Device pixels — what the canvas backing store is sized to. */
  readonly pw: number
  readonly ph: number
  /**
   * The box left over once the rail has taken its share, in device pixels, with
   * its origin at the canvas origin. Exposed as well as `rect` because compare
   * mode subdivides it into two panels and cannot work backwards from a single
   * centred rectangle.
   */
  readonly availW: number
  readonly availH: number
  /** Where one specimen is drawn, in device pixels. Clear of the chrome. */
  readonly rect: Rect
}

/**
 * How much of the frame the specimen gets, once the rail has taken its share.
 *
 * The rail is classified by its own measured width: wider than half the frame
 * means the stylesheet wrapped it to the bottom, so height is what to give up;
 * otherwise it is in the side gutter and width is. One test, no media query
 * repeated in JavaScript, and it stays correct if the breakpoint moves.
 *
 * `devicePixelRatio` is capped at 2. A 3× phone would otherwise ask for a
 * backing store nine times the CSS area to upscale a 292 px tile into, which
 * is memory spent to make a JPEG's own compression artefacts sharper.
 */
export function measurePlate(
  host: HTMLElement,
  chrome: HTMLElement | null,
  srcW: number,
  srcH: number,
): PlateLayout {
  const box = host.getBoundingClientRect()
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2)
  const pw = Math.max(1, Math.round(box.width * dpr))
  const ph = Math.max(1, Math.round(box.height * dpr))

  let availW = pw
  let availH = ph
  if (chrome) {
    const rail = chrome.getBoundingClientRect()
    if (rail.width > box.width * 0.5) availH = Math.max(1, ph - Math.round(rail.height * dpr))
    else availW = Math.max(1, pw - Math.round(rail.width * dpr))
  }

  return {
    cssW: box.width,
    cssH: box.height,
    pw,
    ph,
    availW,
    availH,
    rect: fitRect(availW, availH, srcW, srcH),
  }
}

/**
 * Re-measures when either the frame or the rail changes size.
 *
 * Both are observed, not just the frame: the rail's height is what the canvas
 * subtracts, and it changes on its own when a label grows a character or the
 * buttons rewrap — a resize of the frame is not the only way the available box
 * can move.
 *
 * The callback is held in a ref so that a caller may pass an inline closure
 * without tearing down and rebuilding the observer on every render.
 */
export function useResizeRedraw(
  hostRef: RefObject<HTMLElement | null>,
  chromeRef: RefObject<HTMLElement | null>,
  onResize: () => void,
): void {
  const latest = useRef(onResize)
  latest.current = onResize

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof ResizeObserver !== 'function') {
      latest.current()
      return
    }
    const ro = new ResizeObserver(() => latest.current())
    ro.observe(host)
    if (chromeRef.current) ro.observe(chromeRef.current)
    return () => ro.disconnect()
  }, [hostRef, chromeRef])
}

/**
 * True while the plate is near the viewport.
 *
 * The same guard `DenseCloud` uses, for the same reason and with the same
 * `200px` margin: six plates are mounted at once under the sticky stage, and
 * without this all six would decode their assets the moment the page loads.
 *
 * Where there is no `IntersectionObserver` it reports `true` forever, which
 * degrades to "everything loads" rather than "nothing ever does".
 */
export function useNearViewport(hostRef: RefObject<HTMLElement | null>): boolean {
  const [live, setLive] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver !== 'function') {
      setLive(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => setLive(entry?.isIntersecting ?? false), {
      rootMargin: '200px',
    })
    io.observe(host)
    return () => io.disconnect()
  }, [hostRef])

  return live
}
