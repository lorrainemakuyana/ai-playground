import { FILE_TYPE_COLORS, FILE_TYPE_LABELS, type GraphNode } from './types'

interface NodeDetailsProps {
  node: GraphNode
  connections: number
  onClose: () => void
}

export default function NodeDetails({ node, connections, onClose }: NodeDetailsProps) {
  return (
    <div className="w-72 rounded-lg border border-neutral-800 bg-neutral-950/90 p-4 backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: FILE_TYPE_COLORS[node.fileType] }} />
          <span className="text-xs uppercase tracking-wide text-neutral-400">
            {FILE_TYPE_LABELS[node.fileType]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 transition-colors hover:text-neutral-200"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>
      <h2 className="break-words text-base font-semibold text-neutral-100">{node.label}</h2>
      {node.sourceFile && (
        <p className="mt-1 break-all font-mono text-xs text-neutral-400">{node.sourceFile}</p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Connections</dt>
          <dd className="text-neutral-200">{connections}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Community</dt>
          <dd className="text-neutral-200">#{node.community}</dd>
        </div>
      </dl>
    </div>
  )
}
