import { useEffect, useRef, useState } from 'react'
import { BLOCK_RANGES, SCROLLABLE_VH } from '@/experience/timeline'
import { clamp01 } from '@/experience/easing'
import type { SceneState, StageId } from '@/experience/types'
import { useProgressContext } from './ProgressContext'
import type { FrameSubscriber } from './ProgressContext'

/**
 * Run a callback every frame with the derived scene state.
 * The callback should write to DOM refs directly. It must not call setState.
 */
export function useSceneFrame(fn: FrameSubscriber): void {
  const { subscribeFrame } = useProgressContext()
  const ref = useRef(fn)
  ref.current = fn

  useEffect(
    () => subscribeFrame((state, dt) => ref.current(state, dt)),
    [subscribeFrame],
  )
}

/**
 * The one place React state is allowed to track scroll — and only because it
 * changes about six times across the entire page, not sixty times a second.
 */
export function useActiveStage(): StageId {
  const { stateRef, subscribeStage } = useProgressContext()
  const [stage, setStage] = useState<StageId>(() => stateRef.current.activeStage)
  useEffect(() => subscribeStage(setStage), [subscribeStage])
  return stage
}

const RANGE_BY_ID = new Map(BLOCK_RANGES.map((r) => [r.id, r]))

/** Distance past the block's centre at which a caption is fully gone, in vh. */
const FALLOFF_PAD = 45

/**
 * Widest a crossfade is allowed to be, in vh.
 *
 * This is the one number that stops a caption's ramp scaling with its block, and
 * it exists because the page went from five ~140vh beats to three of 185, 405
 * and 120. Without it the offset is `distance / (blockVh/2 + PAD)`, so a 405vh
 * block fades over 247vh — nearly two viewports on the way in and two on the way
 * out. Between CAPTURE going quiet and 3D RECONSTRUCTION arriving that left 40vh
 * where no sentence was drawn at all, and 102vh where none was above half
 * opacity: half a screen of scroll with the page apparently unlabelled.
 *
 * It is not a hole that can be closed by moving the boundaries, which is worth
 * recording because it looks like it should be. With the ramp proportional, the
 * gap between two adjacent blocks works out to 0.17·(a + b) − 59.4 vh — a
 * function of their combined height, not of where the line between them falls.
 * Three blocks over 710vh always sum to something the pad cannot absorb; five
 * over the same 710 came to −12 and never showed one.
 *
 * So the ramp is capped instead and the block keeps the remainder as a plateau
 * at full focus. 115 is `140/2 + PAD` — the falloff the five-block layout
 * already had — which makes this a no-op for every block at or under 140vh,
 * including the outro. Only the two tall blocks see any difference, and what
 * they see is their caption holding at full strength through the middle of the
 * beat instead of spending the whole beat arriving or leaving.
 */
const FALLOFF_RAMP = 115

/**
 * How centred a given block is in the viewport, 0→1, derived from the SAME
 * global progress value as the 3D scene.
 *
 * This matters: the obvious way to fade section text in is a per-section
 * ScrollTrigger or an IntersectionObserver, but that reintroduces exactly the
 * independent, competing timelines this architecture exists to prevent. Text
 * and scene are two readouts of one number.
 *
 * Trapezoidal, not triangular — see `FALLOFF_RAMP`. `reach` is unchanged: a
 * caption is still fully gone exactly `blockVh/2 + 45` from its block's centre,
 * so the boundaries the harness asserts have not moved. What changed is that the
 * approach to that point is a fixed-width ramp rather than a slope stretched
 * across the whole block.
 */
export function blockSignedOffset(id: BlockId, state: SceneState): number {
  const range = RANGE_BY_ID.get(id)
  if (!range) return 0

  const viewportCentreVh = state.experienceProgress * SCROLLABLE_VH + 50
  const blockCentreVh = (range.startVh + range.endVh) / 2

  const reach = range.vh / 2 + FALLOFF_PAD
  const ramp = reach < FALLOFF_RAMP ? reach : FALLOFF_RAMP
  const plateau = reach - ramp

  const distance = viewportCentreVh - blockCentreVh
  const magnitude = clamp01((Math.abs(distance) - plateau) / ramp)
  return distance < 0 ? -magnitude : magnitude
}

/** 1 when the block is dead-centre in the viewport, 0 once it is fully past. */
export function blockFocus(id: BlockId, state: SceneState): number {
  return 1 - clamp01(Math.abs(blockSignedOffset(id, state)))
}

export type BlockId = (typeof BLOCK_RANGES)[number]['id']
