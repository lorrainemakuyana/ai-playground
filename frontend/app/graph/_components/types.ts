export type FileType = 'code' | 'rationale' | 'concept' | 'document' | 'image'

export interface GraphNode {
  id: string
  label: string
  fileType: FileType
  community: number
  sourceFile: string
}

export interface GraphLink {
  source: string
  target: string
  relation: string
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  builtAtCommit: string | null
}

/** Colour assigned to each file type, used for node fill and the legend. */
export const FILE_TYPE_COLORS: Record<FileType, string> = {
  code: '#8b5cf6',
  concept: '#22d3ee',
  document: '#34d399',
  rationale: '#fbbf24',
  image: '#f472b6',
}

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  code: 'Code',
  concept: 'Concept',
  document: 'Document',
  rationale: 'Rationale',
  image: 'Image',
}
