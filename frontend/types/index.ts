export type SDLCPhase =
  | 'discovery'
  | 'architecture'
  | 'implementation'
  | 'testing'
  | 'sre_review'
  | 'done'

export type AgentRole =
  | 'tech-lead'
  | 'engineer-1'
  | 'engineer-2'
  | 'qa'
  | 'sre'
  | 'custom'

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done'
export type TaskStatus  = 'pending' | 'in-progress' | 'review' | 'done' | 'failed' | 'cancelled'
export type ProjectStatus = 'active' | 'paused' | 'done'

export interface Agent {
  id: string
  project_id: string
  role: AgentRole
  specialization: string
  model_name: string
  system_prompt: string | null
  status: AgentStatus
  is_template_agent: boolean
  is_archived: boolean
}

export interface AgentTemplate {
  id: string
  role: AgentRole
  specialization: string
  model_name: string
  system_prompt: string | null
  is_active: boolean
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  assigned_agent_id: string | null
  phase: SDLCPhase
  title: string
  description: string
  status: TaskStatus
  output: string | null
  created_at: string
  updated_at: string
  role: AgentRole | null
}

export interface AgentMessage {
  id: string
  project_id: string
  from_agent_id: string
  to_agent_id: string | null
  content: string
  timestamp: string
}

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  current_phase: SDLCPhase
  created_at: string
  is_owner: boolean
  agents: Agent[]
  tasks: Task[]
  messages: AgentMessage[]
}

export interface ProjectSummary {
  id: string
  name: string
  description: string
  status: ProjectStatus
  current_phase: SDLCPhase
  created_at: string
  archived_at: string | null
  agent_count: number
  task_count: number
  is_owner: boolean
  collaborator_count: number
  share_status: 'active' | 'revoked' | null
  share_id: string | null
}

export interface ProjectShare {
  id: string
  project_id: string
  user_id: string | null
  invited_email: string
  invite_method: 'email' | 'link'
  joined_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface ShareLink {
  id: string
  project_id: string
  token: string
  url: string
  created_at: string
}

export type SSEEvent =
  | { type: 'agent_message';    payload: AgentMessage }
  | { type: 'task_update';      payload: Task }
  | { type: 'phase_change';     payload: { project_id: string; new_phase: SDLCPhase } }
  | { type: 'agent_status';     payload: { agent_id: string; status: AgentStatus } }
  | { type: 'task_output_chunk'; payload: { task_id: string; chunk: string; reset: boolean } }
  | { type: 'heartbeat';        payload: { timestamp: string } }
  | { type: 'error';            payload: { message: string } }
