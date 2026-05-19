'use client'

import type { Agent } from '@/types'
import { getInitials, agentBorderClass, agentAvatarClass, agentSelectedClass } from '@/lib/utils'
import StatusBadge from './StatusBadge'

interface AgentCardProps {
  agent: Agent
  latestOutput?: string
  currentTask?: string
  isSelected?: boolean
  onClick: (agentId: string) => void
}

export default function AgentCard({ agent, latestOutput, currentTask, isSelected, onClick }: AgentCardProps) {
  const selectedClass = agentSelectedClass(agent.role)

  return (
    <button
      onClick={() => onClick(agent.id)}
      className={`w-full min-h-[96px] text-left border rounded-lg p-4 cursor-pointer transition-colors duration-150 ${isSelected ? selectedClass : `bg-neutral-900 ${agentBorderClass(agent.status)} hover:bg-neutral-850 hover:border-neutral-700`}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase select-none flex-none ${agentAvatarClass(agent.role)}`}>
          {getInitials(agent.role)}
        </div>
        <span className="text-sm font-semibold text-neutral-100 flex-1">{agent.specialization || agent.role}</span>
        <StatusBadge status={agent.status} />
      </div>
      {agent.status === 'working' && currentTask && (
        <p className="text-xs text-neutral-400 mb-1 truncate">{currentTask}</p>
      )}
      {latestOutput ? (
        <p className="text-xs text-neutral-500 font-mono line-clamp-2">{latestOutput}</p>
      ) : (
        <p className="text-xs text-neutral-600 italic">No output yet...</p>
      )}
    </button>
  )
}
