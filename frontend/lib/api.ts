// Server Components need an absolute URL; browser requests go through the Next.js rewrite proxy.
const API_BASE =
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://localhost:8000')
    : '/api'

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? 'Request failed')
  }
  return res.json()
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

export async function addAgent(projectId: string, data: { specialization: string; model_name?: string }) {
  return fetchJSON<import('@/types').Agent>(`/projects/${projectId}/agents`, {
    method: 'POST',
    body: JSON.stringify({ role: 'custom', specialization: data.specialization, model_name: data.model_name ?? 'claude-sonnet-4-6' }),
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

export async function createAgentTemplate(data: { role: string; specialization: string; model_name: string }) {
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
