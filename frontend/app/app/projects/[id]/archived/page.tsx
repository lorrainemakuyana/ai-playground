'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getProject, unarchiveProject, deleteProject } from '@/lib/api'
import { PHASE_LABELS } from '@/lib/constants'
import type { Project } from '@/types'
import Spinner from '@/components/Spinner'

export default function ArchivedProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [unarchiving, setUnarchiving] = useState(false)
  const [unarchiveError, setUnarchiveError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await getProject(projectId)
        setProject(data)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [projectId])

  async function handleUnarchive() {
    setUnarchiving(true)
    setUnarchiveError('')
    try {
      await unarchiveProject(projectId)
      router.replace(`/app/projects/${projectId}`)
    } catch (err) {
      setUnarchiveError(err instanceof Error ? err.message : 'Failed to unarchive project')
      setUnarchiving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteProject(projectId)
      router.replace('/app')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project')
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{fetchError}</p>
        <Link href="/app" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
          ← Back to Projects
        </Link>
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-neutral-800 bg-neutral-900 flex-none">
        <Link
          href="/app"
          className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors flex items-center gap-1 flex-none"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Projects
        </Link>
        <span className="text-neutral-700">/</span>
        <span className="text-sm font-semibold text-neutral-100 truncate">{project.name}</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-500 border border-neutral-700 flex-none">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8m-9 4v4m4-4v4" />
          </svg>
          Archived
        </span>
        <div className="flex-1" />
      </div>

      {/* Unarchive banner */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-400">
              This project is archived and paused.
            </p>
            {unarchiveError && (
              <p className="text-xs text-red-400 mt-1">{unarchiveError}</p>
            )}
          </div>
          <button
            onClick={handleUnarchive}
            disabled={unarchiving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex-none"
          >
            {unarchiving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Unarchiving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Unarchive project
              </>
            )}
          </button>
        </div>
      </div>

      {/* Project info */}
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Details card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 opacity-75">
          <h2 className="text-lg font-semibold text-neutral-300 mb-1">{project.name}</h2>
          <p className="text-sm text-neutral-500 mb-5">{project.description}</p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-neutral-600 mb-0.5">Phase</p>
              <p className="text-sm font-medium text-neutral-400">
                {PHASE_LABELS[project.current_phase] ?? project.current_phase}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-600 mb-0.5">Agents</p>
              <p className="text-sm font-medium text-neutral-400">{project.agents.length}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-600 mb-0.5">Tasks</p>
              <p className="text-sm font-medium text-neutral-400">{project.tasks.length}</p>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="border border-red-900/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-1">Danger zone</h3>
          <p className="text-xs text-neutral-500 mb-4">
            Permanently delete this project and all associated agents, tasks, and data. This cannot be undone.
          </p>
          {deleteError && (
            <p className="text-xs text-red-400 mb-3">{deleteError}</p>
          )}
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-900 text-red-400 hover:bg-red-950 hover:text-red-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete permanently
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-red-400">This cannot be undone.</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900 hover:bg-red-800 text-red-200 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
