'use client'

import { useState } from 'react'
import { deleteProject, unarchiveProject } from '@/lib/api'
import { PHASE_LABELS } from '@/lib/constants'
import type { ProjectSummary } from '@/types'
import StatusBadge from '@/components/StatusBadge'

interface Props {
  project: ProjectSummary
  onDeleted: (projectId: string) => void
  onUnarchived: (projectId: string) => void
}

export default function ArchivedProjectCard({ project, onDeleted, onUnarchived }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [unarchiving, setUnarchiving] = useState(false)
  const [error, setError] = useState('')

  async function handleUnarchive() {
    setUnarchiving(true)
    setError('')
    try {
      await unarchiveProject(project.id)
      onUnarchived(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive project')
      setUnarchiving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await deleteProject(project.id)
      onDeleted(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl flex flex-col min-h-[200px] opacity-75">
      <div className="block p-6 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-neutral-400 leading-tight">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 flex-none">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-500 border border-neutral-700">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8m-9 4v4m4-4v4" />
              </svg>
              Archived
            </span>
            <StatusBadge status={project.status} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
          <span className="text-xs text-neutral-600 font-medium">
            {PHASE_LABELS[project.current_phase] ?? project.current_phase}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-600">
          <span>{project.agent_count} agents</span>
          <span>{project.task_count} tasks</span>
          <span className="ml-auto">
            Archived {project.archived_at ? new Date(project.archived_at).toLocaleDateString() : ''}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-neutral-800 flex flex-col gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <span className="text-xs text-neutral-600">This project is archived and hidden from your active list.</span>
        {!confirming && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUnarchive}
              disabled={unarchiving}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition-colors disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              {unarchiving ? 'Unarchiving…' : 'Unarchive'}
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950 border border-transparent hover:border-red-900 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete permanently
            </button>
          </div>
        )}
        {confirming && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">This cannot be undone.</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2.5 py-1 rounded text-xs font-medium text-red-300 bg-red-950 hover:bg-red-900 border border-red-900 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1 rounded text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
