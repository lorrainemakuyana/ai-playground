'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { CurrentUser, PlanTier } from '@/types'
import { getCurrentUser } from '@/lib/api'

export interface UseCurrentUserResult {
  user: CurrentUser | null
  plan: PlanTier | null
  effectivePlan: PlanTier | null
  planExpiresAt: string | null
  isExpired: boolean
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const CurrentUserContext = createContext<UseCurrentUserResult | null>(null)

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUser(await getCurrentUser())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refetch() }, [refetch])

  const isExpired =
    !!user &&
    user.plan !== 'free' &&
    user.effective_plan === 'free' &&
    !!user.plan_expires_at &&
    new Date(user.plan_expires_at).getTime() < Date.now()

  const value: UseCurrentUserResult = {
    user,
    plan: user?.plan ?? null,
    effectivePlan: user?.effective_plan ?? null,
    planExpiresAt: user?.plan_expires_at ?? null,
    isExpired,
    loading,
    error,
    refetch,
  }

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser(): UseCurrentUserResult {
  const ctx = useContext(CurrentUserContext)
  if (!ctx) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider')
  }
  return ctx
}
