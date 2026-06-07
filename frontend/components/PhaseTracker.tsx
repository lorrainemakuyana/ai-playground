'use client'

import type { SDLCPhase } from '@/types'
import { ALL_PHASES, PHASE_LABELS } from '@/lib/constants'

interface PhaseTrackerProps {
  currentPhase: SDLCPhase
}

export default function PhaseTracker({ currentPhase }: PhaseTrackerProps) {
  const currentIdx = ALL_PHASES.indexOf(currentPhase)
  const isDone = currentPhase === 'done'

  return (
    <div className="w-full flex items-center px-3 sm:px-6 bg-neutral-900 border-b border-neutral-800 overflow-x-auto">
      <div className="flex items-center w-full min-w-max py-3 sm:py-0 sm:h-16">
        {ALL_PHASES.map((phase, idx) => {
          const isCompleted = isDone || idx < currentIdx
          const isCurrent   = !isDone && idx === currentIdx
          const isUpcoming  = !isCompleted && !isCurrent

          return (
            <div key={phase} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className="w-5 h-5 flex items-center justify-center flex-none">
                  {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-400 flex items-center justify-center animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-800 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-amber-800" />
                    </div>
                  )}
                </div>

                <span className={[
                  'text-xs whitespace-nowrap hidden md:block',
                  isCompleted ? 'text-green-400 font-medium'   : '',
                  isCurrent   ? 'text-amber-300 font-semibold' : '',
                  isUpcoming  ? 'text-amber-900'               : '',
                ].join(' ')}>
                  {PHASE_LABELS[phase]}
                </span>
              </div>

              {idx < ALL_PHASES.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${isCompleted ? 'bg-green-600' : 'bg-neutral-700'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
