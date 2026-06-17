'use client'

import Link from 'next/link'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-neutral-950 text-center">
      <h2 className="text-lg font-semibold text-neutral-100">Something went wrong</h2>
      <p className="max-w-sm text-sm text-neutral-400">
        The knowledge graph could not be rendered. Try again or head back to the app.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:text-neutral-100"
        >
          Back to app
        </Link>
      </div>
    </div>
  )
}
