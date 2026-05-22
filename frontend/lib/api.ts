// Server Components need an absolute URL; browser requests go through the Next.js rewrite proxy.
const API_BASE =
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://localhost:8000')
    : '/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function getStoredToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    const message: string = body.detail ?? 'Request failed'

    if (res.status === 401) {
      // Only redirect to /auth when the request is not already from the auth page.
      // Redirecting from /auth causes a page reload that prevents the error from
      // being shown and triggers FrameDoesNotExistError in browser extensions.
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth'
      }
    }

    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export async function register(email: string, password: string) {
  return fetchJSON<{ access_token: string; user_id: string; email: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function login(email: string, password: string) {
  return fetchJSON<{ access_token: string; user_id: string; email: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function logout() {
  return fetchJSON<void>('/auth/logout', { method: 'POST' })
}

export async function getProjects(): Promise<{ projects: import('@/types').ProjectSummary[] }> {
  return fetchJSON<{ projects: import('@/types').ProjectSummary[] }>('/projects')
}

export async function createProject(data: { name: string; description: string }) {
  return fetchJSON<import('@/types').Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getProject(id: string): Promise<import('@/types').Project> {
  return fetchJSON<import('@/types').Project>(`/projects/${id}`)
}

export async function getTasks(projectId: string, filters?: { phase?: string; status?: string }) {
  const params = new URLSearchParams()
  if (filters?.phase)  params.set('phase', filters.phase)
  if (filters?.status) params.set('status', filters.status)
  const query = params.toString() ? `?${params}` : ''
  return fetchJSON<{ tasks: import('@/types').Task[] }>(`/projects/${projectId}/tasks${query}`)
}

export async function addAgent(projectId: string, data: { specialization: string; model_name?: string; role?: import('@/types').AgentRole; system_prompt?: string | null }) {
  return fetchJSON<import('@/types').Agent>(`/projects/${projectId}/agents`, {
    method: 'POST',
    body: JSON.stringify({
      role: data.role ?? 'custom',
      specialization: data.specialization,
      model_name: data.model_name ?? 'claude-sonnet-4-6',
      system_prompt: data.system_prompt ?? null,
    }),
  })
}

export async function updateAgent(projectId: string, agentId: string, data: { specialization?: string; model_name?: string; system_prompt?: string }) {
  return fetchJSON<import('@/types').Agent>(`/projects/${projectId}/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function archiveAgent(projectId: string, agentId: string) {
  return fetchJSON<void>(`/projects/${projectId}/agents/${agentId}`, { method: 'DELETE' })
}

export async function getAgentTemplates() {
  return fetchJSON<import('@/types').AgentTemplate[]>('/agent-templates')
}

export async function createAgentTemplate(data: { role: string; specialization: string; model_name: string; system_prompt?: string | null }) {
  return fetchJSON<import('@/types').AgentTemplate>('/agent-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateAgentTemplate(id: string, data: { specialization?: string; model_name?: string; is_active?: boolean; system_prompt?: string | null }) {
  return fetchJSON<import('@/types').AgentTemplate>(`/agent-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function archiveAgentTemplate(id: string) {
  return fetchJSON<void>(`/agent-templates/${id}`, { method: 'DELETE' })
}

export async function retryTask(projectId: string, taskId: string) {
  return fetchJSON<import('@/types').Task>(`/projects/${projectId}/tasks/${taskId}/retry`, {
    method: 'POST',
  })
}

export async function dispatchNextTask(projectId: string) {
  return fetchJSON<import('@/types').Task>(`/projects/${projectId}/dispatch-next`, {
    method: 'POST',
  })
}

export async function cancelTask(projectId: string, taskId: string) {
  return fetchJSON<import('@/types').Task>(`/projects/${projectId}/tasks/${taskId}/cancel`, {
    method: 'POST',
  })
}

export async function sendDirective(projectId: string, content: string) {
  return fetchJSON<import('@/types').Task>(`/projects/${projectId}/directive`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export interface PreviewInfo {
  project_type: string
  is_web: boolean
  start_command: string
  files: Record<string, string>
  file_count: number
}

export async function getPreviewInfo(projectId: string): Promise<PreviewInfo> {
  return fetchJSON<PreviewInfo>(`/projects/${projectId}/preview-info`)
}

// Sharing
export async function getShares(projectId: string): Promise<import('@/types').ProjectShare[]> {
  return fetchJSON<import('@/types').ProjectShare[]>(`/projects/${projectId}/shares`)
}

export async function inviteByEmail(projectId: string, email: string): Promise<import('@/types').ProjectShare> {
  return fetchJSON<import('@/types').ProjectShare>(`/projects/${projectId}/shares`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function revokeShare(projectId: string, shareId: string): Promise<void> {
  return fetchJSON<void>(`/projects/${projectId}/shares/${shareId}`, { method: 'DELETE' })
}

export async function removeMyShare(projectId: string): Promise<void> {
  return fetchJSON<void>(`/projects/${projectId}/my-share`, { method: 'DELETE' })
}

export async function getShareLink(projectId: string): Promise<import('@/types').ShareLink> {
  return fetchJSON<import('@/types').ShareLink>(`/projects/${projectId}/share-link`, { method: 'POST' })
}

export async function revokeShareLink(projectId: string): Promise<void> {
  return fetchJSON<void>(`/projects/${projectId}/share-link`, { method: 'DELETE' })
}

export async function joinViaLink(token: string): Promise<{ project_id: string }> {
  return fetchJSON<{ project_id: string }>(`/projects/join/${token}`, { method: 'POST' })
}

// Project lifecycle
export async function archiveProject(projectId: string): Promise<import('@/types').ProjectSummary> {
  return fetchJSON<import('@/types').ProjectSummary>(`/projects/${projectId}/archive`, { method: 'PATCH' })
}

export async function unarchiveProject(projectId: string): Promise<import('@/types').ProjectSummary> {
  return fetchJSON<import('@/types').ProjectSummary>(`/projects/${projectId}/unarchive`, { method: 'PATCH' })
}

export async function deleteProject(projectId: string): Promise<void> {
  return fetchJSON<void>(`/projects/${projectId}`, { method: 'DELETE' })
}
