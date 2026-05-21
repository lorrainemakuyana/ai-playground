'use client'

import { useState } from 'react'
import Link from 'next/link'
import { archiveProject } from '@/lib/api'
import { PHASE_LABELS } from '@/lib/constants'
import type { ProjectSummary } from '@/types'
import StatusBadge from '@/components/StatusBadge'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Props {
  project: ProjectSummary
  onArchived: (projectId: string) => void
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
    >
      <svg className="w-3 h-3 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </a>
  )
}

export default function ActiveProjectCard({ project, onArchived }: Props) {
  const base = `${API_BASE}/projects/${project.id}`
  const isDone = project.status === 'done'
  const [confirming, setConfirming] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')

  async function handleArchive() {
    setArchiving(true)
    setArchiveError('')
    try {
      await archiveProject(project.id)
      onArchived(project.id)
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive project')
      setConfirming(false)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="group bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors duration-150 flex flex-col min-h-[200px]">
      <Link href={`/app/projects/${project.id}`} className="block p-6 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-neutral-100 group-hover:text-white transition-colors leading-tight">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 flex-none">
            {!project.is_owner && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-950 text-violet-300 border border-violet-900">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Shared
              </span>
            )}
            {project.is_owner && project.collaborator_count > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {project.collaborator_count}
              </span>
            )}
            <StatusBadge status={project.status} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          <span className="text-xs text-neutral-400 font-medium">
            {PHASE_LABELS[project.current_phase] ?? project.current_phase}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {project.agent_count} agents
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {project.task_count} tasks
          </span>
          <span className="ml-auto">{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </Link>

      <div className="px-4 py-2.5 border-t border-neutral-800 flex flex-col gap-1">
        {archiveError && (
          <span className="text-xs text-red-400">{archiveError}</span>
        )}
        <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-neutral-600 mr-1">Download:</span>
        <DownloadLink href={`${base}/docs/requirements`} label="Requirements" />
        <DownloadLink href={`${base}/docs/architecture`} label="Architecture" />
        <DownloadLink href={`${base}/docs/design`} label="Design" />
        <Link
          href={`/app/projects/${project.id}/preview`}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
        >
          <svg className="w-3 h-3 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview
        </Link>
        {isDone && (
          <a
            href={`${base}/download`}
            download
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-primary-300 bg-primary-950 hover:bg-primary-900 border border-primary-900 transition-colors"
          >
            <svg className="w-3 h-3 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            All files (.zip)
          </a>
        )}
        {project.is_owner && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8m-9 4v4m4-4v4" />
            </svg>
            Archive
          </button>
        )}
        {project.is_owner && confirming && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-neutral-400">Archive this project?</span>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="px-2 py-1 rounded text-xs font-medium text-amber-300 bg-amber-950 hover:bg-amber-900 border border-amber-900 transition-colors disabled:opacity-50"
            >
              {archiving ? 'Archiving…' : 'Yes, archive'}
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
    </div>
  )
}
