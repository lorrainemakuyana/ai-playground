'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import CurrencyToggle from '@/components/CurrencyToggle'
import PlanComparisonTable from '@/components/PlanComparisonTable'
import Spinner from '@/components/Spinner'
import { PLAN_LABELS } from '@/lib/constants'
import type { PlanTier } from '@/types'

function BillingContent() {
  const { effectivePlan, loading } = useCurrentUser()
  const params = useSearchParams()
  const checkout = params.get('checkout') as PlanTier | null
  const change = params.get('change') as PlanTier | null

  let heading = 'Billing'
  if (checkout) heading = `Subscribe to ${PLAN_LABELS[checkout] ?? checkout}`
  else if (change) heading = `Switch to ${PLAN_LABELS[change] ?? change}`

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">{heading}</h1>

      <div className="rounded-lg border border-amber-800 bg-amber-950/40 text-amber-300 text-sm px-4 py-3">
        Self-service payment is coming soon. Plan changes are currently handled by an admin.
      </div>

      <div className="flex justify-end">
        <CurrencyToggle />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <PlanComparisonTable currentTier={effectivePlan ?? undefined} />
      )}
    </main>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Spinner /></div>}>
      <BillingContent />
    </Suspense>
  )
}
