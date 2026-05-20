'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-400">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm">Retry</button>
    </div>
  )
}
