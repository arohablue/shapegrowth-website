import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { createSceneState, deriveSceneState } from '@/experience/deriveSceneState'
import { damp } from '@/experience/easing'
import type { Breakpoint, SceneState, StageId } from '@/experience/types'
import { ProgressContext } from './ProgressContext'
import type { FrameSubscriber, ProgressContextValue, StageSubscriber } from './ProgressContext'

gsap.registerPlugin(ScrollTrigger)

/** Higher = the scene tracks the scrollbar more tightly. ~9 keeps weight without lag. */
const DAMPING = 9
const MOBILE_QUERY = '(max-width: 767px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const readBreakpoint = (): Breakpoint =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches ? 'mobile' : 'desktop'

const readReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE ONLY SCROLL LISTENER IN THE APPLICATION
 * ────────────────────────────────────────────────────────────────────────────
 * Everything visual — DOM and WebGL alike — is downstream of the single number
 * produced here. No component may add its own ScrollTrigger, scroll handler or
 * tween. If two things ever appear to fight, the fix belongs in
 * `experience/timeline.ts`, not in a component.
 *
 * Note what this provider does NOT do: it never calls setState during scroll.
 * State lives in a ref and is fanned out imperatively. React re-renders roughly
 * six times over the whole page — once per section change.
 *
 *
 * WHY THERE ARE TWO SLOTS
 * ───────────────────────
 * `children` is the reconstruction — hero through outro — and it is the ONLY
 * thing the ScrollTrigger below measures. `trailing` is everything the document
 * continues with afterwards.
 *
 * The split exists because this trigger runs `top top` → `bottom bottom` on its
 * own element, so experienceProgress is normalised over whatever that element
 * contains. Putting new sections inside it does not append to the narrative, it
 * *rescales* it: add 500vh and SCROLLABLE_VH goes 810 → 1310, so the PHENOTYPE
 * block slides from p 0.852→1.000 down to p 0.611→0.695 while `TRACKS.phenotype`
 * stays authored at 0.85→1.00 — the measurement pass would then draw itself at
 * 1113vh, several screens into content that has nothing to do with it, and the
 * three beats would each be captioned over the wrong transformation.
 *
 * So the rule that falls out of this, and it is the important one: new content
 * goes in `trailing` and NEVER into `BLOCKS`. `BLOCKS` is the reconstruction's
 * timeline, not the page's layout. `verify-narrative.mjs` asserts the alignment
 * that this split protects.
 *
 * Nothing else had to move. Every fixed-position layer (canvas, veil, rail,
 * grain) contributes zero height, so the measured element's height is `.document`
 * either way — which is why this is a two-line change rather than a restructure.
 */
export function ProgressProvider({
  children,
  trailing,
}: {
  children: ReactNode
  trailing?: ReactNode
}) {
  const stateRef = useRef<SceneState>(createSceneState())
  const rootRef = useRef<HTMLDivElement>(null)
  const breakpointRef = useRef<Breakpoint>(readBreakpoint())
  const rawRef = useRef(0)
  const smoothedRef = useRef(0)

  const frameSubs = useRef(new Set<FrameSubscriber>())
  const stageSubs = useRef(new Set<StageSubscriber>())
  const lastStage = useRef<StageId | null>(null)

  const [reducedMotion, setReducedMotion] = useState(readReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const bpQuery = window.matchMedia(MOBILE_QUERY)
    const syncBreakpoint = () => {
      breakpointRef.current = bpQuery.matches ? 'mobile' : 'desktop'
    }
    syncBreakpoint()
    bpQuery.addEventListener('change', syncBreakpoint)

    // The trigger must be a real content element, NOT document.documentElement.
    // <html> reports clientHeight === viewport height, so 'top top' → 'bottom
    // bottom' collapses to a zero-length range and progress pins to 1 the
    // instant you scroll. This wrapper is as tall as the actual document.
    const trigger = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        rawRef.current = self.progress
      },
    })

    // Seed from the current scroll position so a reload mid-page is correct.
    rawRef.current = trigger.progress
    smoothedRef.current = trigger.progress

    const tick = (_time: number, deltaMs: number) => {
      // Clamp dt: a backgrounded tab returns a huge delta which would snap the
      // scene forward and, worse, produce a bogus velocity spike.
      const dt = Math.min(deltaMs, 50) / 1000
      const raw = rawRef.current
      const previous = smoothedRef.current

      const smoothed = reducedMotion ? raw : damp(previous, raw, DAMPING, dt)
      smoothedRef.current = smoothed

      const velocity = dt > 0 ? (smoothed - previous) / dt : 0

      const state = deriveSceneState(smoothed, raw, velocity, breakpointRef.current, stateRef.current)

      for (const fn of frameSubs.current) fn(state, dt)

      if (state.activeStage !== lastStage.current) {
        lastStage.current = state.activeStage
        for (const fn of stageSubs.current) fn(state.activeStage)
      }
    }

    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      trigger.kill()
      bpQuery.removeEventListener('change', syncBreakpoint)
    }
  }, [reducedMotion])

  const value = useMemo<ProgressContextValue>(
    () => ({
      stateRef,
      breakpointRef,
      reducedMotion,
      subscribeFrame: (fn) => {
        frameSubs.current.add(fn)
        return () => {
          frameSubs.current.delete(fn)
        }
      },
      subscribeStage: (fn) => {
        stageSubs.current.add(fn)
        return () => {
          stageSubs.current.delete(fn)
        }
      },
    }),
    [reducedMotion],
  )

  return (
    <ProgressContext.Provider value={value}>
      {/* No transform/filter/will-change on this wrapper — any of them would
          make it a containing block and break the fixed-position canvas. */}
      <div ref={rootRef}>{children}</div>
      {trailing}
    </ProgressContext.Provider>
  )
}
