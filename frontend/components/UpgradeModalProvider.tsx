'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import UpgradeModal from '@/components/UpgradeModal'
import { registerUpgradeModalOpener, type UpgradeReason } from '@/lib/upgradeModalBridge'

const DEFAULT_REASON: UpgradeReason = {
  title: 'Upgrade your plan',
  body: 'Unlock more projects, agents, models, and sharing.',
  recommend: 'pro',
}

export default function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<UpgradeReason>(DEFAULT_REASON)

  const open = useCallback((partial?: Partial<UpgradeReason>) => {
    setReason({ ...DEFAULT_REASON, ...partial })
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  // Bridge the module-level fetchJSON 403 hook to this React state.
  useEffect(() => {
    registerUpgradeModalOpener(open)
    return () => registerUpgradeModalOpener(null)
  }, [open])

  return (
    <>
      {children}
      <UpgradeModal isOpen={isOpen} reason={reason} onClose={close} />
    </>
  )
}
