'use client'

import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import PlanTierBadge from '@/components/PlanTierBadge'
import { triggerUpgradeModal } from '@/lib/upgradeModalBridge'

// Clickable plan bubble shown in the app header for users who haven't subscribed
// yet (effective plan is Free). Clicking opens the UpgradeModal.
export default function HeaderPlanBadge() {
  const { effectivePlan, loading } = useCurrentUser()

  if (loading || effectivePlan !== 'free') return null

  return (
    <button
      type="button"
      onClick={() => triggerUpgradeModal()}
      aria-label="Upgrade your plan"
      title="Upgrade your plan"
      className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <PlanTierBadge plan="free" size="sm" />
    </button>
  )
}
