'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getProject, addAgent, updateAgent, archiveAgent } from '@/lib/api'
import { getInitials, agentBorderClass, agentAvatarClass } from '@/lib/utils'
import type { Agent, AgentRole } from '@/types'
import Spinner from '@/components/Spinner'
import StatusBadge from '@/components/StatusBadge'

const MODELS = [
  { value: 'claude-sonnet-4-6',        label: 'Sonnet 4.6' },
  { value: 'claude-opus-4-7',           label: 'Opus 4.7' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

const ROLE_LABELS: Record<AgentRole, string> = {
  'tech-lead':  'Tech Lead',
  'engineer-1': 'Senior Engineer (1)',
  'engineer-2': 'Senior Engineer (2)',
  'qa':         'QA Engineer',
  'sre':        'SRE',
  'custom':     'Custom',
}

interface AgentCardProps {
  agent: Agent
  taskCount: number
  projectId: string
  onUpdate: (agent: Agent) => void
  onArchive: (agentId: string) => void
}

function AgentCard({ agent, taskCount, projectId, onUpdate, onArchive }: AgentCardProps) {
  const [editing, setEditing] = useState(false)
  const [spec, setSpec] = useState(agent.specialization)
  const [modelName, setModelName] = useState(agent.model_name)
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const roleLabel = ROLE_LABELS[agent.role] ?? agent.role
  const modelLabel = MODELS.find(m => m.value === agent.model_name)?.label ?? agent.model_name

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const updated = await updateAgent(projectId, agent.id, {
        specialization: spec,
        model_name: modelName,
        system_prompt: systemPrompt.trim() || undefined,
      })
      onUpdate(updated)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditing(false)
    setSpec(agent.specialization)
    setModelName(agent.model_name)
    setSystemPrompt(agent.system_prompt ?? '')
    setSaveError('')
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await archiveAgent(projectId, agent.id)
      onArchive(agent.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete agent')
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`bg-neutral-900 border ${agentBorderClass(agent.status)} rounded-xl p-5 flex flex-col gap-4`}>
      {editing ? (
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold uppercase select-none flex-none ${agentAvatarClass(agent.role)}`}>
            {getInitials(agent.role)}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-100 truncate">{agent.specialization}</p>
              <p className="text-xs text-neutral-500">{roleLabel}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-400">Model</label>
              <select
                className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
              >
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-400">Name</label>
              <input
                className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={spec}
                onChange={e => { setSpec(e.target.value); setSaveError('') }}
                placeholder="Agent name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-400">System Prompt <span className="text-neutral-600 font-normal">(optional)</span></label>
              <textarea
                className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y min-h-[72px] font-mono leading-snug"
                placeholder="Define this agent's persona, expertise, and behavior…"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                rows={3}
              />
            </div>
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleCancelEdit}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold uppercase select-none flex-none ${agentAvatarClass(agent.role)}`}>
            {getInitials(agent.role)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-100 truncate">{agent.specialization}</p>
            <p className="text-xs text-neutral-500">{roleLabel}</p>
          </div>
          <StatusBadge status={agent.status} />
        </div>
      )}

      {!editing && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-neutral-950 rounded-lg px-3 py-2.5">
            <p className="text-xs text-neutral-500 mb-0.5">Model</p>
            <p className="text-sm font-medium text-neutral-200 font-mono">{modelLabel}</p>
          </div>
          <div className="bg-neutral-950 rounded-lg px-3 py-2.5">
            <p className="text-xs text-neutral-500 mb-0.5">Tasks</p>
            <p className="text-sm font-medium text-neutral-200">{taskCount}</p>
          </div>
        </div>
      )}

      {!editing && (
        <div className="space-y-2">
          {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
          {!confirming ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button onClick={() => setConfirming(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-red-900 text-neutral-400 hover:text-red-300 transition-colors">
                Delete
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400 flex-1">This cannot be undone.</span>
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-900 hover:bg-red-800 text-red-200 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirming(false)}
                className="px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="pt-1 border-t border-neutral-800">
        <p className="text-xs text-neutral-600 font-mono truncate">ID: {agent.id}</p>
      </div>
    </div>
  )
}

function AddAgentForm({ projectId, onAdded }: { projectId: string; onAdded: (a: Agent) => void }) {
  const [role, setRole] = useState<AgentRole>('custom')
  const [customRoleTitle, setCustomRoleTitle] = useState('')
  const [modelName, setModelName] = useState('claude-sonnet-4-6')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLDivElement>(null)

  const isCustom = role === 'custom'
  const canAdd = !isCustom || customRoleTitle.trim().length >= 2

  async function handleAdd() {
    const specialization = isCustom
      ? customRoleTitle.trim()
      : (ROLE_LABELS[role] ?? role)
    setAdding(true)
    try {
      const agent = await addAgent(projectId, {
        specialization,
        model_name: modelName,
        role,
        system_prompt: systemPrompt.trim() || null,
      })
      onAdded(agent)
      setRole('custom')
      setCustomRoleTitle('')
      setModelName('claude-sonnet-4-6')
      setSystemPrompt('')
      setError('')
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div ref={formRef} className="bg-neutral-900 border border-dashed border-neutral-700 rounded-xl p-5 space-y-3">
      <p className="text-sm font-semibold text-neutral-300">Add agent</p>
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1">Role</label>
        <select
          className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={role}
          onChange={e => { setRole(e.target.value as AgentRole); setError('') }}
        >
          {(Object.entries(ROLE_LABELS) as [AgentRole, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1">Model</label>
        <select
          className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={modelName}
          onChange={e => setModelName(e.target.value)}
        >
          {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      {isCustom && (
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1">Custom role title</label>
          <input
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="e.g. DevOps Engineer, Mobile Developer"
            value={customRoleTitle}
            onChange={e => { setCustomRoleTitle(e.target.value); setError('') }}
            maxLength={100}
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1">
          System Prompt <span className="text-neutral-600 font-normal">(optional)</span>
        </label>
        <textarea
          className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y min-h-[72px] font-mono leading-snug"
          placeholder="Define this agent's persona, expertise, and behavior…"
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={3}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={handleAdd}
        disabled={adding || !canAdd}
        className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-40 transition-colors"
      >
        {adding ? 'Adding…' : 'Add Agent'}
      </button>
    </div>
  )
}

export default function AgentsPage() {
  const params = useParams()
  const projectId = params.id as string

  const [agents, setAgents] = useState<Agent[]>([])
  const [projectName, setProjectName] = useState('')
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await getProject(projectId)
      setAgents(data.agents)
      setProjectName(data.name)
      const counts: Record<string, number> = {}
      for (const task of data.tasks) {
        if (task.assigned_agent_id) {
          counts[task.assigned_agent_id] = (counts[task.assigned_agent_id] ?? 0) + 1
        }
      }
      setTaskCounts(counts)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Spinner /></div>
  )

  if (fetchError) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-sm">{fetchError}</p>
      <Link href={`/app/projects/${projectId}`} className="text-sm text-primary-400 hover:text-primary-300">← Back to Dashboard</Link>
    </div>
  )

  const customAgents = agents.filter(a => !a.is_template_agent)

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <Link href={`/app/projects/${projectId}`} className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
          <span className="text-neutral-700">/</span>
          <Link href={`/app/projects/${projectId}`} className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors truncate max-w-[200px]">
            {projectName || 'Project'}
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-sm font-semibold text-neutral-100">Custom Agents</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <p className="text-sm text-neutral-500">
          These agents are specific to this project and won't affect other projects.{' '}
          <Link href="/app/agents" className="text-primary-400 hover:text-primary-300 transition-colors">
            Click here
          </Link>{' '}
          to manage the default agents added to all new projects.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} taskCount={taskCounts[agent.id] ?? 0}
              projectId={projectId}
              onUpdate={updated => setAgents(prev => prev.map(a => a.id === updated.id ? updated : a))}
              onArchive={id => setAgents(prev => prev.filter(a => a.id !== id))}
            />
          ))}
          <AddAgentForm
            projectId={projectId}
            onAdded={agent => setAgents(prev => [...prev, agent])}
          />
        </div>
      </main>
    </div>
  )
}
