import type { AgentStatus, TaskStatus, ProjectStatus } from '@/types'

type Status = AgentStatus | TaskStatus | ProjectStatus

const CLASSES: Record<string, string> = {
  idle:          'bg-neutral-800 text-neutral-400',
  working:       'bg-primary-950 text-primary-400 ring-1 ring-primary-800 animate-pulse',
  blocked:       'bg-amber-950 text-amber-400',
  done:          'bg-green-950 text-green-400',
  active:        'bg-green-950 text-green-400',
  paused:        'bg-amber-950 text-amber-400',
  pending:       'bg-amber-950/60 text-amber-400',
  'in-progress': 'bg-primary-950 text-primary-400 ring-1 ring-primary-800',
  review:        'bg-cyan-950 text-cyan-400',
  failed:        'bg-red-950 text-red-400',
  cancelled:     'bg-neutral-800 text-neutral-500',
}

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CLASSES[status] ?? 'bg-neutral-800 text-neutral-400'}`}>
      {status.replace('-', ' ')}
    </span>
  )
}
