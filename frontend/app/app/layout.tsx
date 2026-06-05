import type { ReactNode } from 'react'
import { CurrentUserProvider } from '@/lib/hooks/useCurrentUser'
import UpgradeModalProvider from '@/components/UpgradeModalProvider'

// Nested layout for the authenticated app subtree. The root app/layout.tsx owns
// <html>/<body>; this only wraps {children} with the plan/currency providers so
// the UpgradeModal can be opened from anywhere (including fetchJSON's 403 path).
// Public routes (/auth, /pricing) sit outside app/app/ and never mount these.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <CurrentUserProvider>
      <UpgradeModalProvider>{children}</UpgradeModalProvider>
    </CurrentUserProvider>
  )
}
