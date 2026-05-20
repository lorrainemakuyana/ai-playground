'use client'

import { useState, useEffect, useCallback } from 'react'
import { getShares, inviteByEmail, revokeShare, getShareLink, revokeShareLink } from '@/lib/api'
import type { ProjectShare, ShareLink } from '@/types'

interface Props {
  projectId: string
  onClose: () => void
}

export default function ShareModal({ projectId, onClose }: Props) {
  const [shares, setShares] = useState<ProjectShare[]>([])
  const [shareLink, setShareLink] = useState<ShareLink | null>(null)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [generatingLink, setGeneratingLink] = useState(false)
  const [revokingLinkId, setRevokingLinkId] = useState<string | null>(null)
  const [revokingShare, setRevokingShare] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadShares = useCallback(async () => {
    try {
      const data = await getShares(projectId)
      setShares(data)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void loadShares() }, [loadShares])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    if (!email.trim()) return
    setInviting(true)
    try {
      const share = await inviteByEmail(projectId, email.trim())
      setShares(prev => [...prev, share])
      setEmail('')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevokeShare(shareId: string) {
    setRevokingShare(shareId)
    try {
      await revokeShare(projectId, shareId)
      setShares(prev => prev.map(s => s.id === shareId ? { ...s, revoked_at: new Date().toISOString() } : s))
    } catch {
      // silently ignore
    } finally {
      setRevokingShare(null)
    }
  }

  async function handleGenerateLink() {
    setGeneratingLink(true)
    try {
      const link = await getShareLink(projectId)
      setShareLink(link)
    } catch {
      // silently ignore
    } finally {
      setGeneratingLink(false)
    }
  }

  async function handleRevokeLink() {
    if (!shareLink) return
    setRevokingLinkId(shareLink.id)
    try {
      await revokeShareLink(projectId)
      setShareLink(null)
    } catch {
      // silently ignore
    } finally {
      setRevokingLinkId(null)
    }
  }

  function handleCopy() {
    if (!shareLink) return
    void navigator.clipboard.writeText(shareLink.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeShares = shares.filter(s => !s.revoked_at)
  const MAX_COLLABORATORS = 5

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-100">Share Project</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {activeShares.length} / {MAX_COLLABORATORS} collaborators
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Invite by email */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Invite by email</h3>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                disabled={inviting || activeShares.length >= MAX_COLLABORATORS}
                className="flex-1 px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={inviting || !email.trim() || activeShares.length >= MAX_COLLABORATORS}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting ? 'Inviting…' : 'Invite'}
              </button>
            </form>
            {inviteError && (
              <p className="mt-2 text-xs text-red-400">{inviteError}</p>
            )}
            {activeShares.length >= MAX_COLLABORATORS && (
              <p className="mt-2 text-xs text-amber-500">Maximum of {MAX_COLLABORATORS} collaborators reached.</p>
            )}
          </section>

          {/* Share link */}
          <section>
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Shareable link</h3>
            {!shareLink ? (
              <button
                onClick={handleGenerateLink}
                disabled={generatingLink || activeShares.length >= MAX_COLLABORATORS}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {generatingLink ? 'Generating…' : 'Generate share link'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg">
                  <span className="flex-1 text-xs text-neutral-400 truncate font-mono">{shareLink.url}</span>
                  <button
                    onClick={handleCopy}
                    className="flex-none flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-primary-300 hover:text-primary-200 hover:bg-primary-950 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <button
                  onClick={handleRevokeLink}
                  disabled={revokingLinkId === shareLink.id}
                  className="text-xs text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {revokingLinkId === shareLink.id ? 'Revoking…' : 'Revoke link'}
                </button>
              </div>
            )}
          </section>

          {/* Collaborators list */}
          {!loading && shares.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Collaborators</h3>
              <ul className="space-y-2">
                {shares.map(share => (
                  <li
                    key={share.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      share.revoked_at
                        ? 'bg-neutral-800/40 border-neutral-800 opacity-50'
                        : 'bg-neutral-800 border-neutral-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center flex-none text-xs font-semibold text-neutral-300">
                      {share.invited_email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-200 truncate">{share.invited_email}</p>
                      <p className="text-xs text-neutral-600">
                        {share.revoked_at
                          ? `Revoked ${new Date(share.revoked_at).toLocaleDateString()}`
                          : share.joined_at
                          ? `Joined ${new Date(share.joined_at).toLocaleDateString()}`
                          : 'Invite pending'}
                        {' · '}{share.invite_method === 'link' ? 'via link' : 'via email'}
                      </p>
                    </div>
                    {!share.revoked_at && (
                      <button
                        onClick={() => handleRevokeShare(share.id)}
                        disabled={revokingShare === share.id}
                        className="flex-none text-xs text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50 px-1.5 py-1"
                      >
                        {revokingShare === share.id ? '…' : 'Revoke'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6">
              <svg className="w-5 h-5 text-neutral-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
