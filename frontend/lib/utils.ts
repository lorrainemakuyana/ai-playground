import type { AgentRole, AgentStatus } from '@/types'

export function getInitials(role: string): string {
  return role.split(/[\s-]/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2)
}

export function agentBorderClass(status: AgentStatus): string {
  return status === 'working' ? 'border-primary-800 shadow-primary-glow'
       : status === 'blocked' ? 'border-amber-600'
       : status === 'done'    ? 'border-green-800'
       : 'border-neutral-800'
}

// Distinct avatar bg/text per role so agents are visually identifiable at a glance
const ROLE_COLORS: Record<AgentRole, string> = {
  'tech-lead':  'bg-violet-800  text-violet-200',
  'engineer-1': 'bg-blue-800    text-blue-200',
  'engineer-2': 'bg-blue-800    text-blue-200',
  'qa':         'bg-emerald-800 text-emerald-200',
  'sre':        'bg-orange-800  text-orange-200',
  'custom':     'bg-pink-800    text-pink-200',
}

export function agentAvatarClass(role: AgentRole): string {
  return ROLE_COLORS[role] ?? 'bg-neutral-700 text-neutral-300'
}

const ROLE_SELECTED: Record<AgentRole, string> = {
  'tech-lead':  'border-violet-500 bg-violet-950 hover:bg-violet-900',
  'engineer-1': 'border-blue-500   bg-blue-950   hover:bg-blue-900',
  'engineer-2': 'border-blue-500   bg-blue-950   hover:bg-blue-900',
  'qa':         'border-emerald-500 bg-emerald-950 hover:bg-emerald-900',
  'sre':        'border-orange-500  bg-orange-950  hover:bg-orange-900',
  'custom':     'border-pink-500    bg-pink-950    hover:bg-pink-900',
}

export function agentSelectedClass(role: AgentRole): string {
  return ROLE_SELECTED[role] ?? 'border-neutral-400 bg-neutral-800 hover:bg-neutral-750'
}
