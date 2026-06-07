import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import InstallPrompt from '@/components/InstallPrompt'
import './globals.css'

export const metadata: Metadata = {
  title: 'SDLC Orchestrator',
  description: 'Autonomous AI engineering team for your projects',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Orchestrator',
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-neutral-950 text-neutral-100 min-h-screen font-sans antialiased">
        {children}
        <InstallPrompt />
        <Toaster
          theme="dark"
          position="bottom-right"
          closeButton
          toastOptions={{ duration: Infinity }}
        />
      </body>
    </html>
  )
}
