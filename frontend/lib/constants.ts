import type { SDLCPhase, PlanTier } from '@/types'

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

// Static FX — no live API. 1 GBP = 1.27 USD.
export const USD_PER_GBP = 1.27

export const PLAN_LABELS: Record<PlanTier, string> = {
  free:  'Free',
  pro:   'Pro',
  ultra: 'Ultra',
}

export const PLAN_ORDER: PlanTier[] = ['free', 'pro', 'ultra']

// Rank for upgrade/downgrade comparison.
export const PLAN_RANK: Record<PlanTier, number> = { free: 0, pro: 1, ultra: 2 }

// Base prices stored as GBP pence (single source of truth).
export const PLAN_PRICING: Record<PlanTier, number> = {
  free:  0,      // £0.00
  pro:   1199,   // £11.99 / mo
  ultra: 2999,   // £29.99 / mo
}

// Per-tier limit/feature matrix — mirrors backend PLAN_LIMITS.
export interface PlanFeatures {
  projects: number | 'unlimited'
  agentsPerProject: number | 'unlimited'
  models: string
  sharing: boolean
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free:  { projects: 2,           agentsPerProject: 3,           models: 'Haiku',               sharing: false },
  pro:   { projects: 10,          agentsPerProject: 8,           models: 'Haiku, Sonnet',       sharing: true  },
  ultra: { projects: 'unlimited', agentsPerProject: 'unlimited', models: 'Haiku, Sonnet, Opus', sharing: true  },
}
