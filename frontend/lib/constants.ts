import type { SDLCPhase, PlanTier, Currency } from '@/types'

export const PHASE_LABELS: Record<SDLCPhase, string> = {
  discovery:      'Discovery',
  architecture:   'Architecture',
  implementation: 'Implementation',
  testing:        'Testing',
  sre_review:     'SRE Review',
  done:           'Done',
}

export const ALL_PHASES: SDLCPhase[] = [
  'discovery', 'architecture', 'implementation', 'testing', 'sre_review', 'done',
]

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------


export const PLAN_LABELS: Record<PlanTier, string> = {
  free:  'Free',
  pro:   'Pro',
  ultra: 'Ultra',
}

export const PLAN_ORDER: PlanTier[] = ['free', 'pro', 'ultra']

// Rank for upgrade/downgrade comparison.
export const PLAN_RANK: Record<PlanTier, number> = { free: 0, pro: 1, ultra: 2 }

// Explicit per-currency prices in minor units (pence / cents) — not converted.
export const PLAN_PRICING: Record<PlanTier, Record<Currency, number>> = {
  free:  { GBP: 0,    USD: 0    },
  pro:   { GBP: 1499, USD: 1999 }, // £14.99 / $19.99 / mo
  ultra: { GBP: 3999, USD: 5999 }, // £39.99 / $59.99 / mo
}

// Per-tier limit/feature matrix — mirrors backend PLAN_LIMITS.
export interface PlanFeatures {
  projects: number | 'unlimited'
  agentsPerProject: number | 'unlimited'
  models: string
  sharing: boolean
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free:  { projects: 2,           agentsPerProject: 2,           models: 'Haiku',               sharing: false },
  pro:   { projects: 5,           agentsPerProject: 5,           models: 'Haiku, Sonnet',       sharing: true  },
  ultra: { projects: 'unlimited', agentsPerProject: 'unlimited', models: 'Haiku, Sonnet, Opus', sharing: true  },
}
