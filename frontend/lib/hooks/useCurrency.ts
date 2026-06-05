'use client'

import { useSyncExternalStore, useCallback } from 'react'
import type { Currency } from '@/types'

const STORAGE_KEY = 'preferred_currency'

// Module-level store so every CurrencyToggle / price re-renders together when one changes.
const listeners = new Set<() => void>()

function readStored(): Currency {
  if (typeof window === 'undefined') return 'GBP'
  return window.localStorage.getItem(STORAGE_KEY) === 'USD' ? 'USD' : 'GBP'
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  // Sync across tabs too.
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb() }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

function setStored(c: Currency): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, c)
  listeners.forEach((l) => l())
}

export interface UseCurrencyResult {
  currency: Currency
  setCurrency: (c: Currency) => void
  toggle: () => void
  format: (gbpPence: number) => string
}

export function useCurrency(): UseCurrencyResult {
  // getServerSnapshot returns 'GBP' so SSR and first client render agree.
  const currency = useSyncExternalStore(subscribe, readStored, () => 'GBP' as Currency)

  const setCurrency = useCallback((c: Currency) => setStored(c), [])
  const toggle = useCallback(() => setStored(readStored() === 'USD' ? 'GBP' : 'USD'), [])

  const format = useCallback(
    (amountMinor: number): string => {
      // amountMinor is already in the active currency's minor units (no conversion).
      if (amountMinor === 0) return 'Free'
      const symbol = currency === 'USD' ? '$' : '£'
      return `${symbol}${(amountMinor / 100).toFixed(2)}`
    },
    [currency],
  )

  return { currency, setCurrency, toggle, format }
}
