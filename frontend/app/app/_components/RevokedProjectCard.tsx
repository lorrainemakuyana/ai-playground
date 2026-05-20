'use client'

import { useState } from 'react'
import { removeMyShare } from '@/lib/api'
import { PHASE_LABELS } from '@/lib/constants'
import type { ProjectSummary } from '@/types'
import StatusBadge from '@/components/StatusBadge'

interface Props {
  project: ProjectSummary
  onRemoved: (projectId: string) => void
}

export default function RevokedProjectCard({ project, onRemoved }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  async function handleRemove() {
    setRemoving(true)
    setError('')
    try {
      await removeMyShare(project.id)
      onRemoved(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove project')
      setRemoving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-xl flex flex-col min-h-[200px] opacity-60 cursor-not-allowed">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-neutral-500 leading-tight">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 flex-none">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800/80 text-neutral-600 border border-neutral-700/60">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Access revoked
            </span>
            <StatusBadge status={project.status} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
          <span className="text-xs text-neutral-600 font-medium">
            {PHASE_LABELS[project.current_phase] ?? project.current_phase}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-700">
          <span>{project.agent_count} agents</span>
          <span>{project.task_count} tasks</span>
          <span className="ml-auto">{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-neutral-800/60 flex items-center justify-between cursor-default">
        {error && <span className="text-xs text-red-400">{error}</span>}
        {!confirming && !error && (
          <span className="text-xs text-neutral-700">Your access to this project has been revoked.</span>
        )}
        {!confirming && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
            className="ml-auto cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors opacity-100"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Remove
          </button>
        )}
        {confirming && (
          <div className="w-full flex items-center gap-2 justify-end cursor-default">
            <span className="text-xs text-neutral-400">Remove from your list? This cannot be undone.</span>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="px-2.5 py-1 rounded text-xs font-medium text-neutral-200 bg-neutral-700 hover:bg-neutral-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {removing ? 'Removing…' : 'Yes, remove'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1 rounded text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
