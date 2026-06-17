'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import GraphCanvas from './GraphCanvas'
import GraphLegend from './GraphLegend'
import NodeDetails from './NodeDetails'
import { type FileType, type GraphNode, type KnowledgeGraphData } from './types'

type Status = 'loading' | 'ready' | 'error'

const EMPTY_COUNTS: Record<FileType, number> = {
  code: 0,
  concept: 0,
  document: 0,
  rationale: 0,
  image: 0,
}

export default function KnowledgeGraph() {
  const [data, setData] = useState<KnowledgeGraphData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hovered, setHovered] = useState<GraphNode | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/knowledge-graph.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load graph (${res.status})`)
        return res.json() as Promise<KnowledgeGraphData>
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => {
    if (!data) return EMPTY_COUNTS
    const c = { ...EMPTY_COUNTS }
    for (const n of data.nodes) c[n.fileType] = (c[n.fileType] ?? 0) + 1
    return c
  }, [data])

  const connectionCount = useMemo(() => {
    if (!selected || !data) return 0
    return data.links.filter((l) => l.source === selected.id || l.target === selected.id).length
  }, [selected, data])

  const handleSelect = useCallback((node: GraphNode | null) => setSelected(node), [])
  const handleHover = useCallback((node: GraphNode | null) => setHovered(node), [])

  if (status === 'loading') {
    return <CenterMessage text="Loading knowledge graph…" />
  }
  if (status === 'error' || !data) {
    return <CenterMessage text="Could not load the knowledge graph." tone="error" />
  }
  if (data.nodes.length === 0) {
    return <CenterMessage text="The knowledge graph is empty." />
  }

  return (
    <div className="relative h-full w-full">
      <GraphCanvas
        data={data}
        search={search}
        selectedId={selected?.id ?? null}
        onSelect={handleSelect}
        onHover={handleHover}
      />

      {/* Search */}
      <div className="absolute left-4 top-4 w-64">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes…"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 backdrop-blur focus:border-primary-500 focus:outline-none"
        />
        <p className="mt-2 text-xs text-neutral-500">
          {data.nodes.length.toLocaleString()} nodes · {data.links.length.toLocaleString()} links
        </p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4">
        <GraphLegend counts={counts} />
      </div>

      {/* Hover hint */}
      {hovered && !selected && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-neutral-800 bg-neutral-950/90 px-3 py-1.5 text-sm text-neutral-200 backdrop-blur">
          {hovered.label}
        </div>
      )}

      {/* Selected node details */}
      {selected && (
        <div className="absolute right-4 top-4">
          <NodeDetails node={selected} connections={connectionCount} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  )
}

function CenterMessage({ text, tone = 'default' }: { text: string; tone?: 'default' | 'error' }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className={tone === 'error' ? 'text-red-400' : 'text-neutral-400'}>{text}</p>
    </div>
  )
}
