import type { SDLCPhase } from '@/types'

export const PHASE_LABELS: Record<SDLCPhase, string> = {
  discovery:      'Discovery',
  architecture:   'Architecture',
  implementation: 'Implementation',
  testing:        'Testing',
  sre_review:     'SRE Review',
  done:           'Done',
}

export const ALL_PHASES: SDLCPhase[] = [
  'discovery', 'architecture', 'implementation', 'testing', 'sre_review', 'done',
]
