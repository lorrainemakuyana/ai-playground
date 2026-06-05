'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CurrencyToggle from '@/components/CurrencyToggle'
import PlanComparisonTable from '@/components/PlanComparisonTable'
import type { UpgradeReason } from '@/lib/upgradeModalBridge'

interface UpgradeModalProps {
  isOpen: boolean
  reason: UpgradeReason
  onClose: () => void
}

export default function UpgradeModal({ isOpen, reason, onClose }: UpgradeModalProps) {
  const router = useRouter()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  function goToBilling() {
    onClose()
    router.push('/app/billing')
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl flex flex-col animate-scaleIn"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <h2 id="upgrade-modal-title" className="text-lg font-semibold text-neutral-100">Upgrade your plan</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-base font-medium text-neutral-100">{reason.title}</p>
            <p className="text-sm text-neutral-400">{reason.body}</p>
          </div>
          <div className="flex justify-end">
            <CurrencyToggle />
          </div>
          <PlanComparisonTable highlightPlan={reason.recommend} compact />
        </div>

        <div className="px-6 py-4 border-t border-neutral-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-400 rounded-md hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            Maybe later
          </button>
          <button
            onClick={goToBilling}
            className="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary-600 hover:bg-primary-500 transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  )
}
