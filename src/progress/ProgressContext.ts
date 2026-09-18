import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { Breakpoint, SceneState, StageId } from '@/experience/types'

export type FrameSubscriber = (state: SceneState, dt: number) => void
export type StageSubscriber = (stage: StageId) => void

export interface ProgressContextValue {
  /** Live scene state. Mutated in place every frame — never put this in React state. */
  stateRef: RefObject<SceneState>
  breakpointRef: RefObject<Breakpoint>
  reducedMotion: boolean
  /** Called every frame, after the state has been derived. Returns an unsubscribe fn. */
  subscribeFrame: (fn: FrameSubscriber) => () => void
  /** Called only when the active section changes — safe to trigger React renders from. */
  subscribeStage: (fn: StageSubscriber) => () => void
}

export const ProgressContext = createContext<ProgressContextValue | null>(null)

export function useProgressContext(): ProgressContextValue {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgressContext must be used inside <ProgressProvider>')
  return ctx
}
