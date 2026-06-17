import type { Metadata } from 'next'
import Link from 'next/link'
import KnowledgeGraph from './_components/KnowledgeGraph'

export const metadata: Metadata = {
  title: 'Knowledge Graph · SDLC Orchestrator',
  description: 'Interactive visualisation of the codebase knowledge graph.',
}

export default function GraphPage() {
  return (
    <main className="flex h-screen flex-col bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Knowledge Graph</h1>
          <p className="text-xs text-neutral-500">
            Explore how files, concepts, and rationale connect across the codebase.
          </p>
        </div>
        <Link
          href="/app"
          className="rounded-md border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-neutral-700 hover:text-neutral-100"
        >
          ← Back to app
        </Link>
      </header>
      <div className="relative flex-1 overflow-hidden">
        <KnowledgeGraph />
      </div>
    </main>
  )
}
