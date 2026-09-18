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

/**
 * How centred a given block is in the viewport, 0→1, derived from the SAME
 * global progress value as the 3D scene.
 *
 * This matters: the obvious way to fade section text in is a per-section
 * ScrollTrigger or an IntersectionObserver, but that reintroduces exactly the
 * independent, competing timelines this architecture exists to prevent. Text
 * and scene are two readouts of one number.
 */
export function blockSignedOffset(id: BlockId, state: SceneState): number {
  const range = RANGE_BY_ID.get(id)
  if (!range) return 0

  const viewportCentreVh = state.experienceProgress * SCROLLABLE_VH + 50
  const blockCentreVh = (range.startVh + range.endVh) / 2
  const falloff = range.vh / 2 + 45

  const raw = (viewportCentreVh - blockCentreVh) / falloff
  return raw < -1 ? -1 : raw > 1 ? 1 : raw
}

/** 1 when the block is dead-centre in the viewport, 0 once it is fully past. */
export function blockFocus(id: BlockId, state: SceneState): number {
  return 1 - clamp01(Math.abs(blockSignedOffset(id, state)))
}

export type BlockId = (typeof BLOCK_RANGES)[number]['id']
