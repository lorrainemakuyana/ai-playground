'use client'

import type { PlanTier } from '@/types'
import { useCurrency } from '@/lib/hooks/useCurrency'
import PlanTierBadge from '@/components/PlanTierBadge'
import { PLAN_ORDER, PLAN_PRICING, PLAN_FEATURES, PLAN_RANK, type PlanFeatures } from '@/lib/constants'

interface PlanComparisonTableProps {
  highlightPlan?: PlanTier            // ring + "Most popular" pill (default 'pro')
  currentTier?: PlanTier              // marks the user's effective plan + drives CTA labels
  onSubscribe?: (tier: PlanTier) => void  // when set, renders a CTA per card
  compact?: boolean                   // tighter padding inside the modal
}

const CARD_BORDER: Record<PlanTier, string> = {
  free:  'border-neutral-800 hover:border-neutral-700',
  pro:   'border-primary-700',
  ultra: 'border-orange-500',
}

function featureRows(f: PlanFeatures): { label: string; value: string; on?: boolean }[] {
  return [
    { label: 'Max projects', value: f.projects === 'unlimited' ? 'Unlimited' : String(f.projects) },
    { label: 'Agents / project', value: f.agentsPerProject === 'unlimited' ? 'Unlimited' : String(f.agentsPerProject) },
    { label: 'Models', value: f.models },
    { label: 'Project sharing', value: f.sharing ? '✓' : '—', on: f.sharing },
  ]
}

function ctaLabel(tier: PlanTier, currentTier?: PlanTier): string {
  if (!currentTier) return tier === 'free' ? 'Get started' : 'Subscribe'
  if (tier === currentTier) return 'Current plan'
  return PLAN_RANK[tier] < PLAN_RANK[currentTier] ? 'Downgrade' : 'Upgrade'
}

export default function PlanComparisonTable({
  highlightPlan = 'pro',
  currentTier,
  onSubscribe,
  compact = false,
}: PlanComparisonTableProps) {
  const { currency, format } = useCurrency()

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 ${compact ? 'gap-3' : 'gap-6 lg:gap-8'}`}>
      {PLAN_ORDER.map((tier) => {
        const highlighted = tier === highlightPlan
        const isCurrent = tier === currentTier
        const amount = PLAN_PRICING[tier][currency]
        const price = format(amount)
        const label = ctaLabel(tier, currentTier)
        const isDowngrade = label === 'Downgrade'

        return (
          <div
            key={tier}
            className={`rounded-xl border-2 flex flex-col bg-neutral-900 ${CARD_BORDER[tier]} ${
              compact ? 'p-4 gap-4' : 'p-7 gap-6 min-h-[480px]'
            } ${highlighted ? 'ring-4 ring-primary-500' : ''}`}
          >
            <div className="flex items-center justify-between">
              <PlanTierBadge plan={tier} size={compact ? 'md' : 'lg'} />
              {highlighted && (
                <span className="bg-primary-600 text-white text-[12px] px-3 py-1 rounded-full">Most popular</span>
              )}
              {isCurrent && (
                <span className="bg-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded-full">Current</span>
              )}
            </div>

            <div>
              <span className={`font-semibold text-neutral-100 ${compact ? 'text-2xl' : 'text-4xl'}`}>{price}</span>
              {amount > 0 && <span className="text-sm text-neutral-500"> / mo</span>}
            </div>

            <ul className={`divide-y divide-neutral-800 text-sm ${compact ? '' : 'flex-1'}`}>
              {featureRows(PLAN_FEATURES[tier]).map((row) => (
                <li key={row.label} className={`flex items-center justify-between ${compact ? 'py-2' : 'py-3'}`}>
                  <span className="text-neutral-400">{row.label}</span>
                  <span className={row.on === false ? 'text-neutral-600' : row.on ? 'text-green-400' : 'text-neutral-200'}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>

            {onSubscribe && (
              <button
                type="button"
                disabled={isCurrent}
                aria-disabled={isCurrent}
                onClick={() => onSubscribe(tier)}
                aria-label={`${label}${amount > 0 ? `, ${price} per month` : ''}`}
                className={
                  isCurrent
                    ? 'mt-auto px-4 py-2 text-sm font-medium rounded-md bg-neutral-800 text-neutral-500 cursor-default'
                    : isDowngrade
                      ? 'mt-auto px-4 py-2 text-sm font-medium rounded-md border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors'
                      : 'mt-auto px-4 py-2 text-sm font-medium rounded-md bg-primary-600 hover:bg-primary-500 text-white transition-colors'
                }
              >
                {label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
