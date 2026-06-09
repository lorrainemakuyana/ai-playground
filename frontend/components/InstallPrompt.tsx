'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('pwa-install-dismissed')
    if (stored) {
      const dismissedAt = parseInt(stored, 10)
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - dismissedAt < sevenDays) { setDismissed(true); return }
      localStorage.removeItem('pwa-install-dismissed')
    }

    function handler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null)
      setDismissed(true)
    }
  }

  function dismiss() {
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-neutral-900 border border-neutral-700 rounded-2xl p-4 shadow-2xl shadow-black/50 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center flex-none">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-100">Install Orchestrator</p>
        <p className="text-xs text-neutral-500 mt-0.5">Add to your home screen for quick access.</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={install}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
          >
            Install
          </button>
          <button
            onClick={dismiss}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
