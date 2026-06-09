'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import CurrencyToggle from '@/components/CurrencyToggle'
import PlanComparisonTable from '@/components/PlanComparisonTable'
import { getCurrentUserOptional } from '@/lib/api'
import { PLAN_RANK } from '@/lib/constants'
import type { CurrentUser, PlanTier } from '@/types'

function PricingContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    getCurrentUserOptional().then((u) => {
      if (active) { setUser(u); setReady(true) }
    })
    return () => { active = false }
  }, [])

  // Returning from login with a pending checkout intent → advance to billing.
  useEffect(() => {
    if (!ready) return
    const checkout = params.get('checkout')
    if (checkout && user) {
      router.replace(`/app/billing?checkout=${checkout}`)
    }
  }, [ready, user, params, router])

  function onSubscribe(tier: PlanTier) {
    if (tier === 'free') {
      router.push(user ? '/app' : '/auth?next=/app')
      return
    }
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent('/pricing?checkout=' + tier)}`)
      return
    }
    if (tier === user.effective_plan) return // disabled CTA
    if (PLAN_RANK[tier] < PLAN_RANK[user.effective_plan]) {
      router.push(`/app/billing?change=${tier}`)
    } else {
      router.push(`/app/billing?checkout=${tier}`)
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex-none flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-800">
        <Link href="/" className="text-sm font-semibold text-neutral-200">SDLC Orchestrator</Link>
        {ready && !user && (
          <Link href="/auth" className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors">Log in</Link>
        )}
        {ready && user && (
          <Link href="/app" className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors">Dashboard</Link>
        )}
      </header>

      <div className="flex-1 flex flex-col justify-center mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Simple, transparent pricing</h1>
          <p className="text-neutral-400">Flexible plans, just for you</p>
        </div>

        <div className="flex justify-center">
          <CurrencyToggle />
        </div>

        <PlanComparisonTable currentTier={user?.effective_plan} onSubscribe={onSubscribe} />

        <p className="text-center text-xs text-neutral-500">
          By subscribing you agree to our{' '}
          <Link href="/terms" className="underline hover:text-neutral-300">Terms and Conditions</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-neutral-300">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <PricingContent />
    </Suspense>
  )
}
