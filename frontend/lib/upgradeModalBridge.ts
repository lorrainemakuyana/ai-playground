// Module-level bridge so the non-React `fetchJSON` can open the React UpgradeModal.
// `UpgradeModalProvider` registers its `open` callback here on mount.
import type { PlanTier } from '@/types'

export interface UpgradeReason {
  title: string
  body: string
  recommend: PlanTier
}

type OpenFn = (reason?: Partial<UpgradeReason>) => void

let _open: OpenFn | null = null

export function registerUpgradeModalOpener(fn: OpenFn | null): void {
  _open = fn
}

export function triggerUpgradeModal(reason?: Partial<UpgradeReason>): void {
  _open?.(reason)
}

/** True when a 403 detail string is a plan-limit / sharing gate (vs a generic auth 403). */
export function isPlanLimitDetail(detail: string): boolean {
  return detail.includes('plan limit') || detail === 'Sharing requires Pro or Ultra'
}

/** Map a backend 403 detail string to the modal's reason copy. */
export function reasonForDetail(detail: string): Partial<UpgradeReason> {
  if (detail.includes('projects')) {
    return {
      title: "You've hit the Free project limit",
      body: 'Free plans include up to 2 projects. Upgrade to add more.',
      recommend: 'pro',
    }
  }
  if (detail.includes('agents')) {
    return {
      title: "You've hit the agent limit",
      body: 'Free plans include up to 3 agents per project. Upgrade for more.',
      recommend: 'pro',
    }
  }
  if (detail === 'Sharing requires Pro or Ultra') {
    return {
      title: 'Sharing is a Pro feature',
      body: 'Upgrade to Pro or Ultra to share projects with collaborators.',
      recommend: 'pro',
    }
  }
  return { recommend: 'pro' }
}
