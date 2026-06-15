'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { linkRepo, triggerPush, triggerPR } from '@/lib/api'
import GitHubStatusChip from '@/components/GitHubStatusChip'
import type { GitHubPushStatus } from '@/types'

interface GitHubPanelProps {
  projectId: string
  initialRepo: string | null
  initialBranch: string | null
  initialPushStatus: GitHubPushStatus | null
  initialPushError: string | null
  initialPrUrl: string | null
  onStatusChange: (status: GitHubPushStatus, prUrl?: string) => void
}

export default function GitHubPanel({
  projectId,
  initialRepo,
  initialBranch,
  initialPushStatus,
  initialPushError,
  initialPrUrl,
  onStatusChange,
}: GitHubPanelProps) {
  const [open, setOpen] = useState(false)

  const [repo, setRepo] = useState(initialRepo ?? '')
  const [branch, setBranch] = useState(initialBranch ?? '')
  const [pushStatus, setPushStatus] = useState(initialPushStatus)
  const [pushError, setPushError] = useState(initialPushError)
  const [prUrl, setPrUrl] = useState(initialPrUrl)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pushing, setPushing] = useState(false)
  const [openingPr, setOpeningPr] = useState(false)

  async function handleSaveRepo() {
    setSaving(true)
    setSaveError('')
    try {
      const result = await linkRepo(projectId, repo.trim() || null, branch.trim() || null)
      setRepo(result.github_repo ?? '')
      setBranch(result.github_branch ?? '')
      setPushStatus(result.github_push_status)
      setPushError(result.github_push_error)
      setPrUrl(result.github_pr_url)
      toast.success(repo.trim() ? 'Repository linked' : 'Repository unlinked')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handlePush() {
    setPushing(true)
    try {
      const result = await triggerPush(projectId)
      setPushStatus(result.status as GitHubPushStatus)
      if (result.status === 'success') {
        toast.success('Code pushed to GitHub')
        onStatusChange('success')
      } else if (result.status === 'failed') {
        setPushError(result.error)
        toast.error(result.error ?? 'Push failed')
        onStatusChange('failed')
      } else {
        toast.info('No GitHub repo linked — skipped')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setPushing(false)
    }
  }

  async function handleOpenPR() {
    setOpeningPr(true)
    try {
      const result = await triggerPR(projectId)
      if (result.status === 'success' && result.pr_url) {
        setPrUrl(result.pr_url)
        toast.success('Pull request opened')
        onStatusChange('success', result.pr_url)
      } else if (result.status === 'failed') {
        toast.error(result.error ?? 'Failed to open PR')
      } else {
        toast.info('Skipped — no repo linked')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open PR')
    } finally {
      setOpeningPr(false)
    }
  }

  const linkedRepo = repo.trim() || null

  return (
    <div className="border-b border-neutral-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 flex-none" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="font-medium">GitHub</span>
          {linkedRepo && (
            <span className="text-neutral-500 truncate max-w-[160px]">{linkedRepo}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GitHubStatusChip
            repo={linkedRepo}
            pushStatus={pushStatus}
            prUrl={prUrl}
            pushError={pushError}
          />
          <svg
            className={`w-3.5 h-3.5 transition-transform flex-none ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 bg-neutral-950/30">
          {/* Repo field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-400">
              Repository <span className="text-neutral-600">(owner/repo)</span>
            </label>
            <input
              type="text"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="acme/my-app"
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Branch field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-400">
              Branch <span className="text-neutral-600">(optional — defaults to sdlc/{projectId.slice(0, 8)}…)</span>
            </label>
            <input
              type="text"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder={`sdlc/${projectId}`}
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {saveError && (
            <p className="text-xs text-red-400">{saveError}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSaveRepo}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 transition-colors"
            >
              {saving ? 'Saving…' : (linkedRepo ? 'Update' : 'Link repo')}
            </button>

            {linkedRepo && (
              <button
                onClick={() => { setRepo(''); void handleSaveRepo() }}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium rounded-md hover:bg-red-950 disabled:opacity-50 text-red-400 transition-colors"
              >
                Unlink
              </button>
            )}

            <div className="flex-1" />

            {linkedRepo && (
              <button
                onClick={handlePush}
                disabled={pushing || !linkedRepo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 transition-colors"
              >
                {pushing ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Pushing…
                  </>
                ) : 'Push to GitHub'}
              </button>
            )}

            {pushStatus === 'success' && linkedRepo && (
              <button
                onClick={handleOpenPR}
                disabled={openingPr}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-900 hover:bg-purple-800 disabled:opacity-50 text-purple-100 transition-colors"
              >
                {openingPr ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Opening PR…
                  </>
                ) : (prUrl ? 'Re-open PR' : 'Open PR')}
              </button>
            )}
          </div>

          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-purple-400 hover:text-purple-300 transition-colors truncate"
            >
              {prUrl} ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
