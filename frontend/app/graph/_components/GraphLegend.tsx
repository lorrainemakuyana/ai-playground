import { FILE_TYPE_COLORS, FILE_TYPE_LABELS, type FileType } from './types'

interface GraphLegendProps {
  counts: Record<FileType, number>
}

export default function GraphLegend({ counts }: GraphLegendProps) {
  const types = Object.keys(FILE_TYPE_LABELS) as FileType[]
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-3 backdrop-blur">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Node types</p>
      <ul className="space-y-1.5">
        {types
          .filter((t) => counts[t] > 0)
          .map((t) => (
            <li key={t} className="flex items-center gap-2 text-sm text-neutral-200">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: FILE_TYPE_COLORS[t] }} />
              <span className="flex-1">{FILE_TYPE_LABELS[t]}</span>
              <span className="text-xs text-neutral-500">{counts[t]}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
