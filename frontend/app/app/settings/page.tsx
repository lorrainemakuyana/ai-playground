'use client'

import Link from 'next/link'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import PlanTierBadge from '@/components/PlanTierBadge'
import Spinner from '@/components/Spinner'
import { PLAN_FEATURES } from '@/lib/constants'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SettingsPage() {
  const { user, plan, effectivePlan, planExpiresAt, isExpired, loading, error, refetch } = useCurrentUser()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>

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
