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
  onStop?: (agentId: string) => void
  stopping?: boolean
}

export default function AgentCard({ agent, latestOutput, currentTask, isSelected, onClick, onStop, stopping }: AgentCardProps) {
  const selectedClass = agentSelectedClass(agent.role)

  return (
    <div
      className={`w-full min-h-[88px] text-left border rounded-xl p-3 sm:p-4 cursor-pointer transition-colors duration-150 ${isSelected ? selectedClass : `bg-neutral-900 ${agentBorderClass(agent.status)} hover:bg-neutral-850 hover:border-neutral-700`}`}
      onClick={() => onClick(agent.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(agent.id) }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold uppercase select-none flex-none ${agentAvatarClass(agent.role)}`}>
          {getInitials(agent.role)}
        </div>
        <span className="text-sm font-semibold text-neutral-100 flex-1">{agent.specialization || agent.role}</span>
        <StatusBadge status={agent.status} />
        {agent.status === 'working' && onStop && (
          <button
            onClick={e => { e.stopPropagation(); onStop(agent.id) }}
            disabled={stopping}
            className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950 border border-red-900/50 transition-colors disabled:opacity-50"
            title="Stop agent"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {stopping ? 'Stopping…' : 'Stop'}
          </button>
        )}
      </div>
      {agent.status === 'working' && currentTask && (
        <p className="text-xs text-neutral-400 mb-1 truncate">{currentTask}</p>
      )}
      {latestOutput ? (
        <p className="text-xs text-neutral-500 font-mono line-clamp-2">{latestOutput}</p>
      ) : (
        <p className="text-xs text-neutral-600 italic">No output yet...</p>
      )}
    </div>
  )
}
