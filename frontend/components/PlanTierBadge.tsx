import type { PlanTier } from '@/types'
import { PLAN_LABELS } from '@/lib/constants'

interface PlanTierBadgeProps {
  plan: PlanTier
  expired?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-lg px-3 py-1',
}

const TIER: Record<PlanTier, string> = {
  free:  'bg-neutral-800 text-neutral-300',
  pro:   'bg-primary-950 text-primary-300 ring-1 ring-primary-800',
  ultra: 'bg-neutral-900 ring-1 ring-primary-700',
}

export default function PlanTierBadge({ plan, expired = false, size = 'sm' }: PlanTierBadgeProps) {
  const base = `inline-flex items-center gap-1.5 font-medium rounded-full ${SIZE[size]} ${TIER[plan]}`
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${base}${expired ? ' opacity-60' : ''}`}>
        {plan === 'ultra' ? (
          <span className="bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent font-semibold">
            {PLAN_LABELS.ultra}
          </span>
        ) : (
          PLAN_LABELS[plan]
        )}
      </span>
      {expired && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 ring-1 ring-amber-800">
          Expired
        </span>
      )}
    </span>
  )
}
