import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-neutral-800 mb-4">404</p>
        <h2 className="text-base font-semibold text-neutral-300 mb-2">Page not found</h2>
        <p className="text-sm text-neutral-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/app"
        className="px-4 py-2 text-sm font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
      >
        ← Back to Projects
      </Link>
    </div>
  )
}
