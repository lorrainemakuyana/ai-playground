export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-950">
      <div className="flex items-center gap-3 text-neutral-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-primary-500" />
        Preparing knowledge graph…
      </div>
    </div>
  )
}
