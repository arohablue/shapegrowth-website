import { useRef } from 'react'
import { useSceneFrame } from '@/progress/hooks'
import type { SceneState } from '@/experience/types'

const READOUTS: Array<{ key: keyof SceneState; label: string }> = [
  { key: 'rawProgress', label: 'raw scroll' },
  { key: 'experienceProgress', label: 'experience' },
  { key: 'scanProgress', label: 'scan' },
  { key: 'pointCloudProgress', label: 'pointCloud' },
  { key: 'vertexProgress', label: 'vertex' },
  { key: 'geometryProgress', label: 'geometry' },
  { key: 'meshProgress', label: 'mesh' },
  { key: 'finalPlantProgress', label: 'finalPlant' },
  { key: 'phenotypeProgress', label: 'phenotype' },
]

export const hudEnabled = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

/**
 * Dev-only verification surface for this milestone: proves that one scroll
 * value drives five derived tracks, and that the declared crossfades in
 * timeline.ts actually overlap. Hidden unless ?debug is present.
 */
export function TimelineHUD() {
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([])
  const barRefs = useRef<Array<HTMLSpanElement | null>>([])
  const stageRef = useRef<HTMLSpanElement>(null)

  useSceneFrame((state) => {
    for (let i = 0; i < READOUTS.length; i++) {
      const v = state[READOUTS[i]!.key] as number
      const value = valueRefs.current[i]
      const bar = barRefs.current[i]
      if (value) value.textContent = v.toFixed(3)
      if (bar) bar.style.transform = `scaleX(${v.toFixed(4)})`
    }
    if (stageRef.current) stageRef.current.textContent = state.activeStage
  })

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-30 w-60 border border-ink/12 bg-void/85 p-3 font-mono text-[10px] tracking-wider text-ink/70 backdrop-blur-sm">
      <div className="mb-2 flex justify-between text-ink/40">
        <span>TIMELINE</span>
        <span ref={stageRef} />
      </div>
      {READOUTS.map((r, i) => (
        <div key={r.key as string} className="mb-1.5">
          <div className="flex justify-between">
            <span>{r.label}</span>
            <span
              ref={(el) => {
                valueRefs.current[i] = el
              }}
              className="tabular-nums"
            >
              0.000
            </span>
          </div>
          <span className="mt-0.5 block h-px w-full bg-ink/12">
            <span
              ref={(el) => {
                barRefs.current[i] = el
              }}
              className="block h-px w-full origin-left bg-accent"
              style={{ transform: 'scaleX(0)' }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}
