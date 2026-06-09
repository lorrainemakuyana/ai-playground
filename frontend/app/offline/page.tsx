import Link from 'next/link'

export const metadata = { title: 'Offline – SDLC Orchestrator' }

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-5xl mb-6">📡</div>
      <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-neutral-100 mb-3">You&apos;re offline</h1>
      <p className="text-sm text-neutral-500 max-w-xs mb-8 leading-relaxed">
        No internet connection. Check your network and try again — your projects are waiting.
      </p>
      <Link
        href="/app"
        className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm transition-colors"
      >
        Try again
      </Link>
    </div>
  )
}
