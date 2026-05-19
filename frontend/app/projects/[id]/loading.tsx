export default function Loading() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Top bar skeleton */}
      <div className="h-14 border-b border-neutral-800 bg-neutral-900 flex items-center px-6 gap-4 animate-pulse">
        <div className="h-4 w-20 bg-neutral-800 rounded" />
        <div className="h-4 w-48 bg-neutral-800 rounded flex-1" />
        <div className="h-4 w-24 bg-neutral-800 rounded" />
      </div>

      {/* Phase tracker skeleton */}
      <div className="h-16 border-b border-neutral-800 bg-neutral-900 flex items-center px-6 gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none gap-2">
            <div className="w-3 h-3 rounded-full bg-neutral-800" />
            <div className="flex-1 h-px bg-neutral-800 last:hidden" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div className="w-[340px] flex-none border-r border-neutral-800 p-3 space-y-2 animate-pulse">
          <div className="h-5 w-16 bg-neutral-800 rounded mb-4 mx-1" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-neutral-900 border border-neutral-800 rounded-lg" />
          ))}
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col animate-pulse">
          <div className="h-11 border-b border-neutral-800 flex items-center px-4 gap-3">
            <div className="h-4 w-28 bg-neutral-800 rounded" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
              <div className="w-4 h-4 bg-neutral-800 rounded-full flex-none" />
              <div className="flex-1 h-4 bg-neutral-800 rounded" />
              <div className="w-16 h-4 bg-neutral-800 rounded" />
              <div className="w-12 h-4 bg-neutral-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
