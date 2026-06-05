'use client'

import { useCurrency } from '@/lib/hooks/useCurrency'
import type { Currency } from '@/types'

interface CurrencyToggleProps {
  className?: string
}

const SEGMENTS: { value: Currency; label: string }[] = [
  { value: 'GBP', label: '£ GBP' },
  { value: 'USD', label: '$ USD' },
]

export default function CurrencyToggle({ className = '' }: CurrencyToggleProps) {
  const { currency, setCurrency } = useCurrency()

  return (
    <div
      role="switch"
      aria-checked={currency === 'USD'}
      aria-label="Toggle currency between GBP and USD"
      className={`inline-flex rounded-full bg-neutral-850 p-0.5 ring-1 ring-neutral-800 ${className}`}
    >
      {SEGMENTS.map((seg) => {
        const selected = currency === seg.value
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => setCurrency(seg.value)}
            aria-pressed={selected}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              selected
                ? 'bg-primary-600 text-white shadow-primary-glow'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}
