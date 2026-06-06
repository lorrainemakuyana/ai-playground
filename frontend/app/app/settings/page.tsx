'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { getGitHubTokenStatus, saveGitHubToken, deleteGitHubToken } from '@/lib/api'
import PlanTierBadge from '@/components/PlanTierBadge'
import Spinner from '@/components/Spinner'
import { PLAN_FEATURES } from '@/lib/constants'

function GitHubSection() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getGitHubTokenStatus()
      .then(r => setConnected(r.connected))
      .catch(() => setConnected(false))
  }, [])

  async function handleSave() {
    if (!token.trim()) return
    setSaving(true)
    setError('')
    try {
      await saveGitHubToken(token.trim())
      setConnected(true)
      setToken('')
      toast.success('GitHub token saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save token')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await deleteGitHubToken()
      setConnected(false)
      toast.success('GitHub token removed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove token')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-neutral-400 flex-none" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <h2 className="text-sm font-semibold text-neutral-300">GitHub</h2>
        {connected !== null && (
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${connected ? 'bg-emerald-950 text-emerald-300' : 'bg-neutral-800 text-neutral-500'}`}>
            {connected ? 'Connected' : 'Not connected'}
          </span>
        )}
      </div>

      <p className="text-xs text-neutral-500">
        Connect a GitHub Personal Access Token (PAT) to auto-push generated code and open pull requests. The token is encrypted at rest and never shown again.
      </p>

      {connected === null && (
        <div className="flex items-center gap-2 py-2">
          <Spinner />
          <span className="text-xs text-neutral-500">Checking…</span>
        </div>
      )}

      {connected !== null && !connected && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-400">
              Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-neutral-600">
              Needs <code className="bg-neutral-800 px-1 rounded">repo</code> scope. Create one at github.com/settings/tokens.
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !token.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {saving ? 'Saving…' : 'Save token'}
          </button>
        </div>
      )}

      {connected && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-neutral-400">
            Token saved. To rotate it, remove it and add a new one.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Removing…' : 'Remove token'}
          </button>
        </div>
      )}
    </section>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SettingsPage() {
  const { user, plan, effectivePlan, planExpiresAt, isExpired, loading, error, refetch } = useCurrentUser()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>

      <GitHubSection />

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-300">Plan</h2>

        {loading && (
          <div className="flex items-center justify-center py-8"><Spinner /></div>
        )}

        {!loading && error && (
          <div className="space-y-3">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => void refetch()}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && user && plan && effectivePlan && (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PlanTierBadge plan={plan} expired={isExpired} size="md" />
              {planExpiresAt && (
                <span className="text-sm text-neutral-400">
                  {isExpired ? 'Expired on' : 'Renews / expires'} {formatDate(planExpiresAt)}
                </span>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-300 mb-2">Your current entitlements</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-neutral-800">
                  {(() => {
                    const f = PLAN_FEATURES[effectivePlan]
                    const rows: [string, string][] = [
                      ['Projects', f.projects === 'unlimited' ? 'Unlimited' : String(f.projects)],
                      ['Agents per project', f.agentsPerProject === 'unlimited' ? 'Unlimited' : String(f.agentsPerProject)],
                      ['Models', f.models],
                      ['Project sharing', f.sharing ? 'Included' : '—'],
                    ]
                    return rows.map(([label, value]) => (
                      <tr key={label}>
                        <td className="py-2 text-neutral-400">{label}</td>
                        <td className="py-2 text-right text-neutral-100 font-medium">{value}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>

            {effectivePlan !== 'ultra' && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-neutral-400">
                  {isExpired ? "You're on the Free entitlement." : 'Need more? Compare plans.'}
                </p>
                <Link
                  href="/app/billing"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                >
                  Upgrade →
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
