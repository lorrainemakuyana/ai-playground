'use client'

import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-12 h-12 rounded-full bg-red-950 border border-red-900 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-base font-semibold text-neutral-200 mb-2">Something went wrong</h2>
        <p className="text-sm text-neutral-500">{error.message || 'An unexpected error occurred.'}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="px-4 py-2 text-sm font-medium rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
        >
          Go to Projects
        </Link>
      </div>
    </div>
  )
}
